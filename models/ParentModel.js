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
  term: { type: String, required: true }, // e.g., First, Second, Third
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Pre-save hook to hash password
parentSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  next();
});

// Method to compare passwords
parentSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

parentSchema.pre("save", function (next) {
  if (this.isNew) {
    // Set current session
    this.session = getCurrentSession();
  }
  next();
});

const Parent = mongoose.model("Parent", parentSchema);

export default Parent;
