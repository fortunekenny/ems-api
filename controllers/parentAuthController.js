import { StatusCodes } from "http-status-codes";

import User from "../models/UserModel.js";
import Parent from "../models/ParentModel.js";
import BadRequestError from "../errors/bad-request.js";
import createTokenUser from "../utils/createTokenUser.js";
import { attachCookiesToResponse } from "../utils/jwt.js";
import {
  generateCurrentTerm,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";

export const registerParent = async (req, res) => {
  const { name, email, password, children } = req.body;

  // Validate required fields
  if (!email || !password || !name) {
    throw new BadRequestError("Please provide email, password, and name");
  }

  // Check if email already exists
  const emailAlreadyExists = await Parent.findOne({ email });
  if (emailAlreadyExists) {
    throw new BadRequestError("Email already exists");
  }

  // Generate the current term based on the provided start date and holiday durations
  const term = generateCurrentTerm(
    startTermGenerationDate,
    holidayDurationForEachTerm,
  );

  try {
    // Create Parent user
    const parent = await Parent.create({
      name,
      email,
      password,
      children, // Array of student ObjectId(s)
      term,
    });

    // Create token for the new parent
    const tokenUser = createTokenUser(parent);

    // Attach token to response cookies
    attachCookiesToResponse({ res, user: tokenUser });

    // Return parent details and token in response
    res.status(StatusCodes.CREATED).json({
      parent,
      token: tokenUser,
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  }
};
