import Parent from "../models/ParentModel.js";
import Student from "../models/StudentModel.js";
import Class from "../models/ClassModel.js";
import Subject from "../models/SubjectModel.js";
import NotFoundError from "../errors/not-found.js";
import { StatusCodes } from "http-status-codes";
import checkPermissions from "../utils/checkPermissions.js";

// Get all parents
export const getParents = async (req, res) => {
  try {
    const parents = await Parent.find().select("-password");
    res.status(StatusCodes.OK).json({ parents, count: parents.length });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Get a parent by ID
export const getParentById = async (req, res) => {
  try {
    const { id: parentId } = req.params;
    const parent = await Parent.findOne({ _id: parentId })
      .select("-password")
      .populate([{ path: "children", select: "_id name email class" }]);

    if (!parent) {
      throw new NotFoundError(`No parent found with id: ${parentId}`);
    }

    res.status(StatusCodes.OK).json(parent);
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Update parent record
export const updateParent = async (req, res) => {
  try {
    const { id: parentId } = req.params;
    const { name, children, session, term } = req.body;

    const parent = await Parent.findOne({ _id: parentId });

    if (!parent) {
      throw new NotFoundError(`No parent found with id: ${parentId}`);
    }

    checkPermissions(req.user, parent.user); // Check permissions

    parent.name = name || parent.name;
    parent.children = children || parent.children;
    parent.session = session || parent.session;
    parent.term = term || parent.term;

    await parent.save();
    res.status(StatusCodes.OK).json(parent);
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Update parent status and cascade to children
export const updateParentStatus = async (req, res) => {
  try {
    const { id: parentId } = req.params;
    const { status } = req.body; // Status to update (active or inactive)

    // Ensure status is valid
    if (!["active", "inactive"].includes(status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Invalid status. Allowed values are 'active' or 'inactive'.",
      });
    }

    // Find the parent
    const parent = await Parent.findById(parentId);

    if (!parent) {
      throw new NotFoundError(`No parent found with id: ${parentId}`);
    }

    // Update the parent's status
    parent.status = status;
    await parent.save();

    // Cascade the status update to the parent's children (students)
    await Student.updateMany(
      { guardian: parentId },
      { status: status }, // Update the status of all children
    );

    res.status(StatusCodes.OK).json({
      message: `Parent and associated children statuses updated to '${status}'.`,
    });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Delete parent record (Admin Only)
export const deleteParent = async (req, res) => {
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
    const studentsToDelete = await Student.find({ guardian: parentId });

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
    const deletedStudents = await Student.deleteMany({ guardian: parentId });

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
