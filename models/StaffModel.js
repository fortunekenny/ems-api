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

/*const staffSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  employeeID: { type: String, required: true, unique: true }, // Auto-generated
  role: { type: String, enum: ["teacher", "non-teacher"], required: true },
  department: { type: String }, // Optional for non-teachers
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }], // For teachers
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Class" }], // For teachers
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: true }, // e.g., First, Second, Third
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});
*/

const staffSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true },
  employeeID: { type: String, required: true, unique: true },
  role: {
    type: String,
    enum: ["admin", "teacher", "non-teacher"],
    required: true,
  }, // Admin added
  department: { type: String }, // Optional: For non-teaching staff
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }], // Only for teachers
  classes: [{ type: mongoose.Schema.Types.ObjectId, ref: "Class" }], // Only for teachers
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: true }, // e.g., First, Second, Third
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Pre-save middleware to generate employeeID and set session
staffSchema.pre("save", async function (next) {
  if (this.isNew) {
    // Generate employeeID
    this.employeeID = await generateID("EMP", mongoose.model("Staff"));

    // Set current session
    this.session = getCurrentSession();
  }
  next();
});

const Staff = mongoose.model("Staff", staffSchema);

export default Staff;
