import Question from "../models/QuestionsModel.js";
import LessonNote from "../models/LessonNoteModel.js";
import Staff from "../models/StaffModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";

// Create a new question
export const createQuestion = async (req, res, next) => {
  try {
    const userId = req.user.id; // Authenticated user ID
    const userRole = req.user.role; // Authenticated user role

    const {
      lessonNote,
      questionText,
      questionType,
      options,
      correctAnswer,
      marks,
      ...rest
    } = req.body;

    // Validate required fields
    if (
      !lessonNote ||
      (!questionText && questionType !== "file-upload") ||
      !questionType ||
      !marks
    ) {
      throw new BadRequestError("Please provide all required fields.");
    }

    // Check if the authenticated user is authorized
    let subjectTeacherId;
    let isAuthorized = false;

    if (userRole === "admin" || userRole === "proprietor") {
      isAuthorized = true;
      subjectTeacherId = req.body.subjectTeacher;

      // Ensure 'subjectTeacher' field is provided
      if (!subjectTeacherId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'subjectTeacher' field must be provided.",
        );
      }

      // Validate that the subjectTeacher exists and is valid
      const teacher = await Staff.findById(subjectTeacherId).populate(
        "subjects",
      );
      if (!teacher) {
        throw new NotFoundError("Provided subjectTeacher not found.");
      }

      const isAssignedSubject = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAssignedSubject) {
        throw new BadRequestError(
          "The specified subjectTeacher is not assigned to the selected subject.",
        );
      }
    } else if (userRole === "teacher") {
      // Validate that the teacher is assigned the subject
      const teacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new NotFoundError("Teacher not found.");
      }

      isAuthorized = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to create an exam for the selected subject.",
        );
      }

      subjectTeacherId = userId; // Assign the current teacher as the subjectTeacher
    }

    // Validate that lessonNote exists and retrieve related information
    const lessonNoteExists = await LessonNote.findById(lessonNote).populate(
      "subject",
    );

    if (!lessonNoteExists) {
      throw new NotFoundError("LessonNote not found.");
    }

    // Set default question data
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
      ...rest,
    };

    // Handle file upload for file-upload question type
    if (questionType === "file-upload" && req.files && req.files.length > 0) {
      // Validate the file types and sizes
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      const filesData = req.files.map((file) => {
        // Validate each file's mime type and size
        if (!allowedTypes.includes(file.mimetype)) {
          throw new BadRequestError("Invalid file type.");
        }
        if (file.size > 3 * 1024 * 1024) {
          // File size limit: 3MB
          throw new BadRequestError("File size must not exceed 3MB.");
        }

        // Add the file URL to the files array
        return { url: file.path };
      });

      // Add files to the questionData
      questionData.files = filesData;
    }

    // Create the question
    const question = await Question.create(questionData);

    res.status(StatusCodes.CREATED).json({
      message: "Question created successfully",
      question,
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

/*export const createQuestion = async (req, res) => {
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
};*/

// Get all questions for a specific lesson note
export const getQuestionsByLessonNote = async (req, res, next) => {
  try {
    const { lessonNoteId } = req.params;

    const questions = await Question.find({ lessonNote: lessonNoteId });
    if (questions.length === 0) {
      throw new NotFoundError("No questions found for this lesson note.");
    }

    res.status(StatusCodes.OK).json({ questions });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Get a specific question by ID
export const getQuestionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const question = await Question.findById(id);
    if (!question) {
      throw new NotFoundError("Question not found.");
    }

    res.status(StatusCodes.OK).json({ question });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Update a question by ID
export const updateQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionType, ...rest } = req.body;

    const userId = req.user.id; // Authenticated user ID
    const userRole = req.user.role; // Authenticated user role

    let subjectTeacherId;
    let isAuthorized = false;
    // Check if the authenticated user is authorized (must be a subject teacher for the lessonNote, admin, or proprietor)
    if (userRole === "admin" || userRole === "proprietor") {
      isAuthorized = true;
      subjectTeacherId = req.body.subjectTeacher;

      // Ensure 'subjectTeacher' field is provided
      if (!subjectTeacherId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'subjectTeacher' field must be provided.",
        );
      }

      // Validate that the subjectTeacher exists and is valid
      const teacher = await Staff.findById(subjectTeacherId).populate(
        "subjects",
      );
      if (!teacher) {
        throw new NotFoundError("Provided subjectTeacher not found.");
      }

      const isAssignedSubject = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAssignedSubject) {
        throw new BadRequestError(
          "The specified subjectTeacher is not assigned to the selected subject.",
        );
      }
    } else if (userRole === "teacher") {
      // Validate that the teacher is assigned the subject
      const teacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new NotFoundError("Teacher not found.");
      }

      isAuthorized = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to create an exam for the selected subject.",
        );
      }

      subjectTeacherId = userId; // Assign the current teacher as the subjectTeacher
    }

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

    // Prepare update data
    const updateData = { ...rest };

    // Prepare the update data

    // Handle file uploads for "file-upload" type
    if (questionType === "file-upload" && req.files) {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      // Process and validate each file
      const uploadedFiles = req.files.map((file) => {
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
          url: fileUrl,
        };
      });

      // Add the files to the update data
      updateData.files = uploadedFiles;
    }

    /*// If questionType is "file-upload," handle the uploaded file
    if (questionType === "file-upload" && req.file) {
      const { path: fileUrl, mimetype, size } = req.file; // Extract file details

      // Check allowed mimetypes
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];
      if (!allowedTypes.includes(mimetype)) {
        throw new BadRequestError("Invalid file type.");
      }

      // Validate file size (5MB limit)
      if (size > 5 * 1024 * 1024) {
        throw new BadRequestError("File size must not exceed 5MB.");
      }

      // Add file details to the update data
      updateData.file = {
        url: fileUrl,
        fileType: mimetype.split("/")[1], // Extract type (e.g., pdf, doc)
        fileSize: size,
      };
    }*/

    // Update the question
    const updatedQuestion = await Question.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(StatusCodes.OK).json({
      message: "Question updated successfully.",
      question: updatedQuestion,
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

/*export const updateQuestion = async (req, res) => {
  try {
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
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};*/

// Delete a question by ID
export const deleteQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;

    const question = await Question.findByIdAndDelete(id);
    if (!question) {
      throw new NotFoundError("Question not found.");
    }

    res
      .status(StatusCodes.OK)
      .json({ message: "Question deleted successfully." });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};
