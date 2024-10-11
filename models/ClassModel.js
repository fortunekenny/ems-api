import mongoose from "mongoose";

const classSchema = new mongoose.Schema({
  className: { type: String, required: true }, // e.g., Grade 10, Grade 11
  section: { type: String, required: true }, // e.g., A, B, C
  staff: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff", // Reference to Staff (Class teacher)
    required: true,
  },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // List of students in the class
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }], // Subjects taught in the class
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: true }, // e.g., First, Second, Third
  timetable: { type: String }, // Timetable or schedule in JSON or reference format
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Class = mongoose.model("Class", classSchema);

export default Class;
