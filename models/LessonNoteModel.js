import mongoose from "mongoose";
import {
  getCurrentTermDetails,
  startTermGenerationDate, // Ensure this is correctly defined
  holidayDurationForEachTerm, // Ensure this is correctly defined
} from "../utils/termGenerator.js"; // Import getCurrentTermDetails

const lessonNoteSchema = new mongoose.Schema({
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    required: false,
  },
  classId: {
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
  topic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Diary",
    required: true,
  },
  subTopic: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Diary",
    required: true,
  },
  // lessonDate: {
  //   type: mongoose.Schema.Types.ObjectId,
  //   ref: "TimeTable",
  //   required: true,
  // },
  lessonDate: {
    type: Date,
    required: true,
  },
  previousKnowledge: {
    type: String,
    required: true,
  },
  objectives: [
    {
      type: String,
      required: true,
    },
  ],
  content: {
    type: String,
    required: true,
  },
  evaluation: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Classwork",
      required: false,
    },
  ],
  assignment: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Assignment",
      required: false,
    },
  ],
  status: {
    type: String,
    enum: ["approved", "unapproved"],
    default: "unapproved",
  },
  session: {
    type: String,
  },
  term: {
    type: String,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-validation hook to auto-generate session, term, and lesson week if they are not provided
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
      if (!this.lessonWeek) this.lessonWeek = weekOfTerm + 1; // Set lessonWeek if not provided
    }
  }
  next();
});

// Create LessonNote model
const LessonNote = mongoose.model("LessonNote", lessonNoteSchema);

export default LessonNote;
