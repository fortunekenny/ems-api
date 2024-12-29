import mongoose from "mongoose";
import {
  getCurrentTermDetails,
  startTermGenerationDate, // Ensure this is correctly defined
  holidayDurationForEachTerm, // Ensure this is correctly defined
} from "../utils/termGenerator.js"; // Import getCurrentTermDetails

/*const studentAnswerSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student", // Reference to the Student model
    required: [false, "Student ID is required."],
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject", // Reference to the Subject model
    required: [false, "Subject ID is required."],
  },
  evaluationType: {
    type: String,
    enum: ["Test", "Assignment", "ClassWork", "Exam"],
    required: [true, "Evaluation type is required."],
  },
  evaluationTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, "Evaluation ID is required."],
  },
  lessonNote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LessonNote", // Reference to the LessonNote model
    required: [false, "Please provide a lesson note"],
  },
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Question", // Reference to the Question model
    required: [false, "Question ID is required."],
  },
  questionType: {
    type: String,
    enum: [
      "multiple-choice",
      "true/false",
      "short-answer",
      "essay",
      "rank-order",
      "file-upload",
    ],
    required: [false, "Question type is required."],
  },
  answer: {
    type: String,
    required: function () {
      return this.questionType !== "file-upload";
    },
    validate: {
      validator: function (value) {
        if (this.questionType !== "file-upload") {
          return value && value.length > 0;
        }
        return true; // Skip validation for file-upload type
      },
      message: "Answer cannot be empty for non-file-upload questions.",
    },
  },

  files: [
    {
      url: {
        type: String, // URL for the file stored in Cloudinary
        required: function () {
          return this.questionType === "file-upload";
        },
      },
    },
  ],

  /*file: {
    url: {
      type: String, // Local file path
      required: function () {
        return this.questionType === "file-upload";
      },
    },
    fileType: {
      type: String,
      enum: ["pdf", "doc", "docx", "xlsx"], // Allowed file types
      required: function () {
        return this.questionType === "file-upload";
      },
    },
    fileSize: {
      type: Number, // File size in bytes
      required: function () {
        return this.questionType === "file-upload";
      },
      validate: {
        validator: function (v) {
          return v <= 5 * 1024 * 1024; // Limit file size to 5MB
        },
        message: "File size must not exceed 5MB",
      },
    },
  },
  isCorrect: {
    type: Boolean,
    default: false, // Indicates if the answer is correct or not
  },
  marksAwarded: {
    type: Number,
    default: 0, // Marks awarded for the answer
    min: [0, "Marks cannot be negative."],
    max: [100, "Marks cannot exceed 100."],
    validate: {
      validator: Number.isInteger,
      message: "Marks awarded must be an integer.",
    },
  },
  explanation: {
    type: String,
    validate: {
      validator: (value) =>
        value === undefined || validator.isLength(value, { max: 500 }),
      message: "Explanation cannot exceed 500 characters.",
    },
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class", // Reference to the Class model
  },
  session: {
    type: String,
  },
  term: {
    type: String,
  },
  lessonWeek: {
    type: Number, // Week number of the term (calculated dynamically)
  },
  createdAt: {
    type: Date,
    default: Date.now, // Timestamp when the answer was submitted
  },
  updatedAt: {
    type: Date,
    default: Date.now, // Timestamp when the answer was last updated
  },
});*/

