import mongoose from "mongoose";
import { StatusCodes } from "http-status-codes";
import Grade from "../models/GradeModel.js";
import Attendance from "../models/AttendanceModel.js";
import Fee from "../models/FeeModel.js";
import ReportCard from "../models/ReportcardModel.js";
import Assignment from "../models/AssignmentModel.js";
import ClassWork from "../models/ClassWorkModel.js";
import Test from "../models/TestModel.js";
import Exam from "../models/ExamModel.js";
import ClassroomSession from "../models/ClassroomSessionModel.js";
import ClassroomAttendance from "../models/ClassroomAttendanceModel.js";
import LessonNote from "../models/LessonNoteModel.js";
import Student from "../models/StudentModel.js";
import Staff from "../models/StaffModel.js";
import Parent from "../models/ParentModel.js";
import Class from "../models/ClassModel.js";
import Notification from "../models/NotificationModel.js";
import Library from "../models/LibraryModel.js";
import NotFoundError from "../errors/not-found.js";
import BadRequestError from "../errors/bad-request.js";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";
import { getIO } from "../utils/socket.js";

const toId = (id) => new mongoose.Types.ObjectId(id);

// Push a freshly-computed dashboard snapshot to the requester's personal socket
// room (joined client-side via `join` with the user's id). This keeps any other
// open tabs/devices for the same user in sync in real time without a manual
// refetch. A socket failure must never break the HTTP response.
const emitDashboard = (req, payload) => {
  const room = (req.user?.userId || req.user?.parentId)?.toString();
  if (!room) return;
  try {
    getIO().to(room).emit("dashboard:update", {
      role: req.user.role,
      term: payload.term,
      session: payload.session,
      data: payload,
    });
  } catch (err) {
    // getIO throws if socket.io isn't initialized — log and move on.
    console.error("[DashboardController] socket emit failed:", err.message);
  }
};

const pct = (obtained, obtainable) =>
  obtainable > 0 ? +((obtained / obtainable) * 100).toFixed(1) : 0;

const submissionRate = (submitted, total) =>
  total > 0 ? +((submitted / total) * 100).toFixed(1) : 0;

const currentTermSession = (query) => {
  const { term: qTerm, session: qSession } = query;
  if (qTerm && qSession) return { term: qTerm, session: qSession };
  const { term, session } = getCurrentTermDetails(
    startTermGenerationDate,
    holidayDurationForEachTerm,
  );
  return { term: qTerm || term, session: qSession || session };
};

// ─── Student ─────────────────────────────────────────────────────────────────

const isAdminOrProprietor = (role) => role === "admin" || role === "proprietor";

