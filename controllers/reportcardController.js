import ReportCard from "../models/ReportcardModel.js";
import Student from "../models/StudentModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import InternalServerError from "../errors/internal-server-error.js";
import Grade from "../models/GradeModel.js";
import Class from "../models/ClassModel.js";
import Staff from "../models/StaffModel.js";
import {
  getCurrentTermDetails,
  startTermGenerationDate, // Ensure this is correctly defined
  holidayDurationForEachTerm, // Ensure this is correctly defined
} from "../utils/termGenerator.js"; // Import getCurrentTermDetails

const { session, term, endDate } = getCurrentTermDetails(
  startTermGenerationDate,
  holidayDurationForEachTerm,
  //[] publicHolidays
);

// const endDate = Date.now() - 1000 * 60 * 60 * 24; // 1 day before now

// Create a report card
export const createReportCard = async (req, res, next) => {
  try {
    // Only allow report card creation within the last 2 days before endDate
    const twoDaysBeforeEnd = new Date(endDate);
    twoDaysBeforeEnd.setDate(twoDaysBeforeEnd.getDate() - 1);
    if (Date.now() < twoDaysBeforeEnd) {
      throw new BadRequestError(
        `You can not create report card until the last 2 days of the term. Report card creation opens on ${twoDaysBeforeEnd.toDateString()} and term ends on ${new Date(
          endDate,
        ).toDateString()}.`,
      );
    }

    const {
      student,
      classId,
      teacherComment,
      teacher,
      nextTermResumptionDate,
    } = req.body;

    if (!student || !classId) {
      throw new BadRequestError("Required fields must be provided.");
    }

    const { id: userId, role: userRole } = req.user;

    let classTeacherId;
    let isAuthorized = false;

    if (["admin", "proprietor"].includes(userRole)) {
      isAuthorized = true;
      classTeacherId = teacher;

      // Ensure 'classTeacher' field is provided
      if (!classTeacherId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'teacher' field must be provided.",
        );
      }

      const teacherData = await Staff.findById(classTeacherId).populate(
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
      // session: "2024/2025",
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
      // session: "2025/2026",
    });

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

    // if (gradeData.length === 0 || gradeData.length !== subjects.length ) {

    if (attendanceData.length === 0) {
      throw new NotFoundError("No attendance found for this student.");
    }

    let numberOfTimesPresent = 0;
    let numberOfTimesAbsent = 0;
    let numberOfTimesSchoolOpened = 0;

    for (const attendance of attendanceData) {
      if (attendance.updatedAt >= endDate) {
        numberOfTimesPresent = attendance.totalDaysPresent;
        numberOfTimesAbsent = attendance.totalDaysAbsent;
        numberOfTimesSchoolOpened = attendance.totalDaysSchoolOpened;
      } else {
        throw new BadRequestError(
          "You cannot create a report card until the last day of the term.",
        );
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
      numberOfTimesSchoolOpened,
      numberOfTimesPresent,
      numberOfTimesAbsent,
      nextTermResumptionDate,
      term,
      teacherComment,
      subjectsGrade,
    });
    await reportCard.save();

    // Update the student's academicRecords for this session/term/class to set reportCard
    const studentDoc = await Student.findById(student);
    if (studentDoc && Array.isArray(studentDoc.academicRecords)) {
      const record = studentDoc.academicRecords.find(
        (rec) =>
          rec.session === session &&
          rec.term === term &&
          rec.classId &&
          rec.classId.toString() === classId.toString(),
      );
      if (record) {
        record.reportCard = reportCard._id;
        await studentDoc.save();
      }
    }

    //Compute the student's position (ranking) based on overallPercentage.
    // Retrieve all report cards for the class, term, and session, sorted descending.

    const allReportCards = await ReportCard.find({
      classId,
      term,
      session,
    }).sort({ overallPercentage: -1 });

    let currentRank = 0;
    let lastPercentage = null;
    let rankCounter = 0;

    for (const rc of allReportCards) {
      rankCounter++;
      // If first record or current percentage is less than previous, update rank.
      if (lastPercentage === null || rc.overallPercentage < lastPercentage) {
        currentRank = rankCounter;
      }
      // Else if equal, currentRank remains the same (tie).
      lastPercentage = rc.overallPercentage;
      if (rc._id.equals(reportCard._id)) {
        // Update the newly created report card's position in the database.
        await ReportCard.findByIdAndUpdate(reportCard._id, {
          position: currentRank,
        });
        reportCard.position = currentRank;
        break;
      }
    }

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
      { path: "teacher", select: "_id firstName lastName" },
    ]);
    res.status(StatusCodes.CREATED).json({
      message: "Report card created successfully",
      populatedReportCard,
    });
  } catch (error) {
    console.log("Error creating report card:", error);
    next(new InternalServerError(error.message));
  }
};

