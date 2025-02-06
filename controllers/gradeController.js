import Grade from "../models/GradeModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import StudentAnswer from "../models/StudentAnswerModel.js";
import Staff from "../models/StaffModel.js";
import mongoose from "mongoose";

// Create a grade
export const createGrade = async (req, res, next) => {
  try {
    const {
      student,
      subject,
      teacher,
      classId,
      session,
      term,
      markObtainable,
    } = req.body;

    if (
      !student ||
      !subject ||
      !classId ||
      !session ||
      !term ||
      !markObtainable
    ) {
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

      const teacherData = await Staff.findById(subjectTeacherId).populate([
        { path: "subjects", select: "_id subjectName" },
      ]);
      if (!teacherData) {
        throw new NotFoundError("Provided teacher not found.");
      }

      const isAssignedSubject = teacherData.subjects.some(
        (subjectItem) => subjectItem && subjectItem.equals(subject),
      );

      if (!isAssignedSubject) {
        throw new BadRequestError(
          "The specified teacher is not assigned to the selected subject.",
        );
      }
    } else if (userRole === "teacher") {
      const teacherData = await Staff.findById(userId).populate("subjects");
      if (!teacherData) {
        throw new NotFoundError("Teacher not found.");
      }

      isAuthorized = teacherData.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to grade this subject.",
        );
      }

      subjectTeacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to grade this subject.",
      );
    }

    const evaluationData = await StudentAnswer.find({
      student: student,
      classId: classId,
      subject: subject,
      term: term,
      session: session,
    });

    if (evaluationData.length === 0) {
      throw new NotFoundError("Evaluation not found.");
    }

    let exam = null;
    let examScore = 0;
    const tests = [];
    let testsScore = 0;

    for (const studentAnswer of evaluationData) {
      if (studentAnswer.evaluationType === "Exam") {
        // Update exam-related fields
        exam = studentAnswer._id;
        examScore = Number(studentAnswer.markObtained);
      } else if (studentAnswer.evaluationType === "Test") {
        // Update test-related fields
        tests.push(studentAnswer._id);
        testsScore += studentAnswer.markObtained;
      }
    }

    const markObtained = examScore + testsScore;

    const percentageScore = (markObtained / Number(markObtainable)) * 100;

    const grade = (() => {
      if (percentageScore < 30) return "F";
      if (percentageScore < 40) return "E";
      if (percentageScore < 50) return "D";
      if (percentageScore < 60) return "C";
      if (percentageScore < 70) return "B";
      return "A";
    })();

    const remark = (() => {
      if (grade === "F") return "Failed";
      if (grade === "E") return "Passed";
      if (grade === "D") return "Fair";
      if (grade === "C") return "Good";
      if (grade === "B") return "Very Good";
      return "Excellent";
    })();

    const newGrade = new Grade({
      student,
      subject,
      teacher,
      classId,
      exam,
      examScore,
      tests,
      testsScore,
      markObtained,
      markObtainable,
      percentageScore,
      grade,
      session,
      term,
      remark,
    });
    await newGrade.save();

    const populatedGrade = await Grade.findById(newGrade._id).populate([
      // { path: "exam", select: "_id totalScore" },
      // { path: "tests", select: "_id totalScore" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "student", select: "_id firstName middleName lastName" },
      { path: "teacher", select: "_id name" },
    ]);

    res.status(StatusCodes.CREATED).json({
      message: "Graded successfully",
      populatedGrade,
    });
  } catch (error) {
    console.error("Error creating test:", error);
    next(new BadRequestError(error.message));
  }
};