export const getStudentDashboard = async (req, res) => {
  const isAdmin = isAdminOrProprietor(req.user.role);
  if (isAdmin && !req.query.userId)
    throw new BadRequestError("studentId query param is required for admin access.");
  const studentId = toId(isAdmin ? req.query.userId : req.user.userId);
  const { term, session } = currentTermSession(req.query);

  const [
    grades,
    attendanceSummary,
    fees,
    reportCard,
    classroomStats,
    totalAssignments,
    submittedAssignments,
    totalClasswork,
    submittedClasswork,
    totalTests,
    submittedTests,
    totalExams,
    submittedExams,
    unreadCount,
  ] = await Promise.all([
    Grade.find({ student: studentId, term, session }).populate(
      "subject",
      "subjectName",
    ),

    Attendance.aggregate([
      { $match: { student: studentId, term, session } },
      {
        $group: {
          _id: null,
          totalPresent: { $sum: "$totalDaysPresent" },
          totalAbsent: { $sum: "$totalDaysAbsent" },
          totalSchoolOpened: { $sum: "$totalDaysSchoolOpened" },
          totalPublicHoliday: { $sum: "$totalDaysPublicHoliday" },
        },
      },
    ]),

    Fee.find({ student: studentId, term, session }).select(
      "amountDue amountPaid status dueDate",
    ),

    ReportCard.findOne({ student: studentId, term, session }).select(
      "position overallPercentage overallMarkObtained overallMarkObtainable teacherComment",
    ),

    // Live classroom sessions this term
    ClassroomAttendance.aggregate([
      { $match: { student: studentId } },
      {
        $lookup: {
          from: "classroomsessions",
          localField: "classroomSession",
          foreignField: "_id",
          as: "cs",
        },
      },
      { $unwind: "$cs" },
      { $match: { "cs.term": term, "cs.session": session } },
      {
        $group: {
          _id: null,
          sessionsAttended: { $sum: 1 },
          totalMinutes: { $sum: { $ifNull: ["$durationMinutes", 0] } },
        },
      },
    ]),

    Assignment.countDocuments({ students: studentId, term, session }),
    Assignment.countDocuments({
      students: studentId,
      "submitted.student": studentId,
      term,
      session,
    }),

    ClassWork.countDocuments({ students: studentId, term, session }),
    ClassWork.countDocuments({
      students: studentId,
      "submitted.student": studentId,
      term,
      session,
    }),

    Test.countDocuments({ students: studentId, term, session }),
    Test.countDocuments({
      students: studentId,
      "submitted.student": studentId,
      term,
      session,
    }),

    Exam.countDocuments({ students: studentId, term, session }),
    Exam.countDocuments({
      students: studentId,
      "submitted.student": studentId,
      term,
      session,
    }),

    Notification.countDocuments({
      recipient: studentId,
      recipientModel: "Student",
      isRead: false,
    }),
  ]);

  const att = attendanceSummary[0] || {
    totalPresent: 0,
    totalAbsent: 0,
    totalSchoolOpened: 0,
    totalPublicHoliday: 0,
  };

  const totalFeeDue = fees.reduce((s, f) => s + (f.amountDue || 0), 0);
  const totalFeePaid = fees.reduce((s, f) => s + (f.amountPaid || 0), 0);

  const avgPercentage =
    grades.length > 0
      ? +(
          grades.reduce((s, g) => s + (g.percentageScore || 0), 0) /
          grades.length
        ).toFixed(1)
      : 0;

  const gradeDistribution = { A: 0, B: 0, C: 0, D: 0, F: 0 };
  grades.forEach((g) => {
    const letter = (g.grade || "F")[0].toUpperCase();
    if (letter in gradeDistribution) gradeDistribution[letter]++;
  });

  const payload = {
    term,
    session,
    academicPerformance: {
      averagePercentage: avgPercentage,
      position: reportCard?.position ?? null,
      overallPercentage: reportCard?.overallPercentage ?? null,
      overallMarkObtained: reportCard?.overallMarkObtained ?? null,
      overallMarkObtainable: reportCard?.overallMarkObtainable ?? null,
      teacherComment: reportCard?.teacherComment ?? null,
      gradeDistribution,
      subjects: grades.map((g) => ({
        subject: g.subject?.subjectName ?? null,
        examScore: g.examScore,
        testsScore: g.testsScore,
        markObtained: g.markObtained,
        markObtainable: g.markObtainable,
        percentageScore: g.percentageScore,
        grade: g.grade,
        remark: g.remark,
      })),
    },
    attendance: {
      rate: pct(att.totalPresent, att.totalSchoolOpened),
      totalPresent: att.totalPresent,
      totalAbsent: att.totalAbsent,
      totalSchoolOpened: att.totalSchoolOpened,
      totalPublicHoliday: att.totalPublicHoliday,
    },
    fees: {
      totalDue: totalFeeDue,
      totalPaid: totalFeePaid,
      outstanding: totalFeeDue - totalFeePaid,
      collectionRate: pct(totalFeePaid, totalFeeDue),
      status: fees[0]?.status ?? "N/A",
      dueDate: fees[0]?.dueDate ?? null,
    },
    submissions: {
      assignments: {
        total: totalAssignments,
        submitted: submittedAssignments,
        rate: submissionRate(submittedAssignments, totalAssignments),
      },
      classwork: {
        total: totalClasswork,
        submitted: submittedClasswork,
        rate: submissionRate(submittedClasswork, totalClasswork),
      },
      tests: {
        total: totalTests,
        submitted: submittedTests,
        rate: submissionRate(submittedTests, totalTests),
      },
      exams: {
        total: totalExams,
        submitted: submittedExams,
        rate: submissionRate(submittedExams, totalExams),
      },
    },
    liveClasses: classroomStats[0] ?? { sessionsAttended: 0, totalMinutes: 0 },
    unreadNotifications: unreadCount,
  };

  emitDashboard(req, payload);
  res.status(StatusCodes.OK).json(payload);
};

// ─── Parent ───────────────────────────────────────────────────────────────────

