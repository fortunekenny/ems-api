import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/badRequest.js";
import User from "../models/UserModel.js";
import Parent from "../models/ParentModel.js";
import { createTokenUser, attachCookiesToResponse } from "../utils/token.js";

export const registerParent = async (req, res) => {
  const { name, email, password, children } = req.body;

  // Validate required fields
  if (!email || !password || !name) {
    throw new BadRequestError("Please provide email, password, and name");
  }

  // Check if email already exists
  const emailAlreadyExists = await User.findOne({ email });
  if (emailAlreadyExists) {
    throw new BadRequestError("Email already exists");
  }

  try {
    // Create Parent user
    const parent = await Parent.create({
      name,
      email,
      password,
      children, // Array of student ObjectId(s)
    });

    // Create token for the new parent
    const tokenUser = createTokenUser(parent);

    // Attach token to response cookies
    attachCookiesToResponse({ res, user: tokenUser });

    // Return parent details and token in response
    res.status(StatusCodes.CREATED).json({
      parent: { name: parent.name, email: parent.email },
      token: tokenUser,
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  }
};
