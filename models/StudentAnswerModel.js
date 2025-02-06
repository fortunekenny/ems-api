import mongoose from "mongoose";
import { Schema } from "mongoose";
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
    answers: [
      {
        questionId: {
          type: mongoose.Schema.Types.ObjectId,
          ref: "Question",
          required: [true, "Question ID is required."],
        },
        answer: {
          type: [Schema.Types.Mixed], // Allows strings and numbers in the array
          required: function () {
            return this.questionType !== "file-upload";
          },
          validate: {
            validator: function (value) {
              // Ensure the field is required for non-file-upload question types
              if (this.questionType !== "file-upload") {
                return Array.isArray(value) && value.length > 0;
              }
              return true; // Skip validation for file-upload type
            },
            message: "Answer cannot be empty for this question type.",
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
    markObtained: {
      type: Number,
      default: 0,
    }, // Total marks awarded for all answers  (calculated dynamically)
    grade: {
      type: String,
      required: false,
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
