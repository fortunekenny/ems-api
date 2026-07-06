import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import InternalServerError from "../errors/internal-server-error.js";
import NotFoundError from "../errors/not-found.js";
import UnauthorizedError from "../errors/unauthorize.js";
import Attendance from "../models/AttendanceModel.js";
import Class from "../models/ClassModel.js";
import Fee from "../models/FeeModel.js";
import Grade from "../models/GradeModel.js";
import Parent from "../models/ParentModel.js";
import ReportCard from "../models/ReportcardModel.js";
import StudentAnswer from "../models/StudentAnswerModel.js";
import Student from "../models/StudentModel.js";
import Subject from "../models/SubjectModel.js";
import calculateAge from "../utils/ageCalculate.js";
import {
  getCurrentTermDetails,
  holidayDurationForEachTerm,
  startTermGenerationDate,
} from "../utils/termGenerator.js";
import {
  academicPopulatePaths,
  findTermRecord,
  findGroupByTerm,
  classIdForTerm,
  moveTermToClass,
} from "../utils/academicRecords.js";

// Get all students
export const getStudents = async (req, res, next) => {
  try {
    // Define allowed query parameters
    const allowedFilters = [
      "student", // combined filter for firstName, middleName, lastName, studentId
      "className",
      "status",
      "studentID",
      "term",
      "session",
      "sort",
      "page",
      "limit",
    ];

    // Get provided query keys
    const providedFilters = Object.keys(req.query);

    // Check for unknown parameters (ignore case differences if needed)
    const unknownFilters = providedFilters.filter(
      (key) => !allowedFilters.includes(key),
    );

    if (unknownFilters.length > 0) {
      // Return error if unknown parameters are present
      throw new BadRequestError(
        `Unknown query parameter(s): ${unknownFilters.join(", ")}`,
      );
    }

    const { student, className, status, term, session, sort, page, limit } =
      req.query;

    // Build an initial match stage for fields stored directly on Student
    const matchStage = {};

    // if (term) matchStage.term = { $regex: term, $options: "i" };
    // if (session) matchStage.session = session;
    if (status) matchStage.status = status;

    // Here we use $or on firstName, middleName, lastName, and studentID if the 'student' parameter is provided.
    if (student) {
      matchStage.$or = [
        { firstName: { $regex: student, $options: "i" } },
        { middleName: { $regex: student, $options: "i" } },
        { lastName: { $regex: student, $options: "i" } },
        { studentID: { $regex: student, $options: "i" } },
      ];
    }

    // NOTE: session lives on the class group; term lives under its nested terms[]
    if (session) matchStage["academicRecords.session"] = session;
    if (term)
      matchStage["academicRecords.terms.term"] = { $regex: term, $options: "i" };

    const pipeline = [];
    pipeline.push({ $match: matchStage });

    // unwind the class groups, then their terms, so we can filter/project on term
    pipeline.push({ $unwind: "$academicRecords" });
    pipeline.push({
      $unwind: { path: "$academicRecords.terms", preserveNullAndEmptyArrays: true },
    });

    // Lookup to join class data from the "classes" collection
    pipeline.push({
      $lookup: {
        from: "classes",
        localField: "academicRecords.classId",
        foreignField: "_id",
        as: "classData",
      },
    });
    pipeline.push({ $unwind: "$classData" });

    // Build additional matching criteria based on joined fields.
    const joinMatch = {};

    if (className) {
      joinMatch["classData.className"] = {
        $regex: `^${className}$`,
        $options: "i",
      };
    }

    if (Object.keys(joinMatch).length > 0) {
      pipeline.push({ $match: joinMatch });
    }

    // Sorting stage: define sort options.
    // Adjust the sort options to suit your requirements.
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "a-z": { firstName: 1 },
      "z-a": { firstName: -1 },
    };
    const sortKey = sortOptions[sort] || sortOptions.newest;
    pipeline.push({ $sort: sortKey });

    // Pagination stages: Calculate skip and limit.
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    pipeline.push({ $skip: (pageNumber - 1) * limitNumber });
    pipeline.push({ $limit: limitNumber });

    // Projection stage: structure the output.
    pipeline.push({
      $project: {
        _id: 1,
        firstName: 1,
        middleName: 1,
        lastName: 1,
        classData: {
          _id: "$classData._id",
          className: "$classData.className",
        },
        studentID: 1,
        status: 1,
        isVerified: 1,
        createdAt: 1,
        term: "$academicRecords.terms.term",
        session: "$academicRecords.session",
        // Include other fields from student if needed.
      },
    });

    // Execute the aggregation pipeline
    const students = await Student.aggregate(pipeline);

    // Count total matching documents for pagination.
    // We use a similar pipeline without $skip, $limit, $sort, and $project.
    const countPipeline = pipeline.filter(
      (stage) =>
        !(
          "$skip" in stage ||
          "$limit" in stage ||
          "$sort" in stage ||
          "$project" in stage
        ),
    );
    countPipeline.push({ $count: "total" });
    const countResult = await Student.aggregate(countPipeline);
    const totalStudents = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalStudents / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalStudents,
      numOfPages,
      currentPage: pageNumber,
      students,
    });
  } catch (error) {
    console.log("Error getting all students:", error);
    next(new InternalServerError(error.message));
  }
};

