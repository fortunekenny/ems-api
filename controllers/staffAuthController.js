import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import createTokenUser from "../utils/createTokenUser.js";
import { attachCookiesToResponse } from "../utils/jwt.js";
import Staff from "../models/StaffModel.js";
import Class from "../models/ClassModel.js";
import Subject from "../models/SubjectModel.js";
import Attendance from "../models/AttendanceModel.js"; // Ensure
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";
import generateID from "../utils/generateId.js";
import calculateAge from "../utils/ageCalculate.js";

// Helper function to validate term and session consistency
const isValidTermAndSession = (subject, term, session) =>
  subject.term === term && subject.session === session;

// Helper function to remove subject from the previous teacher's lists
const removeSubjectFromPreviousTeacher = async (subject, previousTeacherId) => {
  const previousTeacher = await Staff.findById(previousTeacherId);
  if (previousTeacher) {
    // Remove the subject from the previous teacher's subjects list
    previousTeacher.subjects = previousTeacher.subjects.filter(
      (subjId) => subjId.toString() !== subject._id.toString(),
    );

    // Also check the classId for removing
    const classId = subject.classId.toString();

    // Check if the previous teacher is still assigned to other subjects for this class
    const otherSubjects = await Subject.find({
      classId: classId,
      subjectTeachers: previousTeacherId,
      _id: { $ne: subject._id }, // Exclude the current subject
    });

    // If the previous teacher is not teaching any other subjects for this class, remove the class from their classes list
    if (otherSubjects.length === 0) {
      previousTeacher.classes = previousTeacher.classes.filter(
        (clsId) => clsId.toString() !== classId,
      );
    }

    await previousTeacher.save();

    // Now, handle class.subjectTeachers
    const assignedClass = await Class.findById(classId);
    if (assignedClass) {
      // Remove the teacher from the class's subjectTeachers list if they are not teaching any other subjects for that class
      assignedClass.subjectTeachers = assignedClass.subjectTeachers.filter(
        (teacherId) => teacherId.toString() !== previousTeacherId.toString(),
      );

      await assignedClass.save();
    }
  }
};

// Helper function to assign subject teachers and update staff's classes/subjects
const assignSubjectTeacherAndUpdateClass = async (
  subject,
  staff,
  term,
  session,
) => {
  if (isValidTermAndSession(subject, term, session)) {
    // If a subject already has a teacher, remove the subject from the previous teacher
    const previousTeacherId = subject.subjectTeachers[0]; // Assuming only one teacher is assigned
    if (
      previousTeacherId &&
      previousTeacherId.toString() !== staff._id.toString()
    ) {
      await removeSubjectFromPreviousTeacher(subject, previousTeacherId);
    }

    // Add the current staff as the subject teacher if not already assigned
    if (!subject.subjectTeachers.includes(staff._id)) {
      subject.subjectTeachers = [staff._id]; // Only allow one teacher for now
    }
    await subject.save();

    // Add the subject to the staff's subjects list if not already there
    if (!staff.subjects.includes(subject._id)) {
      staff.subjects.push(subject._id);
    }

    // Append the classId of the subject to staff's classes list if not already there
    const classId = subject.classId.toString();
    if (!staff.classes.includes(classId)) {
      staff.classes.push(classId);
    }

    // Add the teacher to the class's subjectTeachers list if not already there
    const assignedClass = await Class.findById(classId);
    if (!assignedClass.subjectTeachers.includes(staff._id)) {
      assignedClass.subjectTeachers.push(staff._id);
    }

    // Save the updated class
    await assignedClass.save();
  }
};

export const registerStaff = async (req, res) => {
  const {
    firstName,
    middleName,
    lastName,
    houseNumber,
    streetName,
    townOrCity,
    phoneNumber,
    dateOfBirth,
    age,
    gender,
    email,
    password,
    role,
    department,
    subjects,
    classes,
    isClassTeacher, // Should be the class ID where the teacher is a class teacher
  } = req.body;

  // Validate required fields
  if (
    !email ||
    !password ||
    !role ||
    !firstName ||
    !middleName ||
    !lastName ||
    !streetName ||
    !townOrCity ||
    !dateOfBirth ||
    !phoneNumber ||
    !age ||
    !gender
  ) {
    throw new BadRequestError("Please provide all required fields.");
  }

  // Check if email already exists
  const emailAlreadyExists = await Staff.findOne({ email });
  if (emailAlreadyExists) {
    throw new BadRequestError("Email already exist, kindly login");
  }

  // Generate the current term based on the provided start date and holiday durations
  const { term, session } = getCurrentTermDetails(
    startTermGenerationDate,
    holidayDurationForEachTerm,
  );

  try {
    // Create Staff user
    const staff = await Staff.create({
      firstName,
      middleName,
      lastName,
      houseNumber,
      streetName,
      townOrCity,
      phoneNumber,
      dateOfBirth,
      age: calculateAge(dateOfBirth),
      gender,
      email,
      password,
      role,
      employeeID: await generateID("EMP", firstName, middleName, lastName),
      department,
      subjects,
      classes,
      term,
      session,
      isClassTeacher,
    });

    // Handle class teacher assignment and subject update
    if (role === "teacher" && isClassTeacher) {
      const assignedClass = await Class.findById(isClassTeacher);
      if (!assignedClass) {
        throw new BadRequestError("Assigned class not found for class teacher");
      }

      assignedClass.classTeacher = staff._id; // Assign the teacher as class teacher
      staff.isClassTeacher = assignedClass._id; // Update staff's isClassTeacher field

      // Add classId to staff.classes if not already present
      const classId = assignedClass._id.toString();
      if (!staff.classes.includes(classId)) {
        staff.classes.push(classId);
      }

      await assignedClass.save(); // Save the updated class

      // Update attendance records for the assigned class from the current date onward
      const attendanceUpdateResult = await Attendance.updateMany(
        {
          classId: isClassTeacher,
          term: term,
          session: staff.session,
          date: { $gte: new Date() }, // Apply to current and future dates
        },
        { $set: { classTeacher: staff._id } },
      );

      console.log(
        `Updated ${attendanceUpdateResult.modifiedCount} attendance records with new classTeacher.`,
      );

      // Fetch all subjects for this class in the same term and session
      const classSubjects = await Subject.find({
        classId: isClassTeacher,
        term: term,
        session: staff.session,
      });

      // Assign subjects to the teacher and update staff classes/subjects
      for (const subject of classSubjects) {
        await assignSubjectTeacherAndUpdateClass(
          subject,
          staff,
          term,
          staff.session,
        );
      }

      // Save the updated staff
      await staff.save();
    }

    // Handle case where the teacher has specific subjects assigned
    if (role === "teacher" && subjects && subjects.length > 0) {
      for (const subjectId of subjects) {
        const assignedSubject = await Subject.findById(subjectId);
        if (assignedSubject) {
          await assignSubjectTeacherAndUpdateClass(
            assignedSubject,
            staff,
            term,
            staff.session,
          );
        }
      }

      // Save the updated staff
      await staff.save();
    }

    // Create token for the new staff
    const tokenUser = createTokenUser(staff);

    // Attach token to response cookies
    attachCookiesToResponse({ res, user: tokenUser });

    // Return staff details and token in response
    res.status(StatusCodes.CREATED).json({
      staff,
      token: tokenUser,
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  }
};
