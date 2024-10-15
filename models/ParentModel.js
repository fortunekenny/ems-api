/*
import mongoose from "mongoose";

// Utility function to get current academic session
const getCurrentSession = () => {
  const date = new Date();
  const currentYear = date.getFullYear();
  return `${currentYear}/${currentYear + 1}`;
};

const parentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: true }, // e.g., First, Second, Third
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Pre-save middleware to set session
parentSchema.pre("save", function (next) {
  if (this.isNew) {
    // Set current session
    this.session = getCurrentSession();
  }
  next();
});

const Parent = mongoose.model("Parent", parentSchema);

export default Parent;
*/

import mongoose from "mongoose";
import bcrypt from "bcryptjs";
import { generateCurrentTerm } from "../utils/termGenerator.js";

// Utility functions

const getCurrentSession = () => {
  const date = new Date();
  const currentYear = date.getFullYear();
  return `${currentYear}/${currentYear + 1}`;
};

// Parent Schema
const parentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  role: { type: String, default: "parent" },
  children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: false }, // e.g., First, Second, Third
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Pre-save hook to hash password
parentSchema.pre("validate", async function (next) {
  if (this.isNew) {
    // Hash the password before saving
    if (this.isModified("password")) {
      const salt = await bcrypt.genSalt(10); // Generate a salt
      this.password = await bcrypt.hash(this.password, salt); // Hash the password
    }

    // Generate current session if not already set
    if (!this.session) {
      this.session = getCurrentSession(); // Set the current academic session
    }
  }
  next();
});

// Method to dynamically update term based on start date and holiday durations
parentSchema.methods.updateTerm = function (startDate, holidayDurations) {
  this.term = generateCurrentTerm(startDate, holidayDurations); // Call the term generator function
};

// Method to compare passwords
parentSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

const Parent = mongoose.model("Parent", parentSchema);

export default Parent;