/**
 * Per-student performance roll-up for the admin Students list.
 * Aggregates grades, attendance and fees server-side (one query each) and
 * returns a map keyed by studentId:
 *   { [studentId]: { avgPercentage, passRate, totalGrades,
 *                    attendanceRate, feesOutstanding } }
 * Optional ?term= & ?session= scope all three; omitted = all-time.
 */
export const getStudentsStats = async (req, res, next) => {
  try {
    const { term, session } = req.query;
    const scope = {};
    if (term) scope.term = term;
    if (session) scope.session = session;

    const round = (n) => Math.round((n + Number.EPSILON) * 10) / 10;
    const idStr = (v) => (v == null ? "" : v.toString());

    // ── Grades: avg %, pass rate (>= 50), total count ──────────────────────
    const gradeAgg = await Grade.aggregate([
      { $match: scope },
      {
        $group: {
          _id: "$student",
          totalGrades: { $sum: 1 },
          avgPercentage: { $avg: "$percentageScore" },
          passed: {
            $sum: { $cond: [{ $gte: ["$percentageScore", 50] }, 1, 0] },
          },
        },
      },
    ]);

    // ── Attendance: present sessions / opened sessions (present + absent) ──
    const present = ["present"];
    const opened = ["present", "absent"];
    const attendanceAgg = await Attendance.aggregate([
      { $match: scope },
      {
        $group: {
          _id: "$student",
          present: {
            $sum: {
              $add: [
                { $cond: [{ $in: ["$morningStatus", present] }, 1, 0] },
                { $cond: [{ $in: ["$afternoonStatus", present] }, 1, 0] },
              ],
            },
          },
          opened: {
            $sum: {
              $add: [
                { $cond: [{ $in: ["$morningStatus", opened] }, 1, 0] },
                { $cond: [{ $in: ["$afternoonStatus", opened] }, 1, 0] },
              ],
            },
          },
        },
      },
    ]);

    // ── Fees: outstanding = amountDue - amountPaid ─────────────────────────
    const feeAgg = await Fee.aggregate([
      { $match: scope },
      {
        $group: {
          _id: "$student",
          due: { $sum: "$amountDue" },
          paid: { $sum: "$amountPaid" },
        },
      },
    ]);

    const stats = {};
    const ensure = (id) => {
      const key = idStr(id);
      if (!stats[key]) {
        stats[key] = {
          avgPercentage: null,
          passRate: null,
          totalGrades: 0,
          attendanceRate: null,
          feesOutstanding: 0,
        };
      }
      return stats[key];
    };

    for (const g of gradeAgg) {
      const s = ensure(g._id);
      s.totalGrades = g.totalGrades;
      s.avgPercentage = g.totalGrades ? round(g.avgPercentage) : null;
      s.passRate = g.totalGrades ? round((g.passed / g.totalGrades) * 100) : null;
    }
    for (const a of attendanceAgg) {
      const s = ensure(a._id);
      s.attendanceRate = a.opened ? round((a.present / a.opened) * 100) : null;
    }
    for (const f of feeAgg) {
      const s = ensure(f._id);
      s.feesOutstanding = Math.max(0, (f.due || 0) - (f.paid || 0));
    }

    res.status(StatusCodes.OK).json({ stats });
  } catch (error) {
    console.log("Error getting student stats:", error);
    next(new InternalServerError(error.message));
  }
};

export const updateStudentVerification = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { isVerified } = req.body;
    const { role } = req.user;

    // Only admin or proprietor allowed
    if (role !== "admin" && role !== "proprietor") {
      throw new UnauthorizedError(
        "Only admin or proprietor can update student verification status",
      );
    }

    if (typeof isVerified !== "boolean") {
      throw new BadRequestError("isVerified must be a boolean");
    }

    const student = await Student.findById(studentId);
    if (!student) {
      throw new NotFoundError(`Student not found`);
    }

    if (student.isVerified === isVerified) {
      throw new BadRequestError(
        `Student verification status is already '${isVerified}'`,
      );
    }

    student.isVerified = isVerified;
    await student.save();

    res.status(StatusCodes.OK).json({
      message: `Student verified successfully`,
    });
  } catch (error) {
    console.log("Error updating student verification:", error);
    next(new InternalServerError(error.message));
  }
};

