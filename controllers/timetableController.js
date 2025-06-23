import { StatusCodes } from "http-status-codes";
import WeekTimetable from "../models/TimetableModel.js";
import mongoose from "mongoose";
import InternalServerError from "../errors/internal-server-error.js";
import NotFoundError from "../errors/not-found.js";
import { getCurrentTermDetails } from "../utils/termGenerator.js";

// Create a new week timetable
export const createWeekTimetable = async (req, res, next) => {
  try {
    const { classId, schedule, startDate, holidayDurations, publicHolidays } =
      req.body;
    // Use getCurrentTermDetails to determine term and session
    const termDetails = getCurrentTermDetails(
      startDate,
      holidayDurations,
      publicHolidays
    );
    const { term, session } = termDetails;
    // Optionally: Validate schedule array structure here
    const timetable = await WeekTimetable.create({
      classId,
      term,
      session,
      schedule,
    });
    res
      .status(StatusCodes.CREATED)
      .json({ message: "Week timetable created", timetable });
  } catch (error) {
    console.log("Error creating week timetable:", error);
    next(new InternalServerError(error.message));
  }
};

// Get a week timetable by class, term, and session (term/session from getCurrentTermDetails)
export const getWeekTimetable = async (req, res, next) => {
  try {
    const { classId, startDate, holidayDurations, publicHolidays } = req.query;
    // Use getCurrentTermDetails to determine term and session
    const termDetails = getCurrentTermDetails(
      startDate,
      holidayDurations,
      publicHolidays
    );
    const { term, session } = termDetails;
    const timetable = await WeekTimetable.findOne({
      classId,
      term,
      session,
    })
      .populate("schedule.periods.subject schedule.periods.teacher");
    if (!timetable) {
      throw new NotFoundError("Week timetable not found");
    }
    res.status(StatusCodes.OK).json(timetable);
  } catch (error) {
    console.log("Error fetching week timetable:", error);
    next(new InternalServerError(error.message));
  }
};

// Update a week timetable by ID
export const updateWeekTimetable = async (req, res, next) => {
  try {
    const { id } = req.params;
    const update = req.body;
    const timetable = await WeekTimetable.findByIdAndUpdate(id, update, {
      new: true,
    });
    if (!timetable) {
      throw new NotFoundError("Week timetable not found");
    }
    res
      .status(StatusCodes.OK)
      .json({ message: "Week timetable updated", timetable });
  } catch (error) {
    console.log("Error updating week timetable:", error);
    next(new InternalServerError(error.message));
  }
};

// Delete a week timetable by ID
export const deleteWeekTimetable = async (req, res, next) => {
  try {
    const { id } = req.params;
    const timetable = await WeekTimetable.findByIdAndDelete(id);
    if (!timetable) {
      throw new NotFoundError("Week timetable not found");
    }
    res.status(StatusCodes.OK).json({ message: "Week timetable deleted" });
  } catch (error) {
    console.log("Error deleting week timetable:", error);
    next(new InternalServerError(error.message));
  }
};
