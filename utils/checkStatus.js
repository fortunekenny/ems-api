import Forbidden from "../errors/forbidden.js";
import InternalServerError from "../errors/internal-server-error.js";
import Parent from "../models/ParentModel.js";
import Staff from "../models/StaffModel.js";
import Student from "../models/StudentModel.js";
// import { StatusCodes } from "http-status-codes";

/* export const checkStatus = async (req, res, next) => {
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
      throw new Forbidden(
        "Your account is inactive. Please contact us for more information.",
      );
    }

    // User is active, proceed to the next middleware
    next();
  } catch (error) {
    console.log("Error checking user status:", error);
    next(new InternalServerError(error.message));
  }
}; */

export const checkStatus = async (req, res, next) => {
  const { userId, role, subRole, parentId } = req.user; // subRole: 'father' | 'mother' | 'singleParent'
  try {
    let user;
    let isActive = false;

    if (role === "parent") {
      // Find the parent document by userId (parent doc _id)
      const parentDoc = await Parent.findById(parentId);

      if (!parentDoc) {
        throw new Forbidden(
          "Your account is inactive. Please contact us for more information.",
        );
      }

      // Determine which subdocument to check
      let subUser = null;
      if (subRole === "father" && parentDoc.father) {
        subUser = parentDoc.father;
      } else if (subRole === "mother" && parentDoc.mother) {
        subUser = parentDoc.mother;
      } else if (subRole === "singleParent" && parentDoc.singleParent) {
        subUser = parentDoc.singleParent;
      }

      if (subUser && subUser.status === "active") {
        isActive = true;
      }
    } else if (
      role === "teacher" ||
      role === "admin" ||
      role === "non-teacher"
    ) {
      user = await Staff.findById(userId);
      if (user && user.status === "active") {
        isActive = true;
      }
    } else if (role === "student") {
      user = await Student.findById(userId);
      if (user && user.status === "active") {
        isActive = true;
      }
    }

    if (!isActive) {
      throw new Forbidden(
        "Your account is inactive. Please contact us for more information.",
      );
    }

    next();
  } catch (error) {
    console.log("Error checking user status:", error);
    next(new InternalServerError(error.message));
  }
};
