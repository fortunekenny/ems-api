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

export const checkPermissions = async (requestUser, resourceUserId) => {
  const { role, subRole, userId } = requestUser;
  // console.log("role:", role);
  // console.log("subRole:", subRole);
  // console.log("userId:", userId);
  // console.log("resourceUserId:", resourceUserId);

  if (role === "admin" || role === "proprietor" || role === "teacher") return;

  // Allow if user is the owner of the resource
  if (userId === resourceUserId.toString()) return;

  // Additional check for parents
  if (role === "parent") {
    if (!["father", "mother", "singleParent"].includes(subRole)) {
      throw new UnauthorizedError("Invalid subRole for parent");
    }

    // Check if parent with the given subRole contains the user and student
    const parent = await Parent.findOne({
      [`${subRole}._id`]: userId,
      [`${subRole}.children`]: resourceUserId, // assuming this is studentId
    });

    if (!parent) {
      throw new UnauthorizedError("You are not his/her parent or guardian");
    }

    return;
  }

  throw new UnauthenticatedError("You are not allowed to access this route");
};
export default checkPermissions;