export const createReportCardsForClass = async (req, res, next) => {
  try {
    // Validate term end: Ensure the current date is at or after the term end date.
    // endDate should be provided in req.body (as a string or date)
    // const { endDate } = req.body;
    // if (!endDate) {
    //   throw new BadRequestError("Term end date must be provided.");
    // }
    // Only allow report card creation within the last 2 days before endDate
    const twoDaysBeforeEnd = new Date(endDate);
    twoDaysBeforeEnd.setDate(twoDaysBeforeEnd.getDate() - 1);
    if (Date.now() < twoDaysBeforeEnd) {
      throw new BadRequestError(
        `You can not create report card until the last 2 days of the term. Report card creation opens on ${twoDaysBeforeEnd.toDateString()} and term ends on ${new Date(
          endDate,
        ).toDateString()}.`,
      );
    }

    // Extract required fields from the request body.
    const {
      classId,
      term,
      session,
      teacher,
      teacherComment,
      nextTermResumptionDate,
    } = req.body;
    if (!classId || !term || !session) {
      throw new BadRequestError("classId, term, and session are required.");
    }

    // Authorization check: Only allow if the requester is an admin, proprietor, or the class teacher.
    const { id: userId, role: userRole } = req.user;
    let classTeacherId;
    let isAuthorized = false;
    if (["admin", "proprietor"].includes(userRole)) {
      isAuthorized = true;
      classTeacherId = teacher;
      if (!classTeacherId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'teacher' field must be provided.",
        );
      }
      const teacherData = await Staff.findById(classTeacherId).populate(
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
        throw new BadRequestError("You are not the class teacher.");
      }
      isAuthorized = true;
      classTeacherId = userId;
    }
    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to create report cards.",
      );
    }

    // Retrieve class information, including its subjects.
    const classData = await Class.findOne({ _id: classId, term, session })
      .populate("subjects", "subjectName subjectCode")
      .exec();
    if (!classData) {
      throw new NotFoundError("Class not found.");
    }

    // Build a map of subject IDs to subject details.
    const subjectMap = new Map();
    classData.subjects.forEach((subject) => {
      subjectMap.set(subject._id.toString(), {
        subjectName: subject.subjectName,
        subjectCode: subject.subjectCode,
      });
    });

    // Retrieve all students in the class.
    const students = await Student.find({ classId });
    if (students.length === 0) {
      throw new NotFoundError("No students found for this class.");
    }

    // Prepare an array for report card documents.
    const reportCardsToInsert = [];

    // Loop over each student.
    for (const student of students) {
      // Retrieve grade data for this student in the class, term, session.
      const gradeData = await Grade.find({
        student: student._id,
        classId,
        term,
        session,
      });
      if (gradeData.length === 0) {
        // Optionally, you could skip a student if no grade exists,
        // or include default values.
        continue;
      }
      // Map grade data by subject.
      const gradeMap = new Map();
      gradeData.forEach((grade) => {
        gradeMap.set(grade.subject.toString(), grade);
      });

      // Build subjectsGrade: for each subject in the class, include its grade data or default values.
      const subjectsGrade = classData.subjects.map((subject) => {
        const grade = gradeMap.get(subject._id.toString());
        return grade
          ? {
              gradeId: grade._id,
              subjectId: grade.subject,
              subjectName: subject.subjectName,
              testScore: grade.testsScore || 0,
              examScore: grade.examScore || 0,
              markObtained: (grade.testsScore || 0) + (grade.examScore || 0),
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

      // Retrieve attendance data for the student.
      const attendanceData = await Attendance.find({
        student: student._id,
        classId,
        term,
        session,
      });
      if (attendanceData.length === 0) {
        // Optionally, you might skip this student or use default attendance values.
        continue;
      }
      // For simplicity, assume we take the latest attendance record (or sum up if needed).
      let numberOfTimesPresent = 0;
      let numberOfTimesAbsent = 0;
      let numberOfTimesSchoolOpened = 0;
      // You might iterate over attendanceData to compute totals.
      // For demonstration, we'll use the last record where updatedAt >= endDate.
      const latestAttendance = attendanceData.find(
        (a) => new Date(a.updatedAt) >= new Date(endDate),
      );
      if (latestAttendance) {
        numberOfTimesPresent = latestAttendance.totalDaysPresent;
        numberOfTimesAbsent = latestAttendance.totalDaysAbsent;
        numberOfTimesSchoolOpened = latestAttendance.totalDaysSchoolOpened;
      } else {
        // If no attendance record meets the criterion, throw an error.
        throw new BadRequestError(
          "You cannot create a report card until the last day of the term.",
        );
      }

      // Compute overall marks.
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

      // Build a report card object for the student.
      reportCardsToInsert.push({
        student: student._id,
        classId,
        teacher,
        session,
        overallMarkObtainable,
        overallMarkObtained,
        overallPercentage,
        numberOfTimesSchoolOpened,
        numberOfTimesPresent,
        numberOfTimesAbsent,
        nextTermResumptionDate,
        term,
        teacherComment,
        subjectsGrade,
        createdAt: new Date(),
      });
    }

    if (reportCardsToInsert.length === 0) {
      throw new NotFoundError(
        "No report cards could be created. Ensure grade and attendance data exist for students.",
      );
    }

    // Insert all report cards at once.
    const createdReportCards = await ReportCard.insertMany(reportCardsToInsert);

    // Update each student's academicRecords for this session/term/class to set reportCard
    for (const rc of createdReportCards) {
      const studentDoc = await Student.findById(rc.student);
      if (studentDoc && Array.isArray(studentDoc.academicRecords)) {
        const record = studentDoc.academicRecords.find(
          (rec) =>
            rec.session === rc.session &&
            rec.term === rc.term &&
            rec.classId &&
            rec.classId.toString() === rc.classId.toString(),
        );
        if (record) {
          record.reportCard = rc._id;
          await studentDoc.save();
        }
      }
    }

    // Now, compute positions based on overallPercentage.
    // Sort report cards in descending order (highest percentage first)
    const sortedReportCards = createdReportCards.sort(
      (a, b) => b.overallPercentage - a.overallPercentage,
    );

    let currentRank = 0;
    let previousPercentage = null;
    // Iterate and assign position (rank). Tied percentages receive the same position.
    for (let i = 0; i < sortedReportCards.length; i++) {
      const card = sortedReportCards[i];
      if (
        previousPercentage === null ||
        card.overallPercentage < previousPercentage
      ) {
        currentRank = i + 1;
      }
      previousPercentage = card.overallPercentage;
      // Update the report card with its position.
      await ReportCard.findByIdAndUpdate(card._id, { position: currentRank });
      // Also update the local object.
      card.position = currentRank;
    }

    // Optionally, you could populate the report cards before sending the response.
    const populatedReportCards = await ReportCard.find({
      _id: { $in: createdReportCards.map((card) => card._id) },
    })
      .populate({
        path: "student",
        select: "_id firstName middleName lastName",
      })
      .populate({ path: "classId", select: "_id className" })
      .populate({ path: "teacher", select: "_id firstName lastName" });

    res.status(StatusCodes.CREATED).json({
      message: "Report cards created successfully",
      reportCards: populatedReportCards,
    });
  } catch (error) {
    console.log("Error creating report card:", error);
    next(new InternalServerError(error.message));
  }
};

// Get all report cards
export const getReportCards = async (req, res, next) => {
  try {
    // Define allowed query parameters
    const allowedFilters = [
      "student",
      "classId",
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

    const { student, classId, term, session, sort, page, limit } = req.query;

    // Build an initial match stage for fields stored directly on StudentAnswer
    const matchStage = {};

    if (classId)
      matchStage.classId = {
        $regex: `^${classId}$`,
        $options: "i",
      };
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

    // Build additional matching criteria based on joined fields
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
      // newest: { createdAt: -1 },
      // oldest: { createdAt: 1 },
      "a-z": { "studentData.firstName": 1 },
      "z-a": { "studentData.firstName": -1 },
      lastPosition: { position: -1 },
      firstPosition: { position: 1 },
      lowestPresent: { numberOfTimesPresent: -1 },
      highestPresent: { numberOfTimesPresent: 1 },
      lowestAbsentee: { numberOfTimesAbsent: -1 },
      highestAbsentee: { numberOfTimesAbsent: 1 },
      lowestPercentage: { overallPercentage: -1 },
      highestPercentage: { overallPercentage: 1 },
      lowestMarkObtained: { overallMarkObtained: -1 },
      highestMarkObtained: { overallMarkObtained: 1 },
    };
    const sortKey = sortOptions[sort] || sortOptions.newest;
    pipeline.push({ $sort: sortKey });

    // Pagination stages: Calculate skip and limit.
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    pipeline.push({ $skip: (pageNumber - 1) * limitNumber });
    pipeline.push({ $limit: limitNumber });

    // Projection stage: structure the output
    pipeline.push({
      $project: {
        _id: 1,
        term: 1,
        session: 1,
        updatedAt: 1,
        studentData: {
          _id: "$studentData._id",
          firstName: "$studentData.firstName",
          lastName: "$studentData.lastName",
        },
        classData: {
          _id: "$classData._id",
          className: "$classData.className",
        },
      },
    });

    // Execute the aggregation pipeline
    const reportCards = await ReportCard.aggregate(pipeline);

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
    const countResult = await ReportCard.aggregate(countPipeline);
    const totalReportCards = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalReportCards / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalReportCards,
      numOfPages,
      currentPage: pageNumber,
      reportCards,
    });
  } catch (error) {
    console.log("Error getting report cards:", error);
    next(new InternalServerError(error.message));
  }
};