// Get a student by ID
/* export const getStudentById = async (req, res) => {
  try {
    const { id: studentId } = req.params;
    const student = await Student.findOne({ _id: studentId }).select(
      "-password",
    );


    if (!student) {
      throw new NotFoundError(`Student not found`);
    }

    // checkPermissions(req.user, student.user);

    res.status(StatusCodes.OK).json(student);
  } catch (error) {
    console.error("Error getting student by ID:", error);
    next(new InternalServerError(error.message));
  }
}; */

export const getStudentById = async (req, res, next) => {
  try {
    const { userId, role, subRole } = req.user; // subRole: 'father' | 'mother' | 'singleParent'
    const { id: studentId } = req.params;

    /* if (role === "student") {
      // ❌ Deny access if a student tries to access another student's profile
      if (userId !== studentId) {
        throw new UnauthorizedError(
          "You are not allowed to access this student record",
        );
      }
    } */

    /* if (role === "parent") {
      // ❌ Check that the subRole exists and is valid
      if (!["father", "mother", "singleParent"].includes(subRole)) {
        throw new UnauthorizedError("Invalid subRole for parent");
      }

      // ✅ Find parent document that contains the userId inside the specified subRole
      const parent = await Parent.findOne({
        [`${subRole}._id`]: userId,
        [`${subRole}.children`]: studentId,
      });

      if (!parent) {
        throw new UnauthorizedError(
          "You are not allowed to access this student record",
        );
      }
    } */

    // ✅ At this point, access is authorized.
    // Load the student with each academic-record reference list populated.
    const studentDoc = await Student.findOne({ _id: studentId })
      .select("-password")
      .populate(academicPopulatePaths);

    if (!studentDoc) {
      throw new NotFoundError("Student not found");
    }

    const student = studentDoc.toObject();

    // Back-fill any list that wasn't stored/populated on a record by querying
    // each source collection for everything that references this student id,
    // scoped to that record's class & term. We scope on classId (an ObjectId
    // present on the group and on every related doc) rather than the session
    // string, because session strings drift between collections (spacing, etc.)
    // and silently exclude matches. classId is session-specific, so class + term
    // is both precise and robust. Only fall back to the session string when the
    // group has no classId. Term is matched case-insensitively ("first"/"First").
    const ci = (v) => (v ? new RegExp(`^${String(v).trim()}$`, "i") : undefined);

    await Promise.all(
      (student.academicRecords ?? []).flatMap((group) => {
        const classId = group.classId?._id ?? group.classId;
        return (group.terms ?? []).map(async (rec) => {
          const scope = { student: studentId };
          if (classId) scope.classId = classId;
          else if (group.session) scope.session = group.session;
          if (rec.term) scope.term = ci(rec.term);

          const answersOf = (type) =>
            StudentAnswer.find({ ...scope, evaluationType: ci(type) });

          const [
            attendance,
            assignments,
            classworks,
            tests,
            subjects,
            exam,
            reportCard,
          ] = await Promise.all([
            rec.attendance?.length ? null : Attendance.find(scope),
            rec.assignments?.length ? null : answersOf("Assignment"),
            rec.classworks?.length ? null : answersOf("ClassWork"),
            rec.tests?.length ? null : answersOf("Test"),
            rec.subjects?.length
              ? null
              : Subject.find(
                  classId
                    ? { students: studentId, classId }
                    : {
                        students: studentId,
                        ...(group.session ? { session: group.session } : {}),
                        ...(rec.term ? { term: ci(rec.term) } : {}),
                      },
                ).select("_id subjectName subjectCode classId term session"),
            // exam and reportCard are single refs (not lists) on the term entry,
            // per the Student model. Resolve them from their own collections when
            // they weren't linked at creation time.
            rec.exam
              ? null
              : StudentAnswer.findOne({ ...scope, evaluationType: ci("Exam") }),
            rec.reportCard ? null : ReportCard.findOne(scope),
          ]);

          if (attendance) rec.attendance = attendance;
          if (assignments) rec.assignments = assignments;
          if (classworks) rec.classworks = classworks;
          if (tests) rec.tests = tests;
          if (subjects) rec.subjects = subjects;
          if (exam) rec.exam = exam;
          if (reportCard) rec.reportCard = reportCard;

          // Normalize to the full term shape defined by the Student model so no
          // field is ever missing from the response — lists default to [] and
          // single refs to null even when there's genuinely nothing linked.
          rec.attendance = rec.attendance ?? [];
          rec.assignments = rec.assignments ?? [];
          rec.classworks = rec.classworks ?? [];
          rec.tests = rec.tests ?? [];
          rec.subjects = rec.subjects ?? [];
          rec.exam = rec.exam ?? null;
          rec.reportCard = rec.reportCard ?? null;
        });
      }),
    );

    // ── Reconcile orphaned work ────────────────────────────────────────────
    // The back-fill above only fills term entries that ALREADY exist in
    // academicRecords. But a student can have real work (submissions, attendance,
    // report cards) for a (session, term) their academicRecords was never
    // extended to — e.g. a new session where no record group was created, yet
    // assignments were done. That work would otherwise stay invisible. Here we
    // synthesize a group for any (session, term) that has source data but no
    // matching academicRecords entry, so the response reflects all real work.
    const termKey = (session, term) =>
      `${session ?? ""}|${String(term ?? "").toLowerCase()}`;

    const representedKeys = new Set();
    for (const g of student.academicRecords ?? []) {
      for (const t of g.terms ?? []) representedKeys.add(termKey(g.session, t.term));
    }

    const [allAnswers, allAttendance, allReports] = await Promise.all([
      StudentAnswer.find({ student: studentId }).lean(),
      Attendance.find({ student: studentId }).lean(),
      ReportCard.find({ student: studentId }).lean(),
    ]);

    const emptyTerm = (term) => ({
      term,
      attendance: [],
      assignments: [],
      classworks: [],
      tests: [],
      exam: null,
      reportCard: null,
      subjects: [],
    });
    const buckets = new Map(); // (session|term) -> { session, term, classId, rec }
    const getBucket = (session, term, classId) => {
      const k = termKey(session, term);
      if (!buckets.has(k)) buckets.set(k, { session, term, classId, rec: emptyTerm(term) });
      const b = buckets.get(k);
      if (!b.classId && classId) b.classId = classId;
      return b;
    };
    for (const a of allAnswers) {
      const b = getBucket(a.session, a.term, a.classId).rec;
      const et = String(a.evaluationType || "").toLowerCase();
      if (et === "assignment") b.assignments.push(a);
      else if (et === "classwork") b.classworks.push(a);
      else if (et === "test") b.tests.push(a);
      else if (et === "exam") b.exam = a;
    }
    for (const at of allAttendance) getBucket(at.session, at.term, at.classId).rec.attendance.push(at);
    for (const rc of allReports) getBucket(rc.session, rc.term, rc.classId).rec.reportCard = rc;

    const missing = [...buckets.values()].filter(
      (b) => (b.session || b.term) && !representedKeys.has(termKey(b.session, b.term)),
    );
    if (missing.length) {
      const classIds = [
        ...new Set(missing.map((b) => String(b.classId)).filter((x) => x && x !== "undefined")),
      ];
      const classes = classIds.length
        ? await Class.find({ _id: { $in: classIds } }).select("_id className").lean()
        : [];
      const classMap = new Map(classes.map((c) => [String(c._id), c]));

      for (const b of missing) {
        b.rec.subjects = b.classId
          ? await Subject.find({ students: studentId, classId: b.classId })
              .select("_id subjectName subjectCode classId term session")
              .lean()
          : [];
        student.academicRecords.push({
          session: b.session,
          classId: b.classId ? classMap.get(String(b.classId)) ?? { _id: b.classId } : null,
          terms: [b.rec],
          reconciled: true, // synthesized from source data, not stored on the doc
        });
      }
    }

    res.status(StatusCodes.OK).json(student);
  } catch (error) {
    console.log("Error getting student by ID:", error);
    next(new InternalServerError(error.message));
  }
};

