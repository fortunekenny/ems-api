import Staff from "../models/StaffModel.js";
import NotFoundError from "../errors/not-found.js";
import UnauthorizedError from "../errors/unauthorize.js"; // Direct import of UnauthorizedError
import { StatusCodes } from "http-status-codes";
import checkPermissions from "../utils/checkPermissions.js";
import {
  generateCurrentTerm,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js"; // Import the term generation function

// Controller to get all staff members
export const getStaff = async (req, res) => {
  try {
    const staff = await Staff.find().select("-password");
    res.status(StatusCodes.OK).json({ staff, count: staff.length });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Controller to get a staff member by ID
export const getStaffById = async (req, res) => {
  try {
    const { id: staffId } = req.params;

    // Find the staff member by ID
    const staff = await Staff.findOne({ _id: staffId }).select("-password");

    if (!staff) {
      throw new NotFoundError(`No staff member found with id: ${staffId}`);
    }

    res.status(StatusCodes.OK).json(staff);
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Controller to update a staff member
export const updateStaff = async (req, res) => {
  try {
    const { id: staffId } = req.params;
    const { name, email, role, department, subjects, classes, isClassTeacher } =
      req.body;

    // Find the staff member by ID
    const staff = await Staff.findOne({ _id: staffId });

    if (!staff) {
      throw new NotFoundError(`No staff member found with id: ${staffId}`);
    }

    const term = generateCurrentTerm(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // Check if the current user has permission to update this staff member
    checkPermissions(req.user, staff.user);

    // Update staff member fields
    if (name) staff.name = name;
    if (email) staff.email = email;
    if (role) staff.role = role;
    if (department) staff.department = department;
    if (subjects) staff.subjects = subjects;
    if (classes) staff.classes = classes;
    if (term) staff.term = term;
    if (isClassTeacher) staff.isClassTeacher = isClassTeacher;

    // Save the updated staff member to the database
    await staff.save();

    res.status(StatusCodes.OK).json({ staff });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Controller to delete a staff member (Only admin can delete staff members)
export const deleteStaff = async (req, res) => {
  try {
    const { id: staffId } = req.params;

    // Find the staff member by ID
    const staff = await Staff.findOne({ _id: staffId });

    if (!staff) {
      throw new NotFoundError(`No staff member found with id: ${staffId}`);
    }

    // Ensure only admins can delete a staff member
    if (req.user.role !== "admin") {
      throw new UnauthorizedError("Only admins can delete staff members.");
    }

    // Delete the staff member
    await staff.deleteOne();

    res
      .status(StatusCodes.OK)
      .json({ msg: "Staff member deleted successfully" });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};
