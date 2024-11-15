import Question from "../models/QuestionsModel.js";
import LessonNote from "../models/LessonNoteModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";

// Create a new question
// Create a new question
export const createQuestion = async (req, res) => {
  const {
    lessonNote,
    questionText,
    questionType,
    options,
    correctAnswer,
    marks,
  } = req.body;

  // Validate that required fields are provided
  if (!lessonNote || !questionText || !questionType || !marks) {
    throw new BadRequestError("Please provide all required fields.");
  }

  // Validate that lessonNote exists and retrieve related information
  const lessonNoteExists = await LessonNote.findById(lessonNote).populate(
    "subject",
  );

  if (!lessonNoteExists) {
    throw new NotFoundError("LessonNote not found.");
  }

  // Check if the authenticated user is authorized (must be a subject teacher for the lessonNote, admin, or proprietor)
  const isAuthorized =
    req.user.role === "admin" ||
    req.user.role === "proprietor" ||
    (lessonNoteExists.subject.subjectTeachers &&
      lessonNoteExists.subject.subjectTeachers.includes(req.user.id));

  if (!isAuthorized) {
    return res.status(StatusCodes.FORBIDDEN).json({
      message: "You are not authorized to create questions for this subject.",
    });
  }

  // Set the classId and lessonWeek from the lessonNote
  const questionData = {
    lessonNote,
    questionText,
    questionType,
    options,
    correctAnswer,
    marks,
    subject: lessonNoteExists.subject,
    classId: lessonNoteExists.classId,
    lessonWeek: lessonNoteExists.lessonWeek,
    session: lessonNoteExists.session,
    term: lessonNoteExists.term,
  };

  // Create the question
  const question = await Question.create(questionData);
  res.status(StatusCodes.CREATED).json({ question });
};

// Get all questions for a specific lesson note
export const getQuestionsByLessonNote = async (req, res) => {
  const { lessonNoteId } = req.params;

  const questions = await Question.find({ lessonNote: lessonNoteId });
  if (questions.length === 0) {
    throw new NotFoundError("No questions found for this lesson note.");
  }

  res.status(StatusCodes.OK).json({ questions });
};

// Get a specific question by ID
export const getQuestionById = async (req, res) => {
  const { id } = req.params;

  const question = await Question.findById(id);
  if (!question) {
    throw new NotFoundError("Question not found.");
  }

  res.status(StatusCodes.OK).json({ question });
};

// Update a question by ID
export const updateQuestion = async (req, res) => {
  const { id } = req.params;

  // Find the question and populate the lessonNote's subject to check authorization
  const question = await Question.findById(id).populate({
    path: "lessonNote",
    populate: {
      path: "subject",
      model: "Subject",
    },
  });

  if (!question) {
    throw new NotFoundError("Question not found.");
  }

  // Check if the authenticated user is authorized (must be a subject teacher for the lessonNote, admin, or proprietor)
  const isAuthorized =
    req.user.role === "admin" ||
    req.user.role === "proprietor" ||
    (question.lessonNote.subject.subjectTeachers &&
      question.lessonNote.subject.subjectTeachers.includes(req.user.id));

  if (!isAuthorized) {
    return res.status(StatusCodes.FORBIDDEN).json({
      message: "You are not authorized to update questions for this subject.",
    });
  }

  // Update the question with new data
  const updatedQuestion = await Question.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(StatusCodes.OK).json({ question: updatedQuestion });
};

// Delete a question by ID
export const deleteQuestion = async (req, res) => {
  const { id } = req.params;

  const question = await Question.findByIdAndDelete(id);
  if (!question) {
    throw new NotFoundError("Question not found.");
  }

  res
    .status(StatusCodes.OK)
    .json({ message: "Question deleted successfully." });
};
