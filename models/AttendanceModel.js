import mongoose from "mongoose";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";

const attendanceSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: false,
  },
  classTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    required: false,
  },
  date: {
    type: Date,
    required: true,
  },
  morningStatus: {
    type: String,
    enum: ["present", "absent", "publicHoliday", "pending"],
    default: "pending",
    required: true,
  },
  afternoonStatus: {
    type: String,
    enum: ["present", "absent", "publicHoliday", "pending"],
    default: "pending",
    required: true,
  },
  session: {
    type: String,
    default: function () {
      const { session } = getCurrentTermDetails(
        startTermGenerationDate,
        holidayDurationForEachTerm,
      );
      return session;
    },
  },
  term: {
    type: String,
    lowercase: true,
    default: function () {
      const { term } = getCurrentTermDetails(
        startTermGenerationDate,
        holidayDurationForEachTerm,
      );
      return term;
    },
  },
  weekOfTerm: {
    type: Number,
    // Derived from dayOfTerm in the pre-validate hook below: every 5 school days
    // is one week, numbered from 1 (days 1–5 → week 1, 6–10 → week 2, …).
  },
  dayOfTerm: {
    type: Number,
    default: function () {
      const { day } = getCurrentTermDetails(
        startTermGenerationDate,
        holidayDurationForEachTerm,
      );
      return day;
    },
  },
  timeMarkedMorning: {
    type: Date,
    default: null, // Timestamp for marking morning attendance
  },
  timeMarkedAfternoon: {
    type: Date,
    default: null, // Timestamp for marking afternoon attendance
  },
  markedByMorning: {
    type: String,
    default: null, // Full name of the user who marked morning attendance
  },
  markedByAfternoon: {
    type: String,
    default: null, // Full name of the user who marked afternoon attendance
  },
  // publicHolidays: [
  //   {type: Date} // Array of public holiday dates in the term}
  // ],
  totalDaysPresent: {
    type: Number,
    default: 0,
  },
  totalDaysAbsent: {
    type: Number,
    default: 0,
  },
  totalDaysPublicHoliday: {
    type: Number,
    default: 0,
  },
  totalDaysSchoolOpened: {
    type: Number,
    default: 0,
  }, // Total number of days in the term
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

attendanceSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Keep weekOfTerm consistent with dayOfTerm: every 5 school days is one week,
// numbered from 1 (days 1–5 → week 1, 6–10 → week 2, …). dayOfTerm is supplied
// per record by the bulk creator, or falls back to its own (today-based) default
// when a single day is marked.
attendanceSchema.pre("validate", function (next) {
  if (typeof this.dayOfTerm === "number" && this.dayOfTerm > 0) {
    this.weekOfTerm = Math.ceil(this.dayOfTerm / 5);
  }
  next();
});

// Pre-validation hook to auto-generate session and term if they are not provided
/* attendanceSchema.pre("validate", function (next) {
  if (this.isNew) {
    const startDate = startTermGenerationDate; // Use the startTermGenerationDate instead of 'now'

    // If session or term is not provided, generate them
    /*     if (!this.session || !this.term) {
      const { session, term } = getCurrentTermDetails(
        startDate,
        holidayDurationForEachTerm,
      ); // Pass the start date and holiday durations
      if (!this.session) this.session = session; // Set session if not provided
      if (!this.term) this.term = term; // Set term if not provided
    } 
  }
  next();
}); */

// Create Attendance model
const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
