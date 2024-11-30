import { StatusCodes } from "http-status-codes";
import StudentAnswer from "../models/StudentAnswerModel.js";
import Student from "../models/StudentModel.js";
import Question from "../models/QuestionsModel.js";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import Class from "../models/ClassModel.js";
import LessonNote from "../models/LessonNoteModel.js";

// Create a new student answer

export const createStudentAnswer = async (req, res, next) => {
  try {
    const userId = req.user.id; // Authenticated user ID
    const userRole = req.user.role; // Authenticated user role

    const { student, question, answer, evaluationTypeId, evaluationType } =
      req.body;

    // Validate required fields
    if (
      !question ||
      (!answer && req.files === undefined) || // Answer required unless it's a file-upload
      !evaluationTypeId ||
      !evaluationType
    ) {
      throw new BadRequestError(
        "Student ID, Question ID, Answer (or file for file-upload), evaluationTypeId, and evaluationType are required.",
      );
    }

    let studentId;
    let isAuthorized = false;

    if (userRole === "admin" || userRole === "proprietor") {
      isAuthorized = true;
      studentId = req.body.student;

      // Ensure 'student' field is provided
      if (!studentId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'student' field must be provided.",
        );
      }

      // Validate that the student exists and is valid
      const student = await Student.findById(studentId);
      if (!student) {
        throw new NotFoundError("Provided student not found.");
      }
    } else if (userRole === "student") {
      student = userId; // Assign the current user as the student
      // Validate that the student is assigned the subject
      const student = await Student.findById(student).populate("subjects");
      if (!student) {
        throw new NotFoundError("Student not found.");
      }

      isAuthorized = true;

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not allowed to attempt this question.",
        );
      }
    }

    // Dynamically determine the evaluation model
    const evaluationModelMap = {
      test: Test,
      assignment: Assignment,
      classwork: ClassWork,
      exam: Exam,
    };

    const EvaluationModel = evaluationModelMap[evaluationType];
    if (!EvaluationModel) {
      throw new BadRequestError(
        `Invalid evaluation type. Allowed types: ${Object.keys(
          evaluationModelMap,
        ).join(", ")}.`,
      );
    }

    // Find the evaluation
    const evaluation = await EvaluationModel.findById(evaluationTypeId);
    if (!evaluation) {
      throw new NotFoundError(`${evaluationType} not found.`);
    }

    // Check if the student is in the evaluation's student list for the term and session
    const isStudentInEvaluation = evaluation.students.some(
      (evaluationStudent) =>
        evaluationStudent.student.toString() === student.toString() &&
        evaluationStudent.term === evaluation.term &&
        evaluationStudent.session === evaluation.session,
    );

    if (!isStudentInEvaluation) {
      throw new BadRequestError(
        "The specified student is not part of this evaluation's student list for the current term and session.",
      );
    }

    // Check if the evaluation has already been submitted by the student
    const alreadySubmitted = evaluation.submitted.find(
      (submission) => submission.student.toString() === student,
    );

    if (alreadySubmitted) {
      throw new BadRequestError(
        `This ${evaluationType} has already been submitted.`,
      );
    }

    // Add submission
    evaluation.submitted.push({ student });
    evaluation.status = "submitted";

    // Validate the question exists
    const questionExists = await Question.findById(question).populate(
      "questionText",
    );
    if (!questionExists) {
      throw new NotFoundError("Question not found.");
    }

    // Extract related details for session, term, and classId
    const lessonNote = questionExists.lessonNote;
    const classId = questionExists.classId;
    const subject = questionExists.subject;
    const questionType = questionExists.questionType;

    // Handle file upload for 'file-upload' questionType
    let fileData = [];
    if (questionType === "file-upload") {
      if (!req.files || req.files.length === 0) {
        throw new BadRequestError(
          "File is required for file-upload question type.",
        );
      }

      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      // Validate each file
      req.files.forEach((file) => {
        if (!allowedTypes.includes(file.mimetype)) {
          throw new BadRequestError("Invalid file type.");
        }

        // Check file size: must not exceed 3MB (3MB = 3 * 1024 * 1024 bytes)
        if (file.size > 3 * 1024 * 1024) {
          throw new BadRequestError("File size must not exceed 3MB.");
        }
      });

      // Save file data (assuming you're storing file URLs after uploading to Cloudinary or similar)
      fileData = req.files.map((file) => ({ url: file.path })); // Replace `file.path` with the appropriate URL if using a service like Cloudinary
    }

    // Create the student answer
    let studentAnswer = new StudentAnswer({
      student,
      question,
      questionType,
      answer: questionType !== "file-upload" ? answer : undefined,
      files: questionType === "file-upload" ? fileData : undefined,
      evaluationTypeId,
      evaluationType,
      lessonNote,
      classId,
      subject,
    });

    // Check if the answer is correct
    if (
      questionExists.correctAnswer &&
      questionExists.correctAnswer === answer
    ) {
      studentAnswer.isCorrect = true;
      studentAnswer.marksAwarded = questionExists.marks; // Award full marks if correct
    } else {
      studentAnswer.isCorrect = false;
      studentAnswer.marksAwarded = 0; // No marks if incorrect
    }

    // Save the student answer and evaluation
    await studentAnswer.save();
    await evaluation.save();

    res
      .status(StatusCodes.CREATED)
      .json({ message: "Answer submitted successfully", studentAnswer });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

