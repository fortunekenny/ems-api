import ClassWork from "../models/ClassWorkModel.js";
import LessonNote from "../models/LessonNoteModel.js";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import { StatusCodes } from "http-status-codes";

// Create ClassWork
export const createClassWork = async (req, res, next) => {
  try {
    const { subjectTeacher, lessonNote, dueDate } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate required fields
    if (!subjectTeacher || !lessonNote || !dueDate) {
      throw new BadRequestError("All required fields must be provided.");
    }

    // Fetch LessonNote to validate session, term, lessonWeek, and other fields
    const note = await LessonNote.findById(lessonNote);
    if (!note) {
      throw new BadRequestError("Lesson note not found.");
    }

    // Assign the classId, subject, topic, subTopic, session, term, and lessonWeek based on the lessonNote
    req.body.classId = note.classId;
    req.body.subject = note.subject;
    req.body.topic = note.topic;
    req.body.subTopic = note.subTopic;
    req.body.session = note.session;
    req.body.term = note.term;
    req.body.lessonWeek = note.lessonWeek;

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
        (subjectItem) => subjectItem.toString() === note.subject.toString(),
      );
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to create this class work.",
      );
    }

    // Assign the teacher field based on the role
    if (userRole === "teacher") {
      req.body.subjectTeacher = userId;
    } else if (userRole === "admin" || userRole === "proprietor") {
      if (!req.body.teacher) {
        throw new BadRequestError(
          "For admin or proprietor, the 'teacher' field must be provided.",
        );
      }
    }

    // Create new ClassWork
    const classWork = new ClassWork(req.body);
    await classWork.save();

    res.status(StatusCodes.CREATED).json(classWork);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Get All ClassWorks
export const getAllClassWorks = async (req, res, next) => {
  try {
    const classWorks = await ClassWork.find()
      .populate("subjectTeacher")
      .populate("lessonNote")
      .populate("class")
      .populate("subject")
      .populate("questions")
      .populate("students")
      .populate("submitted");

    res.status(StatusCodes.OK).json(classWorks);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Get ClassWork by ID
export const getClassWorkById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const classWork = await ClassWork.findById(id)
      .populate("subjectTeacher")
      .populate("lessonNote")
      .populate("class")
      .populate("subject")
      .populate("questions")
      .populate("students")
      .populate("submitted");

    if (!classWork) {
      throw new NotFoundError("ClassWork not found.");
    }

    res.status(StatusCodes.OK).json(classWork);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Update ClassWork
export const updateClassWork = async (req, res, next) => {
  try {
    const { id } = req.params;

    const classWork = await ClassWork.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    if (!classWork) {
      throw new NotFoundError("ClassWork not found.");
    }

    res.status(StatusCodes.OK).json(classWork);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Delete ClassWork
export const deleteClassWork = async (req, res, next) => {
  try {
    const { id } = req.params;

    const classWork = await ClassWork.findByIdAndDelete(id);

    if (!classWork) {
      throw new NotFoundError("ClassWork not found.");
    }

    res
      .status(StatusCodes.OK)
      .json({ message: "ClassWork deleted successfully." });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};
