import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // Import bcrypt for password hashing

// Define the schema
const staffSchema = new mongoose.Schema({
  // name: { type: String, required: true }, // Staff member's name
  firstName: { type: String, required: true }, // Staff name at birth
  middleName: { type: String, required: true }, // Staff second name
  lastName: { type: String, required: true }, // Staff surname
  houseNumber: { type: Number, required: false },
  streetName: { type: String, required: true },
  townOrCity: { type: String, required: true },
  email: { type: String, required: true, unique: true }, // Unique email
  phoneNumber: {
    type: Number,
    required: true,
  },
  password: { type: String, required: true }, // Password (hashed later)
  employeeID: { type: String, unique: true }, // Employee ID generated automatically
  role: {
    type: String,
    enum: ["admin", "teacher", "staff", "proprietor"],
    required: true,
  }, // Admin, teacher, or non-teacher roles. Input
  department: { type: String }, // Optional: For non-teaching staff or department-specific teachers. Input
  status: { type: String, enum: ["active", "inactive"], default: "active" }, // Automated
  isVerified: { type: Boolean, default: false },
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
      message: "Invalid date format. Expected format: dd/mm/yyyy",
    },
  },
  age: { type: Number, default: 0 }, // Age of staff
  gender: { type: String, enum: ["male", "female"], required: true }, // Gender: male or female
  // Add notifications here
  notifications: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Notification",
      required: false,
    },
  ],
  teacherRcords: [
    {
      session: { type: String, required: false }, // Academic session. Automated
      term: { type: String, required: false }, // e.g., First, Second, Third term. Automated
      isClassTeacher: { type: mongoose.Schema.Types.ObjectId, ref: "Class" }, // Reference to the class they are class teacher of. Input if a class teacher
      subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }], // Subjects assigned to teachers. Automated if isClassTeacher is inputted and input if teacher is subjects teacher
      classes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Class" }], // Classes assigned to teachers. Input if teacher is a subject teacher for more than 1 class
      students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // Students assigned to teachers. Input if teacher is a subject teacher for more than 1 class
    },
  ],
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

    /*     // Generate employeeID for new staff members if not already set
    if (!this.employeeID) {
      this.employeeID = await generateID("EMP", mongoose.model("Staff"));
    }

    // Set the current academic session if not already set
    if (!this.session) {
      this.session = getCurrentSession();
    } */
  }
  next();
});

// Method to dynamically update term based on start date and holiday durations
// staffSchema.methods.updateTerm = function (startDate, holidayDurations) {
//   this.term = generateCurrentTerm(startDate, holidayDurations); // Call the term generator function
// };

// Method to compare password for login authentication
staffSchema.methods.comparePassword = async function (candidatePassword) {
  return await bcrypt.compare(candidatePassword, this.password); // Compare the provided password with the stored hashed password
};

// Export the Staff model
const Staff = mongoose.model("Staff", staffSchema);
export default Staff;
