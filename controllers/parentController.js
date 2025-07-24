import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import InternalServerError from "../errors/internal-server-error.js";
import NotFoundError from "../errors/not-found.js";
import UnauthorizedError from "../errors/unauthorize.js";
import Class from "../models/ClassModel.js";
import Parent from "../models/ParentModel.js";
import Student from "../models/StudentModel.js";
import Subject from "../models/SubjectModel.js";

// Get all parents
export const getParents = async (req, res, next) => {
  try {
    // Define allowed query parameters
    const allowedFilters = [
      "type",
      "maritalStatus",
      "role",
      "status",
      "isVerified",
      "name",
      "children",
      "sort",
      "page",
      "limit",
    ];

    // Get provided query keys
    const providedFilters = Object.keys(req.query);

    // Check for unknown parameters
    const unknownFilters = providedFilters.filter(
      (key) => !allowedFilters.includes(key),
    );
    if (unknownFilters.length > 0) {
      throw new BadRequestError(
        `Unknown query parameter(s): ${unknownFilters.join(", ")}`,
      );
    }

    // Build filter object
    let matchStage = {};
    let sort, page, limit;
    if (providedFilters.length > 0) {
      const {
        type,
        maritalStatus,
        role,
        status,
        isVerified,
        name,
        children,
        sort: qSort,
        page: qPage,
        limit: qLimit,
      } = req.query;
      if (type) matchStage.type = type;
      if (maritalStatus) matchStage.maritalStatus = maritalStatus;
      if (role)
        matchStage["$or"] = [
          { "father.role": role },
          { "mother.role": role },
          { "singleParent.role": role },
        ];
      if (status)
        matchStage["$or"] = [
          { "father.status": status },
          { "mother.status": status },
          { "singleParent.status": status },
        ];
      if (isVerified !== undefined)
        matchStage["$or"] = [
          { "father.isVerified": isVerified === "true" },
          { "mother.isVerified": isVerified === "true" },
          { "singleParent.isVerified": isVerified === "true" },
        ];
      if (name) {
        // Case-insensitive search for firstName or lastName in any parent type
        const nameRegex = new RegExp(name, "i");
        matchStage["$or"] = [
          { "father.firstName": nameRegex },
          { "father.lastName": nameRegex },
          { "mother.firstName": nameRegex },
          { "mother.lastName": nameRegex },
          { "singleParent.firstName": nameRegex },
          { "singleParent.lastName": nameRegex },
        ];
      }
      if (children) {
        const childRegex = new RegExp(children, "i");
        matchStage["$or"] = [
          { "father.children.firstName": childRegex },
          { "father.children.middleName": childRegex },
          { "father.children.lastName": childRegex },
          { "mother.children.firstName": childRegex },
          { "mother.children.middleName": childRegex },
          { "mother.children.lastName": childRegex },
          { "singleParent.children.firstName": childRegex },
          { "singleParent.children.middleName": childRegex },
          { "singleParent.children.lastName": childRegex },
        ];
      }
      sort = qSort;
      page = qPage;
      limit = qLimit;
    }
    // If no filters are provided, return all parents sorted by newest
    if (providedFilters.length === 0) {
      sort = "newest";
      page = 1;
      limit = 10;
    } else {
      sort = sort || "newest";
      page = Number(page) || 1;
      limit = Number(limit) || 10;
    }

    // Build aggregation pipeline
    const pipeline = [];
    pipeline.push({ $match: matchStage });
    // Sorting
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "a-z-father": { "father.lastName": 1 },
      "z-a-father": { "father.lastName": -1 },
      "a-z-mother": { "mother.lastName": 1 },
      "z-a-mother": { "mother.lastName": -1 },
      "a-z-singleParent": { "singleParent.lastName": 1 },
      "z-a-singleParent": { "singleParent.lastName": -1 },
    };
    const sortKey = sortOptions[sort] || sortOptions["newest"];
    pipeline.push({ $sort: sortKey });
    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: limit });
    // Project to remove password fields
    pipeline.push({
      $project: {
        _id: 1,
        // type: 1,
        // maritalStatus: 1,
        // iAm: 1,
        // schoolFeesResponsibility: 1,
        // notifications: 1,
        // createdAt: 1,
        // updatedAt: 1,
        father: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          // phone: 1,
          // occupation: 1,
          // age: 1,
          address: 1,
          // isGuardian: 1,
          // role: 1,
          status: 1,
          isVerified: 1,
          children: 1,
        },
        mother: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          // phone: 1,
          // occupation: 1,
          // age: 1,
          address: 1,
          // isGuardian: 1,
          // role: 1,
          status: 1,
          isVerified: 1,
          children: 1,
        },
        singleParent: {
          _id: 1,
          firstName: 1,
          lastName: 1,
          email: 1,
          // phone: 1,
          // occupation: 1,
          // age: 1,
          address: 1,
          // role: 1,
          status: 1,
          isVerified: 1,
          children: 1,
        },
      },
    });

    const parents = await Parent.aggregate(pipeline);

    // Count total matching documents for pagination
    const countPipeline = pipeline.filter(
      (stage) =>
        !(
          "$skip" in stage ||
          "$limit" in stage ||
          "$sort" in stage ||
          "$project" in stage
        ),
    );
    countPipeline.push({ $count: "total" });
    const countResult = await Parent.aggregate(countPipeline);
    const totalParents = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalParents / limit);

    res.status(StatusCodes.OK).json({
      count: totalParents,
      numOfPages,
      currentPage: page,
      parents,
    });
  } catch (error) {
    console.log("Error fetching parents:", error);
    next(new InternalServerError(error.message));
  }
};

