import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import createTokenUser from "../utils/createTokenUser.js";
import { attachCookiesToResponse } from "../utils/jwt.js";
import Staff from "../models/StaffModel.js"; // Ensure to import the Staff model
import Class from "../models/ClassModel.js"; // Import the Class model
import {
  generateCurrentTerm,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js"; // Import the term generation function

export const registerStaff = async (req, res) => {
  const {
    name,
    email,
    password,
    role,
    department,
    subjects,
    classes,
    isClassTeacher, // Should be the class ID where the teacher is a class teacher
  } = req.body;

  // Validate required fields
  if (!email || !password || !name || !role) {
    throw new BadRequestError("Please provide email, password, name, and role");
  }

  // Check if email already exists
  const emailAlreadyExists = await Staff.findOne({ email });
  if (emailAlreadyExists) {
    throw new BadRequestError("Email already exists");
  }

  // Generate the current term based on the provided start date and holiday durations
  const term = generateCurrentTerm(
    startTermGenerationDate,
    holidayDurationForEachTerm,
  );

  try {
    // Create Staff user
    const staff = await Staff.create({
      name,
      email,
      password,
      role,
      department,
      subjects,
      classes,
      term, // Store the current term
    });

    // Assign the teacher as class teacher if isClassTeacher is provided
    if (role === "teacher" && isClassTeacher) {
      const assignedClass = await Class.findById(isClassTeacher);
      if (assignedClass) {
        assignedClass.classTeacher = staff._id; // Assign the teacher as class teacher
        staff.isClassTeacher = assignedClass._id; // Update staff's isClassTeacher field
        await assignedClass.save(); // Save the updated class
      } else {
        throw new BadRequestError("Assigned class not found for class teacher");
      }
    }

    // If the teacher has classes assigned, update the subject teachers in those classes
    if (role === "teacher" && classes && classes.length > 0) {
      for (const classId of classes) {
        const assignedClass = await Class.findById(classId);
        if (assignedClass) {
          // Add teacher to subject teachers if not already included
          if (!assignedClass.subjectTeachers.includes(staff._id)) {
            assignedClass.subjectTeachers.push(staff._id);
            await assignedClass.save(); // Save the updated class
          }
        }
      }
    }

    // Save the staff if isClassTeacher field was updated
    await staff.save();

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
