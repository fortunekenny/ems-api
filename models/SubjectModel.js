import mongoose from "mongoose";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js"; // Import the term generation function

const subjectSchema = new mongoose.Schema({
  subjectName: { type: String, required: true }, // Subject name (e.g., Math, Science)
  subjectCode: { type: String, required: true, unique: true }, // Unique subject code
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // List of students in the class
  subjectTeachers: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff", // Reference to Staff (Teacher)
      required: false,
    },
  ],
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  }, // Class offering this subject
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
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

/* const subjectSchema = new mongoose.Schema({
  subjectName: { type: String, required: true }, // Subject name (e.g., Math, Science)
  subjectCode: { type: String, required: true, unique: true }, // Unique subject code
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  }, // Class offering this subject
  subjectRecords: [
    {
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
      subjectTeachers: [
        {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Staff", // Reference to Staff (Teacher)
          required: false,
        },
      ],
      students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // List of students in the class
      createdAt: { type: Date, default: Date.now },
      updatedAt: { type: Date, default: Date.now },
    },
  ],
}); */

/* subjectSchema.pre("validate", async function (next) {
  if (this.isNew) {
    if (!this.session) {
      this.session = getCurrentSession(); // Set the current academic session
    }
  }
  next();
}); */

// Method to dynamically update term based on start date and holiday durations
/* subjectSchema.methods.updateTerm = function (startDate, holidayDurations) {
  this.term = generateCurrentTerm(startDate, holidayDurations); // Call the term generator function
}; */

const Subject = mongoose.model("Subject", subjectSchema);

export default Subject;

/* 
{
  _id: ObjectId,
  classId: ObjectId,
  subjectName: "Math",
  teachers: [
    {
      staffId: ObjectId,
      term: "first",
      session: "2024/2025"
    }
  ]
}
*/