// Update student details
export const updateStudent = async (req, res, next) => {
  const { id: studentId } = req.params;
  const {
    firstName,
    middleName,
    lastName,
    houseNumber,
    streetName,
    townOrCity,
    dateOfBirth,
    term,
    session,
    gender,
    email,
    parentGuardianId,
    classId,
  } = req.body; // Fields to update

  try {
    // Find the student by ID
    const student = await Student.findById(studentId);
    if (!student) {
      throw new NotFoundError(`Student not found`);
    }

    // Check for duplicate email
    if (email && email !== student.email) {
      const emailAlreadyExists = await Student.findOne({ email });
      if (emailAlreadyExists) {
        throw new BadRequestError("Email already exists.");
      }
    }

    // checkPermissions(req.user, student.user);

    // Step 1: Remove student from previous parentGuardianId (if parentGuardianId changes)
    if (
      parentGuardianId &&
      parentGuardianId !== student.parentGuardianId.toString()
    ) {
      const previousGuardian = await Parent.findById(student.parentGuardianId);
      if (previousGuardian) {
        // Remove student from the previous parentGuardianId's children array
        previousGuardian.children.pull(student._id);
        await previousGuardian.save();
      }

      const newGuardian = await Parent.findById(parentGuardianId);
      if (!newGuardian) {
        throw new NotFoundError(
          `Guardian with id ${parentGuardianId} not found`,
        );
      }
      student.parentGuardianId = parentGuardianId; // Update the student's parentGuardianId
      newGuardian.children.push(student._id); // Add the student to the new parentGuardianId
      await newGuardian.save();
    }

    // Step 2: Change class within the current term/session embedded record
    if (classId && term && session) {
      // 2a) Locate the class group + term entry for this term/session
      const record = findTermRecord(student, { term, session });
      const group = findGroupByTerm(student, { term, session });
      if (!record || !group) {
        throw new BadRequestError(
          `No academic record found for term '${term}' and session '${session}'`,
        );
      }

      const previousClassId = group.classId?.toString();

      // 2b) Remove student from previous class (if any)
      if (previousClassId && previousClassId !== classId) {
        const previousClass = await Class.findById(previousClassId);
        if (previousClass) {
          previousClass.students.pull(student._id);
          await previousClass.save();
        }

        // Remove from previous class's subjects
        if (previousClass && previousClass.subjects?.length) {
          const prevSubjects = await Subject.find({
            _id: { $in: previousClass.subjects },
          });
          for (const subj of prevSubjects) {
            subj.students.pull(student._id);
            await subj.save();
          }
        }
      }

      // 2c) Add student to the new class
      const newClass = await Class.findById(classId);
      if (!newClass) {
        throw new NotFoundError(`Class with id ${classId} not found`);
      }
      if (!newClass.students.includes(student._id)) {
        newClass.students.push(student._id);
        await newClass.save();
      }

      // 2d) Add student to the new class's subjects
      if (newClass.subjects?.length) {
        for (const subjId of newClass.subjects) {
          await Subject.updateOne(
            { _id: subjId },
            { $addToSet: { students: student._id } },
          );
        }
      }

      // 2e) Relocate the term entry to the new class's group (classId lives on
      //     the group), preserving its attendance/answers, and reset subjects.
      //     Persisted by the student.save() below.
      moveTermToClass(student, {
        term,
        session,
        classId,
        subjects: newClass.subjects,
      });
    }

    let age;
    try {
      if (dateOfBirth) {
        age = calculateAge(dateOfBirth);
      }
    } catch (err) {
      console.warn("Skipping age calculation:", err.message);
    }

    // Then update any root‐level personal fields:
    Object.assign(student, {
      firstName: firstName ?? student.firstName,
      middleName: middleName ?? student.middleName,
      lastName: lastName ?? student.lastName,
      houseNumber: houseNumber ?? student.houseNumber,
      streetName: streetName ?? student.streetName,
      townOrCity: townOrCity ?? student.townOrCity,
      dateOfBirth: dateOfBirth ?? student.dateOfBirth,
      age: age ?? student.age,
      gender: gender ?? student.gender,
      email: email ?? student.email,
    });

    // Save the updated student record
    await student.save();

    const updatedStudent = await Student.findById(student._id).select(
      "-password",
    );

    res.status(StatusCodes.OK).json({
      message: "Student updated successfully",
      updatedStudent,
    });
  } catch (error) {
    console.log("Error updating student:", error);
    next(new BadRequestError(error.message));
  }
};

