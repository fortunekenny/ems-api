import Class from "../models/ClassModel.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import {
  generateCurrentTerm,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js"; // Import the term generation function
import NotFoundError from "../errors/not-found.js";
import UnauthorizedError from "../errors/unauthorize.js"; // Direct import of UnauthorizedError
import checkPermissions from "../utils/checkPermissions.js";

// Create a new class
export const createClass = async (req, res) => {
  try {
    const {
      className,
      section,
      classTeacher,
      subjectTeachers,
      subjects,
      session,
      timetable,
    } = req.body;

    // Check if class already exists
    const classAlreadyExists = await Class.findOne({ className });
    if (classAlreadyExists) {
      throw new BadRequestError("Class already exists");
    }

    const term = generateCurrentTerm(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    const newClass = new Class({
      className,
      section,
      classTeacher,
      subjectTeachers,
      subjects,
      session,
      term,
      timetable,
    });
    await newClass.save();

    // Return class details
    res.status(StatusCodes.CREATED).json({
      newClass,
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  }
};

// Get all classes
export const getClasses = async (req, res) => {
  try {
    const classes = await Class.find();
    res.status(StatusCodes.OK).json({ classes, count: classes.length });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Get class by ID
export const getClassById = async (req, res) => {
  try {
    const { id: classId } = req.params;

    // Find the class by ID
    const classData = await Class.findOne({ _id: classId }).populate([
      { path: "classTeacher", select: "_id name email employeeID" },
      { path: "subjectTeachers", select: "_id name email employeeID" },
      { path: "students", select: "_id name email studentID" },
      {
        path: "subjects",
        select: "_id subjectName subjectCode subjectTeachers",
      },
    ]);

    if (!classData) {
      throw new NotFoundError(`No class found with id: ${classId}`);
    }
    res.status(StatusCodes.OK).json(classData);
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Update class
export const updateClass = async (req, res) => {
  try {
    const { id: classId } = req.params;
    const {
      className,
      section,
      classTeacher,
      subjectTeachers,
      subjects,
      session,
      timetable,
    } = req.body;

    // Find the class member by ID
    const updatedClass = await Class.findOne({ _id: classId });

    if (!updatedClass) {
      throw new NotFoundError(`No class found with id: ${classId}`);
    }

    const term = generateCurrentTerm(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // Check if the current user has permission to update
    checkPermissions(req.user, updatedClass.user);

    updatedClass.className = className || updatedClass.className;
    updatedClass.section = section || updatedClass.section;
    updatedClass.classTeacher = classTeacher || updatedClass.classTeacher;
    updatedClass.subjectTeachers =
      subjectTeachers || updatedClass.subjectTeachers;
    updatedClass.subjects = subjects || updatedClass.subjects;
    updatedClass.session = session || updatedClass.session;
    updatedClass.term = term || updatedClass.term;
    updatedClass.timetable = timetable || updatedClass.timetable;

    await updatedClass.save();

    res.status(StatusCodes.OK).json(updatedClass);
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Delete class
export const deleteClass = async (req, res) => {
  try {
    const { id: classId } = req.params;
    const classToDelete = await Class.findOne({ _id: classId });

    if (!classToDelete) {
      throw new NotFoundError(`No class found with id: ${classId}`);
    }

    // Ensure only admins can delete a class
    if (req.user.role !== "admin") {
      throw new UnauthorizedError("Only admins can delete class records.");
    }

    await classToDelete.deleteOne();
    res.status(StatusCodes.OK).json({ message: "Class deleted successfully" });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};
