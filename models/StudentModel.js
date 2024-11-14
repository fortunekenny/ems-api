import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // Import bcrypt for password hashing
import { generateCurrentTerm } from "../utils/termGenerator.js"; // Import the term generator function

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

// Student Schema
const studentSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Student name
  email: { type: String, required: true, unique: true }, // Unique email
  password: { type: String, required: true }, // Password (hashed later)
  studentID: { type: String, required: true, unique: true }, // Auto-generated student ID
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  }, // Class reference
  guardian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Parent",
    required: true, // Guardian reference
  },
  attendance: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attendance" }], // Define as array of ObjectIds
  role: { type: String, default: "student" }, // Default role for students
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: false }, // Term (e.g., First, Second, Third)
  age: { type: Number, required: true }, // Age of the student
  gender: { type: String, enum: ["male", "female"], required: true }, // Gender: male or female
  address: { type: String, required: true }, // Address
  medicalHistory: { type: String }, // Optional: Medical history
  createdAt: { type: Date, default: Date.now }, // Creation timestamp
  updatedAt: { type: Date, default: Date.now }, // Update timestamp
});

// Pre-save hook to hash password, generate studentID, set session, and term
studentSchema.pre("validate", async function (next) {
  if (this.isNew) {
    // Hash the password before saving
    if (this.isModified("password")) {
      const salt = await bcrypt.genSalt(10); // Generate a salt
      this.password = await bcrypt.hash(this.password, salt); // Hash the password
    }

    // Generate studentID and set current session if not already set
    if (!this.studentID) {
      this.studentID = await generateID("STU", mongoose.model("Student"));
    }
    if (!this.session) {
      this.session = getCurrentSession(); // Set the current academic session
    }
  }
  next();
});

// Method to dynamically update term based on start date and holiday durations
studentSchema.methods.updateTerm = function (startDate, holidayDurations) {
  this.term = generateCurrentTerm(startDate, holidayDurations); // Call the term generator function
};

// Method to compare passwords
studentSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// Create the Student model
const Student = mongoose.model("Student", studentSchema);

export default Student;