/*export const createStudentAnswer = async (req, res, next) => {
  try {
    const { student, question, answer, evaluationTypeId, evaluationType } =
      req.body;

    // Validate required fields
    if (
      !student ||
      !question ||
      !answer ||
      !evaluationTypeId ||
      !evaluationType
    ) {
      throw new BadRequestError(
        "Student ID, Question ID, Answer, evaluationTypeId, and evaluationType are required.",
      );
    }

    // Dynamically determine the evaluation model
    const evaluationModelMap = {
      test: Test,
      assignment: Assignment,
      classwork: ClassWork,
      exam: Exam,
    };

    const EvaluationModel = evaluationModelMap[evaluationType];
    if (!EvaluationModel) {
      throw new BadRequestError(
        `Invalid evaluation type. Allowed types: ${Object.keys(
          evaluationModelMap,
        ).join(", ")}.`,
      );
    }

    // Find the evaluation
    const evaluation = await EvaluationModel.findById(evaluationTypeId);
    if (!evaluation) {
      throw new NotFoundError(`${evaluationType} not found.`);
    }

    // Check if the student is in the evaluation's student list for the term and session
    const isStudentInEvaluation = evaluation.students.some(
      (evaluationStudent) =>
        evaluationStudent.student.toString() === student.toString() &&
        evaluationStudent.term === evaluation.term &&
        evaluationStudent.session === evaluation.session,
    );

    if (!isStudentInEvaluation) {
      throw new BadRequestError(
        "The specified student is not part of this evaluation's student list for the current term and session.",
      );
    }

    // Check if the evaluation has already been submitted by the student
    const alreadySubmitted = evaluation.submitted.find(
      (submission) => submission.student.toString() === student,
    );

    if (alreadySubmitted) {
      throw new BadRequestError(
        `This ${evaluationType} has already been submitted.`,
      );
    }

    // Add submission
    evaluation.submitted.push({ student });
    evaluation.status = "submitted";

    // Validate the question exists
    const questionExists = await Question.findById(question).populate(
      "questionText",
    );
    if (!questionExists) {
      throw new NotFoundError("Question not found.");
    }

    // Extract related details for session, term, and classId
    const lessonNote = questionExists.lessonNote;
    const classId = questionExists.classId;
    const subject = questionExists.subject;
    const questionType = questionExists.questionType;

    // Create the student answer
    let studentAnswer = new StudentAnswer({
      student,
      question,
      questionType,
      answer,
      evaluationTypeId,
      evaluationType,
      lessonNote,
      classId,
      subject,
    });

    // Check if the answer is correct
    if (
      questionExists.correctAnswer &&
      questionExists.correctAnswer === answer
    ) {
      studentAnswer.isCorrect = true;
      studentAnswer.marksAwarded = questionExists.marks; // Award full marks if correct
    } else {
      studentAnswer.isCorrect = false;
      studentAnswer.marksAwarded = 0; // No marks if incorrect
    }

    // Save the student answer and evaluation
    await studentAnswer.save();
    await evaluation.save();

    res
      .status(StatusCodes.CREATED)
      .json({ message: "Answer submitted successfully", studentAnswer });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};*/

