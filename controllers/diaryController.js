import Diary from "../models/DiaryModel.js";
import Staff from "../models/StaffModel.js";
import Class from "../models/ClassModel.js";
import Subject from "../models/SubjectModel.js";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import InternalServerError from "../errors/internal-server-error.js";
import NotFoundError from "../errors/not-found.js";

export const createDiary = async (req, res, next) => {
  try {
    const userId = req.user.id;
    const userRole = req.user.role;

    // Get the term start date and calculate the one-week creation window
    const { startDate: termStartDate } = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    const oneWeekBeforeTermStart = new Date(termStartDate);
    oneWeekBeforeTermStart.setDate(oneWeekBeforeTermStart.getDate() - 7);

    const currentDate = new Date();

    // Check if the current date is within the allowed window for creating diary entries
    /*if (currentDate < oneWeekBeforeTermStart || currentDate >= termStartDate) {
      throw new BadRequestError(
        "Diary entries can only be created within one week before the term starts.",
      );
    }*/

    // Check authorization
    let isAuthorized = false;

    if (userRole === "admin" || userRole === "proprietor") {
      isAuthorized = true;

      // Ensure 'teacher' field is provided for admin or proprietor
      if (!req.body.subjectTeacher) {
        throw new BadRequestError(
          "For admin or proprietor, the 'subjectTeacher' field must be provided.",
        );
      }
    } else if (userRole === "teacher") {
      // For teachers, validate that the requested subject is assigned to them
      const teacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new BadRequestError("Teacher not found.");
      }

      isAuthorized = teacher.subjects.some(
        (subject) => subject.toString() === req.body.subject,
      );

      // Assign the teacher field to the authenticated teacher
      req.body.subjectTeacher = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to create this diary entry.",
      );
    }

    // Create and save the new diary entry
    const diary = new Diary(req.body);
    await diary.save();

    res.status(StatusCodes.CREATED).json(diary);
  } catch (error) {
    console.error("Error creating diary entry:", error);
    next(new InternalServerError(error.message));
  }
};

// Get all Diary entries
export const getAllDairies = async (req, res, next) => {
  try {
    const dairies = await Diary.find().populate([
      { path: "subjectTeacher", select: "_id name" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName subjectCode" },
    ]);
    res.status(StatusCodes.OK).json(dairies);
  } catch (error) {
    console.error("Error fetching diaries:", error);
    next(new InternalServerError(error.message));
  }
};

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

// Get a single Diary entry by ID
export const getDiaryById = async (req, res, next) => {
  try {
    const diary = await Diary.findById(req.params.id).populate([
      { path: "subjectTeacher", select: "_id name" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName subjectCode" },
    ]);
    if (!diary) throw new NotFoundError("Diary entry not found");
    res.status(StatusCodes.OK).json(diary);
  } catch (error) {
    console.error("Error fetching diary entry:", error);
    next(new InternalServerError(error.message));
  }
};

// Update a Diary entry
export const updateDiary = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch the existing Diary
    const diary = await Diary.findById(id);

    if (!diary) {
      throw new NotFoundError("Diary not found.");
    }

    // Check authorization
    const isAuthorized =
      userRole === "admin" ||
      userRole === "proprietor" ||
      (userRole === "teacher" &&
        diary.subject &&
        diary.subject.subjectTeachers.includes(userId));

    if (!isAuthorized) {
      throw new BadRequestError("You are not authorized to update this diary.");
    }

    // Update the diary
    const updatedDiary = await Diary.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    res
      .status(StatusCodes.OK)
      .json({ message: "diary updated successfully.", updatedDiary });
  } catch (error) {
    console.error("Error updating diary entry:", error);
    next(new InternalServerError(error.message));
  }
};

export const approveDiary = async (req, res, next) => {
  const { diaryId } = req.params; // Get diary ID from the URL params

  if (!diaryId) {
    return res.status(StatusCodes.BAD_REQUEST).json({
      message: "Diary ID is required.",
    });
  }

  try {
    // Find the Diary by its ID
    const diary = await Diary.findById(diaryId);
    if (!diary) {
      throw new NotFoundError("Diary not found.");
    }

    // Check if the diary is already approved
    if (diary.approved) {
      return res.status(StatusCodes.OK).json({
        message: "This diary has already been approved.",
      });
    }

    // Update the approved status to true
    diary.approved = true;
    diary.updatedAt = Date.now(); // Update the `updatedAt` field

    // Save the updated diary
    await diary.save();

    // Return the updated diary
    res.status(StatusCodes.OK).json({
      message: "Diary approved successfully.",
      diary,
    });
  } catch (error) {
    console.error("Error approving diary:", error);
    next(new InternalServerError(error.message));
  }
};