export const getParentDashboard = async (req, res) => {
  const isAdmin = isAdminOrProprietor(req.user.role);
  if (isAdmin && !req.query.userId)
    throw new BadRequestError("parentId query param is required for admin access.");
  const adminView = isAdmin && req.query.userId;
  const { subRole } = req.user;
  const resolvedParentId = adminView ? req.query.userId : req.user.parentId;
  const { term, session } = currentTermSession(req.query);

  const parentDoc = await Parent.findById(resolvedParentId).select(
    "father.children mother.children guardian.children",
  );
  if (!parentDoc) throw new NotFoundError("Parent not found.");

  let childrenIds = [];
  if (adminView) {
    // Admin sees all children across all sub-accounts
    childrenIds = [
      ...(parentDoc.father?.children ?? []),
      ...(parentDoc.mother?.children ?? []),
      ...(parentDoc.guardian?.children ?? []),
    ];
  } else if (subRole === "father") childrenIds = parentDoc.father?.children ?? [];
  else if (subRole === "mother") childrenIds = parentDoc.mother?.children ?? [];
  else if (subRole === "singleParent") {
    childrenIds = [
      ...(parentDoc.father?.children ?? []),
      ...(parentDoc.mother?.children ?? []),
    ];
  } else {
    // guardian — union all
    childrenIds = [
      ...(parentDoc.father?.children ?? []),
      ...(parentDoc.mother?.children ?? []),
      ...(parentDoc.guardian?.children ?? []),
    ];
  }

  // Deduplicate
  const uniqueIds = [...new Map(childrenIds.map((id) => [id.toString(), id])).values()];

  if (!uniqueIds.length) {
    const emptyPayload = { term, session, children: [] };
    emitDashboard(req, emptyPayload);
    return res.status(StatusCodes.OK).json(emptyPayload);
  }

  const students = await Student.find({ _id: { $in: uniqueIds } }).select(
    "firstName lastName admissionNumber status classId",
  );

  const children = await Promise.all(
    students.map(async (child) => {
      const cId = child._id;

      const [grades, attAgg, fees, reportCard, unread, upcomingExams, upcomingTests] =
        await Promise.all([
          Grade.find({ student: cId, term, session })
            .populate("subject", "subjectName")
            .select("subject markObtained markObtainable percentageScore grade"),

          Attendance.aggregate([
            { $match: { student: cId, term, session } },
            {
              $group: {
                _id: null,
                totalPresent: { $sum: "$totalDaysPresent" },
                totalAbsent: { $sum: "$totalDaysAbsent" },
                totalSchoolOpened: { $sum: "$totalDaysSchoolOpened" },
              },
            },
          ]),

          Fee.find({ student: cId, term, session }).select(
            "amountDue amountPaid status dueDate",
          ),

          ReportCard.findOne({ student: cId, term, session }).select(
            "position overallPercentage teacherComment",
          ),

          Notification.countDocuments({
            recipient: cId,
            recipientModel: "Student",
            isRead: false,
          }),

          Exam.find({ students: cId, term, session, status: "pending" })
            .populate("subject", "subjectName")
            .select("subject date startTime durationTime")
            .sort({ date: 1 })
            .limit(5),

          Test.find({ students: cId, term, session, status: "pending" })
            .populate("subject", "subjectName")
            .select("subject date startTime durationTime")
            .sort({ date: 1 })
            .limit(5),
        ]);

      const att = attAgg[0] ?? { totalPresent: 0, totalAbsent: 0, totalSchoolOpened: 0 };
      const totalDue = fees.reduce((s, f) => s + (f.amountDue || 0), 0);
      const totalPaid = fees.reduce((s, f) => s + (f.amountPaid || 0), 0);
      const avgPct =
        grades.length > 0
          ? +(
              grades.reduce((s, g) => s + (g.percentageScore || 0), 0) / grades.length
            ).toFixed(1)
          : 0;

      return {
        student: {
          _id: child._id,
          name: `${child.firstName} ${child.lastName}`,
          admissionNumber: child.admissionNumber,
          status: child.status,
        },
        academicPerformance: {
          averagePercentage: avgPct,
          position: reportCard?.position ?? null,
          overallPercentage: reportCard?.overallPercentage ?? null,
          teacherComment: reportCard?.teacherComment ?? null,
          subjects: grades.map((g) => ({
            subject: g.subject?.subjectName ?? null,
            markObtained: g.markObtained,
            markObtainable: g.markObtainable,
            percentageScore: g.percentageScore,
            grade: g.grade,
          })),
        },
        attendance: {
          rate: pct(att.totalPresent, att.totalSchoolOpened),
          totalPresent: att.totalPresent,
          totalAbsent: att.totalAbsent,
          totalSchoolOpened: att.totalSchoolOpened,
        },
        fees: {
          totalDue,
          totalPaid,
          outstanding: totalDue - totalPaid,
          status: fees[0]?.status ?? "N/A",
          dueDate: fees[0]?.dueDate ?? null,
        },
        upcoming: {
          exams: upcomingExams.map((e) => ({
            subject: e.subject?.subjectName,
            date: e.date,
            startTime: e.startTime,
            durationTime: e.durationTime,
          })),
          tests: upcomingTests.map((t) => ({
            subject: t.subject?.subjectName,
            date: t.date,
            startTime: t.startTime,
            durationTime: t.durationTime,
          })),
        },
        unreadNotifications: unread,
      };
    }),
  );

  const payload = { term, session, children };
  emitDashboard(req, payload);
  res.status(StatusCodes.OK).json(payload);
};

