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
