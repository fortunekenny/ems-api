import Parent from "../models/ParentModel.js";
import Student from "../models/StudentModel.js";
import Class from "../models/ClassModel.js";
import Subject from "../models/SubjectModel.js";
import NotFoundError from "../errors/not-found.js";
import { StatusCodes } from "http-status-codes";
import checkPermissions from "../utils/checkPermissions.js";
import InternalServerError from "../errors/internal-server-error.js";
import BadRequestError from "../errors/bad-request.js";
import UnauthorizedError from "../errors/unauthorize.js";

// Get all parents
export const getParents = async (req, res, next) => {
  try {
    const parents = await Parent.find().select("-password");
    res.status(StatusCodes.OK).json({ count: parents.length, parents });
  } catch (error) {
    console.error("Error fetching parents:", error);
    next(new InternalServerError(error.message));
  }
};

// Get a parent by ID
export const getParentById = async (req, res, next) => {
  try {
    const { id: parentId } = req.params;

    const parent = await Parent.findById(parentId)
      .select("-password")
      .populate([{ path: "children", select: "_id firstName lastName class" }]);

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
        Object.assign(parent.father, updateData);
      } else if (updateData.target === "mother" && parent.mother) {
        Object.assign(parent.mother, updateData);
      } else if (updateData.target === "singleParent" && parent.singleParent) {
        Object.assign(parent.singleParent, updateData);
      } else {
        throw new BadRequestError(
          "Please specify a valid target to update (father, mother, singleParent)",
        );
      }
    }

    // Parent roles can only update their own profile
    else if (role === "Parent") {
      if (subRole === "father" && parent.father?._id.toString() === userId) {
        Object.assign(parent.father, updateData);
      } else if (
        subRole === "mother" &&
        parent.mother?._id.toString() === userId
      ) {
        Object.assign(parent.mother, updateData);
      } else if (
        subRole === "singleParent" &&
        parent.singleParent?._id.toString() === userId
      ) {
        Object.assign(parent.singleParent, updateData);
      } else {
        throw new UnauthorizedError("Not authorized to update this profile");
      }
    } else {
      throw new UnauthorizedError("Invalid role for parent update");
    }

    // Session and Term can be updated by anyone with access
    parent.session = session || parent.session;
    parent.term = term || parent.term;

    await parent.save();

    res.status(StatusCodes.OK).json({ message: "Parent updated", parent });
  } catch (error) {
    console.log("Update error:", error);
    next(new InternalServerError(error.message));
  }
};

// Update parent status and cascade to children
export const updateParentStatus = async (req, res, next) => {
  try {
    const { id: userId } = req.params; // This is the _id of the father, mother, or singleParent
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

    // Assign parent ID
    student.parentGuardianId = parentGuardianId;
    await student.save();

    res.status(StatusCodes.OK).json({
      message: "Parent/Guardian successfully assigned to student.",
      student,
    });
  } catch (error) {
    console.error("Error assigning parent to student:", error);
    next(error);
  }
};

export const updateParentVerificationStatus = async (req, res, next) => {
  try {
    const { id: parentId } = req.params;
    const { isVerified } = req.body;

    if (typeof isVerified !== "boolean") {
      throw new BadRequestError("`isVerified` must be a boolean.");
    }

    const parent = await Parent.findById(parentId);
    if (!parent) {
      throw new NotFoundError(`No parent found`);
    }

    let updatedRoles = [];

    if (parent.father) {
      parent.father.isVerified = isVerified;
      updatedRoles.push("father");
    }

    if (parent.mother) {
      parent.mother.isVerified = isVerified;
      updatedRoles.push("mother");
    }

    if (parent.singleParent) {
      parent.singleParent.isVerified = isVerified;
      updatedRoles.push("singleParent");
    }

    if (updatedRoles.length === 0) {
      throw new BadRequestError("No valid parent roles to update.");
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
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};