// ─── Teacher ──────────────────────────────────────────────────────────────────

export const getTeacherDashboard = async (req, res) => {
  const isAdmin = isAdminOrProprietor(req.user.role);
  if (isAdmin && !req.query.userId)
    throw new BadRequestError("teacherId query param is required for admin access.");
  const teacherId = toId(isAdmin ? req.query.userId : req.user.userId);
  const { term, session } = currentTermSession(req.query);

  // Classes where teacher is class teacher or subject teacher
  const myClasses = await Class.find({
    $or: [{ classTeacher: teacherId }, { subjectTeachers: teacherId }],
  }).select("_id className students classTeacher");

  const classIds = myClasses.map((c) => c._id);
  const allStudentIds = [
    ...new Set(myClasses.flatMap((c) => c.students.map((s) => s.toString()))),
  ];

  const [
    gradesByClass,
    lessonNoteStats,
    lessonNoteWeekly,
    liveSessionStats,
    assignmentStats,
    testStats,
    examStats,
    classworkStats,
    attendanceByClass,
    upcomingExams,
    upcomingTests,
    pendingLessonNotes,
    unreadCount,
  ] = await Promise.all([
    // Grade performance per class (teacher's own grades)
    Grade.aggregate([
      { $match: { teacher: teacherId, term, session } },
      {
        $group: {
          _id: "$classId",
          avgPercentage: { $avg: "$percentageScore" },
          totalGrades: { $sum: 1 },
          passed: { $sum: { $cond: [{ $gte: ["$percentageScore", 50] }, 1, 0] } },
          failed: { $sum: { $cond: [{ $lt: ["$percentageScore", 50] }, 1, 0] } },
          gradeA: { $sum: { $cond: [{ $regexMatch: { input: "$grade", regex: /^A/ } }, 1, 0] } },
          gradeB: { $sum: { $cond: [{ $regexMatch: { input: "$grade", regex: /^B/ } }, 1, 0] } },
          gradeC: { $sum: { $cond: [{ $regexMatch: { input: "$grade", regex: /^C/ } }, 1, 0] } },
          gradeD: { $sum: { $cond: [{ $regexMatch: { input: "$grade", regex: /^D/ } }, 1, 0] } },
          gradeF: { $sum: { $cond: [{ $regexMatch: { input: "$grade", regex: /^F/ } }, 1, 0] } },
        },
      },
      {
        $lookup: {
          from: "classes",
          localField: "_id",
          foreignField: "_id",
          as: "classData",
        },
      },
      { $unwind: { path: "$classData", preserveNullAndEmptyArrays: true } },
    ]),

    // Lesson notes — totals
    LessonNote.aggregate([
      { $match: { teacher: teacherId, term, session } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          approved: { $sum: { $cond: ["$approved", 1, 0] } },
          pending: { $sum: { $cond: ["$approved", 0, 1] } },
        },
      },
    ]),

    // Lesson notes — per week
    LessonNote.aggregate([
      { $match: { teacher: teacherId, term, session } },
      {
        $group: {
          _id: "$lessonWeek",
          count: { $sum: 1 },
          approved: { $sum: { $cond: ["$approved", 1, 0] } },
          pending: { $sum: { $cond: ["$approved", 0, 1] } },
        },
      },
      { $sort: { _id: 1 } },
      {
        $project: {
          _id: 0,
          week: "$_id",
          count: 1,
          approved: 1,
          pending: 1,
        },
      },
    ]),

    // Live sessions conducted
    ClassroomSession.aggregate([
      { $match: { teacher: teacherId, term, session, status: "ended" } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalMinutes: {
            $sum: {
              $divide: [{ $subtract: ["$endedAt", "$startedAt"] }, 60000],
            },
          },
          totalQuestions: { $sum: { $size: "$questions" } },
        },
      },
    ]),

    // Assignments
    Assignment.aggregate([
      { $match: { subjectTeacher: teacherId, term, session } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalStudents: { $sum: { $size: "$students" } },
          totalSubmitted: { $sum: { $size: "$submitted" } },
        },
      },
    ]),

    // Tests
    Test.aggregate([
      { $match: { subjectTeacher: teacherId, term, session } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalStudents: { $sum: { $size: "$students" } },
          totalSubmitted: { $sum: { $size: "$submitted" } },
        },
      },
    ]),

    // Exams
    Exam.aggregate([
      { $match: { subjectTeacher: teacherId, term, session } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalStudents: { $sum: { $size: "$students" } },
          totalSubmitted: { $sum: { $size: "$submitted" } },
        },
      },
    ]),

    // Classwork
    ClassWork.aggregate([
      { $match: { subjectTeacher: teacherId, term, session } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          totalStudents: { $sum: { $size: "$students" } },
          totalSubmitted: { $sum: { $size: "$submitted" } },
        },
      },
    ]),

    // Attendance rate per class (classes I am class teacher of)
    classIds.length
      ? Attendance.aggregate([
          { $match: { classId: { $in: classIds }, term, session } },
          {
            $group: {
              _id: "$classId",
              avgPresent: { $avg: "$totalDaysPresent" },
              avgAbsent: { $avg: "$totalDaysAbsent" },
              avgSchoolOpened: { $avg: "$totalDaysSchoolOpened" },
            },
          },
        ])
      : Promise.resolve([]),

    // Upcoming exams (next 5)
    Exam.find({ subjectTeacher: teacherId, term, session, status: "pending" })
      .populate("subject", "subjectName")
      .populate("classId", "className")
      .select("subject classId date startTime durationTime marksObtainable")
      .sort({ date: 1 })
      .limit(5),

    // Upcoming tests (next 5)
    Test.find({ subjectTeacher: teacherId, term, session, status: "pending" })
      .populate("subject", "subjectName")
      .populate("classId", "className")
      .select("subject classId date startTime durationTime marksObtainable")
      .sort({ date: 1 })
      .limit(5),

    // Lesson notes pending approval
    LessonNote.find({ teacher: teacherId, approved: false, term, session })
      .select("topic subTopic lessonWeek lessonDate")
      .sort({ lessonWeek: 1 })
      .limit(5),

    Notification.countDocuments({
      recipient: teacherId,
      recipientModel: "Staff",
      isRead: false,
    }),
  ]);

  const sessions = liveSessionStats[0] ?? { total: 0, totalMinutes: 0, totalQuestions: 0 };

  const assessmentBlock = (stats) => {
    const s = stats[0] ?? { total: 0, totalStudents: 0, totalSubmitted: 0 };
    return {
      total: s.total,
      submissionRate: submissionRate(s.totalSubmitted, s.totalStudents),
    };
  };

  // Attendance — build a map from classId → className
  const classMap = Object.fromEntries(myClasses.map((c) => [c._id.toString(), c.className]));

  const payload = {
    term,
    session,
    overview: {
      classesCount: myClasses.length,
      totalStudents: allStudentIds.length,
    },
    academicPerformance: {
      byClass: gradesByClass.map((g) => ({
        classId: g._id,
        className: g.classData?.className ?? classMap[g._id?.toString()],
        avgPercentage: +g.avgPercentage.toFixed(1),
        totalGrades: g.totalGrades,
        passed: g.passed,
        failed: g.failed,
        passRate: pct(g.passed, g.totalGrades),
        gradeDistribution: {
          A: g.gradeA,
          B: g.gradeB,
          C: g.gradeC,
          D: g.gradeD,
          F: g.gradeF,
        },
      })),
    },
    attendance: {
      byClass: attendanceByClass.map((a) => ({
        classId: a._id,
        className: classMap[a._id?.toString()] ?? null,
        avgDaysPresent: +a.avgPresent.toFixed(1),
        avgDaysAbsent: +a.avgAbsent.toFixed(1),
        avgAttendanceRate: pct(a.avgPresent, a.avgSchoolOpened),
      })),
    },
    lessonNotes: {
      ...(lessonNoteStats[0] ?? { total: 0, approved: 0, pending: 0 }),
      weeklyBreakdown: lessonNoteWeekly,
      pendingItems: pendingLessonNotes,
    },
    liveClasses: {
      total: sessions.total,
      totalMinutes: +sessions.totalMinutes.toFixed(0),
      avgMinutesPerSession:
        sessions.total > 0 ? +(sessions.totalMinutes / sessions.total).toFixed(0) : 0,
      totalQuestionsAsked: sessions.totalQuestions,
    },
    assessments: {
      exams: { ...assessmentBlock(examStats), upcoming: upcomingExams },
      tests: { ...assessmentBlock(testStats), upcoming: upcomingTests },
      assignments: assessmentBlock(assignmentStats),
      classwork: assessmentBlock(classworkStats),
    },
    unreadNotifications: unreadCount,
  };

  emitDashboard(req, payload);
  res.status(StatusCodes.OK).json(payload);
};