/*export const createStudentAnswer = async (req, res, next) => {
  try {
    const { student, question, answer, evaluationTypeId, evaluationType } =
      req.body;

    if (
      !student ||
      !question ||
      !answer ||
      !evaluationTypeId ||
      !evaluationType
    ) {
      throw new BadRequestError(
        "Student ID, Question ID, Answer, evaluationTypeId, and evaluationType  are required.",
      );
    }

    const evaluation = evaluationType.toLowerCase();

    evaluation = await evaluationType.findById(evaluationTypeId);
    if (!evaluation) throw new NotFoundError(`${evaluationType} not found`);

    // Check if the student is in the evaluation's student list for the current term and session
    const isStudentInEvaluation = evaluation.students.some(
      (evaluationStudent) => {
        return (
          evaluationStudent.student.toString() === student.toString() &&
          evaluationStudent.term === evaluation.term &&
          evaluationStudent.session === evaluation.session
        );
      },
    );

    if (!isStudentInEvaluation) {
      throw new BadRequestError(
        "The specified student is not part of this evaluation's student list for the current term and session.",
      );
    }

    // Check if already submitted
    const alreadySubmitted = evaluation.submitted.find(
      (submission) => submission.student.toString() === student,
    );

    if (alreadySubmitted) {
      throw new BadRequestError(
        `This ${evaluation} has already been submitted.`,
      );
    }

    // Add submission
    evaluation.submitted.push({ student: student });

    // Update evaluation status
    evaluation.status = "submitted";

    // Validate the question exists
    const questionExists = await Question.findById(question).populate(
      "questionText",
    );
    if (!questionExists) {
      throw new NotFoundError("Question not found.");
    }

    // Extract related details for session, term, and classId
    const lessonNote = questionExists.lessonNote;
    const classId = questionExists.classId;
    const subject = questionExists.subject;

    // Create the student answer
    let studentAnswer = new StudentAnswer({
      ...req.body,
      lessonNote,
      classId,
      subject,
    });

    // Check if the answer is correct
    if (
      questionExists.correctAnswer &&
      questionExists.correctAnswer === answer
    ) {
      studentAnswer.isCorrect = true;
      studentAnswer.marksAwarded = questionExists.marks; // Award full marks if correct
    } else {
      studentAnswer.marksAwarded = 0; // No marks if incorrect
    }

    // Save the student answer
    studentAnswer = await studentAnswer.save();

    res
      .status(StatusCodes.CREATED)
      .json({ message: "Answer submited", studentAnswer });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};*/

/*export const createStudentAnswer = async (req, res) => {
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
  const subject = questionExists.subject;

  // Create the student answer
  const studentAnswer = await StudentAnswer.create({
    ...req.body,
    lessonNote,
    classId,
    subject,
  });

  res.status(StatusCodes.CREATED).json({ studentAnswer });
};*/

