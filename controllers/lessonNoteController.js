// controllers/lessonNoteController.js
import LessonNote from "../models/LessonNoteModel.js";
import Staff from "../models/StaffModel.js"; // Ensure Staff model is imported
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";

// Create a new lesson note
export const createLessonNote = async (req, res, next) => {
  try {
    const { lessonWeek, lessonDate } = req.body;

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

    // Holiday constraint: If in holiday, lesson notes can only be created from one week before the new term starts onward
    if (isHoliday) {
      const oneWeekBeforeNextTerm = new Date(nextTermStartDate);
      oneWeekBeforeNextTerm.setDate(oneWeekBeforeNextTerm.getDate() - 7);

      if (new Date(lessonDate) < oneWeekBeforeNextTerm) {
        throw new BadRequestError(
          `During holidays, lesson notes can only be scheduled starting one week before the next term starts (${oneWeekBeforeNextTerm.toDateString()}).`,
        );
      }
    }

    // Lesson notes for the current week cannot be created in the current week itself
    if (lessonWeek === currentWeekOfTerm) {
      throw new BadRequestError(
        `Lesson notes for the current week (${currentWeekOfTerm}) cannot be created in the same week. This should be in previous week.`,
      );
    }

    // Lesson notes for future weeks (e.g., Week 5, Week 6, etc.) can be created from the current week onward
    if (lessonWeek <= currentWeekOfTerm) {
      throw new BadRequestError(
        `Lesson notes can only be created for future week (${
          currentWeekOfTerm + 1
        } and beyond).`,
      );
    }

    // Set teacher to the authenticated user
    req.body.teacher = req.user.id;

    // Validate subject ownership
    const teacher = await Staff.findById(req.user.id).populate("subjects");
    const isSubjectValid = teacher.subjects.some(
      (subject) => subject.toString() === req.body.subject,
    );
    if (!isSubjectValid) {
      throw new BadRequestError(
        "Invalid subject: Subject not assigned to this teacher.",
      );
    }

    // Create and save the new lesson note
    const lessonNote = new LessonNote(req.body);
    await lessonNote.save();
    res.status(StatusCodes.CREATED).json(lessonNote);
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
    const lessonNotes = await LessonNote.find().populate(
      "teacher classId subject topic subTopic",
    );
    /*
          .populate([
        {
          path: "classes",
          select: "_id className students subjects classTeacher",
        },
        {
          path: "subjects",
          select: "_id subjectName subjectCode",
        },
      ])
    */
    res.status(StatusCodes.OK).json(lessonNotes);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Get a single lesson note by ID
export const getLessonNoteById = async (req, res, next) => {
  try {
    const lessonNote = await LessonNote.findById(req.params.id).populate(
      "teacher classId subject topic subTopic",
    );
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
    const lessonNotes = await LessonNote.find({ subject: subjectId }).populate(
      "teacher classId subject topic subTopic",
    );
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
    const lessonNotes = await LessonNote.find({ classId }).populate(
      "teacher classId subject topic subTopic",
    );
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

// Get lesson notes by status (approved or unapproved)
export const getLessonNoteByStatus = async (req, res, next) => {
  try {
    const { status } = req.params;

    // Validate the status parameter to ensure it's either 'approved' or 'unapproved'
    if (status !== "approved" && status !== "unapproved") {
      throw new BadRequestError(
        "Invalid status. Use 'approved' or 'unapproved'.",
      );
    }

    const lessonNotes = await LessonNote.find({ status }).populate(
      "teacher classId subject topic subTopic",
    );

    if (lessonNotes.length === 0) {
      throw new NotFoundError(`No ${status} lesson notes found`);
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

// Get lesson notes by week
export const getLessonNoteByWeek = async (req, res, next) => {
  try {
    const { week } = req.params;
    const lessonNotes = await LessonNote.find({ lessonWeek: week }).populate(
      "teacher classId subject topic subTopic",
    );
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
export const updateLessonNote = async (req, res, next) => {
  try {
    // Get the current user ID (assumes the user is authenticated)
    const teacherId = req.user.id;

    // Check if the subject in req.body is assigned to the teacher
    if (req.body.subject) {
      const teacher = await Staff.findById(teacherId).populate("subjects");
      if (!teacher) {
        throw new BadRequestError("Teacher not found.");
      }

      const isSubjectValid = teacher.subjects.some(
        (subject) => subject.toString() === req.body.subject,
      );

      if (!isSubjectValid) {
        throw new BadRequestError(
          "Invalid subject: Subject not assigned to this teacher.",
        );
      }
    }

    // Ensure the teacher field in the update remains the same as the current user
    req.body.teacher = teacherId;

    // Find the lesson note by ID and update it
    const lessonNote = await LessonNote.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

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

// Update lesson note status to "approved"
export const approveLessonNote = async (req, res) => {
  const { lessonNoteId } = req.params; // Get lesson note ID from the URL params

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

    // Check if the current status is already "approved"
    if (lessonNote.status === "approved") {
      return res.status(StatusCodes.OK).json({
        message: "This lesson note has already been approved.",
      });
    }

    // Update the status to "approved"
    lessonNote.status = "approved";
    lessonNote.updatedAt = Date.now(); // Update the `updatedAt` field

    // Save the updated lesson note
    await lessonNote.save();

    // Return the updated lesson note
    res.status(StatusCodes.OK).json({
      message: "LessonNote approved successfully.",
      lessonNote,
    });
  } catch (error) {
    console.error("Error approving lesson note:", error);
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
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
