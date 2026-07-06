import UnauthenticatedError from "../errors/unauthenticated.js";
import UnauthorizedError from "../errors/unauthorize.js";
import Parent from "../models/ParentModel.js";

/* const checkPermissions = (requestUser, resourceuserId) => {
  // if (requestUser.role === "founder") return;
  if (requestUser.role === "admin") return;
  if (requestUser.role === "proprietor") return;
  if (requestUser.userId === resourceuserId.toString()) return;
  throw new UnauthenticatedError(
    "You are not allowed to access this route",
  );
};

export default checkPermissions;
 */

export const checkPermissions = async (requestUserOrReq, resourceUserIdOrRes, next) => {
  const isMiddleware = typeof next === "function";

  let requestUser, resourceUserId;

  if (isMiddleware) {
    const req = requestUserOrReq;
    requestUser = req.user;
    // Grab the first route param value (e.g. staffId, studentId, etc.)
    resourceUserId = Object.values(req.params)[0];
  } else {
    requestUser = requestUserOrReq;
    resourceUserId = resourceUserIdOrRes;
  }

  const run = async () => {
    const { role, subRole, userId } = requestUser;

    if (role === "admin" || role === "proprietor" || role === "teacher" || role === "non-teacher") return;

    if (userId === resourceUserId?.toString()) return;

    if (role === "parent") {
      if (!["father", "mother", "singleParent"].includes(subRole)) {
        throw new UnauthorizedError("Invalid subRole for parent");
      }

      const parent = await Parent.findOne({
        [`${subRole}._id`]: userId,
        [`${subRole}.children`]: resourceUserId,
      });

      if (!parent) {
        throw new UnauthorizedError("You are not his/her parent or guardian");
      }

      return;
    }

    throw new UnauthenticatedError("You are not allowed to access this route");
  };

  if (isMiddleware) {
    try {
      await run();
      next();
    } catch (err) {
      next(err);
    }
  } else {
    await run();
  }
};
export default checkPermissions;
