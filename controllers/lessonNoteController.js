// controllers/lessonNoteController.js
import LessonNote from "../models/LessonNoteModel.js";
import Assignment from "../models/AssignmentModel.js";
import Classwork from "../models/ClassWorkModel.js";
import Staff from "../models/StaffModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";

// Create a new lesson note
export const createLessonNote = async (req, res, next) => {
  try {
    const { assignment, evaluation } = req.body;
    const { id: userId, role: userRole } = req.user; // Authenticated user ID and role

    // Get current term details
    const {
      startDate: termStartDate,
      isHoliday,
      nextTermStartDate,
      weekOfTerm: currentWeekOfTerm,
    } = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );
    // console.log(
    //   "termStartDate: ",
    //   termStartDate,
    //   "isHoliday: ",
    //   isHoliday,
    //   "nextTermStartDate: ",
    //   nextTermStartDate,
    //   "currentWeekOfTerm: ",
    //   currentWeekOfTerm,
    // );

    // Holiday constraint: If in holiday, lesson notes can only be created from one week before the new term starts onward
    /*if (isHoliday) {
      const oneWeekBeforeNextTerm = new Date(nextTermStartDate);
      oneWeekBeforeNextTerm.setDate(oneWeekBeforeNextTerm.getDate() - 7);

      if (new Date(lessonDate) < oneWeekBeforeNextTerm) {
        throw new BadRequestError(
          `During holidays, lesson notes can only be scheduled starting one week before the next term starts (${oneWeekBeforeNextTerm.toDateString()}).`,
        );
      }
    }*/

    // Lesson notes for the current week cannot be created in the current week itself
    /*if (lessonWeek === currentWeekOfTerm) {
      throw new BadRequestError(
        `Lesson notes for the current week (${currentWeekOfTerm}) cannot be created in the same week. This should be in the previous week.`,
      );
    }*/

    // Lesson notes for future weeks (e.g., Week 5, Week 6, etc.) can be created from the current week onward
    /*if (lessonWeek <= currentWeekOfTerm) {
      throw new BadRequestError(
        `Lesson notes can only be created for future weeks (${
          currentWeekOfTerm + 1
        } and beyond).`,
      );
    }*/

    // Check authorization
    let teacherId;
    let isAuthorized = false;

    if (["admin", "proprietor"].includes(userRole)) {
      isAuthorized = true;
      teacherId = req.body.teacher;

      // Ensure 'subjectTeacher' field is provided
      if (!teacherId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'teacher' field must be provided.",
        );
      }

      const teacher = await Staff.findById(teacherId).populate([
        { path: "subjects", select: "_id subjectName" },
      ]);
      if (!teacher) {
        throw new NotFoundError("Provided teacher not found.");
      }

      const isAssignedSubject = teacher.subjects.some(
        (subjectItem) => subjectItem && subjectItem.equals(subject),
      );

      if (!isAssignedSubject) {
        throw new BadRequestError(
          "The specified teacher is not assigned to the selected subject.",
        );
      }
    } else if (userRole === "teacher") {
      // For teachers, validate that the requested subject is assigned to them
      const teacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new NotFoundError("Teacher not found.");
      }

      isAuthorized = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to create lesson note for this subject.",
        );
      }

      teacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to create this lesson note.",
      );
    }

    // Convert ObjectId to string if necessary
    const assignmentId = assignment.toString();

    // Query with the ID
    assignment = await Assignment.findById(assignmentId).populate("questions");
    if (!assignment) {
      throw new NotFoundError("Assignment not found.");
    }

    const assignmentLessonNoteId = assignment.lessonNote.toString();

    if (assignmentLessonNoteId !== id) {
      throw new BadRequestError(`This assignment is not for this lesson note.`);
    }

    const evaluationId = evaluation.toString();

    evaluation = await Classwork.findById(evaluationId).populate("questions");
    if (!evaluation) {
      throw new NotFoundError("evaluation not found.");
    }

    const evaluationLessonNoteId = evaluation.lessonNote.toString();

    if (evaluationLessonNoteId !== id) {
      throw new BadRequestError(`This evaluation is not for this lesson note.`);
    }

    // Create and save the new lesson note
    const lessonNote = new LessonNote(req.body);
    await lessonNote.save();

    const populatedLessonNote = await LessonNote.findById(
      lessonNote._id,
    ).populate([
      { path: "teacher", select: "_id name" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      {
        path: "evaluation",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionText questionType options",
        },
      },
      {
        path: "assignment",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionType questionText options files",
        },
      },
    ]);

    res.status(StatusCodes.CREATED).json({
      message: "Lesson Note submitted successfully",
      populatedLessonNote,
    });
  } catch (error) {
    next(
      error instanceof BadRequestError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

// Get all lesson notes
export const getAllLessonNotes = async (req, res, next) => {
  try {
    const {
      teacher,
      subject,
      evaluationType,
      classId,
      term,
      session,
      lessonWeek,
      topic,
      subTopic,
      approved,
    } = req.query;

    // Build a query object based on provided filters
    const queryObject = {};

    //queryObject["student.name"] = { $regex: name, $options: "i" }; // Case-insensitive search

    if (teacher) {
      queryObject["teacher"] = { $regex: teacher, $options: "i" }; // Case-insensitive search
    }
    if (subject) {
      queryObject["subject"] = subject;
    }
    if (evaluationType) {
      queryObject["evaluationType"] = evaluationType;
    }
    if (classId) {
      queryObject["classId"] = classId;
    }
    if (lessonWeek) {
      queryObject["lessonWeek"] = lessonWeek;
    }
    if (topic) {
      queryObject["topic"] = topic;
    }
    if (subTopic) {
      queryObject["subTopic"] = subTopic;
    }
    if (approved) {
      queryObject["approved"] = approved;
    }
    if (term) {
      queryObject["term"] = term;
    }
    if (session) {
      queryObject["session"] = session;
    }

    const lessonNotes = await LessonNote.find(queryObject).populate([
      {
        path: "teacher",
        select: "_id name",
      },
      {
        path: "classId",
        select: "_id className",
      },
      {
        path: "subject",
        select: "_id subjectName subjectCode",
      },
      {
        path: "evaluation",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionText questionType options",
        },
      },
      {
        path: "assignment",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionType questionText options files",
        },
      },
    ]);

    res.status(StatusCodes.OK).json({ count: lessonNotes.length, lessonNotes });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Get a single lesson note by ID
export const getLessonNoteById = async (req, res, next) => {
  try {
    const lessonNote = await LessonNote.findById(req.params.id).populate([
      {
        path: "teacher",
        select: "_id name",
      },
      {
        path: "classId",
        select: "_id className",
      },
      {
        path: "subject",
        select: "_id subjectName subjectCode",
      },
    ]);
    if (!lessonNote) {
      throw new NotFoundError("Lesson note not found");
    }
    res.status(StatusCodes.OK).json(lessonNote);
  } catch (error) {
    next(
      error instanceof NotFoundError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

// Get lesson notes by subject
export const getLessonNoteBySubject = async (req, res, next) => {
  try {
    const { subjectId } = req.params;
    const lessonNotes = await LessonNote.find({ subject: subjectId }).populate([
      {
        path: "teacher",
        select: "_id name",
      },
      {
        path: "classId",
        select: "_id className",
      },
      {
        path: "subject",
        select: "_id subjectName subjectCode",
      },
    ]);
    if (lessonNotes.length === 0) {
      throw new NotFoundError(
        "No lesson notes found for the specified subject",
      );
    }
    res.status(StatusCodes.OK).json(lessonNotes);
  } catch (error) {
    next(
      error instanceof NotFoundError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

// Get lesson notes by class
export const getLessonNoteByClass = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const lessonNotes = await LessonNote.find({ classId }).populate([
      {
        path: "teacher",
        select: "_id name",
      },
      {
        path: "classId",
        select: "_id className",
      },
      {
        path: "subject",
        select: "_id subjectName subjectCode",
      },
    ]);
    if (lessonNotes.length === 0) {
      throw new NotFoundError("No lesson notes found for the specified class");
    }
    res.status(StatusCodes.OK).json(lessonNotes);
  } catch (error) {
    next(
      error instanceof NotFoundError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

// Get lesson notes by status
export const getLessonNoteByApprovalStatus = async (req, res, next) => {
  try {
    const { approved } = req.params;

    // Validate and convert the approved parameter to a boolean
    if (approved !== "true" && approved !== "false") {
      throw new BadRequestError(
        "Invalid approved status. Use 'true' or 'false'.",
      );
    }
    const isApproved = approved === "true";

    // Find lesson notes based on the approved status
    const lessonNotes = await LessonNote.find({
      approved: isApproved,
    }).populate([
      {
        path: "teacher",
        select: "_id name",
      },
      {
        path: "classId",
        select: "_id className",
      },
      {
        path: "subject",
        select: "_id subjectName subjectCode",
      },
    ]);

    // Handle the case when no lesson notes are found
    if (lessonNotes.length === 0) {
      const statusMessage = isApproved ? "approved" : "unapproved";
      throw new NotFoundError(`No lesson notes are ${statusMessage}.`);
    }

    // Respond with the list of lesson notes
    res.status(StatusCodes.OK).json(lessonNotes);
  } catch (error) {
    next(
      error instanceof NotFoundError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

// Get lesson notes by week
export const getLessonNoteByWeek = async (req, res, next) => {
  try {
    const { week } = req.params;
    const lessonNotes = await LessonNote.find({ lessonWeek: week }).populate([
      {
        path: "teacher",
        select: "_id name",
      },
      {
        path: "classId",
        select: "_id className",
      },
      {
        path: "subject",
        select: "_id subjectName subjectCode",
      },
    ]);
    if (lessonNotes.length === 0) {
      throw new NotFoundError(`No lesson notes found for week ${week}`);
    }
    res.status(StatusCodes.OK).json(lessonNotes);
  } catch (error) {
    next(
      error instanceof NotFoundError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

// Update a lesson note

/*export const updateLessonNote = async (req, res, next) => {
  try {
    const { id } = req.params; // Lesson note ID from request params
    const { id: userId, role: userRole } = req.user; // Authenticated user details

    // Fetch the existing lesson note to validate authorization
    const lessonNote = await LessonNote.findById(id).populate("teacher");
    if (!lessonNote) {
      throw new NotFoundError("Lesson note not found.");
    }

    const { teacher, evaluation, assignment } = lessonNote;

    // Authorization check
    if (
      !["admin", "proprietor"].includes(userRole) &&
      teacher.toString() !== userId
    ) {
      throw new BadRequestError(
        "You are not authorized to update this lesson note.",
      );
    }

    // Populate assignment and evaluation
    const assignmentId = assignment?.toString();
    const evaluationId = evaluation?.toString();

    const populatedAssignment = assignmentId
      ? await Assignment.findById(assignmentId).populate("questions")
      : null;
    if (assignmentId && !populatedAssignment) {
      throw new NotFoundError("Assignment not found.");
    }

    const populatedEvaluation = evaluationId
      ? await Classwork.findById(evaluationId).populate("questions")
      : null;
    if (evaluationId && !populatedEvaluation) {
      throw new NotFoundError("Evaluation not found.");
    }

    // Update lesson note
    const updatedLessonNote = await LessonNote.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    // Fully populate the updated lesson note
    const populatedLessonNoteUpdate = await LessonNote.findById(
      updatedLessonNote._id,
    ).populate([
      { path: "teacher", select: "_id name" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      {
        path: "evaluation",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionText questionType options",
        },
      },
      {
        path: "assignment",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionType questionText options files",
        },
      },
    ]);

    res.status(StatusCodes.OK).json({
      message: "Lesson Note updated successfully",
      populatedLessonNoteUpdate,
    });
  } catch (error) {
    if (error.name === "CastError") {
      next(new BadRequestError("Invalid lesson note ID."));
    } else {
      next(
        error instanceof NotFoundError || error instanceof BadRequestError
          ? error
          : new BadRequestError(error.message),
      );
    }
  }
};*/

/*export const updateLessonNote = async (req, res, next) => {
  try {
    const { id } = req.params; // Lesson note ID
    const { id: userId, role: userRole } = req.user; // Authenticated user

    // Fetch the existing lesson note
    const lessonNote = await LessonNote.findById(id).populate("teacher");

    if (!lessonNote) {
      throw new NotFoundError("Lesson note not found.");
    }

    let { teacher, evaluation, assignment } = lessonNote;

    console.log("Initial Assignment Content:", assignment);
    console.log("Initial Evaluation Content:", evaluation);

    // Authorization check
    if (
      !["admin", "proprietor"].includes(userRole) &&
      teacher.toString() !== userId
    ) {
      throw new BadRequestError(
        "You are not authorized to update this lesson note.",
      );
    }

    // Handle legacy `assignment` and `evaluation` formats
    if (Array.isArray(assignment)) {
      // If assignment is an array, handle it as legacy data
      console.warn("Legacy format detected for assignment.");
      assignment = assignment[0] || null;
    }

    if (Array.isArray(evaluation)) {
      // If evaluation is an array, handle it as legacy data
      console.warn("Legacy format detected for evaluation.");
      evaluation = evaluation[0] || null;
    }

    // Validate and populate assignment
    if (assignment) {
      const assignmentId = assignment.toString();
      assignment = await Assignment.findById(assignmentId).populate(
        "questions",
      );
      if (!assignment) {
        throw new NotFoundError("Assignment not found.");
      }
    }

    // Validate and populate evaluation
    if (evaluation) {
      const evaluationId = evaluation.toString();
      evaluation = await Classwork.findById(evaluationId).populate("questions");
      if (!evaluation) {
        throw new NotFoundError("Evaluation not found.");
      }
    }

    // Update lesson note
    const updatedLessonNote = await LessonNote.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    // Fully populate updated lesson note
    const populatedLessonNoteUpdate = await LessonNote.findById(
      updatedLessonNote._id,
    ).populate([
      { path: "teacher", select: "_id name" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      {
        path: "evaluation",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionText questionType options",
        },
      },
      {
        path: "assignment",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionType questionText options files",
        },
      },
    ]);

    res.status(StatusCodes.OK).json({
      message: "Lesson Note updated successfully",
      populatedLessonNoteUpdate,
    });
  } catch (error) {
    next(
      error instanceof NotFoundError || error instanceof BadRequestError
        ? error
        : new BadRequestError(error.message),
    );
  }
};*/

export const updateLessonNote = async (req, res, next) => {
  try {
    const { id } = req.params; // Test ID from request params
    const { id: userId, role: userRole } = req.user; // Authenticated user ID and role

    // Fetch the existing lesson note to validate authorization
    const lessonNote = await LessonNote.findById(id).populate("teacher");

    if (!lessonNote) {
      throw new NotFoundError("Lesson note not found.");
    }

    let { teacher, classId, subject, evaluation, assignment } = lessonNote;

    // Check authorization
    let teacherId;
    let isAuthorized = false;

    if (["admin", "proprietor"].includes(userRole)) {
      isAuthorized = true;
      teacherId = teacher;

      const subjectTeacher = await Staff.findById(teacherId).populate([
        { path: "subjects", select: "_id subjectName" },
      ]);
      if (!teacher) {
        throw new NotFoundError("Provided teacher not found.");
      }

      const isAssignedSubject = subjectTeacher.subjects.some(
        (subjectItem) => subjectItem && subjectItem.equals(subject),
      );

      if (!isAssignedSubject) {
        throw new BadRequestError(
          "The specified teacher is not assigned to the selected subject.",
        );
      }
    } else if (userRole === "teacher") {
      // For teachers, validate that the requested subject is assigned to them
      const subjectTeacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new NotFoundError("Teacher not found.");
      }

      isAuthorized = subjectTeacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to create lesson note for this subject.",
        );
      }

      teacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to create this lesson note.",
      );
    }

    /*let teacherId = userId; // Default to logged-in user
    if (["admin", "proprietor"].includes(userRole)) {
      teacherId = teacher;
    }*/

    // Convert ObjectId to string if necessary
    const assignmentId = assignment.toString();

    // Query with the ID
    assignment = await Assignment.findById(assignmentId).populate("questions");
    if (!assignment) {
      throw new NotFoundError("Assignment not found.");
    }

    const assignmentLessonNoteId = assignment.lessonNote.toString();

    if (assignmentLessonNoteId !== id) {
      throw new BadRequestError(`This assignment is not for this lesson note.`);
    }

    const evaluationId = evaluation.toString();

    evaluation = await Classwork.findById(evaluationId).populate("questions");
    if (!evaluation) {
      throw new NotFoundError("evaluation not found.");
    }

    const evaluationLessonNoteId = evaluation.lessonNote.toString();

    if (evaluationLessonNoteId !== id) {
      throw new BadRequestError(`This evaluation is not for this lesson note.`);
    }

    // Find the lesson note by ID and update it
    const updatedLessonNote = await LessonNote.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    const populatedLessonNoteUpdate = await LessonNote.findById(
      updatedLessonNote._id,
    ).populate([
      { path: "teacher", select: "_id name" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      {
        path: "evaluation",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionText questionType options",
        },
      },
      {
        path: "assignment",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionType questionText options files",
        },
      },
    ]);

    res.status(StatusCodes.OK).json({
      message: "Lesson Note updated successfully",
      populatedLessonNoteUpdate,
    });
  } catch (error) {
    next(
      error instanceof NotFoundError || error instanceof BadRequestError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

//update lessonNote approval status
export const approveLessonNote = async (req, res, next) => {
  const { lessonNoteId } = req.params; // Get lessonNote ID from the URL params

  if (!lessonNoteId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "LessonNote ID is required.",
    });
  }

  try {
    // Find the LessonNote by its ID
    const lessonNote = await LessonNote.findById(lessonNoteId);
    if (!lessonNote) {
      throw new NotFoundError("LessonNote not found.");
    }

    // Check if the lessonNote is already approved
    if (lessonNote.approved) {
      return res.status(StatusCodes.OK).json({
        message: "This lessonNote has already been approved.",
      });
    }

    // Update the approved status to true
    lessonNote.approved = true;
    lessonNote.updatedAt = Date.now(); // Update the `updatedAt` field

    // Save the updated lessonNote
    await lessonNote.save();

    // Return the updated lessonNote
    res.status(StatusCodes.OK).json({
      message: "LessonNote approved successfully.",
      lessonNote,
    });
  } catch (error) {
    console.error("Error approving lessonNote:", error);
    next(new BadRequestError(error.message));
  }
};

// Delete a lesson note
export const deleteLessonNote = async (req, res, next) => {
  try {
    const lessonNote = await LessonNote.findByIdAndDelete(req.params.id);
    if (!lessonNote) {
      throw new NotFoundError("Lesson note not found");
    }
    res
      .status(StatusCodes.OK)
      .json({ message: "Lesson note deleted successfully" });
  } catch (error) {
    next(
      error instanceof NotFoundError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

/*const migrateLessonNotes = async () => {
  const lessonNotes = await LessonNote.find();

  for (const note of lessonNotes) {
    const update = {};

    if (Array.isArray(note.assignment)) {
      update.assignment = note.assignment[0] || null;
    }

    if (Array.isArray(note.evaluation)) {
      update.evaluation = note.evaluation[0] || null;
    }

    if (Object.keys(update).length > 0) {
      await LessonNote.findByIdAndUpdate(note._id, update);
      console.log(`Migrated LessonNote: ${note._id}`);
    }
  }

  console.log("Migration completed.");
};

migrateLessonNotes();*/
