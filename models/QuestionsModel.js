import mongoose from "mongoose";

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
  classId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Class", // Reference to the Class model
    required: [true, "Please provide a class ID"],
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
    const startDate = this.lessonNote
      ? this.lessonNote.lessonDate
      : startTermGenerationDate; // Use lessonDate from lessonNote or startTermGenerationDate

    // If session or term is not provided, generate them
    if (!this.session || !this.term) {
      const { session, term, weekOfTerm } = getCurrentTermDetails(
        startDate,
        holidayDurationForEachTerm,
      ); // Pass the start date and holiday durations
      if (!this.session) this.session = session; // Set session if not provided
      if (!this.term) this.term = term; // Set term if not provided

      // Set lesson week based on weekOfTerm returned by getCurrentTermDetails
      if (weekOfTerm) {
        this.lessonWeek = weekOfTerm; // Use the week of term directly
      }
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
