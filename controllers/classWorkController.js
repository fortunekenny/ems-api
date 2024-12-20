import ClassWork from "../models/ClassWorkModel.js";
import LessonNote from "../models/LessonNoteModel.js";
import Class from "../models/ClassModel.js";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import { StatusCodes } from "http-status-codes";

// Create ClassWork

export const createClassWork = async (req, res, next) => {
  try {
    const { lessonNote, questions } = req.body;

    if (!lessonNote || !questions) {
      throw new BadRequestError(
        "LessonNote and questions are required fields.",
      );
    }

    const userId = req.user.id;
    const userRole = req.user.role;

    // Authorization logic
    let isAuthorized = false;

    if (["admin", "proprietor"].includes(userRole)) {
      if (!req.body.subjectTeacher) {
        throw new BadRequestError(
          "For admin or proprietor, the 'subjectTeacher' field is required.",
        );
      }
      isAuthorized = true;
    } else if (userRole === "teacher") {
      const teacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new BadRequestError("Teacher not found.");
      }

      isAuthorized = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === req.body.subject,
      );

      req.body.subjectTeacher = userId; // Assign the teacher as the subject teacher
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to create this class work.",
      );
    }

    // Fetch LessonNote and assign related fields
    const note = await LessonNote.findById(lessonNote);
    if (!note) {
      throw new BadRequestError("Lesson note not found.");
    }

    req.body.classId = note.classId;
    req.body.subject = note.subject;
    req.body.topic = note.topic;
    req.body.subTopic = note.subTopic;
    req.body.session = note.session;
    req.body.term = note.term;
    req.body.lessonWeek = note.lessonWeek;

    // Fetch students for the classId
    const classData = await Class.findById(req.body.classId).populate(
      "students",
    );
    if (!classData || !classData.students) {
      throw new BadRequestError("Class or students not found.");
    }

    req.body.students = classData.students.map((student) => student._id);
    req.body.submitted = []; // Initialize as an empty array

    // Save ClassWork
    const classWork = new ClassWork(req.body);
    await classWork.save();

    // Populate fields for the response
    /*const populatedClassWork = await ClassWork.findById(classWork._id)
      .populate({ path: "questions", select: "_id questionText" })
      .populate({ path: "classId", select: "_id className" });*/

    // Populate fields for the response
    const populatedClassWork = await ClassWork.findById(classWork._id).populate(
      [
        { path: "questions", select: "_id questionType questionText options" },
        { path: "classId", select: "_id className" },
      ],
    );

    // Add additional fields to the response
    const response = {
      ...populatedClassWork.toObject(),
      lessonWeek: req.body.lessonWeek,
      // classId: req.body.classId,
      subject: req.body.subject,
      topic: req.body.topic,
      subTopic: req.body.subTopic,
      session: req.body.session,
      term: req.body.term,
    };

    res.status(StatusCodes.CREATED).json(response);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

/*export const createClassWork = async (req, res, next) => {
  try {
    let {
      subjectTeacher,
      lessonNote,
      questions,
      // dueDate,
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
    if (
    !questions ||
     !lessonNote 
     //|| !dueDate
    ) {
      throw new BadRequestError("All required fields must be provided.");
    }

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

    // Create new ClassWork
    const classWork = new ClassWork(req.body);
    await classWork.save();

    // Populate questions to include _id and questionText in the response
    const populatedClassWork = await ClassWork.findById(classWork._id).populate(
      {
        path: "questions",
        select: "_id questionText",
      },
      {
        path: "classId",
        select: "_id className",
      },
    );

    res.status(StatusCodes.CREATED).json(populatedClassWork);

    // res.status(StatusCodes.CREATED).json(classWork);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};*/

// Get All ClassWorks
export const getAllClassWorks = async (req, res, next) => {
  try {
    const classWorks = await ClassWork.find().populate([
      { path: "questions", select: "_id questionType questionText options" },
      {
        path: "classId",
        select: "_id className",
      },
      {
        path: "subject",
        select: "_id subjectName",
      },
      {
        path: "subjectTeacher",
        select: "_id name",
      },
      {
        path: "lessonNote",
        select: "_id lessonweek lessonPeriod",
      },
    ]);
    /*.populate("subjectTeacher")
      .populate("lessonNote")
      .populate("classId")
      .populate("subject")
      .populate("questions")
      .populate("students")
      .populate("submitted");*/

    res.status(StatusCodes.OK).json({ count: classWorks.length, classWorks });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Get ClassWork by ID
export const getClassWorkById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const classWork = await ClassWork.findById(id).populate([
      { path: "questions", select: "_id questionType questionText options" },
      {
        path: "classId",
        select: "_id className",
      },
      {
        path: "subject",
        select: "_id subjectName",
      },
      {
        path: "subjectTeacher",
        select: "_id name",
      },
      {
        path: "lessonNote",
        select: "_id lessonweek lessonPeriod",
      },
    ]);

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

    // Fetch the existing ClassWork
    const classWork = await ClassWork.findById(id).populate("lessonNote");
    if (!classWork) {
      throw new NotFoundError("ClassWork not found.");
    }

    // Update the ClassWork
    const updatedClassWork = await ClassWork.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    res
      .status(StatusCodes.OK)
      .json({ message: "class work updated successfully.", updatedClassWork });
  } catch (error) {
    next(new BadRequestError(error.message));
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

/*
Updating submitted: When a student submits their work, you would update the submitted array in the ClassWork document.
For example:

javascript
Copy code
classWork.submitted.push(studentId); // Add studentId to the submitted array
await classWork.save();
Retrieving ClassWork with populated fields: When fetching the ClassWork document, you can populate the students and submitted fields using .populate('students') and .populate('submitted') to get the full student details if needed.
*/
