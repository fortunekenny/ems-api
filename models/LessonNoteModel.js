import mongoose from "mongoose";
import {
  getCurrentTermDetails,
  startTermGenerationDate, // Ensure this is correctly defined
  holidayDurationForEachTerm, // Ensure this is correctly defined
} from "../utils/termGenerator.js"; // Import getCurrentTermDetails

const { session, term, weekOfTerm } = getCurrentTermDetails(
  startTermGenerationDate,
  holidayDurationForEachTerm,
); // Pass the start date and holiday durations

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
    default: weekOfTerm + 1,
  },
  topic: {
    type: String,
    required: true,
  },
  subTopic: {
    type: String,
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
  lessonTime: {
    type: String,
    required: [true, "Please provide the lesson time"],
    validate: {
      validator: function (v) {
        // Optional: Add custom validation for time format (e.g., "HH:MM AM/PM")
        return /^(0[1-9]|1[0-2]):[0-5][0-9] (AM|PM)$/.test(v);
      },
      message: "Invalid time format. Expected format: HH:MM AM/PM",
    },
  },

  lessonPeriod: {
    type: Number,
    required: true,
  },
  lessonDuration: {
    type: Number,
    default: 45,
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
  evaluation: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Classwork",
    required: false,
  },
  assignment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Assignment",
    required: false,
  },

  approved: {
    type: Boolean,
    default: false,
  },
  session: {
    type: String,
    default: session,
  },
  term: {
    type: String,
    default: term,
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
/*lessonNoteSchema.pre("validate", function (next) {
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
});*/

// Create LessonNote model
const LessonNote = mongoose.model("LessonNote", lessonNoteSchema);

export default LessonNote;
