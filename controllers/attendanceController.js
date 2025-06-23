import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import InternalServerError from "../errors/internal-server-error.js";
import NotFoundError from "../errors/not-found.js";
import Attendance from "../models/AttendanceModel.js";
import Student from "../models/StudentModel.js";
import {
  getCurrentSession,
  getCurrentTermDetails,
  holidayDurationForEachTerm,
  startTermGenerationDate,
} from "../utils/termGenerator.js";

// Utility function to check if a date is a weekday
const isWeekday = (date) => {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 is Sunday, 6 is Saturday
};

export const markStudentAttendanceForMorning = async (req, res, next) => {
  const { studentId } = req.params; // Student ID from URL parameters
  const { morningStatus } = req.body; // Morning attendance status from request body

  if (!studentId || !morningStatus) {
    throw new BadRequestError(
      "Student ID and morning attendance status are required.",
    );
  }

  const today = new Date();

  if (!isWeekday(today)) {
    return res
      .status(StatusCodes.OK)
      .json({ message: "Attendance cannot be marked on weekends." });
  }

  const formattedToday = today.toISOString().split("T")[0];

  try {
    const student = await Student.findById(studentId).populate("classId");
    if (!student) {
      throw new BadRequestError("Student not found.");
    }

    const isAuthorized =
      req.user.role === "admin" ||
      req.user.role === "proprietor" ||
      (student.classId &&
        student.classId.classTeacher &&
        student.classId.classTeacher.toString() === req.user.id);

    if (!isAuthorized) {
      return res.status(StatusCodes.FORBIDDEN).json({
        message: "You are not authorized to mark attendance for this student.",
      });
    }

    // Find existing attendance record for today
    let attendanceRecord = await Attendance.findOne({
      student: studentId,
      date: formattedToday,
    });

    if (!attendanceRecord) {
      attendanceRecord = new Attendance({
        student: studentId,
        date: formattedToday,
        totalDaysPresent: 0,
        totalDaysAbsent: 0,
        totalDaysPublicHoliday: 0,
        totalDaysSchoolOpened: 0,
      });
    }

    if (attendanceRecord.timeMarkedMorning) {
      throw new BadRequestError(
        "Morning attendance has already been marked for today.",
      );
    }

    // Update morning status and adjust totals
    attendanceRecord.morningStatus = morningStatus;
    attendanceRecord.timeMarkedMorning = Date.now();

    // Adjust totals based on morning status and afternoon status
    if (morningStatus === "present") {
      attendanceRecord.totalDaysPresent += 1;
    }
    if (morningStatus === "publicHoliday") {
      attendanceRecord.totalDaysPublicHoliday += 1;
      attendanceRecord.afternoonStatus = "publicHoliday"; // Set afternoon status to publicHoliday
    }

    //calculate totalDaysSchoolOpened
    attendanceRecord.totalDaysSchoolOpened =
      attendanceRecord.totalDaysPresent + attendanceRecord.totalDaysAbsent;
    //  -
    // attendanceRecord.totalDaysPublicHoliday;

    await attendanceRecord.save();

    return res.status(StatusCodes.CREATED).json({
      message: "Attendance marked successfully.",
      attendance: attendanceRecord,
    });
  } catch (error) {
    console.error("Error marking morning attendance: ", error);
    next(new InternalServerError(error.message)); // Pass error to the global error handler
  }
};

