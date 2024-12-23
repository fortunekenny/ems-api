import mongoose from "mongoose";
import {
  getCurrentTermDetails,
  startTermGenerationDate, // Ensure this is correctly defined
  holidayDurationForEachTerm, // Ensure this is correctly defined
} from "../utils/termGenerator.js";

// console.log("startDate:", startTermGenerationDate);
// console.log("holidayDurations:", holidayDurationForEachTerm);
// console.log(
//   "Term Details:",
//   getCurrentTermDetails(startTermGenerationDate, holidayDurationForEachTerm),
// );

const testSchema = new mongoose.Schema({
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

  // studentId: { type: mongoose.Schema.Types.ObjectId, ref: "Student" }, // Id of student who submited this test ADJUST IN STUDENTASWER CONTROLLER

  students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // List of students who are doing this test
  submitted: [
    {
      student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
      submittedAt: { type: Date, default: Date.now },
    },
  ], // list of students who have submitted test
  evaluationType: { type: String, required: false, default: "Test" },
  session: { type: String, required: false }, // e.g., 2023/2024
  term: { type: String, required: false }, // e.g., First, Second, Third
  status: {
    type: String,
    enum: ["pending", "submitted"],
    default: "pending",
  },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

// Pre-validation hook to auto-generate session, term, if they are not provided
// Pre-validation hook to auto-generate session, term, and week if they are not provided
/*testSchema.pre("validate", function (next) {
  console.log("pre-validate middleware is running.");

  if (this.isNew) {
    console.log("New document detected.");
    const startDate = startTermGenerationDate;

    if (!startDate) {
      console.error("startTermGenerationDate is undefined.");
      return next(new Error("startTermGenerationDate is not defined."));
    }

    if (!this.session || !this.term || !this.week) {
      console.log("Generating session, term, and week.");
      try {
        const { session, term, weekOfTerm } = getCurrentTermDetails(
          startDate,
          holidayDurationForEachTerm,
        );

        this.session = this.session || session;
        this.term = this.term || term;
        this.week = this.week || weekOfTerm;

        console.log("Generated values:", {
          session: this.session,
          term: this.term,
          week: this.week,
        });
      } catch (error) {
        console.error("Error generating term details:", error);
        return next(new Error("Failed to generate term details."));
      }
    } else {
      console.log("Session, term, and week are already provided.");
    }
  } else {
    console.log("This is not a new document. Middleware skipped.");
  }

  next();
});*/

testSchema.pre("validate", function (next) {
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

const Test = mongoose.model("Test", testSchema);

export default Test;
/*testSchema.pre("validate", function (next) {
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
});*/

// console.log(
//   "getCurrentTermDetails context: ",
//   // startDate,
//   startTermGenerationDate,
//   holidayDurationForEachTerm,
//   // weekOfTerm,
//   week,
//   term,
//   session,
// );

/*
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
*/
