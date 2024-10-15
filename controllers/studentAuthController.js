import Parent from "../models/ParentModel.js";
import Student from "../models/StudentModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import createTokenUser from "../utils/createTokenUser.js";
import { attachCookiesToResponse } from "../utils/jwt.js";
import {
  generateCurrentTerm,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js"; // Import the term generation function

// Register Student (Only a Parent or Admin can register a student)
export const registerStudent = async (req, res) => {
  // Get the user ID and role from the authenticated request
  const { role, userId } = req.user; // Extracting role and userId from req.user

  const { name, email, password, classId, age, gender, address, guardianId } =
    req.body;

  // Validate required fields
  if (!name || !email || !password || !age || !gender || !address) {
    throw new BadRequestError("Please provide all required fields");
  }

  try {
    // Check if the user is a parent or an admin
    if (role !== "parent" && role !== "admin") {
      return res.status(StatusCodes.FORBIDDEN).json({
        error: "Access denied. Only parents or admins can register students.",
      });
    }

    let parent = null;
    let guardian = null;

    // Logic for parents: The parent is automatically the guardian
    if (role === "parent") {
      parent = await Parent.findById(userId);
      if (!parent) {
        return res
          .status(StatusCodes.NOT_FOUND)
          .json({ error: "Parent not found" });
      }
      guardian = parent._id; // Set the current parent as the guardian
    }

    // Logic for admins: Admin must assign a guardian (parent)
    if (role === "admin") {
      if (!guardianId) {
        throw new BadRequestError(
          "Admin must assign a guardian (parent) for the student.",
        );
      }

      guardian = await Parent.findById(guardianId);
      if (!guardian) {
        return res
          .status(StatusCodes.NOT_FOUND)
          .json({ error: "Assigned guardian (parent) not found." });
      }

      guardian = guardian._id; // Set the assigned parent as the guardian
    }

    const emailAlreadyExists = await Student.findOne({ email });
    if (emailAlreadyExists) {
      throw new BadRequestError("Student email already exists");
    }

    // Generate the current term based on the provided start date and holiday durations
    const term = generateCurrentTerm(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // Create the new student with the assigned guardian (either parent or assigned by admin)
    const student = new Student({
      name,
      email,
      password,
      class: classId,
      guardian, // Set the guardian (either the parent or assigned parent by admin)
      age,
      gender,
      address,
      term, // Set the generated term
    });

    // Save the student to the database
    await student.save();

    // If a parent registered the student, add the student ID to the parent's children array
    if (role === "parent") {
      parent.children.push(student._id);
      await parent.save(); // Save the parent with the updated children list
    }

    // If the student was registered by an admin, you can optionally add the student ID to the assigned guardian's children
    if (role === "admin") {
      const assignedParent = await Parent.findById(guardianId);
      assignedParent.children.push(student._id);
      await assignedParent.save(); // Save the assigned parent with the updated children list
    }

    // Optionally generate a token for the student (if needed)
    const tokenUser = createTokenUser(student); // Create token user for the student
    attachCookiesToResponse({ res, user: tokenUser }); // Attach token to response cookies

    // Respond with success
    res.status(StatusCodes.CREATED).json({
      student,
      token: tokenUser, // Sending the token for the student
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  }
};