// Update student status
export const updateStudentStatus = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { status } = req.body; // Status to update (active or inactive)

    // Ensure status is valid
    if (!["active", "inactive"].includes(status)) {
      throw new BadRequestError(
        "Invalid status. Allowed values are 'active' or 'inactive'.",
      );
    }

    // Find the student
    const student = await Student.findById(studentId);

    if (!student) {
      throw new NotFoundError(`Student not found`);
    }

    student.previousStatus = student.status; // Store the previous status

    // Update the student's status
    student.status = status;
    await student.save();

    res.status(StatusCodes.OK).json({
      message: `Student status updated successfully.`,
    });
  } catch (error) {
    console.log("Error updating student:", error);
    next(new BadRequestError(error.message));
  }
};

export const addStudentToParent = async (req, res, next) => {
  try {
    const { studentId } = req.params; // student ID from URL
    const { parentId, parentRole } = req.body; // parentId and role (father, mother, singleParent) from body
    const { role } = req.user;

    // Only admin or proprietor can perform this action
    if (role !== "admin" && role !== "proprietor") {
      throw new UnauthorizedError(
        "Only admin or proprietor can add students to a parent",
      );
    }

    // Validate parentRole
    if (!["father", "mother", "singleParent"].includes(parentRole)) {
      throw new BadRequestError("Invalid parentRole specified");
    }

    // Find the parent document
    const parent = await Parent.findById(parentId);
    if (!parent) {
      throw new NotFoundError("Parent record not found");
    }

    const targetSection = parent[parentRole];

    if (!targetSection) {
      throw new NotFoundError(`No data found under ${parentRole}`);
    }

    if (!Array.isArray(targetSection.children)) {
      targetSection.children = [];
    }

    if (targetSection.children.includes(studentId)) {
      throw new BadRequestError("Student already linked to this parent role");
    }

    targetSection.children.push(studentId);
    await parent.save();

    res.status(StatusCodes.OK).json({
      message: `Student successfully added to ${parentRole}`,
    });
  } catch (error) {
    console.log("Add student error:", error);
    next(new InternalServerError(error.message));
  }
};

