import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import UnauthenticatedError from "../errors/unauthenticated.js";
import bcrypt from "bcryptjs";
import { attachCookiesToResponse } from "../utils/jwt.js";
import createTokenUser from "../utils/createTokenUser.js";
import Parent from "../models/ParentModel.js";
import Student from "../models/StudentModel.js";
import Staff from "../models/StaffModel.js";
import InternalServerError from "../errors/internal-server-error.js";

export const login = async (req, res, next) => {
  const { email, password, studentID, staffId, phone } = req.body;

  // Check if required fields are provided
  if (!password || (!email && !studentID && !staffId && !phone)) {
    throw new BadRequestError("Please provide required fields.");
  }

  try {
    let user;

    // Check if Parent is logging in (email or phone allowed)
    if (email || phone) {
      // Try to find parent by email or phone in any subdocument (father, mother, singleParent)
      /* user = await Parent.findOne({
        $or: [
          { "father.email": email },
          { "mother.email": email },
          { "singleParent.email": email },
          { "father.phone": phone },
          { "mother.phone": phone },
          { "singleParent.phone": phone },
        ].filter(Boolean),
      }); */
      user = await Parent.findOne({
        $or: [
          email && { "father.email": email },
          email && { "mother.email": email },
          email && { "singleParent.email": email },
          phone && { "father.phone": phone },
          phone && { "mother.phone": phone },
          phone && { "singleParent.phone": phone },
        ].filter(Boolean), // Ensures no undefined queries
      });

      // if (!user) {
      //   console.log("No parent found with provided email or phone");
      // } else {
      //   console.log("Parent document found:", user._id);
      //   console.log("Father:", user.father?.email, user.father?.phone);
      //   console.log("Mother:", user.mother?.email, user.mother?.phone);
      //   console.log(
      //     "SingleParent:",
      //     user.singleParent?.email,
      //     user.singleParent?.phone,
      //   );
      // }
      let parentRole = null;
      let parentUser = null;
      if (user) {
        if (
          user.father &&
          (user.father.email === email || user.father.phone === phone)
        ) {
          parentUser = user.father;
          parentRole = "father";
        } else if (
          user.mother &&
          (user.mother.email === email || user.mother.phone === phone)
        ) {
          parentUser = user.mother;
          parentRole = "mother";
        } else if (
          user.singleParent &&
          (user.singleParent.email === email ||
            user.singleParent.phone === phone)
        ) {
          parentUser = user.singleParent;
          parentRole = "singleParent";
        }
      }
      if (parentUser && (await bcrypt.compare(password, parentUser.password))) {
        // Pass the correct subdocument structure to createTokenUser
        const tokenUser = createTokenUser({
          father: parentRole === "father" ? parentUser : undefined,
          mother: parentRole === "mother" ? parentUser : undefined,
          singleParent: parentRole === "singleParent" ? parentUser : undefined,
          _id: user._id,
          parentId: user._id,
        });
        // console.log("token user", tokenUser);
        // console.log("token user parentid", tokenUser.parentId);
        // if (!parentUser?.password) {
        //   console.log("No password found for parent user:", parentUser);
        // }

        attachCookiesToResponse({ res, user: tokenUser });
        return res.status(StatusCodes.OK).json({
          user: {
            name: tokenUser.name,
            email: parentUser.email,
            phone: parentUser.phone,
            role: tokenUser.role,
            subRole: tokenUser.subRole,
            status: tokenUser.status,
            parentId: tokenUser.parentId,
            userId: tokenUser.userId,
          },
        });
      }
    }

    // Check if Student is logging in (email or studentID allowed)
    if (email || studentID) {
      const studentQuery = email ? { email } : { studentID };
      user = await Student.findOne(studentQuery);
      if (user && (await bcrypt.compare(password, user.password))) {
        const tokenUser = createTokenUser(user); // Assuming Student has name, email
        attachCookiesToResponse({ res, user: tokenUser });
        return res.status(StatusCodes.OK).json({
          user: {
            firstName: user.firstName,
            studentID: user.studentID,
            role: user.role,
            status: user.status,
          },
        });
      }
    }

    // Check if Staff is logging in (email or staffId allowed)
    if (email || staffId) {
      const staffQuery = email ? { email } : { staffId };
      user = await Staff.findOne(staffQuery);
      if (user && (await bcrypt.compare(password, user.password))) {
        const tokenUser = createTokenUser(user); // Assuming Staff has name, email, role
        attachCookiesToResponse({ res, user: tokenUser });
        return res.status(StatusCodes.OK).json({
          user: {
            firstName: user.firstName,
            staffId: user.staffId,
            email: user.email,
            role: user.role,
            status: user.status,
          },
        });
      }
    }

    // If the user is not found in any collection, return an error
    throw new UnauthenticatedError("Invalid credentials");
  } catch (error) {
    console.log("Error logging in:", error);
    next(new InternalServerError(error.message));
  }
};

/* export const login = async (req, res) => {
  const { email, password, studentID, staffId } = req.body;

  // Check if email and password are provided
  if (!email || !password || !studentID || !staffId) {
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
}; */

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
