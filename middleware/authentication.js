import Class from "../models/ClassModel.js";
import Student from "../models/StudentModel.js";
import UnauthenticatedError from "../errors/unauthenticated.js";
import UnauthorizedError from "../errors/unauthorize.js";
import { isTokenValid } from "../utils/jwt.js";

export const authenticateToken = async (req, res, next) => {
  const token = req.signedCookies.token;

  if (!token) {
    throw new UnauthenticatedError("Authentication invalid");
  }
  try {
    const { name, userId, role, status } = isTokenValid({ token });
    req.user = { name, userId, role, status };
    next();
  } catch (error) {
    throw new UnauthenticatedError("Authentication invalid");
  }
};

/*
export const authenticateToken = async (req, res, next) => {
  const token = req.signedCookies.token;

  if (!token) {
    throw new UnauthenticatedError("Authentication invalid");
  }
  try {
    // Validate token and extract payload
    const decoded = isTokenValid({ token });

    // Ensure decoded has the expected properties
    if (!decoded || !decoded.name || !decoded.userId || !decoded.role) {
      throw new UnauthenticatedError("Authentication invalid");
    }

    // Populate req.user with necessary information
    req.user = {
      name: decoded.name,
      userId: decoded.userId,
      role: decoded.role,
    };
    next();
  } catch (error) {
    throw new UnauthenticatedError("Authentication invalid");
  }
};*/

/*
export const authenticateToken = async (req, res, next) => {
  const token = req.signedCookies.token;

  if (!token) {
    throw new UnauthenticatedError("Authentication invalid");
  }

  try {
    // Verify the token and extract payload
    const decoded = isTokenValid({ token }); // Should return an object with name, userId, and role

    // Populate req.user with token details
    req.user = {
      name: decoded.name,
      userId: decoded.userId,
      role: decoded.role,
    };

    next(); // Continue to the next middleware or route handler
  } catch (error) {
    throw new UnauthenticatedError("Authentication invalid");
  }
};*/

// export const authorizeRole = (...roles) => {
//   return (req, res, next) => {
//     if (!roles.includes(req.user.role)) {
//       throw new UnauthorizedError(
//         "You are not authorized to access this route",
//       );
//     }
//     next();
//   };
// };

export const authorizeRole = (...roles) => {
  return (req, res, next) => {
    // Check if req.user is populated before accessing its role
    const { role } = req.user || {};

    // If role is not provided or does not match any of the allowed roles
    if (!role || !roles.includes(role)) {
      throw new UnauthorizedError(
        "You are not authorized to access this route",
      );
    }

    // Call next middleware if role is valid
    next();
  };
};

// authorize.js

// Middleware to check if the user is an admin or the class teacher for the given class
export const authorizeClassTeacherOrAdmin = async (req, res, next) => {
  const { classId } = req.params;
  const { user } = req;

  if (user.role === "admin") {
    return next(); // Grant access if the user is an admin
  }

  // Check if the user is the class teacher for the specified class
  const classData = await Class.findById(classId);

  if (!classData || String(classData.classTeacher) !== String(user._id)) {
    throw new UnauthorizedError(
      "You are not authorized to access this resource.",
    );
  }

  next(); // Grant access if the user is the class teacher
};

export const authorizeClassTeacherOrAdminOrParent = async (req, res, next) => {
  const { user } = req;
  const { studentId, classId } = req.params;

  try {
    // Check if the user is an admin or a parent
    if (user.role === "admin" || user.role === "parent") {
      return next();
    }

    // Identify the class ID based on studentId or classId in the request
    let classToCheck;
    if (studentId) {
      const student = await Student.findById(studentId).populate("classId"); // Populate the student's class
      if (!student) {
        return res.status(404).json({ msg: "Student not found" });
      }
      classToCheck = student.classId;
    } else if (classId) {
      classToCheck = await Class.findById(classId);
    }

    if (!classToCheck) {
      return res.status(404).json({ msg: "Class not found" });
    }

    // Check if the current user is the class teacher of this class
    if (String(classToCheck.classTeacher) === String(user._id)) {
      return next();
    }

    // If none of the conditions are met, deny access
    return res
      .status(403)
      .json({ msg: "You are not authorized to access this route" });
  } catch (error) {
    console.error("Authorization error:", error);
    res.status(500).json({ msg: "Internal server error" });
  }
};
