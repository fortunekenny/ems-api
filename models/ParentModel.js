import mongoose from "mongoose";
import bcrypt from "bcryptjs";

// Utility functions
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";

const { term, session } = getCurrentTermDetails(
  startTermGenerationDate,
  holidayDurationForEachTerm,
);

const parentSchema = new mongoose.Schema(
  {
    // Parent Type (Parent or Guardian)
    type: { type: String, enum: ["Parent", "Guardian"], required: true },

    // Marital Status
    // if separated you will provide both father and mother details
    maritalStatus: {
      type: String,
      enum: ["Married", "Separated", "SingleParent"],
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

    // if parent or guardian and married or separated, its either the mother or father or both are responsible for the school fees
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
    father: {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      firstName: { type: String, trim: true, required: true },
      lastName: { type: String, trim: true, required: true },
      email: { type: String, unique: true, sparse: true, required: true },
      password: { type: String, minlength: 6, required: true },
      phone: { type: String, unique: true, sparse: true, required: true },
      occupation: { type: String, default: "Unemployed", required: true },
      age: { type: Number, required: true },
      address: {
        houseNumber: { type: Number, required: false },
        streetName: { type: String, required: true },
        townOrCity: { type: String, required: true },
      },
      isGuardian: { type: Boolean, default: false }, // Can be a Guardian
      role: { type: String, default: "father" }, // Role for Authentication
      // Status & Verification
      status: { type: String, enum: ["active", "inactive"], default: "active" },
      isVerified: { type: Boolean, default: false },
      // Children Relationship
      children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    },

    // Mother Details (Can be a Parent or Guardian)
    mother: {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      firstName: { type: String, trim: true, required: true },
      lastName: { type: String, trim: true, required: true },
      email: { type: String, unique: true, sparse: true, required: true },
      password: { type: String, minlength: 6, required: true },
      phone: { type: String, unique: true, sparse: true, required: true },
      occupation: { type: String, default: "Unemployed", required: true },
      address: {
        houseNumber: { type: Number, required: false },
        streetName: { type: String, required: true },
        townOrCity: { type: String, required: true },
      },
      isGuardian: { type: Boolean, default: false }, // Can be a Guardian
      role: { type: String, default: "mother" }, // Role for Authentication
      // Status & Verification
      status: { type: String, enum: ["active", "inactive"], default: "active" },
      isVerified: { type: Boolean, default: false },
      // Children Relationship
      children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    },

    // If it's a single parent (Father or Mother acting alone)
    singleParent: {
      _id: { type: mongoose.Schema.Types.ObjectId, auto: true },
      firstName: { type: String, trim: true, required: true },
      lastName: { type: String, trim: true, required: true },
      email: { type: String, unique: true, sparse: true, required: true },
      password: { type: String, minlength: 6, required: true },
      phone: { type: String, unique: true, sparse: true, required: true },
      occupation: { type: String, default: "Unemployed", required: true },
      address: {
        houseNumber: { type: Number, required: false },
        streetName: { type: String, required: true },
        townOrCity: { type: String, required: true },
      },
      role: { type: String, default: "singleParent" }, // Role for Authentication
      // Status & Verification
      status: { type: String, enum: ["active", "inactive"], default: "active" },
      isVerified: { type: Boolean, default: false },
      // Children Relationship
      children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],
    },

    // // Children Relationship
    // children: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }],

    // Role for Authentication
    // role: { type: String, default: "parent" },

    // Emergency Contact
    // emergencyContact: {
    //   name: { type: String, required: true },
    //   relationship: { type: String, required: true }, // e.g., "Uncle", "Aunt"
    //   phone: { type: String, required: true },
    // },

    // Notifications
    // notifications: [
    //   {
    //     title: String,
    //     message: String,
    //     read: { type: Boolean, default: false },
    //     createdAt: { type: Date, default: Date.now },
    //   },
    // ],

    // // Status & Verification
    // status: { type: String, enum: ["active", "inactive"], default: "active" },
    // isVerified: { type: Boolean, default: false },

    session: { type: String, default: session }, // e.g., 2023/2024
    term: { type: String, default: term }, // e.g., First, Second, Third

    // Created & Updated timestamps
    createdAt: { type: Date, default: Date.now },
    updatedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

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
