import mongoose from "mongoose";

import {
  getCurrentTermDetails,
  startTermGenerationDate, // Ensure this is correctly defined
  holidayDurationForEachTerm, // Ensure this is correctly defined
} from "../utils/termGenerator.js"; // Import getCurrentTermDetails

const { session, term } = getCurrentTermDetails(
  startTermGenerationDate,
  holidayDurationForEachTerm,
); // Pass the start date and holiday durations

const gradeSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  }, // Link to Student
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: true,
  }, // Link to Subject
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  }, // Link to ClassId
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    required: false,
  },
  exam: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "StudentAnswer",
    required: false,
  },
  examScore: { type: Number, default: 0 },
  tests: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "StudentAnswer",
      required: false,
    },
  ],
  testsScore: { type: Number, default: 0 },
  markObtained: { type: Number, default: 0 },
  percentageScore: { type: Number, default: 0 },
  markObtainable: { type: Number, default: 100 },
  position: { type: Number }, // Student's position in the subject
  grade: { type: String },
  remark: { type: String }, // Teacher's comment on student performance
  session: { type: String, default: session }, // e.g., 2023/2024
  term: { type: String, default: term }, // e.g., First, Second, Third
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Grade = mongoose.model("Grade", gradeSchema);

export default Grade;
