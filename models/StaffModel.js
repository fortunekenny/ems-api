import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // Import bcrypt for password hashing
import { generateCurrentTerm } from "../utils/termGenerator.js";

// Utility functions
const generateID = async (prefix, Model) => {
  const count = await Model.countDocuments();
  const datePart = new Date()
    .toISOString()
    .replace(/[-T:\.Z]/g, "")
    .slice(0, 8); // YYYYMMDD
  return `${prefix}${datePart}${count + 1}`;
};

const getCurrentSession = () => {
  const date = new Date();
  const currentYear = date.getFullYear();
  return `${currentYear}/${currentYear + 1}`;
};

// Define the schema
const staffSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Staff member's name
  email: { type: String, required: true, unique: true }, // Unique email
  password: { type: String, required: true }, // Password (hashed later)
  employeeID: { type: String, required: true, unique: true }, // Employee ID generated automatically
  role: {
    type: String,
    enum: ["admin", "teacher", "non-teacher"],
    required: true,
  }, // Admin, teacher, or non-teacher roles. Input
  department: { type: String }, // Optional: For non-teaching staff or department-specific teachers. Input
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }], // Subjects assigned to teachers. Automated if isClassTeacher is inputed and input if teacher is subjects teacher
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Class" }], // Classes assigned to teachers. Input if teacher is a subject teacher for more than 1 class
  isClassTeacher: { type: mongoose.Schema.Types.ObjectId, ref: "Class" }, // Reference to the class they are class teacher of. Input if a class teacher
  status: { type: String, enum: ["active", "inactive"], default: "active" }, // Automated
  session: { type: String, required: true }, // Academic session. Automated
  term: { type: String, required: false }, // e.g., First, Second, Third term. Automated
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Pre-save middleware for handling password hashing, employeeID generation, and setting session
staffSchema.pre("validate", async function (next) {
  if (this.isNew) {
    // Hash the password before saving if it's a new staff member
    if (this.isModified("password")) {
      const salt = await bcrypt.genSalt(10); // Generate salt for hashing
      this.password = await bcrypt.hash(this.password, salt); // Hash the password
    }

    // Generate employeeID for new staff members if not already set
    if (!this.employeeID) {
      this.employeeID = await generateID("EMP", mongoose.model("Staff"));
    }

    // Set the current academic session if not already set
    if (!this.session) {
      this.session = getCurrentSession();
    }
  }
  next();
});

// Method to dynamically update term based on start date and holiday durations
staffSchema.methods.updateTerm = function (startDate, holidayDurations) {
  this.term = generateCurrentTerm(startDate, holidayDurations); // Call the term generator function
};

// Method to compare password for login authentication
staffSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password); // Compare the provided password with the stored hashed password
};

// Export the Staff model
const Staff = mongoose.model("Staff", staffSchema);
export default Staff;
