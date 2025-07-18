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
    default: function () {
      const { weekOfTerm } = getCurrentTermDetails(
        startTermGenerationDate,
        holidayDurationForEachTerm,
      );
      return weekOfTerm;
    },
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