// ─── Admin / Proprietor ───────────────────────────────────────────────────────

export const getAdminDashboard = async (req, res) => {
  const { term, session } = currentTermSession(req.query);

  const [
    activeStudents,
    inactiveStudents,
    staffByRole,
    classCount,
    feeStats,
    gradeByClass,
    schoolAttendance,
    persistentAbsentees,
    sessionStatusCounts,
    lessonNoteStats,
    lessonNotePendingCount,
    libraryStats,
    notificationStats,
    recentlyAbsentStudents,
    feeRevenueTrend,
  ] = await Promise.all([
    Student.countDocuments({ status: "active" }),
    Student.countDocuments({ status: "inactive" }),

    // Staff breakdown by role and status
    Staff.aggregate([
      {
        $group: {
          _id: "$role",
          total: { $sum: 1 },
          active: { $sum: { $cond: [{ $eq: ["$status", "active"] }, 1, 0] } },
          verified: { $sum: { $cond: ["$isVerified", 1, 0] } },
        },
      },
    ]),

    Class.countDocuments(),

    // Fee collection stats for this term/session
    Fee.aggregate([
      { $match: { term, session } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalDue: { $sum: "$amountDue" },
          totalPaid: { $sum: "$amountPaid" },
        },
      },
    ]),

    // Academic performance by class
    Grade.aggregate([
      { $match: { term, session } },
      {
        $group: {
          _id: "$classId",
          avgPercentage: { $avg: "$percentageScore" },
          totalGrades: { $sum: 1 },
          passed: { $sum: { $cond: [{ $gte: ["$percentageScore", 50] }, 1, 0] } },
        },
      },
      { $sort: { avgPercentage: -1 } },
      {
        $lookup: {
          from: "classes",
          localField: "_id",
          foreignField: "_id",
          as: "classData",
        },
      },
      { $unwind: { path: "$classData", preserveNullAndEmptyArrays: true } },
    ]),

    // School-wide attendance
    Attendance.aggregate([
      { $match: { term, session } },
      {
        $group: {
          _id: null,
          avgPresent: { $avg: "$totalDaysPresent" },
          avgAbsent: { $avg: "$totalDaysAbsent" },
          avgSchoolOpened: { $avg: "$totalDaysSchoolOpened" },
          totalRecords: { $sum: 1 },
        },
      },
    ]),

    // Students with > 5 absences this term
    Attendance.aggregate([
      { $match: { term, session } },
      { $group: { _id: "$student", totalAbsent: { $sum: "$totalDaysAbsent" } } },
      { $match: { totalAbsent: { $gt: 5 } } },
      { $count: "count" },
    ]),

    // Live session counts by status
    ClassroomSession.aggregate([
      { $match: { term, session } },
      { $group: { _id: "$status", count: { $sum: 1 } } },
    ]),

    // Lesson note stats
    LessonNote.aggregate([
      { $match: { term, session } },
      {
        $group: {
          _id: null,
          total: { $sum: 1 },
          approved: { $sum: { $cond: ["$approved", 1, 0] } },
          pending: { $sum: { $cond: ["$approved", 0, 1] } },
        },
      },
    ]),

    LessonNote.countDocuments({ approved: false, term, session }),

    // Library
    Library.aggregate([
      {
        $group: {
          _id: null,
          totalTitles: { $sum: 1 },
          totalCopies: { $sum: "$availableCopies" },
          borrowed: {
            $sum: {
              $cond: [{ $gt: [{ $size: "$borrowedBy" }, 0] }, 1, 0],
            },
          },
        },
      },
    ]),

    // Unread notifications per recipient model
    Notification.aggregate([
      { $match: { isRead: false } },
      { $group: { _id: "$recipientModel", count: { $sum: 1 } } },
    ]),

    // Top 10 most recently absent students
    Attendance.aggregate([
      { $match: { term, session, morningStatus: "absent" } },
      { $sort: { date: -1 } },
      {
        $group: {
          _id: "$student",
          lastAbsent: { $first: "$date" },
          totalAbsent: { $sum: "$totalDaysAbsent" },
        },
      },
      { $sort: { totalAbsent: -1 } },
      { $limit: 10 },
      {
        $lookup: {
          from: "students",
          localField: "_id",
          foreignField: "_id",
          as: "studentData",
        },
      },
      { $unwind: { path: "$studentData", preserveNullAndEmptyArrays: true } },
      {
        $project: {
          _id: 1,
          lastAbsent: 1,
          totalAbsent: 1,
          name: {
            $concat: [
              { $ifNull: ["$studentData.firstName", ""] },
              " ",
              { $ifNull: ["$studentData.lastName", ""] },
            ],
          },
        },
      },
    ]),

    // Monthly fee revenue (installment payments grouped by month)
    Fee.aggregate([
      { $match: { term, session } },
      { $unwind: "$installments" },
      {
        $group: {
          _id: {
            year: { $year: "$installments.datePaid" },
            month: { $month: "$installments.datePaid" },
          },
          collected: { $sum: "$installments.amount" },
        },
      },
      { $sort: { "_id.year": 1, "_id.month": 1 } },
    ]),
  ]);

  // Process fee totals
  const feeTotals = { totalDue: 0, totalPaid: 0, paid: 0, pending: 0, overdue: 0 };
  feeStats.forEach((f) => {
    feeTotals.totalDue += f.totalDue ?? 0;
    feeTotals.totalPaid += f.totalPaid ?? 0;
    if (f._id === "Paid") feeTotals.paid = f.count;
    else if (f._id === "Pending") feeTotals.pending = f.count;
    else if (f._id === "Overdue") feeTotals.overdue = f.count;
  });
  feeTotals.outstanding = feeTotals.totalDue - feeTotals.totalPaid;
  feeTotals.collectionRate = pct(feeTotals.totalPaid, feeTotals.totalDue);

  const att = schoolAttendance[0] ?? {
    avgPresent: 0,
    avgAbsent: 0,
    avgSchoolOpened: 0,
    totalRecords: 0,
  };

  const sessionMap = {};
  sessionStatusCounts.forEach((s) => {
    sessionMap[s._id] = s.count;
  });

  const notifMap = {};
  notificationStats.forEach((n) => {
    notifMap[n._id] = n.count;
  });

  const staffMap = {};
  staffByRole.forEach((s) => {
    staffMap[s._id] = { total: s.total, active: s.active, verified: s.verified };
  });

  const payload = {
    term,
    session,
    overview: {
      students: { active: activeStudents, inactive: inactiveStudents },
      classes: classCount,
      staff: staffMap,
    },
    fees: {
      ...feeTotals,
      revenueTrend: feeRevenueTrend.map((r) => ({
        year: r._id.year,
        month: r._id.month,
        collected: r.collected,
      })),
    },
    academicPerformance: {
      byClass: gradeByClass.map((g) => ({
        classId: g._id,
        className: g.classData?.className ?? null,
        avgPercentage: +g.avgPercentage.toFixed(1),
        totalGrades: g.totalGrades,
        passRate: pct(g.passed, g.totalGrades),
      })),
      schoolAvgPercentage:
        gradeByClass.length > 0
          ? +(
              gradeByClass.reduce((s, g) => s + g.avgPercentage, 0) / gradeByClass.length
            ).toFixed(1)
          : 0,
    },
    attendance: {
      schoolWideRate: pct(att.avgPresent, att.avgSchoolOpened),
      avgDaysPresent: +att.avgPresent.toFixed(1),
      avgDaysAbsent: +att.avgAbsent.toFixed(1),
      totalRecords: att.totalRecords,
      studentsWithExcessiveAbsences: persistentAbsentees[0]?.count ?? 0,
      recentlyAbsent: recentlyAbsentStudents,
    },
    liveClasses: {
      scheduled: sessionMap["scheduled"] ?? 0,
      live: sessionMap["live"] ?? 0,
      ended: sessionMap["ended"] ?? 0,
      total: Object.values(sessionMap).reduce((s, v) => s + v, 0),
    },
    lessonNotes: {
      ...(lessonNoteStats[0] ?? { total: 0, approved: 0, pending: 0 }),
      pendingApprovalCount: lessonNotePendingCount,
    },
    library: libraryStats[0] ?? { totalTitles: 0, totalCopies: 0, borrowed: 0 },
    notifications: {
      unreadByRole: notifMap,
      totalUnread: Object.values(notifMap).reduce((s, v) => s + v, 0),
    },
  };

  emitDashboard(req, payload);
  res.status(StatusCodes.OK).json(payload);
};

