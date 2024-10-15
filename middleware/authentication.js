import UnauthenticatedError from "../errors/unauthenticated.js";
import UnauthorizedError from "../errors/unauthorize.js";
import { isTokenValid } from "../utils/jwt.js";

export const authenticateToken = async (req, res, next) => {
  const token = req.signedCookies.token;

  if (!token) {
    throw new UnauthenticatedError("Authentication invalid");
  }
  try {
    const { name, userId, role } = isTokenValid({ token });
    req.user = { name, userId, role };
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
