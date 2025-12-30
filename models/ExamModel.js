import mongoose from "mongoose";
import {
  getCurrentTermDetails,
  startTermGenerationDate, // Ensure this is correctly defined
  holidayDurationForEachTerm, // Ensure this is correctly defined
} from "../utils/termGenerator.js";

const { session, term } = getCurrentTermDetails(
  startTermGenerationDate,
  holidayDurationForEachTerm,
);

const examSchema = new mongoose.Schema({
  subjectTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff", // Reference to Staff (Teacher only)
    required: true,
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  }, // Link to Class
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  },
  questions: [
    { type: mongoose.Schema.Types.ObjectId, ref: "Question", required: true },
  ],
  date: {
    type: String, // Store date as a string to validate custom format
    required: [true, "Please provide the test date"],
    validate: {
      validator: function (v) {
        // Regular expression to validate dd/mm/yyyy format
        return /^(0[1-9]|[12][0-9]|3[01])\/(0[1-9]|1[0-2])\/(\d{2}|\d{4})$/.test(
          v,
        );
      },
      message: "Invalid date format. Expected format: or dd/mm/yyyy",
    },
  },
  week: {
    type: Number,
    required: true,
  },
  durationTime: {
    type: Number,
    required: true,
  },
  startTime: {
    type: String,
    required: [true, "Please provide the test time"],
    validate: {
      validator: function (v) {
        // Updated regex to allow single-digit hours without leading zero
        return /^(0?[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/.test(v);
      },
      message: "Invalid time format. Expected format: HH:MM AM/PM",
    },
  },
  marksObtainable: {
    type: Number,
    required: false,
    min: [1, "Marks should be greater than or equal to 1"],
    max: [60, "Marks should not exceed 60"],
  },
  // studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" }, // Id of student who submited this exam
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // List of students who are doing this exam
  submitted: [
    {
      student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
      submittedAt: { type: Date, default: Date.now },
    },
  ], // list of students who have submitted exam
  evaluationType: { type: String, required: false, default: "Exam" },
  session: { type: String, default: session }, // e.g., 2023/2024
  term: { type: String, default: term }, // e.g., First, Second, Third
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
