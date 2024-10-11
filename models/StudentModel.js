import mongoose from "mongoose";

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

/*
const studentSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  studentID: { type: String, required: true, unique: true }, // Auto-generated
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  guardian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Parent",
    required: true,
  },
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: true }, // e.g., First, Second, Third
  age: { type: Number, required: true },
  gender: { type: String, enum: ["male", "female"], required: true },
  address: { type: String, required: true },
  medicalHistory: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Pre-save middleware to generate studentID and set session
studentSchema.pre("save", async function (next) {
  if (this.isNew) {
    // Generate studentID
    this.studentID = await generateID("STU", mongoose.model("Student"));

    // Set current session
    this.session = getCurrentSession();
  }
  next();
});

const Student = mongoose.model("Student", studentSchema);

export default Student;
*/

// Student Schema
const studentSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  studentID: { type: String, required: true, unique: true }, // Auto-generated
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true },
  guardian: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Parent",
    required: true,
  },
  role: { type: String, default: "student" },
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: true }, // e.g., First, Second, Third
  age: { type: Number, required: true },
  gender: { type: String, enum: ["male", "female"], required: true },
  address: { type: String, required: true },
  medicalHistory: { type: String },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Pre-save hook to hash password and generate studentID
studentSchema.pre("save", async function (next) {
  if (this.isModified("password")) {
    this.password = await bcrypt.hash(this.password, 10);
  }
  if (this.isNew) {
    this.studentID = await generateID("STU", mongoose.model("Student"));
    this.session = getCurrentSession();
  }
  next();
});

// Method to compare passwords
studentSchema.methods.comparePassword = async function (password) {
  return bcrypt.compare(password, this.password);
};

const Student = mongoose.model("Student", studentSchema);

export default Student;
