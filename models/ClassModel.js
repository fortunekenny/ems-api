import mongoose from "mongoose";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";

const classSchema = new mongoose.Schema({
  className: { type: String, required: true, unique: true }, // e.g., Grade 10, Grade 11
  section: { type: String, required: true, default: "A" }, // e.g., A, B, C
  classTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff", // Reference to Staff (Class teacher)
    required: false,
  },
  subjectTeachers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff", // Reference to Staff (Class teacher)
      required: false,
    },
  ],
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // List of students in the class
  subjects: [{ type: mongoose.Schema.Types.ObjectId, ref: "Subject" }], // Subjects taught in the class. Input if not class teacher or class teacher but teaches other class
  session: {
    type: String,
    default: function () {
      const { session } = getCurrentTermDetails(
        startTermGenerationDate,
        holidayDurationForEachTerm,
      );
      return session;
    },
  }, // e.g., 2023/2024
  term: {
    type: String,
    default: function () {
      const { term } = getCurrentTermDetails(
        startTermGenerationDate,
        holidayDurationForEachTerm,
      );
      return term;
    },
  }, // e.g., First, Second, Third
  timetable: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Timetable", // Reference to Timetable
    required: false,
  }, // Timetable or schedule in JSON or reference format
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

classSchema.pre("validate", async function (next) {
  if (this.isNew) {
    /*     if (!this.session) {
      this.session = getCurrentSession(); // Set the current academic session
    } */
  }
  next();
});

// Method to dynamically update term based on start date and holiday durations
/* classSchema.methods.updateTerm = function (startDate, holidayDurations) {
  this.term = generateCurrentTerm(startDate, holidayDurations); // Call the term generator function
}; */

const Class = mongoose.model("Class", classSchema);

export default Class;
