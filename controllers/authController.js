import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import UnauthenticatedError from "../errors/unauthenticated.js";
import bcrypt from "bcryptjs";
import { attachCookiesToResponse } from "../utils/jwt.js";
import createTokenUser from "../utils/createTokenUser.js";
import Parent from "../models/ParentModel.js";
import Student from "../models/StudentModel.js";
import Staff from "../models/StaffModel.js";

/*
export const register = async (req, res) => {
  // console.log("Register endpoint hit");
  const { email, name, password, role } = req.body;

  // Check if email and password are provided
  if (!email || !password || !name || !role) {
    throw new BadRequestError("Please provide email, password, and name");
  }

  const emailAlreadyExists = await User.findOne({ email });
  if (emailAlreadyExists) {
    throw new BadRequestError("Email already exist");
  }

  //first registered user is
  // const isFirstAccount = (await User.countDocuments({})) === 0;
  // const role = isFirstAccount ? "founder" : "user";

  const user = await User.create({ email, name, password, role });
  const tokenUser = createTokenUser(user);
  attachCookiesToResponse({ res, user: tokenUser });
  res.status(StatusCodes.CREATED).json({ user: tokenUser });
};*/

/*
export const login = async (req, res) => {
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    throw new BadRequestError("Please provide email and password");
  }

  try {
    const user = await User.findOne({ email });

    // Check if user exists
    if (!user) {
      throw new UnauthenticatedError("Invalid Credentials");
    }

    // Check if the user has been approved by an admin
    if (!user.isApproved) {
      return res
        .status(StatusCodes.FORBIDDEN)
        .json({ error: "Your account has not been approved by an admin." });
    }

    // Verify the password
    const isPasswordCorrect = await user.comparePassword(password);
    if (!isPasswordCorrect) {
      throw new UnauthenticatedError("Invalid Credentials");
    }

    // Generate a token for the user
    const tokenUser = createTokenUser(user);
    attachCookiesToResponse({ res, user: tokenUser });

    res.status(StatusCodes.OK).json({ user: tokenUser });
  } catch (error) {
    // Handle errors, returning appropriate status and message
    res.status(StatusCodes.UNAUTHORIZED).json({ error: error.message });
  }
};
*/

export const login = async (req, res) => {
  const { email, password } = req.body;

  // Check if email and password are provided
  if (!email || !password) {
    throw new BadRequestError("Please provide email and password");
  }

  try {
    // First, check in the Parent collection
    let user = await Parent.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      // If found, log in as Parent
      const tokenUser = createTokenUser(user); // Assuming Parent has name, email
      attachCookiesToResponse({ res, user: tokenUser });
      return res.status(StatusCodes.OK).json({
        user: {
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
        // role: "parent",
      });
    }

    // If not found in Parent, check in Student collection
    user = await Student.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      // If found, log in as Student
      const tokenUser = createTokenUser(user); // Assuming Student has name, email
      attachCookiesToResponse({ res, user: tokenUser });
      return res.status(StatusCodes.OK).json({
        user: {
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
        // role: "student",
      });
    }

    // If not found in Parent or Student, check in Staff collection
    user = await Staff.findOne({ email });
    if (user && (await bcrypt.compare(password, user.password))) {
      // If found, log in as Staff
      const tokenUser = createTokenUser(user); // Assuming Staff has name, email, role
      attachCookiesToResponse({ res, user: tokenUser });
      return res.status(StatusCodes.OK).json({
        user: {
          name: user.name,
          email: user.email,
          role: user.role,
          status: user.status,
        },
      });
    }

    // If the user is not found in any collection, return an error
    throw new UnauthenticatedError("Invalid credentials");
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
};

// const logout = async (req, res) => {
//   res.cookie("token", "logout", {
//     httpOnly: true,
//     expires: new Date(Date.now()),
//   });
//   res.status(StatusCodes.OK).json({ msg: `user logged out` });
// };

export const logout = (req, res) => {
  // Clear the JWT token from the cookie
  res.clearCookie("token", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production", // Set to true in production
    sameSite: "Strict",
  });

  // res.json({ message: "User logged out successfully" });
  res.status(StatusCodes.OK).json({ msg: `User logged out successfully` });
};

// export default {
//   register,
//   login,
//   logoutUser,
// };
