import mongoose from "mongoose";
import {
  getCurrentTermDetails,
  startTermGenerationDate, // Ensure this is correctly defined
  holidayDurationForEachTerm, // Ensure this is correctly defined
} from "../utils/termGenerator.js";

const classWorkSchema = new mongoose.Schema({
  subjectTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff", // Reference to Staff (Teacher only)
    required: true,
  },
  class: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  },
  lessonWeek: {
    type: Number, // Week number of the term (calculated dynamically)
  },
  topic: { type: mongoose.Schema.Types.ObjectId, ref: "LessonNote" },
  sunTopic: [{ type: mongoose.Schema.Types.ObjectId, ref: "LessonNote" }],
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Questions" }],
  dueDate: { type: Date, required: true },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // List of students who received the classWork
  submitted: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // List of students who submitted
  session: { type: String, required: true }, // e.g., 2023/2024
  term: { type: String, required: true }, // e.g., First, Second, Third
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Pre-validation hook to auto-generate session, term, if they are not provided
lessonNoteSchema.pre("validate", function (next) {
  if (this.isNew) {
    const startDate = startTermGenerationDate; // Use the startTermGenerationDate if no lesson date is provided

    // If session or term is not provided, generate them
    if (!this.session || !this.term || !this.lessonWeek) {
      const { session, term, weekOfTerm } = getCurrentTermDetails(
        startDate,
        holidayDurationForEachTerm,
      ); // Pass the start date and holiday durations
      if (!this.session) this.session = session; // Set session if not provided
      if (!this.term) this.term = term; // Set term if not provided
      if (!this.lessonWeek) this.lessonWeek = weekOfTerm; // Set lessonWeek if not provided
    }
  }
  next();
});

const Classwork = mongoose.model("Classwork", classWorkSchema);

export default Classwork;