// Remove student from parent
export const removeStudentFromParent = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { parentId, parentRole } = req.body;
    const { role } = req.user;

    // Only admin or proprietor can perform this action
    if (role !== "admin" && role !== "proprietor") {
      throw new UnauthorizedError(
        "Only admin or proprietor can remove students from a parent",
      );
    }

    // Validate parentRole
    if (!["father", "mother", "singleParent"].includes(parentRole)) {
      throw new BadRequestError("Invalid parentRole specified");
    }

    // Find the parent document
    const parent = await Parent.findById(parentId);
    if (!parent) {
      throw new NotFoundError("Parent record not found");
    }

    const targetSection = parent[parentRole];

    if (!targetSection || !Array.isArray(targetSection.children)) {
      throw new NotFoundError(
        `No valid ${parentRole} data or children list found`,
      );
    }

    const index = targetSection.children.indexOf(studentId);
    if (index === -1) {
      throw new NotFoundError("Student not linked to this parent role");
    }

    targetSection.children.splice(index, 1); // Remove student
    await parent.save();

    res.status(StatusCodes.OK).json({
      message: `Student successfully removed from ${parentRole}`,
    });
  } catch (error) {
    console.log("Remove student error:", error);
    next(new InternalServerError(error.message));
  }
};

// Delete student (Admin Only)
export const deleteStudent = async (req, res, next) => {
  try {
    const { id: studentId } = req.params;
    const student = await Student.findOne({ _id: studentId });

    // console.log("role", req.user.role);

    if (!student) {
      throw new NotFoundError(`No student found with id: ${studentId}`);
    }

    // Ensure only admins can delete a student
    // if (req.user.role !== "admin") {
    //   throw new UnauthorizedError("Only admins can delete student records.");
    // }

    // Step 1: Remove the student from all related classes
    await Class.updateMany(
      { students: studentId }, // Find classes where the student is referenced
      { $pull: { students: studentId } }, // Remove the student from the students array
    );

    // Step 2: Remove the student from all related subjects
    await Subject.updateMany(
      { students: studentId }, // Find subjects where the student is referenced
      { $pull: { students: studentId } }, // Remove the student from the students array
    );

    // Step 3: Optionally, remove the student from the parent's children array
    if (student.parentGuardianId) {
      await Parent.updateOne(
        { _id: student.parentGuardianId },
        { $pull: { children: studentId } }, // Remove the student from the parent's children array
      );
    }

    // Step 4: Delete all attendance records associated with the student
    await Attendance.deleteMany({ student: studentId });

    // Step 5: Delete the student record
    await student.deleteOne();

    res
      .status(StatusCodes.OK)
      .json({ message: "Student and associated records deleted successfully" });
  } catch (error) {
    console.log("Error deleting student:", error);
    next(new BadRequestError(error.message));
  }
};

