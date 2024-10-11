import { UnauthenticatedError } from "../errors";

const checkPermissions = (requestUser, resourceuserId) => {
  if (requestUser.role === "founder") return;
  // if (requestUser.role === "admin") return;
  if (requestUser.userId === resourceuserId.toString()) return;
  throw new UnauthenticatedError("You are not allowed to access this route");
};

export default checkPermissions;
