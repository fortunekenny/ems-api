import ClassWork from "../models/ClassWorkModel.js";
import LessonNote from "../models/LessonNoteModel.js";
import Class from "../models/ClassModel.js";
import Question from "../models/QuestionsModel.js";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import { StatusCodes } from "http-status-codes";

// Create ClassWork

export const createClassWork = async (req, res, next) => {
  try {
    const { lessonNote, questions } = req.body;
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
          "You are not authorized to create class work for the selected subject.",
        );
      }
      req.body.subjectTeacher = userId;
      subjectTeacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to create this class work.",
      );
    }

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

    // Fetch students for the classId
    const classData = await Class.findById(req.body.classId).populate(
      "students",
    );
    if (!classData || !classData.students.length) {
      throw new BadRequestError("Class or students not found.");
    }

    req.body.students = classData.students.map((student) => student._id);
    req.body.submitted = []; // Initialize as an empty array

    // Save ClassWork
    const classWork = new ClassWork(req.body);
    await classWork.save();

    // Populate fields for the response
    const populatedClassWork = await ClassWork.findById(classWork._id).populate(
      [
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
      ],
    );

    res.status(StatusCodes.CREATED).json({
      message: "ClassWork created successfully",
      populatedClassWork,
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

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
    const { id: userId, role: userRole } = req.user; // Authenticated user ID and role

    // Fetch the existing ClassWork
    const classWork = await ClassWork.findById(id).populate("lessonNote");
    if (!classWork) {
      throw new NotFoundError("ClassWork not found.");
    }

    const { subject, questions, classId, term } = classWork; // Use data from the existing classWork document

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
          "You are not authorized to update this classWork for the selected subject.",
        );
      }

      subjectTeacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to update this class work.",
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

    // Update the ClassWork
    const updatedClassWork = await ClassWork.findByIdAndUpdate(id, req.body, {
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
    const { id } = req.params; // ClassWork ID to be deleted

    // Find the ClassWork document
    const classWork = await ClassWork.findById(id);
    if (!classWork) {
      throw new NotFoundError("ClassWork not found.");
    }

    const { lessonNote } = classWork; // Extract the lessonNote reference

    // Find the associated LessonNote document
    const lessonNoteDoc = await LessonNote.findById(lessonNote);
    if (!lessonNoteDoc) {
      throw new NotFoundError("Associated lessonNote not found.");
    }

    // Remove the classWork reference from the LessonNote
    lessonNoteDoc.classWork = lessonNoteDoc.classWork.filter(
      (assignId) => !assignId.equals(id), // Filter out the current classWork ID
    );
    await lessonNoteDoc.save();

    // Delete the ClassWork document
    await ClassWork.findByIdAndDelete(id);

    res
      .status(StatusCodes.OK)
      .json({ message: "ClassWork deleted successfully." });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};