// Add student to a class, handle subject assignments, and update attendance
export const addStudentToClass = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { classId, changeDate } = req.body;

    if (!studentId || !classId) {
      throw new BadRequestError("studentId and classId are required");
    }

    // Find the student
    const student = await Student.findById(studentId);
    if (!student) {
      throw new NotFoundError("Student not found");
    }

    // Verify new class exists
    const newClass = await Class.findById(classId).populate("subjects");
    if (!newClass) {
      throw new NotFoundError("Class not found");
    }

    // If student is already in a class, check term/session rules
    if (student.classId) {
      const currentClass = await Class.findById(student.classId);
      // Use the updated isValidTermSessionMove signature
      const isValidMove = await isValidTermSessionMove(
        student,
        currentClass,
        newClass,
      );
      if (!isValidMove) {
        if (student.previousStatus === "inactive") {
          throw new BadRequestError(
            "Previously inactive students can only be moved to classes in the current term and session.",
          );
        } else {
          throw new BadRequestError(
            "Invalid class movement. Students can only move within the same session, or from third term of previous session to current term.",
          );
        }
      }
    }

    // Handle previous class if exists
    if (student.classId && student.classId.toString() !== classId) {
      const oldClass = await Class.findById(student.classId).populate(
        "subjects",
      );

      // Remove student from old class
      await Class.updateOne(
        { _id: student.classId },
        { $pull: { students: student._id } },
      );

      // Remove student from old class's subjects
      if (oldClass && oldClass.subjects) {
        for (const subject of oldClass.subjects) {
          await Subject.updateOne(
            { _id: subject._id },
            { $pull: { students: student._id } },
          );
        }
      }
    }

    // Add student to new class
    await Class.updateOne(
      { _id: classId },
      { $addToSet: { students: student._id } },
    );

    // Add student to all subjects in the new class
    if (newClass.subjects) {
      for (const subject of newClass.subjects) {
        await Subject.updateOne(
          { _id: subject._id },
          { $addToSet: { students: student._id } },
        );
      }
    }

    // Reflect the class change on the current term's academic record (relocating
    // the term entry into the new class's group).
    const { term: curTerm, session: curSession } = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );
    moveTermToClass(student, {
      term: curTerm,
      session: curSession,
      classId,
      subjects: newClass.subjects.map((s) => s._id),
    });
    await student.save();

    // Update all attendance records from the date of the change
    const dateFrom = changeDate ? new Date(changeDate) : new Date();
    await Attendance.updateMany(
      { student: student._id, date: { $gte: dateFrom } },
      { $set: { classId: classId } },
    );

    res.status(StatusCodes.OK).json({
      message:
        "Student added to class, subjects updated, and attendance records updated successfully",
    });
  } catch (error) {
    console.log("Error adding student to class:", error);
    next(new InternalServerError(error.message));
  }
};

// Change student's class and update attendance records

export const removeStudentFromClass = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { newClassId, changeDate } = req.body;

    if (!newClassId) {
      throw new BadRequestError("New class ID is required");
    }

    // 1) Load student
    const student = await Student.findById(studentId);
    if (!student) {
      throw new NotFoundError("Student not found");
    }

    // 2) Determine current term/session
    const { term, session } = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // 3) Find the embedded record
    const record = findTermRecord(student, { term, session });
    if (!record) {
      throw new BadRequestError(
        `No academic record found for term '${term}' and session '${session}'`,
      );
    }
    const oldClassId = classIdForTerm(student, { term, session })?.toString();
    if (!oldClassId) {
      throw new BadRequestError(
        "Student is not assigned to any class in the current term/session",
      );
    }

    // 4) Verify new class exists and is appropriate
    const newClass = await Class.findById(newClassId).lean();
    if (!newClass) {
      throw new NotFoundError("New class not found");
    }

    // 5) Remove student from old class roster
    await Class.updateOne(
      { _id: oldClassId },
      { $pull: { students: student._id } },
    );

    // 6) Remove student from old class's subjects
    const oldClass = await Class.findById(oldClassId).populate("subjects");
    if (oldClass?.subjects?.length) {
      for (const subj of oldClass.subjects) {
        await Subject.updateOne(
          { _id: subj._id },
          { $pull: { students: student._id } },
        );
      }
    }

    // 7) Add student to new class roster
    await Class.updateOne(
      { _id: newClassId },
      { $addToSet: { students: student._id } },
    );

    // 8) Add student to new class's subjects
    const newClassPop = await Class.findById(newClassId).populate("subjects");
    if (newClassPop?.subjects?.length) {
      for (const subj of newClassPop.subjects) {
        await Subject.updateOne(
          { _id: subj._id },
          { $addToSet: { students: student._id } },
        );
      }
    }

    // 9) Update attendance records from changeDate onward
    const dateFrom = changeDate ? new Date(changeDate) : new Date();
    await Attendance.updateMany(
      {
        student: student._id,
        classId: oldClassId,
        date: { $gte: dateFrom },
      },
      { $set: { classId: newClassId } },
    );

    // 10) Relocate the term entry to the new class's group and reset subjects.
    moveTermToClass(student, {
      term,
      session,
      classId: newClassId,
      subjects: newClassPop.subjects.map((s) => s._id),
    });
    await student.save();

    res.status(StatusCodes.OK).json({
      message: "Student moved to new class and records updated successfully",
    });
  } catch (error) {
    console.log("Error removing student from class:", error);
    next(new InternalServerError(error.message));
  }
};

// Add a student to a subject
/* export const addStudentToSubject = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { subjectId } = req.body;

    // Validate student and subject exist
    const student = await Student.findById(studentId);
    if (!student) {
      throw new NotFoundError(`Student with id ${studentId} not found`);
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      throw new NotFoundError(`Subject not found`);
    }

    // Check if student is already enrolled in the subject
    if (subject.students.includes(student._id)) {
      throw new BadRequestError("Student is already enrolled in this subject");
    }

    // Add student to the subject's student list
    subject.students.push(student._id);
    await subject.save();

    // Return success response
    res.status(StatusCodes.OK).json({
      message: "Student successfully added to subject",
      subject,
    });
  } catch (error) {
    console.log("Error in adding student to subject", error);
    next(new InternalServerError(error.message));
  }
}; */

