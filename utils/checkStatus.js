import Parent from "../models/ParentModel.js";
import Staff from "../models/StaffModel.js";
import Student from "../models/StudentModel.js";
import { StatusCodes } from "http-status-codes";

export const checkStatus = async (req, res, next) => {
  const { userId, role } = req.user; // Assuming user information is available after authentication

  try {
    let user;

    // Check the user's status based on their role
    if (role === "parent") {
      user = await Parent.findById(userId);
    } else if (role === "teacher") {
      user = await Staff.findById(userId);
    } else if (role === "student") {
      user = await Student.findById(userId);
    } else if (role === "admin") {
      user = await Staff.findById(userId);
    } else if (role === "non-teacher") {
      user = await Staff.findById(userId);
    }

    // If no user is found or status is not "active"
    if (!user || user.status !== "active") {
      return res.status(StatusCodes.FORBIDDEN).json({
        error:
          "Your account is inactive. Please contact us for more information.",
      });
    }

    // User is active, proceed to the next middleware
    next();
  } catch (error) {
    return res.status(StatusCodes.INTERNAL_SERVER_ERROR).json({
      error: "Error checking user status.",
    });
  }
};
