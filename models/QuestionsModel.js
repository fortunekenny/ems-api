/*const questionSchema = new mongoose.Schema({
  lessonNote: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "LessonNote", // Reference to the LessonNote model
    required: [true, "Please provide a lesson note"],
  },
  questionText: {
    type: String,
    required: [true, "Please provide the question text"],
    minlength: [10, "Question text should be at least 10 characters long"],
    validate: {
      validator: function (v) {
        // Custom validation to check for any disallowed characters or patterns
        return /^[a-zA-Z0-9\s\.,?!]*$/.test(v); // Allow only alphanumeric and basic punctuation
      },
      message: "Question text contains invalid characters",
    },
  },
  questionType: {
    type: String,
    enum: ["multiple-choice", "true/false", "short-answer", "essay"],
    required: true,
  },
  options: [
    {
      type: String,
      required: function () {
        return this.questionType === "multiple-choice"; // Options required for multiple-choice questions
      },
      validate: {
        validator: function (v) {
          // Custom validation: multiple-choice must have at least two options
          return (
            this.questionType !== "multiple-choice" || (v && v.length >= 2)
          );
        },
        message: "Multiple-choice questions must have at least two options",
      },
    },
  ],
  correctAnswer: {
    type: String,
    required: function () {
      // Only required for multiple-choice, true/false, and short-answer types
      return ["multiple-choice", "true/false", "short-answer"].includes(
        this.questionType,
      );
    },
    validate: {
      validator: function (v) {
        if (this.questionType === "multiple-choice") {
          // For multiple-choice, correctAnswer must be one of the options
          return this.options && this.options.includes(v);
        } else if (this.questionType === "true/false") {
          // For true/false, correctAnswer must be 'True' or 'False'
          return ["True", "False"].includes(v);
        } else if (this.questionType === "short-answer") {
          // For short-answer, just ensure it's a non-empty string (or pattern match)
          return typeof v === "string" && v.trim().length > 0;
        }
        return true; // No validation for essay questions
      },
      message: "Invalid correct answer for this question type",
    },
  },
  marks: {
    type: Number,
    required: [true, "Please provide the marks for the question"],
    min: [1, "Marks should be greater than or equal to 1"],
    max: [10, "Marks should not exceed 10"], // Adjust max as needed
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
*/

import mongoose from "mongoose";
import {
  getCurrentTermDetails,
  startTermGenerationDate, // Ensure this is correctly defined
  holidayDurationForEachTerm, // Ensure this is correctly defined
} from "../utils/termGenerator.js"; // Import getCurrentTermDetails