// Get all report cards for a specific student
export const getReportCardsForStudent = async (req, res, next) => {
  try {
    const reportCards = await ReportCard.find({
      student: req.params.studentId,
      session: req.query.session,
      term: req.query.term,
    }).populate("student class grades");
    res.status(StatusCodes.OK).json(reportCards);
  } catch (error) {
    console.log("Error getting report cards for student:", error);
    next(new InternalServerError(error.message));
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
      { path: "teacher", select: "_id firstName lastName" },
    ]);
    if (!reportCard) {
      throw new NotFoundError("Report card not found");
    }

    res.status(StatusCodes.OK).json(reportCard);
  } catch (error) {
    console.log("Error getting report card by ID:", error);
    next(new InternalServerError(error.message));
  }
};

// Update a report card
export const updateReportCard = async (req, res, next) => {
  try {
    const { grades, comments, session, term } = req.body;
    const updatedReportCard = await ReportCard.findByIdAndUpdate(
      req.params.id,
      { grades, comments, session, term },
      { new: true },
    );
    if (!updatedReportCard) {
      throw new NotFoundError("Report card not found");
    }
    res.status(StatusCodes.OK).json(updatedReportCard);
  } catch (error) {
    console.log("Error updating report card:", error);
    next(new InternalServerError(error.message));
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
    console.log("Error deleting report card:", error);
    next(new InternalServerError(error.message));
  }
};
