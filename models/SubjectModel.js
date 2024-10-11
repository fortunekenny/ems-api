import mongoose from "mongoose";

const subjectSchema = new mongoose.Schema({
  subjectName: { type: String, required: true }, // Subject name (e.g., Math, Science)
  subjectCode: { type: String, required: true, unique: true }, // Unique subject code
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff", // Reference to Staff (Teacher)
    required: true,
  },
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true }, // Class offering this subject
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: true }, // e.g., First, Second, Third
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Subject = mongoose.model("Subject", subjectSchema);

export default Subject;