const questionSchema = new mongoose.Schema({
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
  questionText: {
    type: String,
    required: [true, "Please provide the question text"],
    minlength: [10, "Question text should be at least 10 characters long"],
    validate: {
      validator: function (v) {
        // Custom validation to check for any disallowed characters or patterns
        return /^[a-zA-Z0-9\s\.,?!]*$/.test(v); // Allow only alphanumeric and basic punctuation
      },
      message: "Question text contains invalid characters",
    },
  },
  questionType: {
    type: String,
    enum: [
      "multiple-choice",
      "true/false",
      "short-answer",
      "essay",
      "rank-order",
    ],
    required: true,
  },
  options: [
    {
      type: String,
      required: function () {
        return ["multiple-choice", "rank-order"].includes(this.questionType); // Options required for multiple-choice and rank-order questions
      },
      validate: {
        validator: function (v) {
          // Validation for options based on question type
          if (this.questionType === "multiple-choice") {
            return v && v.length >= 2; // Multiple-choice must have at least two options
          } else if (this.questionType === "rank-order") {
            return v && v.length >= 2; // Rank-order must also have at least two options to rank
          }
          return true;
        },
        message: "This question type must have at least two options",
      },
    },
  ],
  correctAnswer: {
    type: mongoose.Schema.Types.Mixed, // Can store string or array
    required: function () {
      // Required for multiple-choice, true/false, short-answer, and rank-order types
      return [
        "multiple-choice",
        "true/false",
        "short-answer",
        "rank-order",
      ].includes(this.questionType);
    },
    validate: {
      validator: function (v) {
        if (this.questionType === "multiple-choice") {
          // For multiple-choice, correctAnswer must be one of the options
          return this.options && this.options.includes(v);
        } else if (this.questionType === "true/false") {
          // For true/false, correctAnswer must be 'True' or 'False'
          return ["True", "False"].includes(v);
        } else if (this.questionType === "short-answer") {
          // For short-answer, just ensure it's a non-empty string (or pattern match)
          return typeof v === "string" && v.trim().length > 0;
        } else if (this.questionType === "rank-order") {
          // For rank-order, correctAnswer should be an array matching the options in specific order
          return (
            Array.isArray(v) &&
            v.length === this.options.length &&
            v.every((item) => this.options.includes(item))
          );
        }
        return true; // No validation for essay questions
      },
      message: "Invalid correct answer for this question type",
    },
  },
  marks: {
    type: Number,
    required: [true, "Please provide the marks for the question"],
    min: [1, "Marks should be greater than or equal to 1"],
    max: [10, "Marks should not exceed 10"], // Adjust max as needed
  },
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class", // Reference to the Class model
    required: [false, "Please provide a class ID"],
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
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Pre-validation hook to auto-generate session, term, and lesson week if they are not provided
questionSchema.pre("validate", function (next) {
  if (this.isNew) {
    const startDate = startTermGenerationDate; // Use or startTermGenerationDate

    // If session or term is not provided, generate them
    if (!this.session || !this.term) {
      const { session, term } = getCurrentTermDetails(
        startDate,
        holidayDurationForEachTerm,
      ); // Pass the start date and holiday durations
      if (!this.session) this.session = session; // Set session if not provided
      if (!this.term) this.term = term; // Set term if not provided

      /*      // Set lesson week based on weekOfTerm returned by getCurrentTermDetails
      if (weekOfTerm) {
        this.lessonWeek = weekOfTerm; // Use the week of term directly
      }
      */
    }
  }
  next();
});

// Update the `updatedAt` field before saving
questionSchema.pre("save", function (next) {
  this.updatedAt = Date.now();
  next();
});

// Create the Question model
const Question = mongoose.model("Question", questionSchema);

export default Question;

/*
Creating a Multiple-Choice Question:

import Question from "./models/Question";

// Example: Creating a multiple-choice question
const createMCQuestion = async () => {
  const mcQuestion = new Question({
    lessonNote: "someLessonNoteId", // The ID of the related lesson note
    questionText: "What is the capital of France?",
    questionType: "multiple-choice",
    options: ["Paris", "London", "Rome", "Berlin"],
    correctAnswer: "Paris",
    marks: 2,
  });

  try {
    await mcQuestion.save();
    console.log("Multiple-Choice Question saved:", mcQuestion);
  } catch (error) {
    console.error("Error saving question:", error.message);
  }
};

// Call the function
createMCQuestion();
*/

/*
Creating a True/False Question:

import Question from './models/Question';

// Example: Creating a true/false question
const createTFQuestion = async () => {
  const tfQuestion = new Question({
    lessonNote: 'someLessonNoteId', // The ID of the related lesson note
    questionText: 'The earth is flat.',
    questionType: 'true/false',
    correctAnswer: 'False',
    marks: 1,
  });

  try {
    await tfQuestion.save();
    console.log('True/False Question saved:', tfQuestion);
  } catch (error) {
    console.error('Error saving question:', error.message);
  }
};

// Call the function
createTFQuestion();

*/

/*
Creating a Short-Answer Question:

import Question from './models/Question';

// Example: Creating a short-answer question
const createSAQuestion = async () => {
  const saQuestion = new Question({
    lessonNote: 'someLessonNoteId', // The ID of the related lesson note
    questionText: 'What is the formula for water?',
    questionType: 'short-answer',
    correctAnswer: 'H2O',
    marks: 2,
  });

  try {
    await saQuestion.save();
    console.log('Short-Answer Question saved:', saQuestion);
  } catch (error) {
    console.error('Error saving question:', error.message);
  }
};

// Call the function
createSAQuestion();

*/

/*
Creating an Essay Question:

import Question from './models/Question';

// Example: Creating an essay question
const createEssayQuestion = async () => {
  const essayQuestion = new Question({
    lessonNote: 'someLessonNoteId', // The ID of the related lesson note
    questionText: 'Discuss the causes and effects of global warming.',
    questionType: 'essay',
    marks: 10,
  });

  try {
    await essayQuestion.save();
    console.log('Essay Question saved:', essayQuestion);
  } catch (error) {
    console.error('Error saving question:', error.message);
  }
};

// Call the function
createEssayQuestion();

*/

/*
Example Rank-Order Question

{
  "lessonNote": "63f9c569d87b9f28b0c4d389", // Example LessonNote ID
  "questionText": "Arrange the planets in our solar system in order from closest to farthest from the Sun.",
  "questionType": "rank-order",
  "options": [
    "Mercury",
    "Venus",
    "Earth",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune"
  ],
  "correctAnswer": [
    "Mercury",
    "Venus",
    "Earth",
    "Mars",
    "Jupiter",
    "Saturn",
    "Uranus",
    "Neptune"
  ],
  "marks": 5,
  "classId": "63f9c599d87b9f28b0c4d3a1", // Example Class ID
  "session": "2023/2024",
  "term": "First Term",
  "lessonWeek": 3
}

*/
