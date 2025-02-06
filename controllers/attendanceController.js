import Attendance from "../models/AttendanceModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
  getCurrentSession,
} from "../utils/termGenerator.js";
import Student from "../models/StudentModel.js";
import Class from "../models/ClassModel.js";

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
      attendanceRecord.totalDaysPresent +
      attendanceRecord.totalDaysAbsent -
      attendanceRecord.totalDaysPublicHoliday;

    await attendanceRecord.save();

    return res.status(StatusCodes.CREATED).json({
      message: "Attendance marked successfully.",
      attendance: attendanceRecord,
    });
  } catch (error) {
    console.error("Error marking morning attendance: ", error);
    next(new BadRequestError(error.message)); // Pass error to the global error handler
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
      attendanceRecord.totalDaysPresent +
      attendanceRecord.totalDaysAbsent -
      attendanceRecord.totalDaysPublicHoliday;

    await attendanceRecord.save();

    return res.status(StatusCodes.CREATED).json({
      message: "Attendance marked successfully.",
      attendance: attendanceRecord,
    });
  } catch (error) {
    console.error("Error marking afternoon attendance: ", error);
    next(new BadRequestError(error.message)); // Pass error to the global error handler
  }
};

export const getAllAttendanceRecords = async (req, res, next) => {
  try {
    const { firstName, middleName, lastName, classId, term, session, date } =
      req.query;

    // Build a query object based on provided filters
    const queryObject = {};

    if (firstName) {
      queryObject["firstName"] = { $regex: firstName, $options: "i" }; // Case-insensitive search
    }
    if (middleName) {
      queryObject["middleName"] = { $regex: middleName, $options: "i" }; // Case-insensitive search
    }
    if (lastName) {
      queryObject["lastName"] = { $regex: lastName, $options: "i" }; // Case-insensitive search
    }
    if (classId) {
      queryObject["classId"] = classId;
    }
    if (date) {
      queryObject["date"] = date;
    }
    if (term) {
      queryObject["term"] = term;
    }
    if (session) {
      queryObject["session"] = session;
    }

    const attendanceRecords = await Attendance.find(queryObject);
    res.status(StatusCodes.OK).json({ attendance: attendanceRecords });
  } catch (error) {
    console.error("Error getting attendance records: ", error);
    next(new BadRequestError(error.message));
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
    next(new BadRequestError(error.message));
  }
};

// Delete attendance records for a specific student in the current term and session
export const deleteStudentAttendanceForTerm = async (req, res) => {
  const { studentId } = req.params;

  if (!studentId) {
    throw new BadRequestError("Student ID is required to delete attendance.");
  }

  // Get current term and session details
  const { term } = getCurrentTermDetails(
    startTermGenerationDate,
    holidayDurationForEachTerm,
  ); // Adjust this if you need the session as well
  const session = getCurrentSession(); // Fetch session separately

  try {
    // Delete attendance records based on student ID, current term, and session
    const deleteResult = await Attendance.deleteMany({
      student: studentId,
      term,
      session,
    });

    if (deleteResult.deletedCount === 0) {
      throw new NotFoundError(
        `No attendance records found for student ID: ${studentId} in the current term and session.`,
      );
    }

    res.status(StatusCodes.OK).json({
      message: `Deleted ${deleteResult.deletedCount} attendance records for student ID: ${studentId} in the current term and session.`,
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  }
};
