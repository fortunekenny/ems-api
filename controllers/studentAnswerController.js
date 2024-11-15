import { StatusCodes } from "http-status-codes";
import StudentAnswer from "../models/StudentAnswerModel.js";
import Question from "../models/QuestionsModel.js";
import LessonNote from "../models/LessonNoteModel.js";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";

// Create a new student answer
export const createStudentAnswer = async (req, res) => {
  const { student, question, answer } = req.body;

  if (!student || !question || !answer) {
    throw new BadRequestError(
      "Student ID, Question ID, and Answer are required.",
    );
  }

  // Validate the question exists
  const questionExists = await Question.findById(question).populate(
    "lessonNote",
  );
  if (!questionExists) {
    throw new NotFoundError("Question not found.");
  }

  // Extract related details for session, term, and classId
  const lessonNote = questionExists.lessonNote;
  const classId = questionExists.classId;
  const session = questionExists.session;
  const term = questionExists.term;
  const lessonWeek = questionExists.lessonWeek;

  // Create the student answer
  const studentAnswer = await StudentAnswer.create({
    ...req.body,
    lessonNote,
    classId,
    session,
    term,
    lessonWeek,
  });

  res.status(StatusCodes.CREATED).json({ studentAnswer });
};

// Fetch all answers for a specific student and subject
export const getAnswersForStudentAndSubject = async (req, res) => {
  const { studentId, subjectId } = req.params;

  if (!studentId || !subjectId) {
    throw new BadRequestError("Student ID and Subject ID are required.");
  }

  const answers = await StudentAnswer.find({
    student: studentId,
    subject: subjectId,
  });
  if (!answers.length) {
    throw new NotFoundError("No answers found for this student and subject.");
  }

  res.status(StatusCodes.OK).json({ answers });
};

// Update an existing student answer
export const updateStudentAnswer = async (req, res) => {
  const { id } = req.params;

  // Validate the answer exists
  const studentAnswer = await StudentAnswer.findById(id);
  if (!studentAnswer) {
    throw new NotFoundError("Student answer not found.");
  }

  // Update the answer
  const updatedAnswer = await StudentAnswer.findByIdAndUpdate(id, req.body, {
    new: true,
    runValidators: true,
  });

  res.status(StatusCodes.OK).json({ studentAnswer: updatedAnswer });
};

// Delete a student answer
export const deleteStudentAnswer = async (req, res) => {
  const { id } = req.params;

  const studentAnswer = await StudentAnswer.findByIdAndDelete(id);
  if (!studentAnswer) {
    throw new NotFoundError("Student answer not found.");
  }

  res
    .status(StatusCodes.OK)
    .json({ message: "Student answer deleted successfully." });
};
