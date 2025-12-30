import mongoose from "mongoose";
const { Schema } = mongoose;
import {
  getCurrentTermDetails,
  startTermGenerationDate, // Ensure this is correctly defined
  holidayDurationForEachTerm, // Ensure this is correctly defined
} from "../utils/termGenerator.js"; // Import getCurrentTermDetails

const questionSchema = new mongoose.Schema({
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
  subject: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Subject", // Reference to the Subject model
    required: [false, "Subject ID is required."],
  },
  topic: {
    type: String,
    required: false,
  },
  subTopic: {
    type: String,
    required: false,
  },
  questionText: {
    type: String,
    required: function () {
      return this.questionType !== "file-upload";
    },
    // minlength: [, "Question text should be at least 10 characters long"],
  },
  questionType: {
    type: String,
    enum: [
      "multiple-choice",
      "true/false",
      "short-answer",
      "essay",
      "rank-order",
      "file-upload", // File upload type
    ],
    required: true,
  },
  options: {
    type: [mongoose.Schema.Types.Mixed],
    validate: {
      validator: function (value) {
        // Validate that options are provided for specific question types
        if (["multiple-choice", "rank-order"].includes(this.questionType)) {
          return Array.isArray(value) && value.length >= 2;
        }
        return true; // Skip validation for other question types
      },
      message:
        "Options must be an array with at least two choices for multiple-choice and rank-order questions.",
    },
  },
  /*   options: {
    type: [String], // Array of strings representing the options
    validate: {
      validator: function (value) {
        // Validate that options are provided for specific question types
        if (["multiple-choice", "rank-order"].includes(this.questionType)) {
          return Array.isArray(value) && value.length >= 2;
        }
        return true; // Skip validation for other question types
      },
      message:
        "Options must be an array with at least two choices for multiple-choice and rank-order questions.",
    },
  }, */
  correctAnswer: {
    type: [Schema.Types.Mixed], // Allow an array of strings or numbers
    required: true, // All question types require a correctAnswer
    validate: {
      validator: function (value) {
        if (!Array.isArray(value) || value.length === 0) {
          return false; // correctAnswer must be a non-empty array
        }

        // Validation for specific question types
        if (
          ["multiple-choice", "rank-order", "short-answer", "essay"].includes(
            this.questionType,
          )
        ) {
          return value.every((ans) => typeof ans === "string");
        }

        if (this.questionType === "true/false") {
          return (
            value.length === 1 &&
            ["true", "false"].includes(String(value[0]).toLowerCase())
          );
        }

        return true; // Default case
      },
      message:
        "Correct answer must be a non-empty array of valid answers for the question type.",
    },
  },
  /*correctAnswer: {
    type: String,
    required: function () {
      return ["multiple-choice", "true/false", "rank-order"].includes(
        this.questionType,
      );
    },
    validate: {
      validator: function (value) {
        // Validate correctAnswer against the options for multiple-choice and rank-order questions
        if (
          this.questionType === "multiple-choice" ||
          this.questionType === "rank-order"
        ) {
          return this.options.includes(value);
        }
        // For true/false, the answer must be "true" or "false"
        if (this.questionType === "true/false") {
          return ["true", "false"].includes(value.toLowerCase());
        }
        return true; // Skip validation for other question types
      },
      message:
        "Correct answer must match one of the options or be valid for the question type.",
    },
  },*/
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

  marks: {
    type: Number,
    required: [true, "Please provide the marks for this question"],
    min: [1, "Marks should be greater than or equal to 1"],
    max: [20, "Marks should not exceed 20"],
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class",
    required: [false, "Please provide a class ID"],
  },
  status: {
    type: String,
    enum: ["pending", "submitted"],
    default: "pending",
  },
  session: {
    type: String,
  },
  term: {
    type: String,
  },
  lessonWeek: {
    type: Number,
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

// Update the `updatedAt` field before saving
questionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Create the Question model
const Question = mongoose.model("Question", questionSchema);

export default Question;
