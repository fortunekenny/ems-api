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
    const { lessonNote, questions, marksObtainable } = req.body;
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
    // if (!marksObtainable) {
    //   throw new BadRequestError("marksObtainable must be provided.");
    // }

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

      isAuthorized = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to create assignment for the selected subject.",
        );
      }
      req.body.subjectTeacher = userId;
      subjectTeacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to create this assignment.",
      );
    }

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

    // Create the assignment
    const assignment = new Assignment(req.body);
    await assignment.save();

    // Populate assignment data for response
    const populatedAssignment = await Assignment.findById(
      assignment._id,
    ).populate([
      {
        path: "questions",
        select: "_id questionType questionText options files",
      },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "subjectTeacher", select: "_id name" },
      {
        path: "lessonNote",
        select: "_id lessonweek lessonPeriod",
      },
      // { path: "students", select: "_id firstName lastName" },
    ]);

    res.status(StatusCodes.CREATED).json({
      message: "Assignment created successfully",
      populatedAssignment,
    });
  } catch (error) {
    console.error("Error creating assignment:", error);
    next(new BadRequestError(error.message));
  }
};

// Get all assignments
export const getAssignments = async (req, res, next) => {
  try {
    const {
      subjectTeacher,
      subject,
      evaluationType,
      classId,
      term,
      session,
      lessonWeek,
      topic,
    } = req.query;

    // Build a query object based on provided filters
    const queryObject = {};

    //queryObject["student.name"] = { $regex: name, $options: "i" }; // Case-insensitive search

    if (subjectTeacher) {
      queryObject["subjectTeacher"] = { $regex: subjectTeacher, $options: "i" }; // Case-insensitive search
    }
    if (subject) {
      queryObject["subject"] = subject;
    }
    if (evaluationType) {
      queryObject["evaluationType"] = evaluationType;
    }
    if (classId) {
      queryObject["classId"] = classId;
    }
    if (lessonWeek) {
      queryObject["lessonWeek"] = lessonWeek;
    }
    if (topic) {
      queryObject["topic"] = topic;
    }
    if (term) {
      queryObject["term"] = term;
    }
    if (session) {
      queryObject["session"] = session;
    }

    const assignments = await Assignment.find(queryObject).populate([
      {
        path: "questions",
        select: "_id questionType questionText options files",
      },
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
    const { id: userId, role: userRole } = req.user; // Authenticated user ID and role

    const assignment = await Assignment.findById(id).populate("lessonNote");
    if (!assignment) {
      throw new NotFoundError("Assignment not found");
    }

    const { subject, questions, classId, term, marksObtainable } = assignment; // Use data from the existing assignment document

    let subjectTeacherId;
    let isAuthorized = false;

    if (["admin", "proprietor"].includes(userRole)) {
      isAuthorized = true;
      subjectTeacherId = req.body.subjectTeacher;

      // Ensure 'subjectTeacher' field is provided
      if (!subjectTeacherId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'subjectTeacher' field must be provided.",
        );
      }

      const teacher = await Staff.findById(subjectTeacherId).populate([
        { path: "subjects", select: "_id subjectName" },
      ]);
      if (!teacher) {
        throw new NotFoundError("Provided subjectTeacher not found.");
      }

      const isAssignedSubject = teacher.subjects.some(
        (subjectItem) => subjectItem && subjectItem.equals(subject),
      );

      if (!isAssignedSubject) {
        throw new BadRequestError(
          "The specified subjectTeacher is not assigned to the selected subject.",
        );
      }
    } else if (userRole === "teacher") {
      const teacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new NotFoundError("Teacher not found.");
      }

      // Check if the teacher is authorized for this test's subject
      isAuthorized = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to update this assignment for the selected subject.",
        );
      }

      subjectTeacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to update this assignment.",
      );
    }

    // Fetch and validate questions
    const questionDocs = await Question.find({ _id: { $in: questions } });

    if (questionDocs.length !== questions.length) {
      throw new BadRequestError("Some questions could not be found.");
    }

    for (const [index, question] of questionDocs.entries()) {
      // Perform validations using saved `exam` fields (e.g., `term`)
      if (
        question.subject.toString() !== subject.toString() ||
        question.classId.toString() !== classId.toString() ||
        question.term.toString().toLowerCase() !== term.toString().toLowerCase()
      ) {
        throw new BadRequestError(
          `Question at index ${
            index + 1
          } does not match the class, subject, or term.`,
        );
      }
    }

    const updatedAssignment = await Assignment.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    }).populate([
      {
        path: "questions",
        select: "_id questionType questionText options files",
      },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "subjectTeacher", select: "_id name" },
      {
        path: "lessonNote",
        select: "_id lessonweek lessonPeriod",
      },
    ]);

    res.status(StatusCodes.OK).json({
      message: "Assignment updated successfully.",
      updatedAssignment,
    });
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
    const { id } = req.params; // Assignment ID to be deleted

    // Find the Assignment document
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      throw new NotFoundError("Assignment not found.");
    }

    const { lessonNote } = assignment; // Extract the lessonNote reference

    // Find the associated LessonNote document
    const lessonNoteDoc = await LessonNote.findById(lessonNote);
    if (!lessonNoteDoc) {
      throw new NotFoundError("Associated lessonNote not found.");
    }

    // Remove the assignment reference from the LessonNote
    lessonNoteDoc.assignment = lessonNoteDoc.assignment.filter(
      (assignId) => !assignId.equals(id), // Filter out the current assignment ID
    );
    await lessonNoteDoc.save();

    // Delete the Assignment document
    await Assignment.findByIdAndDelete(id);

    res
      .status(StatusCodes.OK)
      .json({ message: "Assignment deleted successfully." });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};
