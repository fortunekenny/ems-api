import mongoose from "mongoose";

const reportCardSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  }, // Link to Student
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true }, // Link to Class
  grades: [{ type: mongoose.Schema.Types.ObjectId, ref: "Grade" }], // List of grades in the term
  teacherComments: { type: String }, // Comments from class teacher
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: true }, // e.g., First, Second, Third
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const ReportCard = mongoose.model("ReportCard", reportCardSchema);

export default ReportCard;
