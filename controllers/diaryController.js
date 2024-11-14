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
    // Set teacher to the authenticated user
    req.body.teacher = req.user.id;

    // Get the term start date
    const { startDate: termStartDate } = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // Calculate the allowed creation window for diary entries
    const oneWeekBeforeTermStart = new Date(termStartDate);
    oneWeekBeforeTermStart.setDate(oneWeekBeforeTermStart.getDate() - 7);

    // Get the current date
    const currentDate = new Date();

    // Check if current date is within the exact one-week window before term start
    if (currentDate < oneWeekBeforeTermStart || currentDate >= termStartDate) {
      throw new BadRequestError(
        "Diary entries can only be created within one week before the term starts.",
      );
    }

    // Retrieve the teacher's document to check assigned subjects
    const teacher = await Staff.findById(req.user.id).populate("subjects");

    if (!teacher) {
      throw new BadRequestError("Teacher not found");
    }

    // Check if the requested subject is within the teacher's assigned subjects
    const isSubjectValid = teacher.subjects.some(
      (subject) => subject.toString() === req.body.subject,
    );

    if (!isSubjectValid) {
      throw new BadRequestError(
        "Invalid subject: Subject not assigned to this teacher.",
      );
    }

    // Create and save the new diary entry
    const diary = new Diary(req.body);
    await diary.save();

    res.status(StatusCodes.CREATED).json(diary);
  } catch (error) {
    next(new BadRequestError(error.message));
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
