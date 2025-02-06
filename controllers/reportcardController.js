import ReportCard from "../models/ReportcardModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import Grade from "../models/GradeModel.js";
import Class from "../models/ClassModel.js";
import Staff from "../models/StaffModel.js";

import {
  getCurrentTermDetails,
  startTermGenerationDate, // Ensure this is correctly defined
  holidayDurationForEachTerm, // Ensure this is correctly defined
} from "../utils/termGenerator.js"; // Import getCurrentTermDetails

const { session, term } = getCurrentTermDetails(
  startTermGenerationDate,
  holidayDurationForEachTerm,
);

// Create a report card
export const createReportCard = async (req, res, next) => {
  try {
    const { student, classId, teacherComment, teacher } = req.body;

    if (!student || !classId) {
      throw new BadRequestError("Required fields must be provided.");
    }

    const { id: userId, role: userRole } = req.user;

    let subjectTeacherId;
    let isAuthorized = false;

    if (["admin", "proprietor"].includes(userRole)) {
      isAuthorized = true;
      subjectTeacherId = teacher;

      // Ensure 'subjectTeacher' field is provided
      if (!subjectTeacherId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'teacher' field must be provided.",
        );
      }

      const teacherData = await Staff.findById(subjectTeacherId).populate(
        "isClassTeacher",
      );
      if (!teacherData || !teacherData.isClassTeacher.equals(classId)) {
        throw new BadRequestError("Teacher is not the class teacher.");
      }
    } else if (userRole === "teacher") {
      const teacherData = await Staff.findById(userId).populate(
        "isClassTeacher",
      );
      if (!teacherData || !teacherData.isClassTeacher.equals(classId)) {
        throw new BadRequestError(
          "You are not authorized to create a report card.",
        );
      }
      isAuthorized = true;
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to create report card.",
      );
    }

    // 1. Get class information (should use findOne/findById instead of find)
    const classData = await Class.findOne({
      _id: classId, // Use _id instead of classId if that's your schema field
      term: term,
      session: session,
    })
      .populate("subjects", "subjectName")
      .exec(); // Populate subject names

    if (!classData) {
      throw new NotFoundError("Class not found");
    }

    // a subject ID-to-name map
    const subjectMap = new Map();
    classData.subjects.forEach((subject) => {
      subjectMap.set(subject._id.toString(), subject.subjectName);
    });

    const gradeData = await Grade.find({
      student,
      classId,
      term,
      session,
    });

    // if (gradeData.length === 0 || gradeData.length !== subjects.lenght ) {
    if (gradeData.length === 0) {
      throw new NotFoundError("Grade not found.");
    }

    // Map grades for the subjects
    const gradeMap = new Map();
    gradeData.forEach((grade) => {
      gradeMap.set(grade.subject.toString(), grade);
    });

    // structured grade information

    // Ensure all subjects for the class are included in subjectsGrade
    const subjectsGrade = classData.subjects.map((subject) => {
      const grade = gradeMap.get(subject._id.toString());
      return grade
        ? {
            gradeId: grade._id,
            subjectId: grade.subject,
            subjectName: subject.subjectName,
            testScore: grade.testsScore || 0,
            examScore: grade.examScore || 0,
            markObtained: grade.testsScore + grade.examScore,
            grade: grade.grade || "N/A",
            percentage: grade.percentageScore || 0,
            markObtainable: grade.markObtainable || 100,
            remark: grade.remark || "N/A",
          }
        : {
            gradeId: null,
            subjectId: subject._id,
            subjectName: subject.subjectName,
            testScore: 0,
            examScore: 0,
            markObtained: 0,
            grade: "N/A",
            percentage: 0,
            markObtainable: 100,
            remark: "No grades available",
          };
    });

    const attendanceData = await Attendance.find({
      student,
      classId,
      term,
      session,
    });

    // if (gradeData.length === 0 || gradeData.length !== subjects.lenght ) {
    if (attendanceData.length === 0) {
      throw new NotFoundError("No attendance found for this student.");
    }

    for (const attendance of attendanceData) {
      if (attendance.attendance === "present") {
        attendance.numberOfTimesPresent += 1;
      } else {
        attendance.numberOfTimesAbsent += 1;
      }
    }

    const overallMarkObtainable = subjectsGrade.reduce(
      (sum, item) => sum + item.markObtainable,
      0,
    );
    const overallMarkObtained = subjectsGrade.reduce(
      (sum, item) => sum + item.markObtained,
      0,
    );
    const overallPercentage =
      overallMarkObtainable > 0
        ? parseFloat(
            ((overallMarkObtained / overallMarkObtainable) * 100).toFixed(2),
          )
        : 0;

    const reportCard = new ReportCard({
      student,
      classId,
      teacher,
      session,
      overallMarkObtainable,
      overallMarkObtained,
      overallPercentage,
      term,
      teacherComment,
      subjectsGrade,
    });
    await reportCard.save();

    const populatedReportCard = await ReportCard.findById(
      reportCard._id,
    ).populate([
      {
        path: "subjectsGrade",
        select:
          "gradeId subjectId subjectName testScore examScore markObtained grade percentage markObtainable remark",
      },
      { path: "classId", select: "_id className" },
      { path: "student", select: "_id firstName middleName lastName" },
      { path: "teacher", select: "_id name" },
    ]);
    res.status(StatusCodes.CREATED).json({
      message: "Report card created successfully",
      populatedReportCard,
    });
  } catch (error) {
    console.error("Error creating report card:", error);
    next(new BadRequestError(error.message));
  }
};