/*const studentAnswerSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student", // Reference to the Student model
    required: [false, "Student ID is required."],
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject", // Reference to the Subject model
    required: [false, "Subject ID is required."],
  },
  evaluationType: {
    type: String,
    enum: ["Test", "Assignment", "ClassWork", "Exam"],
    required: [true, "Evaluation type is required."],
  },
  evaluationTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    required: [true, "Evaluation ID is required."],
  },
  lessonNote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LessonNote", // Reference to the LessonNote model
    required: [false, "Please provide a lesson note"],
  },
  questions: [
    {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Question", // Reference to the Question model
      required: [false, "Question ID is required."],
    },
  ],
  answers: [
    {
      type: String,
      required: function () {
        return this.questionType !== "file-upload";
      },
      validate: {
        validator: function (value) {
          if (
            this.questionType !== "file-upload" ||
            this.questionType !== "essay" ||
            this.questionType !== "short-answer"
          ) {
            return value && value.length > 0;
          }
          return true; // Skip validation for file-upload type
        },
        message: "Answer cannot be empty.",
      },
    },
  ],

  files: [
    {
      url: {
        type: String, // URL for the file stored in Cloudinary
        required: function () {
          return this.questionType === "file-upload";
        },
      },
    },
  ],

  isCorrect: [
    {
      type: Boolean,
      default: false, // Indicates if the answer is correct or not
    },
  ],
  marksAwarded: [
    {
      type: Number,
      default: 0, // Marks awarded for the answer
      min: [0, "Marks cannot be negative."],
      max: [100, "Marks cannot exceed 100."],
      validate: {
        validator: Number.isInteger,
        message: "Marks awarded must be an integer.",
      },
    },
  ],
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class", // Reference to the Class model
  },
  session: {
    type: String,
  },
  term: {
    type: String,
  },
  lessonWeek: {
    type: Number, // Week number of the term (calculated dynamically)
  },
  createdAt: {
    type: Date,
    // default: Date.now, // Timestamp when the answer was submitted
  },
  updatedAt: {
    type: Date,
    default: Date.now, // Timestamp when the answer was last updated
  },
});*/

const studentAnswerSchema = new mongoose.Schema(
  {
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student", // Reference to the Student model
      required: [false, "Student ID is required."],
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject", // Reference to the Subject model
      required: [false, "Subject ID is required."],
    },
    evaluationType: {
      type: String,
      // enum: ["Test", "Assignment", "ClassWork", "Exam"],
      // required: [true, "Evaluation type is required."],
    },
    evaluationTypeId: {
      type: mongoose.Schema.Types.ObjectId,
      required: [true, "Evaluation ID is required."],
    },
    lessonNote: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "LessonNote", // Reference to the LessonNote model
      required: [false, "Please provide a lesson note"],
    },
    // questions: [
    //   {
    //     type: mongoose.Schema.Types.ObjectId,
    //     ref: "Question", // Reference to the Question model
    //     required: [false, "Question ID is required."],
    //   },
    // ],
    answers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
          required: [true, "Question ID is required."],
        },
        answer: {
          type: String,
          required: function () {
            return this.questionType !== "file-upload";
          },
          validate: {
            validator: function (value) {
              if (
                this.questionType !== "file-upload" ||
                this.questionType !== "essay" ||
                this.questionType !== "short-answer"
              ) {
                return value && value.length > 0;
              }
              return true; // Skip validation for file-upload type
            },
            message: "Answer cannot be empty.",
          },
        },
        files: [
          {
            url: {
              type: String, // URL for the file stored in Cloudinary
              required: function () {
                return this.questionType === "file-upload";
              },
            },
          },
        ],
        isCorrect: {
          type: Boolean,
          default: false, // Indicates if the answer is correct or not
        },
        marksAwarded: {
          type: Number,
          default: 0, // Marks awarded for the answer
          min: [0, "Marks cannot be negative."],
          max: [100, "Marks cannot exceed 100."],
          validate: {
            validator: Number.isInteger,
            message: "Marks awarded must be an integer.",
          },
        },
      },
    ],
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class", // Reference to the Class model
    },
    session: {
      type: String,
    },
    term: {
      type: String,
    },
    lessonWeek: {
      type: Number, // Week number of the term (calculated dynamically)
    },
  },
  { timestamps: true },
);

// Pre-validation hook to check and set session, term, and week of term before validation
studentAnswerSchema.pre("validate", function (next) {
  if (this.isNew) {
    const startDate = startTermGenerationDate; // Use createdAt or default start date if no answer date is provided

    // If session, term, and classId are not provided, fetch the current term details
    if (!this.session || !this.term) {
      const { session, term } = getCurrentTermDetails(
        startDate,
        holidayDurationForEachTerm,
      );

      // Set session, term, and weekOfTerm if not provided
      if (!this.session) this.session = session;
      if (!this.term) this.term = term;
      // if (!this.lessonWeek) this.lessonWeek = weekOfTerm; // Set the current week of the term
    }
  }

  next();
});