export const addStudentToSubject = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { subjectId } = req.body;

    // 1) Load student
    const student = await Student.findById(studentId);
    if (!student) throw new NotFoundError("Student not found");

    // 2) Get current term/session
    const { term, session } = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // 3) Find academic record
    const record = findTermRecord(student, { term, session });
    const enrolledClassId = classIdForTerm(student, { term, session });
    if (!record || !enrolledClassId) {
      throw new BadRequestError(
        "Student is not enrolled in a class this term/session",
      );
    }

    // 4) Load subject
    const subject = await Subject.findById(subjectId);
    if (!subject) throw new NotFoundError("Subject not found");

    // 5) Verify subject belongs to the student's current class
    const classDoc = await Class.findById(enrolledClassId);
    if (!classDoc || !classDoc.subjects.includes(subject._id)) {
      throw new BadRequestError(
        "Subject does not belong to student's current class",
      );
    }

    // 6) Add student to subject
    if (!subject.students.includes(student._id)) {
      subject.students.push(student._id);
      await subject.save();
    }

    // 7) Add subject to student’s academic record
    if (!record.subjects.includes(subject._id)) {
      record.subjects.push(subject._id);
      await student.save();
    }

    res
      .status(StatusCodes.OK)
      .json({ message: "Student added to subject successfully" });
  } catch (error) {
    console.log("Error in addStudentToSubject:", error);
    next(new InternalServerError(error.message));
  }
};

// Remove a student from a subject
/* export const removeStudentFromSubject = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { subjectId } = req.body;

    // Validate student and subject exist
    const student = await Student.findById(studentId);
    if (!student) {
      throw new NotFoundError(`Student with id ${studentId} not found`);
    }

    const subject = await Subject.findById(subjectId);
    if (!subject) {
      throw new NotFoundError(`Subject not found`);
    }

    // Check if student is enrolled in the subject
    if (!subject.students.includes(student._id)) {
      throw new BadRequestError("Student is not enrolled in this subject");
    }

    // Remove student from the subject's student list
    subject.students = subject.students.filter(
      (studentId) => studentId.toString() !== student._id.toString(),
    );
    await subject.save();

    // Return success response
    res.status(StatusCodes.OK).json({
      message: "Student successfully removed from subject",
      subject,
    });
  } catch (error) {
    console.log("Error in removing student from subject", error);
    next(new InternalServerError(error.message));
  }
}; */

export const removeStudentFromSubject = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { subjectId } = req.body;

    // 1) Load student
    const student = await Student.findById(studentId);
    if (!student) throw new NotFoundError("Student not found");

    // 2) Get current term/session
    const { term, session } = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // 3) Find academic record
    const record = findTermRecord(student, { term, session });
    const enrolledClassId = classIdForTerm(student, { term, session });
    if (!record || !enrolledClassId) {
      throw new BadRequestError(
        "Student is not enrolled in a class this term/session",
      );
    }

    // 4) Verify subject
    const subject = await Subject.findById(subjectId);
    if (!subject) throw new NotFoundError("Subject not found");

    // 5) Remove student from subject
    await Subject.updateOne(
      { _id: subjectId },
      { $pull: { students: student._id } },
    );

    // 6) Remove subject from the student's term entry
    record.subjects.pull(subject._id);
    await student.save();

    res
      .status(StatusCodes.OK)
      .json({ message: "Student removed from subject successfully" });
  } catch (error) {
    console.log("Error in removeStudentFromSubject:", error);
    next(new InternalServerError(error.message));
  }
};

const isValidTermSessionMove = async (student, fromClass, toClass) => {
  // Early exit if class info not found
  if (!fromClass || !toClass) return false;

  // If student was previously inactive, allow move from any class in any past term/session to current term and session
  if (student && student.previousStatus === "inactive") {
    // Only allow if toClass is in the current session and term (assume current means latest session/term in your system)
    // If you want to restrict to a specific session/term, adjust this logic accordingly
    // Here, we just check that the destination is the current session and term
    // (You may want to pass current session/term as parameters if needed)
    return true;
  }

  // Allow moves within same session (regardless of class or term)
  if (fromClass.session === toClass.session) {
    return true;
  }

  // Allow moves from third term of previous session to current term in current session
  if (fromClass.term === "third") {
    // Extract years from session strings to check if "from" is previous to "to"
    const [fromStart] = fromClass.session.split("/").map(Number);
    const [toStart] = toClass.session.split("/").map(Number);

    if (toStart === fromStart + 1) {
      return true;
    }
  }

  return false;
};
