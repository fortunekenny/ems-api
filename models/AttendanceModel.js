import mongoose from "mongoose";

const attendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  }, // Link to Student
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true }, // Link to Class
  date: { type: Date, required: true },
  status: { type: String, enum: ["Present", "Absent", "Late"], required: true }, // Attendance status
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: true }, // e.g., First, Second, Third
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
