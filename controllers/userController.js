import User from "../models/UserModel.js";
import { StatusCodes } from "http-status-codes";
import CustomError from "../errors/custom-api.js";

// Create a new user
// export const createUser = async (req, res) => {
//   try {
//     const { name, email, password, role } = req.body;
//     const user = new User({ name, email, password, role });
//     await user.save(); // This will trigger the pre-save middleware to create or update associated roles
//     res.status(StatusCodes.CREATED).json({ user });
//   } catch (error) {
//     res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
//   }
// };

// Get all users
export const getUsers = async (req, res) => {
  try {
    const users = await User.find()
      .populate("staff")
      .populate("student")
      .populate("parent");
    res.status(StatusCodes.OK).json({ users });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
};

// Get user by ID
export const getUserById = async (req, res) => {
  try {
    const user = await User.findById(req.params.id)
      .populate("staff")
      .populate("student")
      .populate("parent");
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(StatusCodes.OK).json(user);
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
};

// Update user details
export const updateUser = async (req, res) => {
  try {
    const userId = req.params.id;

    // Update the user
    const updatedUser = await User.findByIdAndUpdate(userId, req.body, {
      new: true,
    });

    // Check if user was found and updated
    if (!updatedUser) return res.status(404).json({ error: "User not found" });

    // If the role has changed, save the updated user to trigger the middleware
    if (req.body.role && req.body.role !== updatedUser.role) {
      await updatedUser.save(); // This will invoke the pre-save middleware
    }

    res.status(StatusCodes.OK).json(updatedUser);
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  }
};

// Delete user
export const deleteUser = async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: "User not found" });
    res.status(StatusCodes.OK).json({ message: "User deleted successfully" });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
};

// Approve a user by admin
export const approveUser = async (req, res) => {
  const { userId } = req.params;

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res
        .status(StatusCodes.NOT_FOUND)
        .json({ error: "User not found" });
    }

    if (user.isApproved) {
      return res
        .status(StatusCodes.BAD_REQUEST)
        .json({ error: "User is already approved" });
    }

    // Approve the user
    user.isApproved = true;
    await user.save();

    res
      .status(StatusCodes.OK)
      .json({ message: "User approved successfully", user });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
};

// Get all unapproved users
export const getUnapprovedUsers = async (req, res) => {
  try {
    // Find all users with isApproved set to false
    const unapprovedUsers = await User.find({ isApproved: false });

    if (unapprovedUsers.length === 0) {
      return res
        .status(StatusCodes.OK)
        .json({ message: "No unapproved user(s) found" });
    }

    res.status(StatusCodes.OK).json({ users: unapprovedUsers });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
  }
};
