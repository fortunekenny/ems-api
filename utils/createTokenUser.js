/* const createTokenUser = (user) => {
  return {
    // name: user.name,
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
      role: "Parent", // general role
      subRole: subRole, // specific sub-role
      status: roleData.status,
    };
  }

  // Flat user schema
  return {
    name: `${user.firstName} ${user.lastName}`,
    userId: user._id,
    role: user.role,
    status: user.status,
  };
};

export default createTokenUser;
