import Assignment from "../models/AssignmentModel.js";
import LessonNote from "../models/LessonNoteModel.js";
import Staff from "../models/StaffModel.js";
import Class from "../models/ClassModel.js";
import Question from "../models/QuestionsModel.js";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import { StatusCodes } from "http-status-codes";

// Create a new assignment

export const createAssignment = async (req, res, next) => {
  try {
    const { lessonNote, questions, evaluationType } = req.body;
    const { id: userId, role: userRole } = req.user;

    // Validate required fields
    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      throw new BadRequestError(
        "Questions must be provided and cannot be empty.",
      );
    }
    if (!lessonNote) {
      throw new BadRequestError("Lesson note must be provided.");
    }

    // Authorization logic
    let isAuthorized = false;
    let subjectTeacherId;

    if (["admin", "proprietor"].includes(userRole)) {
      isAuthorized = true;
      subjectTeacherId = req.body.subjectTeacher;

      if (!req.body.subjectTeacher) {
        throw new BadRequestError(
          "For admin or proprietor, the 'subjectTeacher' field must be provided.",
        );
      }

      // Validate that the subjectTeacher exists and is valid
      const teacher = await Staff.findById(subjectTeacherId).populate(
        "subjects",
      );
      if (!teacher) {
        throw new NotFoundError("Provided subjectTeacher not found.");
      }

      const isAssignedSubject = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAssignedSubject) {
        throw new BadRequestError(
          "The specified subjectTeacher is not assigned to the selected subject.",
        );
      }
    } else if (userRole === "teacher") {
      const teacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new BadRequestError("Teacher not found.");
      }

      const note = await LessonNote.findById(lessonNote);
      if (!note) {
        throw new BadRequestError("Lesson note not found.");
      }

      isAuthorized = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === note.subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to create a test for the selected subject.",
        );
      }

      req.body.subjectTeacher = userId; // Assign teacher ID to the assignment
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to create this assignment.",
      );
    }

    // Fetch and validate the lesson note
    const note = await LessonNote.findById(lessonNote).populate(
      "classId subject",
    );
    if (!note) {
      throw new BadRequestError("Lesson note not found.");
    }

    // Assign fields based on the lesson note
    const { classId, subject, topic, subTopic, session, term, lessonWeek } =
      note;
    Object.assign(req.body, {
      classId,
      subject,
      topic,
      subTopic,
      session,
      term,
      lessonWeek,
    });

    // console.log("Assignment context: ", { subject, classId, term });

    // Fetch questions from database to validate them
    const questionDocs = await Question.find({ _id: { $in: questions } });

    if (questionDocs.length !== questions.length) {
      throw new BadRequestError("Some questions could not be found.");
    }

    // Validate questions against the lesson note context
    for (const [index, question] of questionDocs.entries()) {
      // console.log(`Validating question ${index + 1}: `, question);
      if (
        question.subject.toString() !== subject._id.toString() ||
        question.classId.toString() !== classId._id.toString() ||
        question.term.toString().toLowerCase() !== term.toString().toLowerCase()
      ) {
        throw new BadRequestError(
          `Question at index ${
            index + 1
          } does not match the class, subject, or term.`,
        );
      }
    }

    // Fetch students for the class
    const classData = await Class.findById(classId).populate("students");
    if (!classData || !classData.students.length) {
      throw new BadRequestError("Class or students not found.");
    }

    // Populate students and initialize the submitted array
    req.body.students = classData.students.map((student) => student._id);
    req.body.submitted = []; // Initially an empty array

    // Add evaluationType with a default value
    req.body.evaluationType = evaluationType || "Assignment";

    // Create the assignment
    const assignment = new Assignment(req.body);
    await assignment.save();

    // Populate assignment data for response
    const populatedAssignment = await Assignment.findById(
      assignment._id,
    ).populate([
      { path: "questions", select: "_id questionType questionText options" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "subjectTeacher", select: "_id name" },
      // { path: "students", select: "_id firstName lastName" },
    ]);

    // Prepare the response
    const response = {
      ...populatedAssignment.toObject(),
      lessonWeek,
      // subject,
      topic,
      subTopic,
      session,
      term,
    };

    // Send the response
    res.status(StatusCodes.CREATED).json(response);
  } catch (error) {
    console.error("Error creating assignment:", error);
    next(new BadRequestError(error.message));
  }
};

// Get all assignments
export const getAssignments = async (req, res, next) => {
  try {
    const assignments = await Assignment.find().populate([
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

    res.status(StatusCodes.OK).json({ count: assignments.length, assignments });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Get assignment by ID
export const getAssignmentById = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id).populate([
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
    // .populate("subjectTeacher", "name")
    // .populate("classId", "name")
    // .populate("students", "name")
    // .populate("lessonNote")
    // .populate("subject")
    // .populate("questions")
    // .populate("submitted");

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
export const deleteAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;

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