// Get all grades
export const getGrades = async (req, res, next) => {
  try {
    const { firstName, middleName, lastName, subject, classId, term, session } =
      req.query;

    // Build a query object based on provided filters
    const queryObject = {};

    /*     if (student) {
      queryObject["student.name"] = { $regex: name, $options: "i" }; // Case-insensitive search
      // queryObject["student"] = { $regex: student, $options: "i" }; // Case-insensitive search
    } */
    if (firstName) {
      queryObject["firstName"] = { $regex: firstName, $options: "i" }; // Case-insensitive search
    }
    if (middleName) {
      queryObject["middleName"] = { $regex: middleName, $options: "i" }; // Case-insensitive search
    }
    if (lastName) {
      queryObject["lastName"] = { $regex: lastName, $options: "i" }; // Case-insensitive search
    }
    if (subject) {
      queryObject["subject"] = subject;
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

    const grades = await Grade.find(queryObject).populate([
      // { path: "exam", select: "_id totalScore" },
      // { path: "tests", select: "_id totalScore" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "student", select: "_id firstName middleName lastName" },
      { path: "teacher", select: "_id name" },
      // { path: "students", select: "_id firstName lastName" },
    ]);
    res.status(StatusCodes.OK).json({ count: grades.length, grades });
  } catch (error) {
    console.error("Error getting grade:", error);
    next(new BadRequestError(error.message));
  }
};

// Get all grades for a specific student
export const getGradesForStudent = async (req, res) => {
  try {
    const grades = await Grade.find({ student: req.params.studentId }).populate(
      "student subject teacher",
    );
    res.status(200).json(grades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a grade by ID
export const getGradeById = async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.id).populate(
      "student subject teacher",
    );
    if (!grade) return res.status(404).json({ error: "Grade not found" });
    res.status(200).json(grade);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a grade
export const updateGrade = async (req, res, next) => {
  try {
    const updatedGrade = await Grade.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    res
      .status(StatusCodes.OK)
      .json({ message: "Grade updated successfully.", updatedGrade });
  } catch (error) {
    console.error("Error updating grade:", error);
    next(new BadRequestError(error.message));
  }
};

// Delete a grade
export const deleteGrade = async (req, res) => {
  try {
    const grade = await Grade.findByIdAndDelete(req.params.id);
    if (!grade) return res.status(404).json({ error: "Grade not found" });
    res.status(200).json({ message: "Grade deleted successfully" });
  } catch (error) {
    console.error("Error deleting grade:", error);
    res.status(500).json({ error: error.message });
  }
};

/*
const transitionToNewTermOrSession = async (startDate, holidayDurations) => {
  try {
    // Get the current term details
    const {
      term: currentTerm,
      nextTermStartDate,
      session: currentSession,
      isHoliday,
    } = getCurrentTermDetails(startDate, holidayDurations);

    console.log(`Current term: ${currentTerm}, Is holiday: ${isHoliday}`);

    // Determine the next term/session
    const terms = ["first", "second", "third"];
    const nextTermIndex = (terms.indexOf(currentTerm) + 1) % terms.length;
    const nextTerm = terms[nextTermIndex];
    const isNewSession = nextTerm === "first"; // New session begins with the first term

    const newSession = isNewSession
      ? `${parseInt(currentSession.split("/")[0], 10) + 1}/${parseInt(currentSession.split("/")[1], 10) + 1}`
      : currentSession;

    console.log(`Transitioning to ${nextTerm} term in session ${newSession}`);

    // Create new records for the next term/session
    const classes = await Class.find({ session: currentSession, term: currentTerm });

    for (const classDoc of classes) {
      const newClass = new Class({
        ...classDoc.toObject(),
        term: nextTerm,
        session: newSession,
      });
      await newClass.save();
    }

    console.log(`Created new classes for term: ${nextTerm}, session: ${newSession}`);

    // Reset attendance records
    const attendances = await Attendance.find({ session: currentSession, term: currentTerm });

    for (const attendanceDoc of attendances) {
      const newAttendance = new Attendance({
        ...attendanceDoc.toObject(),
        term: nextTerm,
        session: newSession,
        date: undefined, // Clear the date for new attendance records
      });
      await newAttendance.save();
    }

    console.log(`Attendance reset for term: ${nextTerm}, session: ${newSession}`);

    // Optionally notify stakeholders
    await notifyUsers(nextTerm, newSession, isHoliday);

    console.log("Transition completed successfully.");
  } catch (error) {
    console.error("Error transitioning to new term/session:", error);
  }
};
*/