// Get a parent by ID
export const getParentByParentId = async (req, res, next) => {
  try {
    const { parentId } = req.params;

    const parent = await Parent.findById(parentId)
      .select("-father.password -mother.password -singleParent.password")
      .populate([
        { path: "father.children", select: "_id firstName lastName" },
        { path: "mother.children", select: "_id firstName lastName" },
        {
          path: "singleParent.children",
          select: "_id firstName lastName",
        },
      ]);

    if (!parent) {
      throw new NotFoundError(`Parent not found`);
    }

    // Convert Mongoose document to plain JS object
    const parentObj = parent.toObject();

    // Remove any role that is falsy or empty object
    if (!parentObj.father || Object.keys(parentObj.father).length === 0) {
      delete parentObj.father;
    }

    if (!parentObj.mother || Object.keys(parentObj.mother).length === 0) {
      delete parentObj.mother;
    }

    if (
      !parentObj.singleParent ||
      Object.keys(parentObj.singleParent).length === 0
    ) {
      delete parentObj.singleParent;
    }

    res.status(StatusCodes.OK).json(parentObj);
  } catch (error) {
    console.log("Error fetching parent:", error);
    next(new InternalServerError(error.message));
  }
};

export const getParentByUserId = async (req, res, next) => {
  try {
    const { userId } = req.params;

    // Find the parent that has a subdocument (father/mother/singleParent) with matching _id
    const parent = await Parent.findOne({
      $or: [
        { "father._id": userId },
        { "mother._id": userId },
        { "singleParent._id": userId },
      ],
    })
      .select("-father.password -mother.password -singleParent.password")
      .populate([
        { path: "father.children", select: "_id firstName lastName" },
        { path: "mother.children", select: "_id firstName lastName" },
        { path: "singleParent.children", select: "_id firstName lastName" },
      ]);

    if (!parent) {
      throw new NotFoundError("Parent not found");
    }

    const parentObj = parent.toObject();

    // Keep only the matched user (father, mother, or singleParent)
    if (parentObj.father && parentObj.father._id?.toString() !== userId) {
      delete parentObj.father;
    }
    if (parentObj.mother && parentObj.mother._id?.toString() !== userId) {
      delete parentObj.mother;
    }
    if (
      parentObj.singleParent &&
      parentObj.singleParent._id?.toString() !== userId
    ) {
      delete parentObj.singleParent;
    }

    res.status(StatusCodes.OK).json(parentObj);
  } catch (error) {
    console.error("Error fetching parent by userId:", error);
    next(new InternalServerError(error.message));
  }
};

