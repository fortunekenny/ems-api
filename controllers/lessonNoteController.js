// controllers/lessonNoteController.js
import LessonNote from "../models/LessonNoteModel.js";
import Staff from "../models/StaffModel.js"; // Ensure Staff model is imported
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";

// Create a new lesson note
export const createLessonNote = async (req, res, next) => {
  try {
    const { lessonWeek, lessonDate } = req.body;
    const userRole = req.user.role;
    const userId = req.user.id;

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
        `Lesson notes for the current week (${currentWeekOfTerm}) cannot be created in the same week. This should be in the previous week.`,
      );
    }

    // Lesson notes for future weeks (e.g., Week 5, Week 6, etc.) can be created from the current week onward
    if (lessonWeek <= currentWeekOfTerm) {
      throw new BadRequestError(
        `Lesson notes can only be created for future weeks (${
          currentWeekOfTerm + 1
        } and beyond).`,
      );
    }

    // Check authorization
    let isAuthorized = false;

    if (userRole === "admin" || userRole === "proprietor") {
      isAuthorized = true;
    } else if (userRole === "teacher") {
      // For teachers, validate that the requested subject is assigned to them
      const teacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new BadRequestError("Teacher not found.");
      }

      isAuthorized = teacher.subjects.some(
        (subject) => subject.toString() === req.body.subject,
      );
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to create this lesson note.",
      );
    }

    // Assign the teacher field based on the role
    if (userRole === "teacher") {
      req.body.teacher = userId;
    } else if (userRole === "admin" || userRole === "proprietor") {
      if (!req.body.teacher) {
        throw new BadRequestError(
          "For admin or proprietor, the 'teacher' field must be provided.",
        );
      }
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
    // Get the current user ID and role (assumes the user is authenticated)
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch the existing lesson note to validate authorization
    const lessonNote = await LessonNote.findById(req.params.id).populate({
      path: "subject",
      model: "Subject",
    });

    if (!lessonNote) {
      throw new NotFoundError("Lesson note not found.");
    }

    // Authorization: Allow updates only if the user is:
    // - A teacher who owns the subject
    // - An admin or proprietor
    const isAuthorized =
      userRole === "admin" ||
      userRole === "proprietor" ||
      (userRole === "teacher" &&
        lessonNote.subject &&
        lessonNote.subject.subjectTeachers.includes(userId));

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to update this lesson note.",
      );
    }

    /*    // If the `subject` field is in the request body, validate it for teachers
    if (req.body.subject && userRole === "teacher") {
      const teacher = await Staff.findById(userId).populate("subjects");
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
    }*/

    // Ensure the `teacher` field remains the same as the current user for teachers
    // Assign the teacher field based on the role

    // Find the lesson note by ID and update it
    const updatedLessonNote = await LessonNote.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    res.status(StatusCodes.OK).json(updatedLessonNote);
  } catch (error) {
    next(
      error instanceof NotFoundError || error instanceof BadRequestError
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