export const markStudentAttendanceForAfternoon = async (req, res, next) => {
  const { studentId } = req.params; // Student ID from URL parameters
  const { afternoonStatus } = req.body; // Afternoon attendance status from request body

  if (!studentId || !afternoonStatus) {
    throw new BadRequestError(
      "Student ID and afternoon attendance status are required.",
    );
  }

  const today = new Date();

  if (!isWeekday(today)) {
    return res
      .status(StatusCodes.OK)
      .json({ message: "Attendance cannot be marked on weekends." });
  }

  const formattedToday = today.toISOString().split("T")[0];

  try {
    const student = await Student.findById(studentId).populate("classId");
    if (!student) {
      throw new BadRequestError("Student not found.");
    }

    const isAuthorized =
      req.user.role === "admin" ||
      req.user.role === "proprietor" ||
      (student.classId &&
        student.classId.classTeacher &&
        student.classId.classTeacher.toString() === req.user.id);

    if (!isAuthorized) {
      return res.status(StatusCodes.FORBIDDEN).json({
        message: "You are not authorized to mark attendance for this student.",
      });
    }

    // Find existing attendance record for today
    let attendanceRecord = await Attendance.findOne({
      student: studentId,
      date: formattedToday,
    });

    if (!attendanceRecord) {
      attendanceRecord = new Attendance({
        student: studentId,
        date: formattedToday,
        totalDaysPresent: 0,
        totalDaysAbsent: 0,
        totalDaysPublicHoliday: 0,
        totalDaysSchoolOpened: 0,
      });
    }

    // Ensure afternoon status isn't updated twice in one day
    if (attendanceRecord.timeMarkedAfternoon) {
      throw new BadRequestError(
        "Afternoon attendance has already been marked for today.",
      );
    }

    // Update afternoon status and adjust totals

    attendanceRecord.afternoonStatus = afternoonStatus;
    attendanceRecord.timeMarkedAfternoon = Date.now();

    // Adjust totals based on afternoon status and morning status
    if (afternoonStatus === "present" && morningStatus === "absent") {
      attendanceRecord.totalDaysPresent += 1;
    }
    if (afternoonStatus === "absent" && morningStatus === "absent") {
      attendanceRecord.totalDaysAbsent += 1;
    }

    //calculate totalDaysSchoolOpened
    attendanceRecord.totalDaysSchoolOpened =
      attendanceRecord.totalDaysPresent + attendanceRecord.totalDaysAbsent;
    // -
    // attendanceRecord.totalDaysPublicHoliday;

    await attendanceRecord.save();

    return res.status(StatusCodes.CREATED).json({
      message: "Attendance marked successfully.",
      attendance: attendanceRecord,
    });
  } catch (error) {
    console.error("Error marking afternoon attendance: ", error);
    next(new InternalServerError(error.message));
  }
};

export const getAllAttendanceRecords = async (req, res, next) => {
  try {
    const allowedFilters = [
      "student",
      "classId",
      "classTeacher",
      "term",
      "session",
      "date",
      "sort",
      "page",
      "limit",
    ];

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

    const {
      student,
      classId,
      classTeacher,
      term,
      session,
      date,
      sort,
      page,
      limit,
    } = req.query;

    // Build an initial match stage for fields stored directly on StudentAnswer
    const matchStage = {};

    if (date) matchStage.date = date;
    if (term) matchStage.term = { $regex: term, $options: "i" };
    if (session) matchStage.session = session;

    // Start building the aggregation pipeline
    const pipeline = [];
    pipeline.push({ $match: matchStage });

    // Lookup student data from the "students" collection
    pipeline.push({
      $lookup: {
        from: "students",
        localField: "student",
        foreignField: "_id",
        as: "studentData",
      },
    });
    pipeline.push({ $unwind: "$studentData" });

    // Lookup class data from the "classes" collection
    pipeline.push({
      $lookup: {
        from: "classes",
        localField: "classId",
        foreignField: "_id",
        as: "classData",
      },
    });
    pipeline.push({ $unwind: "$classData" });

    // Lookup to join classTeacher data from the "staff" collection
    pipeline.push({
      $lookup: {
        from: "staffs", // collection name for staff (ensure this matches your DB)
        localField: "classTeacher",
        foreignField: "_id",
        as: "classTeacherData",
      },
    });
    pipeline.push({ $unwind: "$classTeacherData" });

    const joinMatch = {};
    if (student) {
      const studentRegex = {
        $regex: `^${student}$`,
        $options: "i",
      };

      joinMatch.$or = [
        { "studentData.firstName": studentRegex },
        { "studentData.middleName": studentRegex },
        { "studentData.lastName": studentRegex },
      ];
    }
    if (classTeacher) {
      const classTeacherRegex = {
        $regex: `^${classTeacher}$`,
        $options: "i",
      };

      joinMatch.$or = [
        {
          "classTeacherData.firstName": classTeacherRegex,
        },
        {
          "classTeacherData.middleName": classTeacherRegex,
        },
        {
          "classTeacherData.lastName": classTeacherRegex,
        },
      ];
    }
    if (classId) {
      joinMatch["classData.className"] = {
        $regex: `^${classId}$`,
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
      "a-z": { "studentData.firstName": 1 },
      "z-a": { "studentData.firstName": -1 },
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
        date: 1,
        term: 1,
        session: 1,
        createdAt: 1,
        student: {
          _id: "$studentData._id",
          firstName: "$studentData.firstName",
          middleName: "$studentData.middleName",
          lastName: "$studentData.lastName",
        },
        classTeacher: {
          _id: "$classTeacherData._id",
          firstName: "$classTeacherData.firstName",
          middleName: "$classTeacherData.middleName",
          lastName: "$classTeacherData.lastName",
        },
        classId: {
          _id: "$classData._id",
          className: "$classData.className",
        },
        // Include other fields from Attendance if needed.
      },
    });

    // Execute the aggregation pipeline
    const attendances = await Attendance.aggregate(pipeline);

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
    const countResult = await Attendance.aggregate(countPipeline);
    const totalAttendances = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalAttendances / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalAttendances,
      numOfPages,
      currentPage: pageNumber,
      attendances,
    });
  } catch (error) {
    console.error("Error getting attendance records: ", error);
    next(new InternalServerError(error.message));
  }
};

