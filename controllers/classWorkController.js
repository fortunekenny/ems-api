import ClassWork from "../models/ClassWorkModel.js";
import LessonNote from "../models/LessonNoteModel.js";
import Class from "../models/ClassModel.js";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import { StatusCodes } from "http-status-codes";

// Create ClassWork
export const createClassWork = async (req, res, next) => {
  try {
    const {
      subjectTeacher,
      lessonNote,
      questions,
      dueDate,
      lessonWeek,
      classId,
      subject,
      topic,
      subTopic,
      session,
      term,
    } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;

    // Validate required fields
    if (!questions || !lessonNote || !dueDate) {
      throw new BadRequestError("All required fields must be provided.");
    }

    // Fetch LessonNote to validate session, term, lessonWeek, and other fields
    const note = await LessonNote.findById(lessonNote);
    if (!note) {
      throw new BadRequestError("Lesson note not found.");
    }

    // Assign the classId, subject, topic, subTopic, session, term, and lessonWeek based on the lessonNote
    classId = note.classId;
    subject = note.subject;
    topic = note.topic;
    subTopic = note.subTopic;
    session = note.session;
    term = note.term;
    lessonWeek = note.lessonWeek;

    // Fetch students for the given classId
    const classData = await Class.findById(req.body.classId).populate(
      "students",
    );
    if (!classData || !classData.students) {
      throw new BadRequestError("Class or students not found.");
    }

    // Populate students and initialize the submitted array to empty
    req.body.students = classData.students.map((student) => student._id);
    req.body.submitted = []; // Initially empty array, will be updated later as students submit work

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
        (subjectItem) => subjectItem.toString() === note.subject.toString(),
      );

      // Assign the teacher field to the authenticated teacher
      req.body.subjectTeacher = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to create this class work.",
      );
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
      .populate("classId")
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
    const userId = req.user.id;
    const userRole = req.user.role;

    // Fetch the existing ClassWork
    const classWork = await ClassWork.findById(id).populate("lessonNote");
    if (!classWork) {
      throw new NotFoundError("ClassWork not found.");
    }

    // Check authorization
    const isAuthorized =
      userRole === "admin" ||
      userRole === "proprietor" ||
      (userRole === "teacher" &&
        classWork.lessonNote.subject &&
        classWork.lessonNote.subject.subjectTeachers.includes(userId));

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to update this class work.",
      );
    }

    // Update the ClassWork
    const updatedClassWork = await ClassWork.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(StatusCodes.OK).json(updatedClassWork);
  } catch (error) {
    next(
      error instanceof BadRequestError || error instanceof NotFoundError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

export const submitClassWork = async (req, res, next) => {
  try {
    const { id } = req.params; // ClassWork ID
    const userId = req.user.id; // Student ID

    const classWork = await ClassWork.findById(id);
    if (!classWork) throw new NotFoundError("ClassWork not found.");

    // Check if the student is part of the class
    if (!classWork.students.includes(userId)) {
      throw new BadRequestError("You are not authorized to submit this work.");
    }

    // Check if already submitted
    const alreadySubmitted = classWork.submitted.find(
      (submission) => submission.student.toString() === userId,
    );
    if (alreadySubmitted) {
      throw new BadRequestError("You have already submitted this work.");
    }

    // Add submission
    classWork.submitted.push({ student: userId });

    // Update status based on due date
    if (new Date(classWork.dueDate) > new Date()) {
      classWork.status = "completed"; // Submission before the due date
    } else {
      classWork.status = "overdue"; // Submission after the due date
    }

    await classWork.save();

    res
      .status(StatusCodes.OK)
      .json({ message: "ClassWork submitted successfully." });
  } catch (error) {
    next(error);
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

/*
Updating submitted: When a student submits their work, you would update the submitted array in the ClassWork document.
For example:

javascript
Copy code
classWork.submitted.push(studentId); // Add studentId to the submitted array
await classWork.save();
Retrieving ClassWork with populated fields: When fetching the ClassWork document, you can populate the students and submitted fields using .populate('students') and .populate('submitted') to get the full student details if needed.
*/
