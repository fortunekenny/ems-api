import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // Import bcrypt for password hashing
import generateID from "../utils/generateId.js"; // Generates unique studentID

// Student Schema

const studentSchema = new mongoose.Schema(
  {
    // ─── Personal & Contact Info ─────────────────────────────────────────────
    firstName: { type: String, required: true },
    middleName: { type: String, required: true },
    lastName: { type: String, required: true },
    dateOfBirth: {
      type: Date,
      required: [true, "Please provide date of birth"],
      validate: {
        validator: function (v) {
          // Accept JS Date objects (from controller) and strings (from direct input)
          if (v instanceof Date && !isNaN(v.getTime())) return true;
          if (typeof v === "string") {
            return /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.test(
              v,
            );
          }
          return false;
        },
        message: "Invalid date format. Expected dd/mm/yy or dd/mm/yyyy",
      },
    },
    age: { type: Number },
    gender: { type: String, enum: ["male", "female"], required: true },
    medicalHistory: { type: String },

    // ─── Address ───────────────────────────────────────────────────────────────
    houseNumber: { type: Number },
    streetName: { type: String, required: true },
    townOrCity: { type: String, required: true },

    // ─── Auth & IDs ────────────────────────────────────────────────────────────
    email: { type: String, unique: true, sparse: true },
    password: { type: String, default: "secret" },
    studentID: { type: String, unique: true },
    role: { type: String, default: "student" },
    isVerified: { type: Boolean, default: false },

    // ─── Relations ────────────────────────────────────────────────────────────
    parentGuardianId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Parent",
    },

    // ─── Historical & Current Academic Records ─────────────────────────────────
    // Grouped by class (per session), each holding the three terms of that class.
    // A student who changes class mid-session simply gets a second class entry
    // for that session, each with the term(s) spent there.
    academicRecords: [
      {
        session: {
          type: String,
          required: true, // e.g. "2023/2024"
        },
        classId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Class",
        },

        // The terms of this class: first, second, third.
        terms: [
          {
            term: {
              type: String,
              enum: ["first", "second", "third"],
              lowercase: true,
              required: true,
            },

            // Attendance for this term
            attendance: [
              {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Attendance",
              },
            ],

            // Assignments
            assignments: [
              {
                type: mongoose.Schema.Types.ObjectId,
                ref: "StudentAnswer",
              },
            ],

            // Classworks
            classworks: [
              {
                type: mongoose.Schema.Types.ObjectId,
                ref: "StudentAnswer",
              },
            ],

            // Tests
            tests: [
              {
                type: mongoose.Schema.Types.ObjectId,
                ref: "StudentAnswer",
              },
            ],

            // End-of-term exam answer
            exam: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "StudentAnswer",
            },

            // End-of-term report card
            reportCard: {
              type: mongoose.Schema.Types.ObjectId,
              ref: "ReportCard",
            },

            // Subjects enrolled/taught this term
            subjects: [
              {
                type: mongoose.Schema.Types.ObjectId,
                ref: "Subject",
              },
            ],
          },
        ],
      },
    ],

    // ─── Overall Status ────────────────────────────────────────────────────────
    status: { type: String, enum: ["active", "inactive"], default: "inactive" },
    previousStatus: { type: String, enum: ["active", "inactive"] },
    notifications: [
      {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Notification",
      },
    ],
  },
  {
    timestamps: true, // automatically adds createdAt & updatedAt
  },
);

// Pre-save hook to hash password, generate studentID, set session, and term
studentSchema.pre("validate", async function (next) {
  if (this.isNew) {
    // Generate a studentID if one wasn't provided (so it's never missing)
    if (!this.studentID) {
      this.studentID = await generateID(
        "STU",
        this.firstName,
        this.middleName,
        this.lastName,
      );
    }

    // Hash the password before saving
    if (this.isModified("password")) {
      const salt = await bcrypt.genSalt(10); // Generate a salt
      this.password = await bcrypt.hash(this.password, salt); // Hash the password
    }
  }
  next();
});

// Method to compare passwords
studentSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// module.exports = mongoose.model("Student", studentSchema);

// Create the Student model
const Student = mongoose.model("Student", studentSchema);

export default Student;
