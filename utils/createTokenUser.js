/* const createTokenUser = (user) => {
  return {
    // name: user.name,
    name: `${user.firstName} ${user.lastName}`,
    userId: user._id,
    role: user.role,
    status: user.status,
  };
}; */

/* const createTokenUser = (user) => {
  if (user.father || user.mother || user.singleParent) {
    let roleData;
    let subRole;
    let parentId = user._id || user.parentId; // top-level Parent _id

    if (user.father) {
      roleData = user.father;
      subRole = "father";
    } else if (user.mother) {
      roleData = user.mother;
      subRole = "mother";
    } else if (user.singleParent) {
      roleData = user.singleParent;
      subRole = "singleParent";
    }

    return {
      name: `${roleData.firstName} ${roleData.lastName}`,
      userId: roleData._id,
      parentId: parentId,
      role: "parent", // general role
      subRole: subRole, // specific sub-role
      status: roleData.status,
    };
  }

  // Flat user schema (e.g., from JWT)
  // If role is parent, ensure parentId and subRole are present
  if (user.role === "parent") {
    return {
      name: user.name,
      userId: user.userId,
      parentId: user.parentId || user.userId, // fallback to userId if parentId missing
      role: user.role,
      subRole: user.subRole || undefined,
      status: user.status,
    };
  }

  // Other users (student, staff, etc)
  return {
    name: `${user.firstName} ${user.lastName}`,
    userId: user._id,
    role: user.role,
    status: user.status,
  };
}; */

const createTokenUser = (user) => {
  if (user.father || user.mother || user.singleParent) {
    let roleData;
    let subRole;
    let parentId = user.parentId; // top-level Parent _id

    if (user.father) {
      roleData = user.father;
      subRole = "father";
    } else if (user.mother) {
      roleData = user.mother;
      subRole = "mother";
    } else if (user.singleParent) {
      roleData = user.singleParent;
      subRole = "singleParent";
    }

    return {
      name: `${roleData.firstName} ${roleData.lastName}`,
      userId: roleData._id,
      parentId: parentId,
      role: "parent",
      subRole: subRole,
      status: roleData.status,
    };
  }

  // Flat user schema (e.g., from JWT)
  // If role is parent, ensure parentId and subRole are present
  if (user.role === "parent") {
    // Try to get parentId and subRole from user object, fallback to userId if missing
    return {
      name:
        user.name || `${user.firstName || ""} ${user.lastName || ""}`.trim(),
      userId: user.userId || user._id,
      parentId: user.parentId || user.userId,
      role: user.role,
      subRole: user.subRole,
      status: user.status,
    };
  }

  // Other users (student, staff, etc)
  return {
    name: `${user.firstName || ""} ${user.lastName || ""}`.trim(),
    userId: user._id,
    role: user.role,
    status: user.status,
  };
};

export default createTokenUser;
