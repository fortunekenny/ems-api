import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // Import bcrypt for password hashing

// Student Schema
/*const studentSchema = new mongoose.Schema({
  firstName: { type: String, required: true }, // Student name at birth
  middleName: { type: String, required: true }, // Student second name
  lastName: { type: String, required: true }, // Student surname
  houseNumber: { type: Number, required: false },
  streetName: { type: String, required: true },
  townOrCity: { type: String, required: true },
  email: { type: String, required: false, unique: true, sparse: true }, // Unique email, sparse Allow multiple `null` values
  password: { type: String, default: "secret" }, // Password (hashed later)
  studentID: { type: String, unique: true }, // Auto-generated student ID
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  }, // Class reference
  parentGuardianId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Parent",
    required: false, // Guardian reference
  },
  attendance: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attendance" }], // Define as array of ObjectIds
  role: { type: String, default: "student" }, // Default role for students
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  previousStatus: { type: String, enum: ["active", "inactive"] }, // Track previous status
  isVerified: { type: Boolean, default: false },
  session: { type: String, required: false }, // e.g., 2023/2024
  term: { type: String, required: false }, // Term (e.g., First, Second, Third)
  dateOfBirth: {
    type: String, // Store date as a string to validate custom format
    required: [true, "Please provide date of birth"],
    validate: {
      validator: function (v) {
        // Regular expression to validate dd/mm/yyyy format
        return /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.test(
          v,
        );
      },
      message: "Invalid date format. Expected format: dd/mm/yy or dd/mm/yyyy",
    },
  },
  age: { type: Number }, // Age of the student
  gender: { type: String, enum: ["male", "female"], required: true }, // Gender: male or female
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
  }
  next();
});

// Method to compare passwords
studentSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

// Create the Student model
const Student = mongoose.model("Student", studentSchema);

export default Student;
*/

const studentSchema = new mongoose.Schema(
  {
    // ─── Personal & Contact Info ─────────────────────────────────────────────
    firstName: { type: String, required: true },
    middleName: { type: String, required: true },
    lastName: { type: String, required: true },
    dateOfBirth: {
      type: String,
      required: [true, "Please provide date of birth"],
      validate: {
        validator: (v) =>
          /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.test(v),
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
    academicRecords: [
      {
        session: {
          type: String,
          required: true, // e.g. "2023/2024"
        },
        term: {
          type: String,
          enum: ["first", "second", "third"],
          required: true,
        },
        classId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Class",
        },

        // Attendance for this term/session
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

        // End-of-term report card
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

        // Status within this term/session
        // status: {
        //   type: String,
        //   enum: ["active", "inactive"],
        //   default: "active",
        // },
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
