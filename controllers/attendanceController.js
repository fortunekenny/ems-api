import Attendance from "../models/AttendanceModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
  getCurrentSession,
} from "../utils/termGenerator.js"; // Assume this utility function exists
import Student from "../models/StudentModel.js";
import Class from "../models/ClassModel.js";

// Utility function to check if a date is a weekday
const isWeekday = (date) => {
  const day = date.getDay();
  return day !== 0 && day !== 6; // 0 is Sunday, 6 is Saturday
};

// Get attendance for a specific student based on their current class, term, and session
export const getAttendanceForStudent = async (req, res) => {
  const { studentId } = req.params;

  if (!studentId) {
    throw new BadRequestError("Student ID is required to fetch attendance.");
  }

  // Retrieve student's current class, term, and session from their record
  const student = await Student.findById(studentId);
  if (!student) {
    throw new NotFoundError("Student not found.");
  }
  const { classId, term, session } = student;

  // Check if the authenticated user is authorized to get attendance
  const isAuthorized =
    req.user.role === "admin" || // Admin can access all attendance records
    req.user.role === "proprietor" || // Proprietor can access all attendance records
    (student.classId &&
      student.classId.classTeacher &&
      student.classId.classTeacher.toString() === req.user.id) || // Class teacher for the student's class
    (req.user.role === "parent" && // Parent can access attendance for their children
      req.user.children &&
      req.user.children.includes(student._id.toString())) ||
    (req.user.role === "student" && req.user.id === student._id.toString()); // Student can access their own attendance

  if (!isAuthorized) {
    return res.status(StatusCodes.FORBIDDEN).json({
      message: "You are not authorized to view attendance for this student.",
    });
  }

  try {
    // Fetch attendance records based on student’s class, term, and session
    const attendanceRecords = await Attendance.find({
      student: studentId,
      classId,
      term,
      session,
    });

    if (!attendanceRecords || attendanceRecords.length === 0) {
      throw new NotFoundError(
        "No attendance records found for this student in their current term and session.",
      );
    }

    res.status(StatusCodes.OK).json({ attendance: attendanceRecords });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  }
};

// Mark today's attendance for a student based on student ID
export const markAttendanceForToday = async (req, res) => {
  const { studentId } = req.params; // Fetch student ID from URL parameters
  const { status } = req.body; // Fetch attendance status from request body

  if (!studentId || !status) {
    throw new BadRequestError("Student ID and attendance status are required.");
  }

  // Get today's date
  const today = new Date();

  // Check if today is a weekday
  if (!isWeekday(today)) {
    return res
      .status(StatusCodes.OK)
      .json({ message: "Attendance cannot be marked on weekends." });
  }

  // Format today to YYYY-MM-DD
  const formattedToday = today.toISOString().split("T")[0];

  try {
    // Fetch student details, including the class and class teacher
    const student = await Student.findById(studentId).populate("classId");
    if (!student) {
      throw new BadRequestError("Student not found.");
    }

    // Check if the authenticated staff member is authorized to mark attendance
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

    // Find or create today's attendance record for the student
    const attendanceRecord = await Attendance.findOneAndUpdate(
      { student: studentId, date: formattedToday },
      { status },
      { new: true, runValidators: true },
    );

    // If no attendance record for today exists, create a new one
    if (!attendanceRecord) {
      const newAttendanceRecord = await Attendance.create({
        student: studentId,
        date: formattedToday,
        status,
      });

      return res
        .status(StatusCodes.CREATED)
        .json({ attendance: newAttendanceRecord });
    }

    res.status(StatusCodes.OK).json({ attendance: attendanceRecord });
  } catch (error) {
    console.error("Error marking attendance: ", error); // Log the error
    res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  }
};

// Fetch all attendance records for the current class in the current term and session
export const getAttendanceForClass = async (req, res) => {
  const { classId } = req.params;

  if (!classId) {
    throw new BadRequestError("Class ID is required to fetch attendance.");
  }

  // Get current term and session details
  const { term, session } = getCurrentTermDetails(
    startTermGenerationDate,
    holidayDurationForEachTerm,
  );

  try {
    // Fetch the class information to check for class teacher authorization
    const classData = await Class.findById(classId);

    if (
      req.user.role !== "admin" &&
      req.user.role !== "proprietor" &&
      (!classData || classData.classTeacher.toString() !== req.user.id)
    ) {
      return res.status(StatusCodes.FORBIDDEN).json({
        message: "You are not authorized to view attendance for this class.",
      });
    }

    // Fetch attendance records for the specified class, term, and session
    const attendanceRecords = await Attendance.find({ classId, term, session });

    if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      throw new NotFoundError(
        "No attendance records found for this class in the current term and session.",
      );
    }

    res.status(StatusCodes.OK).json({ attendance: attendanceRecords });
  } catch (error) {
    console.error("Error in getAttendanceForClass:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
};

// Get today's attendance for a specific class in the current term and session
export const getClassAttendanceForToday = async (req, res) => {
  const { classId } = req.params;

  if (!classId) {
    throw new BadRequestError(
      "Class ID is required to fetch attendance for today.",
    );
  }

  // Get today's date and format it to YYYY-MM-DD
  const today = new Date();
  const formattedToday = today.toISOString().split("T")[0];

  // Check if today is a weekday
  if (!isWeekday(today)) {
    return res
      .status(StatusCodes.OK)
      .json({ message: "Today is a weekend; no attendance to fetch." });
  }

  // Get current term and session details
  const { term, session } = getCurrentTermDetails(
    startTermGenerationDate,
    holidayDurationForEachTerm,
  );

  try {
    // Fetch the class information to check for class teacher authorization
    const classData = await Class.findById(classId);

    if (
      req.user.role !== "admin" &&
      req.user.role !== "proprietor" &&
      (!classData || classData.classTeacher.toString() !== req.user.id)
    ) {
      return res.status(StatusCodes.FORBIDDEN).json({
        message: "You are not authorized to view attendance for this class.",
      });
    }

    // Find today's attendance for the specified class, term, and session
    const attendanceRecords = await Attendance.find({
      classId,
      date: {
        $gte: new Date(formattedToday),
        $lt: new Date(
          new Date(formattedToday).setDate(
            new Date(formattedToday).getDate() + 1,
          ),
        ),
      },
      term,
      session,
    });

    if (!Array.isArray(attendanceRecords) || attendanceRecords.length === 0) {
      throw new NotFoundError(
        `No attendance records found for class ID: ${classId} on ${formattedToday}.`,
      );
    }

    res.status(StatusCodes.OK).json({ attendance: attendanceRecords });
  } catch (error) {
    console.error("Error in getClassAttendanceForToday:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
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
