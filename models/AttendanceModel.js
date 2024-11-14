import mongoose from "mongoose";
import {
  getCurrentTermDetails,
  startTermGenerationDate, // Make sure these are correctly defined elsewhere
  holidayDurationForEachTerm, // Make sure these are correctly defined elsewhere
} from "../utils/termGenerator.js"; // Import getCurrentTermDetails

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
  status: {
    type: String,
    enum: ["present", "absent", "holiday", "Pending"],
    default: "Pending",
    required: true,
  },
  session: {
    type: String,
  },
  term: {
    type: String,
  },
  timeMarked: {
    type: Date,
    default: null,
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

// Pre-validation hook to auto-generate session and term if they are not provided
attendanceSchema.pre("validate", function (next) {
  if (this.isNew) {
    const startDate = startTermGenerationDate; // Use the startTermGenerationDate instead of 'now'

    // If session or term is not provided, generate them
    if (!this.session || !this.term) {
      const { session, term } = getCurrentTermDetails(
        startDate,
        holidayDurationForEachTerm,
      ); // Pass the start date and holiday durations
      if (!this.session) this.session = session; // Set session if not provided
      if (!this.term) this.term = term; // Set term if not provided
    }
  }
  next();
});

// Create Attendance model
const Attendance = mongoose.model("Attendance", attendanceSchema);

export default Attendance;
