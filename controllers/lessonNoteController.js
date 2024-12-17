// controllers/lessonNoteController.js
import LessonNote from "../models/LessonNoteModel.js";
import Staff from "../models/StaffModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";

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
    console.log(
      "termStartDate: ",
      termStartDate,
      "isHoliday: ",
      isHoliday,
      "nextTermStartDate: ",
      nextTermStartDate,
      "currentWeekOfTerm: ",
      currentWeekOfTerm,
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
    const lessonNotes = await LessonNote.find().populate([
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
