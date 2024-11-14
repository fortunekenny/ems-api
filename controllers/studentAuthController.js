// Import necessary models and utilities at the top
import Parent from "../models/ParentModel.js";
import Student from "../models/StudentModel.js";
import Class from "../models/ClassModel.js";
import Subject from "../models/SubjectModel.js";
import Attendance from "../models/AttendanceModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import createTokenUser from "../utils/createTokenUser.js";
import { attachCookiesToResponse } from "../utils/jwt.js";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";

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
export const registerStudent = async (req, res) => {
  const { role, userId } = req.user;
  const { name, email, password, classId, age, gender, address, guardian } =
    req.body;

  // Validate required fields
  if (!name || !email || !password || !age || !gender || !address || !classId) {
    throw new BadRequestError(
      "Please provide all required fields, including classId",
    );
  }

  try {
    // Role validation: Only parent or admin can register a student
    if (role !== "parent" && role !== "admin") {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "Access denied. Only parents or admins can register students.",
      });
    }

    let parent = null;
    let guardianId = null;

    if (role === "parent") {
      parent = await Parent.findById(userId);
      if (!parent) {
        return res
          .status(StatusCodes.NOT_FOUND)
          .json({ error: "Parent not found" });
      }
      guardianId = parent._id;
    }

    if (role === "admin") {
      if (!guardian) {
        throw new BadRequestError(
          "Admin must assign a guardian (parent) for the student.",
        );
      }

      const assignedGuardian = await Parent.findById(guardian);
      if (!assignedGuardian) {
        return res
          .status(StatusCodes.NOT_FOUND)
          .json({ error: "Assigned guardian (parent) not found." });
      }
      guardianId = assignedGuardian._id;
    }

    const emailAlreadyExists = await Student.findOne({ email });
    if (emailAlreadyExists) {
      throw new BadRequestError("Student email already exists");
    }

    // Generate current term details using start date and holiday durations
    const termDetails = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );
    const { term, startDate, endDate } = termDetails;

    // Create and save the new student
    const student = new Student({
      name,
      email,
      password,
      classId,
      guardian: guardianId,
      age,
      gender,
      address,
      term,
      session: "2024/2025",
    });

    await student.save();

    // Verify class exists and add student
    const assignedClass = await Class.findById(classId);
    if (!assignedClass) {
      throw new BadRequestError(`Class with id ${classId} not found`);
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
    if (role === "parent") {
      parent.children.push(student._id);
      await parent.save();
    }

    if (role === "admin") {
      const assignedParent = await Parent.findById(guardian);
      assignedParent.children.push(student._id);
      await assignedParent.save();
    }

    // Generate school days and attendance records
    const schoolDays = getSchoolDays(new Date(startDate), new Date(endDate));
    const attendanceIds = [];
    for (const date of schoolDays) {
      const attendance = new Attendance({
        student: student._id,
        classId: classId,
        date: date,
        status: "Pending",
        session: student.session,
        term: student.term,
        classTeacher: classTeacher, // Add classTeacher to attendance
      });
      const savedAttendance = await attendance.save();
      attendanceIds.push(savedAttendance._id);
    }

    student.attendance = attendanceIds; // Add attendance IDs to the student document
    await student.save(); // Save updated student with attendance references

    const tokenUser = createTokenUser(student);
    attachCookiesToResponse({ res, user: tokenUser });

    res.status(StatusCodes.CREATED).json({
      student,
      token: tokenUser,
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  }
};
