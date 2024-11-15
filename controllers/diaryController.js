import Diary from "../models/DiaryModel.js";
import Staff from "../models/StaffModel.js";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";

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
    if (currentDate < oneWeekBeforeTermStart || currentDate >= termStartDate) {
      throw new BadRequestError(
        "Diary entries can only be created within one week before the term starts.",
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
        "You are not authorized to create this diary entry.",
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

    // Create and save the new diary entry
    const diary = new Diary(req.body);
    await diary.save();

    res.status(StatusCodes.CREATED).json(diary);
  } catch (error) {
    next(
      error instanceof BadRequestError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

// Get all Diary entries
export const getAllDairies = async (req, res, next) => {
  try {
    const dairies = await Diary.find().populate("teacher classId subject");
    res.status(StatusCodes.OK).json(dairies);
  } catch (error) {
    next(error);
  }
};

// Get a single Diary entry by ID
export const getDiaryById = async (req, res, next) => {
  try {
    const diary = await Diary.findById(req.params.id).populate(
      "teacher classId subject",
    );
    if (!diary) throw new NotFoundError("Diary entry not found");
    res.status(StatusCodes.OK).json(diary);
  } catch (error) {
    next(error);
  }
};

// Update a Diary entry
export const updateDiary = async (req, res, next) => {
  try {
    const diary = await Diary.findByIdAndUpdate(req.params.id, req.body, {
      new: true,
      runValidators: true,
    });
    if (!diary) throw new NotFoundError("Diary entry not found");
    res.status(StatusCodes.OK).json(diary);
  } catch (error) {
    next(
      error instanceof NotFoundError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

export const approveDiary = async (req, res) => {
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

    // Check if the current status is already "approved"
    if (diary.status === "approved") {
      return res.status(StatusCodes.OK).json({
        message: "This diary has already been approved.",
      });
    }

    // Update the status to "approved"
    diary.status = "approved";
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
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ error: error.message });
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
    next(error);
  }
};