// Fetch all answers for a specific student and subject
export const getAnswersForStudentAndSubject = async (req, res, next) => {
  try {
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
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

export const getStudentAnswersByEvaluation = async (req, res, next) => {
  try {
    const { studentId, evaluationTypeId } = req.params; // Extract parameters

    // Validate required parameters
    if (!studentId || !evaluationTypeId) {
      throw new BadRequestError(
        "Both 'studentId' and 'evaluationTypeId' are required.",
      );
    }

    // Fetch student answers with the specified filters
    const studentAnswers = await StudentAnswer.find({
      student: studentId,
      evaluationTypeId: evaluationTypeId,
    })
      .populate("question") // Populate question details
      .populate("subject") // Populate subject details
      // .populate("lessonNote") // Populate lesson note details if needed
      .lean(); // Convert Mongoose documents to plain JavaScript objects

    // Check if answers exist
    if (studentAnswers.length === 0) {
      throw new NotFoundError("No answers found for the specified criteria.");
    }

    // Respond with the data
    res.status(200).json({
      message: "Student answers retrieved successfully.",
      data: studentAnswers,
    });
  } catch (error) {
    next(error);
  }
};

// Update an existing student answer

export const updateStudentAnswer = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id; // Authenticated user ID
    const userRole = req.user.role; // Authenticated user role

    let studentId;
    let isAuthorized = false;

    if (userRole === "admin" || userRole === "proprietor") {
      isAuthorized = true;
      studentId = req.body.student;

      // Ensure 'student' field is provided
      if (!studentId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'student' field must be provided.",
        );
      }

      // Validate that the student exists and is valid
      const student = await Student.findById(studentId);
      if (!student) {
        throw new NotFoundError("Provided student not found.");
      }
    } else if (userRole === "student") {
      student = userId; // Assign the current user as the student
      // Validate that the student is assigned the subject
      const student = await Student.findById(student).populate("subjects");
      if (!student) {
        throw new NotFoundError("Student not found.");
      }

      isAuthorized = true;

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not allowed to attempt this question.",
        );
      }
    }

    // Find the existing student answer
    const studentAnswer = await StudentAnswer.findById(id);
    if (!studentAnswer) {
      throw new NotFoundError("Student answer not found.");
    }

    // Extract fields from request
    const { answer, isCorrect, marksAwarded, explanation, questionType } =
      req.body;

    // Handle file uploads if questionType is file-upload
    let uploadedFiles = studentAnswer.files; // Retain existing files unless new ones are uploaded
    if (req.files && req.files.length > 0) {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      uploadedFiles = req.files.map((file) => {
        const { path: fileUrl, mimetype, size } = file;

        if (!allowedTypes.includes(mimetype)) {
          throw new BadRequestError(
            `Invalid file type: ${mimetype}. Allowed types are PDF, Word, and Excel files.`,
          );
        }

        if (size > 3 * 1024 * 1024) {
          throw new BadRequestError("File size must not exceed 5MB.");
        }

        return {
          url: fileUrl, // Replace with the actual URL
        };
      });
    }

    // Validate for file-upload type questions
    if (
      questionType === "file-upload" &&
      (!uploadedFiles || uploadedFiles.length === 0)
    ) {
      throw new BadRequestError("File is required for file-upload questions.");
    }

    // Update fields dynamically
    if (answer && questionType !== "file-upload") studentAnswer.answer = answer;
    if (isCorrect !== undefined) studentAnswer.isCorrect = isCorrect;
    if (marksAwarded !== undefined) studentAnswer.marksAwarded = marksAwarded;
    if (explanation) studentAnswer.explanation = explanation;
    if (questionType === "file-upload") studentAnswer.files = uploadedFiles;

    // Save the updated student answer
    await studentAnswer.save();

    res.status(StatusCodes.OK).json({
      message: "Student answer updated successfully",
      studentAnswer,
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

/*export const updateStudentAnswer = async (req, res, next) => {
  try {
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
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};*/

// Delete a student answer
export const deleteStudentAnswer = async (req, res, next) => {
  try {
    const { id } = req.params;

    const studentAnswer = await StudentAnswer.findByIdAndDelete(id);
    if (!studentAnswer) {
      throw new NotFoundError("Student answer not found.");
    }

    res
      .status(StatusCodes.OK)
      .json({ message: "Student answer deleted successfully." });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};
