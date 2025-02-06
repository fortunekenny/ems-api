import mongoose from "mongoose";
import bcrypt from "bcryptjs"; // Import bcrypt for password hashing

// Student Schema
const studentSchema = new mongoose.Schema({
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
  guardian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Parent",
    required: true, // Guardian reference
  },
  attendance: [{ type: mongoose.Schema.Types.ObjectId, ref: "Attendance" }], // Define as array of ObjectIds
  role: { type: String, default: "student" }, // Default role for students
  status: { type: String, enum: ["active", "inactive"], default: "active" },
  session: { type: String, required: false }, // e.g., 2023/2024
  term: { type: String, required: false }, // Term (e.g., First, Second, Third)
  age: { type: Number, required: true }, // Age of the student
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

    // if (!this.studentID) {
    //   this.studentID = await generateID("STU");
    // }
    // if (!this.session) {
    //   this.session = session; // Set the current academic session
    // }
    // if (!this.term) {
    //   this.term = term; // Set the current term
    // }
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
