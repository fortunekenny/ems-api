import Assignment from "../models/AssignmentModel.js";
import LessonNote from "../models/LessonNoteModel.js";
import Class from "../models/ClassModel.js";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import { StatusCodes } from "http-status-codes";

// Create a new assignment
export const createAssignment = async (req, res, next) => {
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

    const assignment = new Assignment(req.body);
    await assignment.save();

    res.status(StatusCodes.CREATED).json(assignment);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Get all assignments
export const getAssignments = async (req, res, next) => {
  try {
    const assignments = await Assignment.find()
      .populate("subjectTeacher", "name") // populate teacher's name
      .populate("classId", "name") // populate class name
      .populate("students", "name") // populate students' names
      .populate("lessonNote")
      .populate("subject")
      .populate("questions")
      .populate("submitted");

    res.status(StatusCodes.OK).json(assignments);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Get assignment by ID
export const getAssignmentById = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate("subjectTeacher", "name")
      .populate("classId", "name")
      .populate("students", "name")
      .populate("lessonNote")
      .populate("subject")
      .populate("questions")
      .populate("submitted");

    if (!assignment) {
      throw new NotFoundError("Assignment not found.");
    }

    res.status(StatusCodes.OK).json(assignment);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Update an assignment
export const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const assignment = await Assignment.findById(id).populate("lessonNote");
    if (!assignment) {
      throw new NotFoundError("Assignment not found");
    }

    // Check authorization
    const isAuthorized =
      userRole === "admin" ||
      userRole === "proprietor" ||
      (userRole === "teacher" &&
        assignment.lessonNote.subject &&
        assignment.lessonNote.subject.subjectTeachers.includes(userId));

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to update this assignment.",
      );
    }

    const updatedAssignment = await Assignment.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(StatusCodes.OK).json(updatedAssignment);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

export const submitAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      throw new NotFoundError("Assignment not found");
    }

    // Check if the student is part of the class
    if (!assignment.students.includes(userId)) {
      throw new BadRequestError("You are not authorized to this assignment.");
    }

    const alreadySubmitted = assignment.submitted.find(
      (submission) => submission.student.toString() === userId,
    );
    if (alreadySubmitted) {
      throw new BadRequestError("You have already submitted this assignment.");
    }

    // Add submission
    assignment.submitted.push({ student: userId });

    // Update status based on due date
    if (new Date(assignment.dueDate) > new Date()) {
      assignment.status = "completed";
    } else {
      assignment.status = "overdue";
    }

    await assignment.save();

    res
      .status(StatusCodes.OK)
      .json({ message: "Assignment submitted successfully." });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Delete an assignment
export const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndDelete(id);

    if (!assignment) {
      throw new NotFoundError("Assignment not found.");
    }

    res
      .status(StatusCodes.OK)
      .json({ message: "Assignment deleted successfully" });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};
