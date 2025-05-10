// Import necessary models and utilities at the top
import Parent from "../models/ParentModel.js";
import Student from "../models/StudentModel.js";
import Class from "../models/ClassModel.js";
import Subject from "../models/SubjectModel.js";
import Attendance from "../models/AttendanceModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import Forbidden from "../errors/forbidden.js";
import createTokenUser from "../utils/createTokenUser.js";
import { attachCookiesToResponse } from "../utils/jwt.js";
import generateID from "../utils/generateId.js";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";
import InternalServerError from "../errors/internal-server-error.js";

// Utility to generate a list of school days in a term (excluding weekends)
const getSchoolDays = (startDate, endDate) => {
  const schoolDays = [];
  let currentDate = new Date(startDate);

  while (currentDate <= endDate) {
    const dayOfWeek = currentDate.getDay();
    if (dayOfWeek !== 0 && dayOfWeek !== 6) {
      schoolDays.push(new Date(currentDate));
    }
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return schoolDays;
};

// Register Student and create attendance
export const registerStudent = async (req, res, next) => {
  const {
    firstName,
    middleName,
    lastName,
    houseNumber,
    streetName,
    townOrCity,
    phoneNumber,
    password,
    classId,
    dateOfBirth,
    age,
    gender,
  } = req.body;

  if (
    !firstName ||
    !middleName ||
    !lastName ||
    !streetName ||
    !townOrCity ||
    !dateOfBirth ||
    !age ||
    !gender ||
    !classId
  ) {
    throw new BadRequestError("Please provide all required fields");
  }

  const { role, userId } = req.user;

  try {
    if (role !== "parent" && role !== "admin" && role !== "proprietor") {
      throw new Forbidden("Only parents can register students.");
    }

    let parent = null;
    let parentGuardianId = null;
    let assignedGuardian = null;

    if (role === "parent") {
      parent = await Parent.findById(userId);
      if (!parent) throw new NotFoundError("Parent not found");
      parentGuardianId = parent._id;
    }

    if (role === "admin" || role === "proprietor") {
      if (!req.body.parentGuardianId) {
        throw new BadRequestError(
          "Admin must assign a parent for the student.",
        );
      }

      assignedGuardian = await Parent.findById(req.body.parentGuardianId);
      if (!assignedGuardian) {
        throw new NotFoundError("Assigned parent/guardian not found.");
      }
      parentGuardianId = assignedGuardian._id;
    }

    const { term, session, startDate, endDate } = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    await Student.collection.dropIndex("email_1");
    await Student.createIndexes();

    const student = new Student({
      firstName,
      middleName,
      lastName,
      houseNumber,
      streetName,
      townOrCity,
      dateOfBirth,
      phoneNumber,
      studentID: await generateID("STU", firstName, middleName, lastName),
      email: req.body.email == null ? undefined : req.body.email,
      password,
      classId,
      parentGuardianId,
      age,
      gender,
      term,
      session,
    });

    await student.save();

    // Verify class exists and add student
    const assignedClass = await Class.findById(classId);
    if (!assignedClass) {
      throw new NotFoundError(`Class not found`);
    }
    if (
      assignedClass.term === term &&
      assignedClass.session === student.session
    ) {
      assignedClass.students.push(student._id);
      await assignedClass.save();
    }

    // Retrieve the class teacher from the class document
    const classTeacher = assignedClass.classTeacher;

    // Update subjects for the assigned class
    const subjects = await Subject.find({
      _id: { $in: assignedClass.subjects },
    });
    for (const subject of subjects) {
      if (subject.term === term && subject.session === student.session) {
        subject.students.push(student._id);
        await subject.save();
      }
    }

    // Update parent's children
    const targetParent = role === "parent" ? parent : assignedGuardian;

    if (targetParent.father && Object.keys(targetParent.father).length > 0) {
      targetParent.father.children.push(student._id);
    }
    if (targetParent.mother && Object.keys(targetParent.mother).length > 0) {
      targetParent.mother.children.push(student._id);
    }
    if (
      targetParent.singleParent &&
      Object.keys(targetParent.singleParent).length > 0
    ) {
      targetParent.singleParent.children.push(student._id);
    }

    await targetParent.save();

    // Generate school days and attendance records
    const schoolDays = getSchoolDays(new Date(startDate), new Date(endDate));
    const attendanceIds = [];

    for (const date of schoolDays) {
      const attendance = new Attendance({
        student: student._id,
        classId: classId,
        date: date,
        morningStatus: "pending", // Separate status for morning attendance
        afternoonStatus: "pending", // Separate status for afternoon attendance
        session: student.session,
        term: student.term,
        classTeacher: classTeacher, // Assign class teacher
      });

      const savedAttendance = await attendance.save();
      attendanceIds.push(savedAttendance._id);
    }

    student.attendance = attendanceIds; // Add attendance IDs to the student document
    await student.save(); // Save updated student with attendance references

    const tokenUser = createTokenUser(student);
    attachCookiesToResponse({ res, user: tokenUser });

    const populatedStudent = await Student.findById(student._id)
      .select("-password")
      .populate([
        {
          path: "classId",
          select: "_id className classTeacher subjectTeachers subjects",
          populate: [
            { path: "classTeacher", select: "_id name" },
            { path: "subjectTeachers", select: "_id name" },
            { path: "subjects", select: "_id subjectName" },
          ],
        },
        { path: "guardian", select: "_id name" },
      ]);

    res.status(StatusCodes.CREATED).json({
      message: "Student registered successfully",
      populatedStudent,
      token: tokenUser,
    });
  } catch (error) {
    if (error.code === 11000) {
      console.error("Error registering student:", error);
      throw new BadRequestError("There is a duplicate error of unique values.");
    }
    console.error("Error registering student:", error);
    next(new InternalServerError(error.message));

    // throw error;
  }
};