// Update parent record
export const updateParent = async (req, res, next) => {
  try {
    const { id: parentId } = req.params;
    const { session, term, ...updateData } = req.body;
    const { role, subRole, userId } = req.user;

    const parent = await Parent.findById(parentId);
    if (!parent) {
      throw new NotFoundError(`No parent found with id: ${parentId}`);
    }

    // Admins and Proprietors can update any sub-role
    if (role === "admin" || role === "proprietor") {
      if (updateData.target === "father" && parent.father) {
        const { password, target, ...rest } = updateData;
        Object.assign(parent.father, rest);
      } else if (updateData.target === "mother" && parent.mother) {
        const { password, target, ...rest } = updateData;
        Object.assign(parent.mother, rest);
      } else if (updateData.target === "singleParent" && parent.singleParent) {
        const { password, target, ...rest } = updateData;
        Object.assign(parent.singleParent, rest);
      } else {
        throw new BadRequestError(
          "Please specify a valid target to update (father, mother, singleParent)",
        );
      }
    }
    // Parent roles can only update their own profile
    else if (role === "parent") {
      if (subRole === "father" && parent.father?._id.toString() === userId) {
        const { password, target, ...rest } = updateData;
        Object.assign(parent.father, rest);
      } else if (
        subRole === "mother" &&
        parent.mother?._id.toString() === userId
      ) {
        const { password, target, ...rest } = updateData;
        Object.assign(parent.mother, rest);
      } else if (
        subRole === "singleParent" &&
        parent.singleParent?._id.toString() === userId
      ) {
        const { password, target, ...rest } = updateData;
        Object.assign(parent.singleParent, rest);
      } else {
        throw new UnauthorizedError("Not authorized to update this profile");
      }
    } else {
      throw new UnauthorizedError("Invalid role for parent update");
    }

    // Session and Term can be updated by anyone with access
    if (session && parent.get("session") !== session) {
      parent.set("session", session);
    }
    if (term && parent.get("term") !== term) {
      parent.set("term", term);
    }

    await parent.save();

    // Prepare response: remove password fields and empty subdocs
    const parentObj = parent.toObject();
    if (parentObj.father) delete parentObj.father.password;
    if (parentObj.mother) delete parentObj.mother.password;
    if (parentObj.singleParent) delete parentObj.singleParent.password;
    if (!parentObj.father || Object.keys(parentObj.father).length === 0)
      delete parentObj.father;
    if (!parentObj.mother || Object.keys(parentObj.mother).length === 0)
      delete parentObj.mother;
    if (
      !parentObj.singleParent ||
      Object.keys(parentObj.singleParent).length === 0
    )
      delete parentObj.singleParent;

    res
      .status(StatusCodes.OK)
      .json({ message: "Parent updated", parent: parentObj });
  } catch (error) {
    console.log("Update error:", error);
    next(new InternalServerError(error.message));
  }
};

// Update parent status and cascade to children
export const updateParentStatus = async (req, res, next) => {
  try {
    const { userId } = req.params; // This is the _id of the father, mother, or singleParent
    const { status } = req.body;

    // Ensure status is valid
    if (!["active", "inactive"].includes(status)) {
      throw new BadRequestError("Invalid status");
    }

    // Find parent where the subdocument _id matches
    const parent = await Parent.findOne({
      $or: [
        { "father._id": userId },
        { "mother._id": userId },
        { "singleParent._id": userId },
      ],
    });

    if (!parent) {
      throw new NotFoundError(`Parent not found`);
    }

    let target = null;
    let role = "";

    if (parent.father?._id.toString() === userId) {
      target = parent.father;
      role = "father";
    } else if (parent.mother?._id.toString() === userId) {
      target = parent.mother;
      role = "mother";
    } else if (parent.singleParent?._id.toString() === userId) {
      target = parent.singleParent;
      role = "singleParent";
    } else {
      throw new NotFoundError("Matching parent role not found");
    }

    // Check if status is already the same
    if (target.status === status) {
      throw new BadRequestError(
        `No changes made. The ${role}'s status is already '${status}'.`,
      );
    }

    // Update and save
    target.status = status;
    await parent.save();

    res.status(StatusCodes.OK).json({
      message: `${role}'s status updated to '${status}'.`,
    });
  } catch (error) {
    console.log("Update error:", error);
    next(new InternalServerError(error.message));
  }
};