// ─── Non-teaching Staff ───────────────────────────────────────────────────────

export const getStaffDashboard = async (req, res) => {
  const isAdmin = isAdminOrProprietor(req.user.role);
  if (isAdmin && !req.query.userId)
    throw new BadRequestError("staffId query param is required for admin access.");
  const staffId = toId(isAdmin ? req.query.userId : req.user.userId);
  const { term, session } = currentTermSession(req.query);

  const [
    activeStudents,
    feeStats,
    attendanceSummary,
    overdueStudents,
    lessonNotePending,
    libraryStats,
    unreadCount,
  ] = await Promise.all([
    Student.countDocuments({ status: "active" }),

    Fee.aggregate([
      { $match: { term, session } },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalDue: { $sum: "$amountDue" },
          totalPaid: { $sum: "$amountPaid" },
        },
      },
    ]),

    Attendance.aggregate([
      { $match: { term, session } },
      {
        $group: {
          _id: null,
          avgPresent: { $avg: "$totalDaysPresent" },
          avgAbsent: { $avg: "$totalDaysAbsent" },
          avgSchoolOpened: { $avg: "$totalDaysSchoolOpened" },
          totalRecords: { $sum: 1 },
        },
      },
    ]),

    // Students with overdue fees
    Fee.countDocuments({ term, session, status: "Overdue" }),

    // Lesson notes awaiting approval
    LessonNote.countDocuments({ approved: false, term, session }),

    Library.aggregate([
      {
        $group: {
          _id: null,
          totalTitles: { $sum: 1 },
          totalCopies: { $sum: "$availableCopies" },
          borrowed: {
            $sum: { $cond: [{ $gt: [{ $size: "$borrowedBy" }, 0] }, 1, 0] },
          },
        },
      },
    ]),

    Notification.countDocuments({
      recipient: staffId,
      recipientModel: "Staff",
      isRead: false,
    }),
  ]);

  const feeTotals = { totalDue: 0, totalPaid: 0, paid: 0, pending: 0, overdue: 0 };
  feeStats.forEach((f) => {
    feeTotals.totalDue += f.totalDue ?? 0;
    feeTotals.totalPaid += f.totalPaid ?? 0;
    if (f._id === "Paid") feeTotals.paid = f.count;
    else if (f._id === "Pending") feeTotals.pending = f.count;
    else if (f._id === "Overdue") feeTotals.overdue = f.count;
  });
  feeTotals.outstanding = feeTotals.totalDue - feeTotals.totalPaid;
  feeTotals.collectionRate = pct(feeTotals.totalPaid, feeTotals.totalDue);

  const att = attendanceSummary[0] ?? { avgPresent: 0, avgAbsent: 0, avgSchoolOpened: 0, totalRecords: 0 };

  const payload = {
    term,
    session,
    overview: {
      activeStudents,
    },
    fees: {
      ...feeTotals,
      overdueStudents,
    },
    attendance: {
      schoolWideRate: pct(att.avgPresent, att.avgSchoolOpened),
      avgDaysPresent: +att.avgPresent.toFixed(1),
      avgDaysAbsent: +att.avgAbsent.toFixed(1),
      totalRecords: att.totalRecords,
    },
    lessonNotes: {
      pendingApprovalCount: lessonNotePending,
    },
    library: libraryStats[0] ?? { totalTitles: 0, totalCopies: 0, borrowed: 0 },
    unreadNotifications: unreadCount,
  };

  emitDashboard(req, payload);
  res.status(StatusCodes.OK).json(payload);
};
