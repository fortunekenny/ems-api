import mongoose from "mongoose";

import {
  getCurrentTermDetails,
  startTermGenerationDate, // Ensure this is correctly defined
  holidayDurationForEachTerm, // Ensure this is correctly defined
} from "../utils/termGenerator.js"; // Import getCurrentTermDetails

const { session, term, nextTermStartDate } = getCurrentTermDetails(
  startTermGenerationDate,
  holidayDurationForEachTerm,
); // Pass the start date and holiday durations

const reportCardSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student",
    required: true,
  }, // Link to Student
  teacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff",
    required: false,
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: true,
  }, // Link to Class
  subjectsGrade: [
    {
      gradeId: { type: mongoose.Schema.Types.ObjectId, ref: "Grade" },
      subjectId: { type: mongoose.Schema.Types.ObjectId, ref: "Subject" },
      subjectName: String,
      testScore: Number,
      examScore: Number,
      markObtained: Number,
      grade: String,
      percentage: Number,
      markObtainable: Number,
      remark: String,
    },
  ],
  teacherComment: { type: String, default: "Yet to comment" }, // Comments from class teacher
  overallMarkObtainable: { type: Number }, //Total mark obtainable in the term
  overallMarkObtained: { type: Number }, //Total mark obtainable in the term
  overallPercentage: { type: Number }, //Total percentage in the term
  position: { type: Number }, //Student's position in the class
  numberOfTimesSchoolOpened: { type: Number, default: 0 }, // Total number of times school opened in the term
  numberOfTimesPresent: { type: Number, default: 0 }, // Total number of times student was present in the term
  numberOfTimesAbsent: { type: Number, default: 0 }, // Total number of times student was absent in the term
  session: { type: String, default: session }, // e.g., 2023/2024
  term: { type: String, default: term }, // e.g., First, Second, Third
  nextTermResumptionDate: { type: Date, default: nextTermStartDate }, // Date student resume for next term
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const ReportCard = mongoose.model("ReportCard", reportCardSchema);

export default ReportCard;
