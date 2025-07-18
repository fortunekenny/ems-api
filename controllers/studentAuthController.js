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
    gender,
  } = req.body;

  // Parse dateOfBirth from dd/mm/yyyy or dd/mm/yy string to JS Date
  function parseDateOfBirth(dobStr) {
    if (!dobStr || typeof dobStr !== "string") return null;
    // Accept dd/mm/yyyy or dd/mm/yy
    const parts = dobStr.split("/");
    if (parts.length !== 3) return null;
    let [day, month, year] = parts;
    day = parseInt(day, 10);
    month = parseInt(month, 10) - 1; // JS months are 0-based
    year = year.length === 2 ? 2000 + parseInt(year, 10) : parseInt(year, 10);
    const dateObj = new Date(year, month, day);
    if (isNaN(dateObj.getTime())) return null;
    return dateObj;
  }

  // Calculate age from JS Date
  function calculateAge(birthDate) {
    if (!birthDate || isNaN(birthDate.getTime())) {
      throw new BadRequestError("Invalid dateOfBirth format");
    }
    const today = new Date();
    let age = today.getFullYear() - birthDate.getFullYear();
    const m = today.getMonth() - birthDate.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birthDate.getDate())) {
      age--;
    }
    return age;
  }

  if (
    !firstName ||
    !middleName ||
    !lastName ||
    !streetName ||
    !townOrCity ||
    !dateOfBirth ||
    !gender ||
    !classId
  ) {
    throw new BadRequestError("Please provide all required fields");
  }

  const { role, parentId, userId } = req.user;
  let session;

  try {
    if (role !== "parent" && role !== "admin" && role !== "proprietor") {
      throw new Forbidden("Only parents can register students.");
    }

    session = await Student.startSession();
    session.startTransaction();

    let parent = null;
    let parentGuardianId = null;
    let assignedGuardian = null;

    // With this improved version:

    if (role === "parent") {
      // Fallback: if parentId is missing, use userId for parent lookup
      const parentLookupId = parentId || userId;
      parent = await Parent.findById(parentLookupId).session(session);
      if (!parent) throw new NotFoundError("Parent not found");
      parentGuardianId = parentLookupId;
    }

    if (role === "admin" || role === "proprietor") {
      if (!req.body.parentGuardianId) {
        throw new BadRequestError(
          "Admin must assign a parent for the student.",
        );
      }
      assignedGuardian = await Parent.findById(
        req.body.parentGuardianId,
      ).session(session);
      if (!assignedGuardian) {
        throw new NotFoundError("Assigned parent/guardian not found.");
      }
      parentGuardianId = assignedGuardian._id;
    }

    const {
      term,
      session: sessionName,
      startDate,
      endDate,
    } = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // Remove index ops from transaction (should be managed separately)
    // await Student.collection.dropIndex("email_1");
    // await Student.createIndexes();

    // Parse and validate dateOfBirth
    const parsedDOB = parseDateOfBirth(dateOfBirth);
    if (!parsedDOB) {
      throw new BadRequestError(
        "Invalid dateOfBirth format. Expected dd/mm/yyyy or dd/mm/yy",
      );
    }

    const student = new Student({
      firstName,
      middleName,
      lastName,
      houseNumber,
      streetName,
      townOrCity,
      dateOfBirth: parsedDOB,
      phoneNumber,
      studentID: await generateID("STU", firstName, middleName, lastName),
      email: req.body.email == null ? undefined : req.body.email,
      password,
      parentGuardianId,
      age: calculateAge(parsedDOB),
      gender,
      academicRecords: [
        {
          classId,
          term,
          session: sessionName,
        },
      ],
    });

    await student.save({ session });

    // Verify class exists and add student
    const assignedClass = await Class.findById(classId).session(session);
    if (!assignedClass) {
      throw new NotFoundError(`Class not found`);
    }
    if (assignedClass.term === term && assignedClass.session === sessionName) {
      assignedClass.students.push(student._id);
      await assignedClass.save({ session });
    }

    // Retrieve the class teacher from the class document
    const classTeacher = assignedClass.classTeacher;

    // Update subjects for the assigned class
    const subjects = await Subject.find({
      _id: { $in: assignedClass.subjects },
    }).session(session);
    for (const subject of subjects) {
      if (subject.term === term && subject.session === sessionName) {
        subject.students.push(student._id);
        await subject.save({ session });
      }
    }

    // Update parent's children
    const targetParent = role === "parent" ? parent : assignedGuardian;
    if (targetParent.father && Object.keys(targetParent.father).length > 0) {
      if (!targetParent.father.children.includes(student._id)) {
        targetParent.father.children.push(student._id);
      }
    }
    if (targetParent.mother && Object.keys(targetParent.mother).length > 0) {
      if (!targetParent.mother.children.includes(student._id)) {
        targetParent.mother.children.push(student._id);
      }
    }
    if (
      targetParent.singleParent &&
      Object.keys(targetParent.singleParent).length > 0
    ) {
      if (!targetParent.singleParent.children.includes(student._id)) {
        targetParent.singleParent.children.push(student._id);
      }
    }
    await targetParent.save({ session });

    // Generate school days and attendance records
    const {
      schoolDays,
      session: currentSession,
      term: currentTerm,
    } = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );
    const attendanceIds = [];

    for (const date of schoolDays) {
      const attendance = new Attendance({
        student: student._id,
        classId: classId,
        date: date,
        morningStatus: "pending",
        afternoonStatus: "pending",
        classTeacher: classTeacher,
      });
      const savedAttendance = await attendance.save({ session });
      attendanceIds.push(savedAttendance._id);
    }

    // 🔧 Find the current academic record
    const academicRecord = student.academicRecords.find(
      (record) =>
        record.session === currentSession && record.term === currentTerm,
    );

    if (!academicRecord) {
      throw new NotFoundError(
        "Academic record not found for this session and term",
      );
    }

    // ✅ Attach attendance IDs and save student
    academicRecord.attendance.push(...attendanceIds);
    await student.save({ session });

    await session.commitTransaction();
    await session.endSession();
    session = null; // Prevent abort/end in catch block

    // Only non-database operations after transaction is committed
    const tokenUser = createTokenUser(student);
    attachCookiesToResponse({ res, user: tokenUser });

    const populatedStudent = await Student.findById(student._id)
      .select("-password")
      .populate([
        {
          path: "academicRecords.classId",
          select: "_id className section",
        },
        {
          path: "academicRecords",
          populate: {
            path: "attendance",
            select: "id",
          },
        },
        {
          path: "parentGuardianId",
          select: "id",
          populate: [
            { path: "father", select: "id firstName lastName" },
            { path: "mother", select: "id firstName lastName" },
            { path: "singleParent", select: "id firstName lastName" },
          ],
        },
      ]);

    res.status(StatusCodes.CREATED).json({
      message: "Student registered successfully",
      populatedStudent,
      token: tokenUser,
    });
  } catch (error) {
    if (session) {
      try {
        await session.abortTransaction();
      } catch (e) {
        // Ignore abort errors if already committed
      }
      try {
        session.endSession();
      } catch (e) {
        // Ignore endSession errors if already ended
      }
    }
    if (error.code === 11000) {
      console.log("Error registering student:", error);
      throw new BadRequestError("There is a duplicate error of unique values.");
    }
    console.log("Error registering student:", error);
    next(new InternalServerError(error.message));
  }
};
