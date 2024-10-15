import Parent from "../models/ParentModel.js";
import Student from "../models/StudentModel.js";
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

    // Delete students associated with this parent
    const deletedStudents = await Student.deleteMany({ guardian: parentId });

    //delete the parent
    await parent.deleteOne();

    res.status(StatusCodes.OK).json({
      message: "Parent deleted successfully",
      deletedStudentsCount: deletedStudents.deletedCount, //number of deleted students
    });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};
