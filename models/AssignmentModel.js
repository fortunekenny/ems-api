import mongoose from "mongoose";

const assignmentSchema = new mongoose.Schema({
  subjectTeacher: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Staff", // Reference to Staff (Teacher only)
    required: false,
  },
  lessonNote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LessonNote", // Reference to the LessonNote model
    required: [true, "Please provide a lesson note"],
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: false,
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject",
    required: false,
  },
  lessonWeek: {
    type: Number, // Week number of the term (calculated dynamically)
  },
  topic: {
    type: String,
  },
  subTopic: {
    type: String,
  },
  questions: [{ type: mongoose.Schema.Types.ObjectId, ref: "Question" }],
  marksObtainable: { type: Number, required: false },
  students: [{ type: mongoose.Schema.Types.ObjectId, ref: "Student" }], // List of students who received the assignment
  submitted: [
    {
      student: { type: mongoose.Schema.Types.ObjectId, ref: "Student" },
      submittedAt: { type: Date, default: Date.now },
    },
  ], // List of students who submitted
  evaluationType: { type: String, required: false, default: "Assignment" },
  //dueDate: { type: Date, required: true },
  // status: {
  //   type: String,
  //   enum: ["pending", "submitted"],
  //   default: "pending",
  // },
  session: { type: String }, // e.g., 2023/2024
  term: { type: String }, // e.g., First, Second, Third
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
});

const Assignment = mongoose.model("Assignment", assignmentSchema);

export default Assignment;