// Get all report cards
export const getReportCards = async (req, res, next) => {
  try {
    const { student, firstName, middleName, lastName, classId, term, session } =
      req.query;

    // Build a query object based on provided filters
    const queryObject = {};

    if (student) {
      queryObject["student.name"] = { $regex: name, $options: "i" }; // Case-insensitive search
      // queryObject["student"] = { $regex: student, $options: "i" }; // Case-insensitive search
    }
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
    if (term) {
      queryObject["term"] = term;
    }
    if (session) {
      queryObject["session"] = session;
    }

    const reportCards = await ReportCard.find(queryObject).populate([
      {
        path: "subjectsGrade",
        select:
          "gradeId subjectId subjectName testScore examScore markObtained grade percentage markObtainable remark",
      },
      { path: "classId", select: "_id className" },
      { path: "student", select: "_id firstName middleName lastName" },
      { path: "teacher", select: "_id name" },
    ]);
    res.status(StatusCodes.OK).json({ count: reportCards.length, reportCards });
  } catch (error) {
    console.error("Error getting report cards:", error);
    next(new BadRequestError(error.message));
  }
};

// Get all report cards for a specific student
export const getReportCardsForStudent = async (req, res) => {
  try {
    const reportCards = await ReportCard.find({
      student: req.params.studentId,
      session: req.query.session,
      term: req.query.term,
    }).populate("student class grades");
    res.status(200).json(reportCards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get report card by ID
export const getReportCardById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const reportCard = await ReportCard.findById(id).populate([
      {
        path: "subjectsGrade",
        select:
          "gradeId subjectId subjectName testScore examScore markObtained grade percentage markObtainable remark",
      },
      { path: "classId", select: "_id className" },
      { path: "student", select: "_id firstName middleName lastName" },
      { path: "teacher", select: "_id name" },
    ]);
    if (!reportCard) {
      throw new NotFoundError("Report card not found");
    }

    res.status(StatusCodes.OK).json(reportCard);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Update a report card
export const updateReportCard = async (req, res) => {
  try {
    const { grades, comments, session, term } = req.body;
    const updatedReportCard = await ReportCard.findByIdAndUpdate(
      req.params.id,
      { grades, comments, session, term },
      { new: true },
    );
    if (!updatedReportCard)
      return res.status(404).json({ error: "Report card not found" });
    res.status(200).json(updatedReportCard);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a report card
import mongoose from "mongoose";
import Attendance from "../models/AttendanceModel.js";

export const deleteReportCard = async (req, res, next) => {
  try {
    const { reportCardId } = req.params;

    // Validate ID format
    if (!mongoose.Types.ObjectId.isValid(reportCardId)) {
      throw new BadRequestError("Invalid report card ID format.");
    }

    // Attempt to delete the report card
    const reportCard = await ReportCard.findByIdAndDelete(reportCardId);
    if (!reportCard) {
      throw new NotFoundError("Student report card not found.");
    }

    res
      .status(StatusCodes.OK)
      .json({ message: "Report card deleted successfully" });
  } catch (error) {
    next(error);
  }
};
