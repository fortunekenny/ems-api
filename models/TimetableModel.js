import mongoose from "mongoose";

const timetableSchema = new mongoose.Schema({
  class: { type: mongoose.Schema.Types.ObjectId, ref: "Class", required: true }, // Link to Class
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  }, // Link to Subject
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Teacher",
    required: true,
  }, // Link to Teacher
  day: { type: String, required: true }, // Day of the week, e.g., Monday
  time: { type: String, required: true }, // Time in HH:mm format
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: true }, // e.g., First, Second, Third
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Timetable = mongoose.model("Timetable", timetableSchema);

export default Timetable;