export const getAttendanceById = async (req, res, next) => {
  try {
    const attendanceRecord = await Attendance.findById(req.params.id);
    res
      .status(StatusCodes.OK)
      .json({ attendance: attendanceRecord })
      .populate([
        { path: "classId", select: "_id className" },
        { path: "subject", select: "_id subjectName" },
        { path: "student", select: "_id name" },
        { path: "classTeacher", select: "_id name" },
        // { path: "students", select: "_id firstName lastName" },
      ]);
  } catch (error) {
    console.error("Error getting attendance record: ", error);
    next(new InternalServerError(error.message));
  }
};

// Delete attendance records for a specific student in the current term and session
export const deleteStudentAttendanceForTerm = async (req, res) => {
  const { studentId } = req.params;

  if (!studentId) {
    throw new BadRequestError("Student ID is required to delete attendance.");
  }

  // Get current term and session details
  const { term, session } = getCurrentTermDetails(
    startTermGenerationDate,
    holidayDurationForEachTerm,
  ); // Adjust this if you need the session as well
  // const session = getCurrentSession(); // Fetch session separately

  try {
    // Delete attendance records based on student ID, current term, and session
    const deleteResult = await Attendance.deleteMany({
      student: studentId,
      term,
      session,
    });

    if (deleteResult.deletedCount === 0) {
      throw new NotFoundError(
        `No attendance records found for this student in the current term and session.`,
      );
    }

    res.status(StatusCodes.OK).json({
      message: `Deleted ${deleteResult.deletedCount} attendance records for student in the current term and session.`,
    });
  } catch (error) {
    console.log("Error deleting attendance records: ", error);
    next(new InternalServerError(error.message));
  }
};

// Create attendance records for a student for the current or next term
export const createStudentTermAttendance = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    if (!studentId) {
      throw new BadRequestError("Student ID is required.");
    }

    // Get current term/session details
    const termDetails = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );
    let { term, session, isHoliday, nextTerm, nextSession, schoolDays } =
      termDetails;

    // If isHoliday, use nextTerm (and nextSession if term is third)
    if (isHoliday) {
      term = nextTerm;
      if (termDetails.term === "third") {
        session = nextSession;
      }
      // Recalculate schoolDays for the next term
      const nextTermDetails = getCurrentTermDetails(
        termDetails.nextTermStartDate,
        holidayDurationForEachTerm,
      );
      schoolDays = nextTermDetails.schoolDays;
    }

    // Find the student and their class
    const student = await Student.findById(studentId);
    if (!student) {
      throw new NotFoundError("Student not found.");
    }
    const classId =
      student.academicRecords?.find(
        (rec) => rec.term === term && rec.session === session,
      )?.classId || student.classId;

    // Get the class teacher
    const assignedClass = await Class.findById(classId);
    const classTeacher = assignedClass ? assignedClass.classTeacher : undefined;

    // Create attendance records for each school day
    const attendanceIds = [];
    for (const date of schoolDays) {
      const attendance = new Attendance({
        student: student._id,
        classId: classId,
        date: date,
        morningStatus: "pending",
        afternoonStatus: "pending",
        classTeacher: classTeacher,
        term,
        session,
      });
      const savedAttendance = await attendance.save();
      attendanceIds.push(savedAttendance._id);
    }

    // Update student's academicRecords.attendance array for the correct term/session/class
    // Find the correct academic record
    const recordIndex = student.academicRecords.findIndex(
      (rec) =>
        rec.term === term &&
        rec.session === session &&
        rec.classId?.toString() === classId.toString(),
    );
    if (recordIndex !== -1) {
      // Append new attendance IDs to the academic record's attendance array
      student.academicRecords[recordIndex].attendance = [
        ...(student.academicRecords[recordIndex].attendance || []),
        ...attendanceIds,
      ];
      await student.save();
    }

    res.status(StatusCodes.CREATED).json({
      message: `Attendance records created for student for term ${term} (${session})`,
    });
  } catch (error) {
    console.log("Error creating student term attendance", error);
    next(new InternalServerError(error.message));
  }
};