export const assignParentToStudent = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { parentGuardianId } = req.body;

    // Validate inputs
    if (!parentGuardianId) {
      throw new BadRequestError("Parent ID is required.");
    }

    // Check if the parent exists
    const parent = await Parent.findById(parentGuardianId);
    if (!parent) {
      throw new NotFoundError(`Parent not found`);
    }

    // Check if the student exists
    const student = await Student.findById(studentId);
    if (!student) {
      throw new NotFoundError(`Student not found`);
    }

    // Check if the parent is already assigned
    if (
      student.parentGuardianId &&
      student.parentGuardianId.toString() === parentGuardianId
    ) {
      throw new BadRequestError(
        "This parent/guardian is already assigned to the student.",
      );
    }

    // Assign parent ID
    student.parentGuardianId = parentGuardianId;
    await student.save();

    res.status(StatusCodes.OK).json({
      message: "Parent/Guardian successfully assigned to student.",
      student,
    });
  } catch (error) {
    console.log("Error assigning parent to student:", error);
    next(new InternalServerError(error.message));
  }
};

export const updateParentVerificationStatus = async (req, res, next) => {
  try {
    const { parentId } = req.params;
    const { isVerified } = req.body;

    if (typeof isVerified !== "boolean") {
      throw new BadRequestError("`isVerified` must be a boolean.");
    }

    const parent = await Parent.findById(parentId);
    if (!parent) {
      throw new NotFoundError(`No parent found`);
    }

    let updatedRoles = [];

    if (parent.father && parent.father.isVerified !== isVerified) {
      parent.father.isVerified = isVerified;
      updatedRoles.push("father");
    }

    if (parent.mother && parent.mother.isVerified !== isVerified) {
      parent.mother.isVerified = isVerified;
      updatedRoles.push("mother");
    }

    if (parent.singleParent && parent.singleParent.isVerified !== isVerified) {
      parent.singleParent.isVerified = isVerified;
      updatedRoles.push("singleParent");
    }

    if (updatedRoles.length === 0) {
      throw new BadRequestError(
        "No changes needed. All roles already have the requested verification status.",
      );
    }

    await parent.save();

    res.status(StatusCodes.OK).json({
      message: `Verification status set to '${isVerified}' for: ${updatedRoles.join(
        ", ",
      )}`,
    });
  } catch (error) {
    console.log("Parent verification error:", error);
    next(new InternalServerError(error.message));
  }
};

// Delete parent record (Admin Only)
export const deleteParent = async (req, res, next) => {
  try {
    const { id: parentId } = req.params;
    const parent = await Parent.findOne({ _id: parentId });

    if (!parent) {
      throw new NotFoundError(`No parent found with id: ${parentId}`);
    }

    // Ensure only admins can delete a parent
    if (req.user.role !== "admin") {
      throw new UnauthorizedError("Only admins can delete parent records.");
    }

    // Find and delete all students associated with this parent
    const studentsToDelete = await Student.find({ parentGuardianId: parentId });

    // Remove students from any associated classes and subjects before deletion
    for (const student of studentsToDelete) {
      // Remove student from class references
      await Class.updateMany(
        { students: student._id },
        { $pull: { students: student._id } },
      );

      // Remove student from subject references
      await Subject.updateMany(
        { students: student._id },
        { $pull: { students: student._id } },
      );
    }

    // Delete the students themselves
    const deletedStudents = await Student.deleteMany({
      parentGuardianId: parentId,
    });

    // Finally, delete the parent
    await parent.deleteOne();

    res.status(StatusCodes.OK).json({
      message: "Parent and associated students deleted successfully",
      deletedStudentsCount: deletedStudents.deletedCount, // number of deleted students
    });
  } catch (error) {
    console.error("Error deleting parent:", error);
    next(new InternalServerError(error.message));
  }
};
