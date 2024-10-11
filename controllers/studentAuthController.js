import Parent from "../models/ParentModel.js";
import Student from "../models/StudentModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/badRequest.js";
import { createTokenUser, attachCookiesToResponse } from "../utils/token.js";

// Register Student (Only a Parent can register a student)
export const registerStudent = async (req, res) => {
  // Get the parent ID from the authenticated request (this assumes you're using a middleware to authenticate users)
  const parentId = req.user.id;

  const { name, email, password, classId, age, gender, address } = req.body;

  // Validate required fields
  if (!name || !email || !password || !classId || !age || !gender || !address) {
    throw new BadRequestError("Please provide all required fields");
  }

  try {
    // Find the parent who is registering the student
    const parent = await Parent.findById(parentId);
    if (!parent) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ error: "Parent not found" });
    }

    // Create the new student with the parent as the guardian
    const student = new Student({
      name,
      email,
      password,
      class: classId,
      guardian: parentId, // Set the current parent as the guardian
      age,
      gender,
      address,
    });

    // Save the student to the database
    await student.save();

    // After saving the student, add the student ID to the parent's children array
    parent.children.push(student._id);
    await parent.save(); // Save the parent with the updated children list

    // Optionally generate a token for the student (if needed)
    const tokenUser = createTokenUser(student); // Create token user for the student
    attachCookiesToResponse({ res, user: tokenUser }); // Attach token to response cookies

    // Respond with success
    res.status(StatusCodes.CREATED).json({
      student: {
        name: student.name,
        email: student.email,
        class: student.class,
        guardian: parent.name, // Showing parent name as the guardian
      },
      token: tokenUser, // Sending the token for the student
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  }
};
