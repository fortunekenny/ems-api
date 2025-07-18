import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Utility functions
/* import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js"; */

/* const { term, session } = getCurrentTermDetails(
  startTermGenerationDate,
  holidayDurationForEachTerm,
); */

const parentSchema = new mongoose.Schema({
  // Parent Type (Parent or Guardian)
  type: { type: String, enum: ["Parent", "Guardian"], required: true },

  // Marital Status
  // if separated you will provide both father and mother details
  maritalStatus: {
    type: String,
    enum: ["Married", "SingleParent"],
    required: true,
  },

  iAm: {
    type: String,
    enum: ["Father", "Mother"],
    required: false,
  },

  // if guardian you are acting as either father or mother
  actingAs: {
    type: String,
    enum: ["Father", "Mother"],
    required: false,
  },

  // if parent or guardian and married or singleParent, its either the mother or father or both are responsible for the school fees
  schoolFeesResponsibility: {
    type: String,
    enum: ["Father", "Mother"],
    required: false,
  },

  /* 
    if parent, you are either a father or a mother
    if guardian you are either acting as father or mother
    if single parent you are both father and mother
    */

  // Father Details (Can be a Parent or Guardian)
  notifications: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      required: false,
    },
  ],
  father: {
    type: new mongoose.Schema(
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        firstName: { type: String, trim: true, required: false },
        lastName: { type: String, trim: true, required: false },
        email: {
          type: String,
          // unique: true,
          sparse: true,
          required: false,
          // default: undefined,
        },
        password: { type: String, minlength: 6, required: false },
        phone: { type: String, unique: true, sparse: true, required: false },
        occupation: { type: String, default: "Unemployed", required: false },
        age: { type: Number, required: false },
        address: {
          houseNumber: { type: Number, required: false },
          streetName: { type: String, required: false },
          townOrCity: { type: String, required: false },
        },
        isGuardian: { type: Boolean, default: false },
        role: { type: String, default: "father" },
        status: {
          type: String,
          enum: ["active", "inactive"],
          default: "active",
        },
        isVerified: { type: Boolean, default: false },
        children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
      },
      { _id: false },
    ),
    required: false,
    default: undefined,
  },
  // Mother Details (Can be a Parent or Guardian)
  mother: {
    type: new mongoose.Schema(
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        firstName: { type: String, trim: true, required: false },
        lastName: { type: String, trim: true, required: false },
        email: {
          type: String,
          // unique: true,
          sparse: true,
          required: false,
          // default: undefined,
        },
        password: { type: String, minlength: 6, required: false },
        phone: { type: String, unique: true, sparse: true, required: false },
        occupation: { type: String, default: "Unemployed", required: false },
        age: { type: Number, required: false },
        address: {
          houseNumber: { type: Number, required: false },
          streetName: { type: String, required: false },
          townOrCity: { type: String, required: false },
        },
        isGuardian: { type: Boolean, default: false },
        role: { type: String, default: "mother" },
        status: {
          type: String,
          enum: ["active", "inactive"],
          default: "active",
        },
        isVerified: { type: Boolean, default: false },
        children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
      },
      { _id: false },
    ),
    required: false,
    default: undefined,
  },

  // If it's a single parent (Father or Mother acting alone)
  singleParent: {
    type: new mongoose.Schema(
      {
        _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
        firstName: { type: String, trim: true, required: false },
        lastName: { type: String, trim: true, required: false },
        email: {
          type: String,
          // unique: true,
          sparse: true,
          required: false,
          // default: undefined,
        },
        password: { type: String, minlength: 6, required: false },
        phone: { type: String, unique: true, sparse: true, required: false },
        occupation: { type: String, default: "Unemployed", required: false },
        age: { type: Number, required: false },
        address: {
          houseNumber: { type: Number, required: false },
          streetName: { type: String, required: false },
          townOrCity: { type: String, required: false },
        },
        role: { type: String, default: "singleParent" },
        status: {
          type: String,
          enum: ["active", "inactive"],
          default: "active",
        },
        isVerified: { type: Boolean, default: false },
        children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
      },
      { _id: false },
    ),
    required: false,
    default: undefined,
  },
  role: {
    type: String,
    default: "parent",
  },
  // Created & Updated timestamps
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Hash password before saving
parentSchema.pre("save", async function (next) {
  if (this.isModified("father.password") && this.father?.password) {
    const salt = await bcrypt.genSalt(10);
    this.father.password = await bcrypt.hash(this.father.password, salt);
  }

  if (this.isModified("mother.password") && this.mother?.password) {
    const salt = await bcrypt.genSalt(10);
    this.mother.password = await bcrypt.hash(this.mother.password, salt);
  }

  if (this.isModified("singleParent.password") && this.singleParent?.password) {
    const salt = await bcrypt.genSalt(10);
    this.singleParent.password = await bcrypt.hash(
      this.singleParent.password,
      salt,
    );
  }

  // Check for duplicate emails across all parent types
  const emails = [
    this.father?.email,
    this.mother?.email,
    this.singleParent?.email,
  ].filter((email) => email && email !== "");

  if (emails.length > 0) {
    // Check if any other documents have these emails
    const existingParent = await this.constructor.findOne({
      _id: { $ne: this._id },
      $or: [
        { "father.email": { $in: emails } },
        { "mother.email": { $in: emails } },
        { "singleParent.email": { $in: emails } },
      ],
    });

    if (existingParent) {
      return next(new Error("Email already exists"));
    }
  }

  next();
});

// Check password method for login
parentSchema.methods.matchPassword = async function (enteredPassword, role) {
  if (role === "father") {
    return await bcrypt.compare(enteredPassword, this.father.password);
  } else if (role === "mother") {
    return await bcrypt.compare(enteredPassword, this.mother.password);
  } else if (role === "singleParent") {
    return await bcrypt.compare(enteredPassword, this.singleParent.password);
  }
  return false;
};

// Parent Model
const Parent = mongoose.model("Parent", parentSchema);
export default Parent;