// Delete a Diary entry
export const deleteDiary = async (req, res, next) => {
  try {
    const diary = await Diary.findByIdAndDelete(req.params.id);
    if (!diary) throw new NotFoundError("Diary entry not found");
    res
      .status(StatusCodes.OK)
      .json({ message: "Diary entry deleted successfully" });
  } catch (error) {
    console.error("Error deleting diary entry:", error);
    next(new InternalServerError(error.message));
  }
};

// Copy topic and subTopics from a previous-session diary to the current session.
// Validates that the source diary's className, subjectName, term, and lessonWeek
// all match the provided className, subjectName, and the auto-derived current term and weekOfTerm.
export const copyDiaryToCurrentSession = async (req, res, next) => {
  try {
    const { diaryId, className, subjectName, currentSubjectId } = req.body;

    if (!diaryId || !className || !subjectName || !currentSubjectId) {
      throw new BadRequestError(
        "diaryId, className, subjectName, and currentSubjectId are all required.",
      );
    }

    // Fetch source diary with populated class and subject names
    const sourceDiary = await Diary.findById(diaryId).populate([
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
    ]);

    if (!sourceDiary) {
      throw new NotFoundError("Source diary entry not found.");
    }

    // Derive current session, term, and week
    const {
      session: currentSession,
      term: currentTerm,
      weekOfTerm: currentWeek,
    } = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // Validate: source diary must not already be in the current session
    if (sourceDiary.session === currentSession) {
      throw new BadRequestError(
        "The selected diary already belongs to the current session.",
      );
    }

    // Validate: source diary's className must match the provided className
    if (sourceDiary.classId.className !== className) {
      throw new BadRequestError(
        `Source diary class "${sourceDiary.classId.className}" does not match "${className}".`,
      );
    }

    // Validate: source diary's subjectName must match the provided subjectName
    if (sourceDiary.subject.subjectName !== subjectName) {
      throw new BadRequestError(
        `Source diary subject "${sourceDiary.subject.subjectName}" does not match "${subjectName}".`,
      );
    }

    // Validate: source diary's term must match the current term
    if (sourceDiary.term !== currentTerm) {
      throw new BadRequestError(
        `Source diary term "${sourceDiary.term}" does not match the current term "${currentTerm}".`,
      );
    }

    // Validate: source diary's lessonWeek must match the current week of term
    if (sourceDiary.lessonWeek !== currentWeek) {
      throw new BadRequestError(
        `Source diary lesson week "${sourceDiary.lessonWeek}" does not match the current week "${currentWeek}".`,
      );
    }

    // Resolve subjectTeacher based on role
    const userId = req.user.id;
    const userRole = req.user.role;
    let subjectTeacher;

    const currentSubject = await Subject.findById(currentSubjectId);
    if (!currentSubject) {
      throw new NotFoundError("Current subject not found.");
    }

    if (userRole === "teacher") {
      const isSubjectTeacher = currentSubject.subjectTeachers.some(
        (teacher) => teacher.toString() === userId.toString(),
      );

      if (!isSubjectTeacher) {
        throw new BadRequestError(
          "You are not the subject teacher for this subject.",
        );
      }
      subjectTeacher = userId;
    } else if (userRole === "admin" || userRole === "proprietor") {
      if (!req.body.subjectTeacher) {
        throw new BadRequestError(
          "subjectTeacher must be provided for admin or proprietor.",
        );
      }
      subjectTeacher = req.body.subjectTeacher;
    }

    // Block if a diary with the same criteria already exists in the current session
    const duplicate = await Diary.findOne({
      term: currentTerm,
      lessonWeek: currentWeek,
    });

    if (duplicate) {
      throw new BadRequestError(
        `A diary for class "${className}", subject "${subjectName}", term "${currentTerm}", week ${currentWeek} already exists in the current session.`,
      );
    }

    const newDiary = new Diary({
      subjectTeacher,
      classId: currentSubject.classId,
      subject: currentSubject._id,
      term: currentTerm,
      lessonWeek: currentWeek,
      topic: sourceDiary.topic,
      subTopics: sourceDiary.subTopics,
      session: currentSession,
      approved: false,
    });

    await newDiary.save();

    res.status(StatusCodes.CREATED).json({
      message: `Diary copied from session ${sourceDiary.session} to ${currentSession} ${currentTerm} term.`,
      diary: newDiary,
    });
  } catch (error) {
    console.error("Error copying diary to current session:", error);
    next(new InternalServerError(error.message));
  }
};
