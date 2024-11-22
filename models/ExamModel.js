import mongoose from "mongoose";
import {
  getCurrentTermDetails,
  startTermGenerationDate, // Ensure this is correctly defined
  holidayDurationForEachTerm, // Ensure this is correctly defined
} from "../utils/termGenerator.js";

const examSchema = new mongoose.Schema({
  subjectTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff", // Reference to Staff (Teacher only)
    required: false,
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "ClassId",
    required: false,
  }, // Link to Class
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: false,
  },
  questions: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Questions", required: true },
  ],
  date: { type: Date, required: true },
  week: {
    type: Number,
    required: true,
  },
  durationTime: {
    type: Number,
    required: true,
  },
  startTime: {
    type: Number,
    required: true,
  },
  studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" }, // Id of student who submited this exam
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // List of students who are doing this exam
  submitted: [
    {
      student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
      submittedAt: { type: Date, default: Date.now },
    },
  ], // list of students who have submitted exam
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: true }, // e.g., First, Second, Third
  status: {
    type: String,
    enum: ["pending", "submitted"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Pre-validation hook to auto-generate session, term, if they are not provided
examSchema.pre("validate", function (next) {
  if (this.isNew) {
    const startDate = startTermGenerationDate;
    // If session or term is not provided, generate them
    if (!this.session || !this.term || !this.week) {
      const { session, term, weekOfTerm } = getCurrentTermDetails(
        startDate,
        holidayDurationForEachTerm,
      ); // Pass the start date and holiday durations
      if (!this.session) this.session = session; // Set session if not provided
      if (!this.term) this.term = term; // Set term if not provided
      if (!this.week) this.week = weekOfTerm; // Set week if not provided
    }
  }
  next();
});

const Exam = mongoose.model("Exam", examSchema);

export default Exam;