// Create the StudentAnswer model
const StudentAnswer = mongoose.model("StudentAnswer", studentAnswerSchema);

export default StudentAnswer;

/*const studentAnswerSchema = new mongoose.Schema({
  student: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Student", // Reference to the Student model
    required: [false, "Student ID is required."],
  },
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject", // Reference to the Subject model
    required: [false, "Subject ID is required."],
  },
  evaluationType: {
    type: String,
    enum: ["Test", "Assignment", "ClassWork", "Exam"],
    required: [true, "Evaluation type is required."],
  },
  evaluationTypeId: {
    type: mongoose.Schema.Types.ObjectId,
    // ref: ["Test", "Assignment", "ClassWork", "Exam"],
    required: [true, "Evaluation ID is required."],
  },
  lessonNote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LessonNote", // Reference to the LessonNote model
    required: [false, "Please provide a lesson note"],
  },
  question: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Question", // Reference to the Question model
    required: [false, "Question ID is required."],
  },
  answer: {
    type: String,
    required: [true, "Answer is required."],
    validate: {
      validator: (value) => validator.isLength(value, { min: 1 }),
      message: "Answer cannot be empty.",
    },
  },
  isCorrect: {
    type: Boolean,
    default: false, // Indicates if the answer is correct or not
  },
  marksAwarded: {
    type: Number,
    default: 0, // Marks awarded for the answer
    min: [0, "Marks cannot be negative."],
    max: [100, "Marks cannot exceed 100."],
    validate: {
      validator: Number.isInteger,
      message: "Marks awarded must be an integer.",
    },
  },
  explanation: {
    type: String,
    validate: {
      validator: (value) =>
        value === undefined || validator.isLength(value, { max: 500 }),
      message: "Explanation cannot exceed 500 characters.",
    },
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class", // Reference to the Class model
    // required: [true, "Class ID is required."],
  },
  session: {
    type: String,
  },
  term: {
    type: String,
  },
  lessonWeek: {
    type: Number, // Week number of the term (calculated dynamically)
  },
  createdAt: {
    type: Date,
    default: Date.now, // Timestamp when the answer was submitted
  },
  updatedAt: {
    type: Date,
    default: Date.now, // Timestamp when the answer was last updated
  },
});*/

/*
const checkAnswer = async (req, res) => {
  try {
    const { studentAnswerId } = req.params;

    const studentAnswer = await StudentAnswer.findById(studentAnswerId).populate("question");

    if (!studentAnswer) throw new Error("Answer not found");

    const isCorrect = studentAnswer.answer === studentAnswer.question.correctAnswer;
    studentAnswer.isCorrect = isCorrect;

    // Optionally award marks
    studentAnswer.marksAwarded = isCorrect ? studentAnswer.question.marks : 0;

    await studentAnswer.save();

    res.status(200).json({ message: "Answer checked successfully", studentAnswer });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

*/

/*
Example of Saving a Student's Answer:

import StudentAnswer from "./models/StudentAnswer"; // Assuming the path is correct

// Example data
const studentId = "someStudentId"; // Replace with actual student ID
const questionId = "someQuestionId"; // Replace with actual question ID
const answer = "Option A"; // Replace with actual answer
const classId = "someClassId"; // Replace with actual class ID

const studentAnswer = new StudentAnswer({
  student: studentId,
  question: questionId,
  answer: answer,
  classId: classId,
});

await studentAnswer.save();  // This will trigger pre-validation and set the session, term, and week if not provided

*/

/*
Retrieving Student Answers:

// Find all answers for a specific student in a specific term and session
const studentAnswers = await StudentAnswer.find({ student: studentId, session: '2024/2025', term: 'First Term' })
  .populate("question");

// Find a specific answer for a particular question
const studentSpecificAnswer = await StudentAnswer.findOne({ student: studentId, question: questionId })
  .populate("question");

*/

/*

*/

/*
in the StudentAnswer.questions get each questions question.questionType, question.correctanswer if questionType is multiple-choice, true/false, or rank-order check it 
*/
