import Staff from "../models/StaffModel.js";
import { StatusCodes } from "http-status-codes";
import jwt from "jsonwebtoken";

// Utility function to generate JWT
const generateToken = (user) => {
  return jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: "1d",
  });
};

// Register Staff
export const registerStaff = async (req, res) => {
  const { name, email, password, role, department, subjects, classes } =
    req.body;

  try {
    const staff = new Staff({
      name,
      email,
      password,
      role,
      department,
      subjects,
      classes,
    });

    await staff.save();

    const token = generateToken({ _id: staff._id, role: staff.role });
    res.status(StatusCodes.CREATED).json({
      staff: { name: staff.name, email: staff.email, role: staff.role },
      token,
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  }
};
