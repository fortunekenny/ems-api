// Create an test
import { StatusCodes } from "http-status-codes";
import Test from "../models/TestModel.js";
import Staff from "../models/StaffModel.js";
import Student from "../models/StudentModel.js";
import Subject from "../models/SubjectModel.js";
import Class from "../models/ClassModel.js";
import Question from "../models/QuestionsModel.js";
import StudentAnswer from "../models/StudentAnswerModel.js"; // Adjust the path as needed
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";

export const createTest = async (req, res, next) => {
  try {
    let {
      classId,
      subject,
      questions,
      date,
      students,
      submitted,
      startTime,
      durationTime,
      session,
      term,
    } = req.body;

    // console.log("test context: ", { subject, classId, term, session });

    const { id: userId, role: userRole } = req.user; // Authenticated user ID and role

    // Validate required fields
    if (
      !classId ||
      !subject ||
      !questions ||
      !Array.isArray(questions) ||
      questions.length === 0 ||
      !date ||
      !startTime ||
      !durationTime
    ) {
      throw new BadRequestError("All required fields must be provided.");
    }

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

      isAuthorized = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to create a test for the selected subject.",
        );
      }

      subjectTeacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError("You are not authorized to create this test.");
    }

    // // Fetch and validate questions
    // const questionDocs = await Question.find({ _id: { $in: questions } });

    const classData = await Class.findById(req.body.classId).populate(
      "students",
    );
    if (!classData || !classData.students.length) {
      throw new BadRequestError("Class or students not found.");
    }

    students = classData.students.map((student) => student._id);
    submitted = [];

    // console.log("Creating a new Test document...");

    const test = new Test({
      subjectTeacher: subjectTeacherId,
      classId,
      subject,
      questions,
      students,
      submitted,
      date,
      startTime,
      durationTime,
      session,
      term,
    });

    // console.log("Saving the Test document...");

    await test.save();

    // console.log("Test document saved successfully.");

    // Fetch and validate questions
    const questionDocs = await Question.find({ _id: { $in: questions } });

    if (questionDocs.length !== questions.length) {
      throw new BadRequestError("Some questions could not be found.");
    }

    for (const [index, question] of questionDocs.entries()) {
      // Perform validations using saved `test` fields (e.g., `term`)
      if (
        question.subject.toString() !== test.subject.toString() ||
        question.classId.toString() !== test.classId.toString() ||
        question.term.toString().toLowerCase() !==
          test.term.toString().toLowerCase()
      ) {
        throw new BadRequestError(
          `Question at index ${
            index + 1
          } does not match the class, subject, or term.`,
        );
      }
    }

    const populatedTest = await Test.findById(test._id).populate([
      {
        path: "questions",
        select: "_id questionType questionText options files",
      },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "subjectTeacher", select: "_id name" },
    ]);

    res.status(StatusCodes.CREATED).json({
      message: "Test created successfully.",
      test: populatedTest,
    });
  } catch (error) {
    console.error("Error creating test:", error);
    next(new BadRequestError(error.message));
  }
};

/*export const createTest = async (req, res, next) => {
  try {
    const {
      classId,
      subject,
      questions,
      date,
      startTime,
      durationTime,
      session,
      term,
    } = req.body;

    const { id: userId, role: userRole } = req.user; // Authenticated user ID and role

    // Validate required fields
    if (
      !classId ||
      !subject ||
      !questions ||
      !Array.isArray(questions) ||
      questions.length === 0 ||
      !date ||
      !startTime ||
      !durationTime
    ) {
      throw new BadRequestError("All required fields must be provided.");
    }

    let subjectTeacherId;
    let isAuthorized = false;

    if (["admin", "proprietor"].includes(userRole)) {
      isAuthorized = true;
      subjectTeacherId = req.body.subjectTeacher;

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

      isAuthorized = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to create a test for the selected subject.",
        );
      }

      subjectTeacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError("You are not authorized to create this test.");
    }

    // Fetch and validate questions
    const questionDocs = await Question.find({ _id: { $in: questions } });

    if (questionDocs.length !== questions.length) {
      throw new BadRequestError("Some questions could not be found.");
    }

    // Validate each question
    for (const [index, question] of questionDocs.entries()) {
      const questionSubject = question?.subject;
      const questionClassId = question?.classId;
      const questionTerm = question?.term;

      if (!questionSubject || !questionClassId || !questionTerm) {
        console.error(
          `Invalid question at index ${index}:`,
          JSON.stringify(question, null, 2),
        );
        throw new BadRequestError(
          `Question at index ${
            index + 1
          } is missing subject, classId, or term.`,
        );
      }

      if (
        questionSubject.toString() !== subject.toString() ||
        questionClassId.toString() !== classId.toString() ||
        questionTerm.toString().toLowerCase() !== term.toString().toLowerCase()
      ) {
        console.error(
          `Question mismatch at index ${index}:`,
          JSON.stringify(question, null, 2),
        );
        throw new BadRequestError(
          `Question at index ${
            index + 1
          } does not match this class, term, or subject.`,
        );
      }
    }

    // Fetch and validate class
    const classData = await Class.findById(classId).populate("students");
    if (!classData || !classData.students.length) {
      throw new BadRequestError("Class or students not found.");
    }

    req.body.students = classData.students.map((student) => student._id);
    req.body.submitted = [];

    const test = new Test({
      subjectTeacher: subjectTeacherId,
      classId,
      subject,
      questions,
      date,
      startTime,
      durationTime,
      session,
      term,
    });

    await test.save();

    const populatedTest = await Test.findById(test._id).populate([
      { path: "questions", select: "_id questionType questionText options" },
      { path: "classId", select: "_id className" },
      { path: "subjectTeacher", select: "_id name" },
    ]);

    res.status(StatusCodes.CREATED).json({
      message: "Test created successfully.",
      test: populatedTest,
    });
  } catch (error) {
    console.error("Error creating test:", error);
    next(new BadRequestError(error.message));
  }
};*/

/*export const createTest = async (req, res, next) => {
  try {
    const {
      classId,
      subject,
      questions,
      date,
      startTime,
      durationTime,
      session,
      term,
    } = req.body;

    const { id: userId, role: userRole } = req.user; // Authenticated user ID and role

    // Validate required fields
    if (
      !classId ||
      !subject ||
      !questions ||
      !Array.isArray(questions) ||
      questions.length === 0 ||
      !date ||
      !startTime ||
      !durationTime
    ) {
      throw new BadRequestError("All required fields must be provided.");
    }

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

      // Validate that the subjectTeacher exists and is valid
      const teacher = await Staff.findById(subjectTeacherId).populate([
        {
          path: "subjects",
          select: "_id subjectName",
        },
      ]);
      if (!teacher) {
        throw new NotFoundError("Provided subjectTeacher not found.");
      }

      console.log("teacher-subjects: ", teacher.subjects);
      console.log("subject: ", subject);

      console.log("subjectTeacherId: ", subjectTeacherId);

      const isAssignedSubject = teacher.subjects.some(
        (subjectItem) => subjectItem && subjectItem.equals(subject),
      );

      console.log("isAssignedSubject: ", isAssignedSubject);

      if (!isAssignedSubject) {
        throw new BadRequestError(
          "The specified subjectTeacher is not assigned to the selected subject.",
        );
      }
    } else if (userRole === "teacher") {
      // Validate that the teacher is assigned the subject
      const teacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new NotFoundError("Teacher not found.");
      }

      isAuthorized = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to create a test for the selected subject.",
        );
      }

      subjectTeacherId = userId; // Assign the current teacher as the subjectTeacher
    }

    console.log("subjectTeacherId: ", subjectTeacherId);

    if (!isAuthorized) {
      throw new BadRequestError("You are not authorized to create this test.");
    }

    // Fetch and validate questions
    const questionDocs = await Question.find({ _id: { $in: questions } });

    if (questionDocs.length !== questions.length) {
      throw new BadRequestError("Some questions could not be found.");
    }

    for (const [index, question] of questionDocs.entries()) {
      console.log(`Validating question ${index + 1}: `, question);
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

    // Fetch and validate class
    const classData = await Class.findById(classId).populate("students");
    if (!classData || !classData.students.length) {
      throw new BadRequestError("Class or students not found.");
    }

    // Populate students and initialize the submitted array
    req.body.students = classData.students.map((student) => student._id);
    req.body.submitted = []; // Initially an empty array

    // Create the test
    const test = new Test({
      subjectTeacher: subjectTeacherId,
      classId,
      subject,
      questions,
      date,
      startTime,
      durationTime,
      session,
      term,
    });

    await test.save();

    // Populate test data for response
    const populatedTest = await Test.findById(test._id).populate([
      { path: "questions", select: "_id questionType questionText options" },
      { path: "classId", select: "_id className" },
      { path: "subjectTeacher", select: "_id name" },
    ]);

    res.status(StatusCodes.CREATED).json({
      message: "Test created successfully.",
      test: populatedTest,
    });
  } catch (error) {
    console.error("Error creating test:", error);
    next(new BadRequestError(error.message));
  }
};*/

/*export const createTest = async (req, res, next) => {
  try {
    const { classId, subject, questions, date, startTime, durationTime } =
      req.body;

    const userId = req.user.id; // Authenticated user ID
    const userRole = req.user.role; // Authenticated user role

    // Validate required fields
    if (
      !classId ||
      !subject ||
      !questions ||
      !date ||
      !startTime ||
      !durationTime
    ) {
      throw new BadRequestError("All required fields must be provided.");
    }

    let subjectTeacherId;
    let isAuthorized = false;

    if (userRole === "admin" || userRole === "proprietor") {
      isAuthorized = true;
      subjectTeacherId = req.body.subjectTeacher;

      // Ensure 'subjectTeacher' field is provided
      if (!subjectTeacherId) {
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
      // Validate that the teacher is assigned the subject
      const teacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new NotFoundError("Teacher not found.");
      }

      isAuthorized = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to create a test for the selected subject.",
        );
      }

      subjectTeacherId = userId; // Assign the current teacher as the subjectTeacher
    }

    if (!isAuthorized) {
      throw new BadRequestError("You are not authorized to create this test.");
    }

    // Create the test
    const test = new Test({
      subjectTeacher: subjectTeacherId,
      classId,
      subject,
      questions,
      date,
      startTime,
      durationTime,
    });

    await test.save();

    res.status(StatusCodes.CREATED).json({
      message: "Test created successfully.",
      test,
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};*/

// Get all tests
export const getAllTests = async (req, res, next) => {
  try {
    const tests = await Test.find().populate([
      {
        path: "questions",
        select: "_id questionType questionText options files",
      },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "subjectTeacher", select: "_id name" },
      // { path: "students", select: "_id firstName lastName" },
    ]);
    res.status(StatusCodes.OK).json({ count: tests.length, tests });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Get test by ID
export const getTestById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const test = await Test.findById(id).populate([
      {
        path: "questions",
        select: "_id questionType questionText options files",
      },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "subjectTeacher", select: "_id name" },
      // { path: "students", select: "_id firstName lastName" },
    ]);
    if (!test) {
      throw new NotFoundError("Test not found.");
    }
    res.status(StatusCodes.OK).json(test);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Update an test

export const updateTest = async (req, res, next) => {
  try {
    const { id } = req.params; // Test ID from request params
    const userId = req.user.id; // Authenticated user ID
    const userRole = req.user.role; // Authenticated user role

    // Find the test to be updated
    const test = await Test.findById(id).populate("subjectTeacher");
    if (!test) {
      throw new NotFoundError("Test not found.");
    }

    const { subject } = test; // Use subject from the existing test document

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
          "You are not authorized to update the test for the selected subject.",
        );
      }

      subjectTeacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError("You are not authorized to update this test.");
    }

    // Update the test
    // Update the test
    const updatedTest = await Test.findByIdAndUpdate(id, req.body, {
      new: true, // Return the updated document
      runValidators: true, // Validate the update against the schema
    }).populate([
      {
        path: "questions",
        select: "_id questionType questionText options files",
      },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "subjectTeacher", select: "_id name" },
    ]);

    res.status(StatusCodes.OK).json({
      message: "Test updated successfully.",
      updatedTest,
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

/*export const updateTest = async (req, res, next) => {
  try {
    const { id } = req.params; // Test ID from request params
    const userId = req.user.id; // Authenticated user ID
    const userRole = req.user.role; // Authenticated user role

    // Find the test to be updated
    const test = await Test.findById(id).populate("subjectTeacher");
    if (!test) {
      throw new NotFoundError("Test not found.");
    }

    // Authorization check

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

      isAuthorized = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to create a test for the selected subject.",
        );
      }

      subjectTeacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError("You are not authorized to create this test.");
    }

/*    let isAuthorized = false;

    if (userRole === "admin" || userRole === "proprietor") {
      isAuthorized = true;
    } else if (userRole === "teacher") {
      // Teachers can only update their own assigned tests
      isAuthorized = test.subjectTeacher._id.toString() === userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError("You are not authorized to update this test.");
    }


    // Update the test
    const updatedTest = await Test.findByIdAndUpdate(id, req.body, {
      new: true, // Return the updated document
      runValidators: true, // Validate the update against the schema
    });

    res.status(StatusCodes.OK).json({
      message: "Test updated successfully.",
      updatedTest,
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};*/

export const getTestDetailsWithAnswers = async (req, res, next) => {
  try {
    const { id } = req.params; // Test ID

    // Fetch the test and populate the questions
    const test = await Test.findById(id).populate("questions");
    if (!test) {
      throw new Error("Test not found");
    }

    // Fetch answers for each question
    const questionsWithAnswers = await Promise.all(
      test.questions.map(async (question) => {
        const answers = await StudentAnswer.find({ question: question._id });
        return {
          question: question,
          answers: answers, // List of answers for this question
        };
      }),
    );

    res.status(StatusCodes.OK).json({
      testDetails: test,
      questionsWithAnswers,
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Delete a test
export const deleteTest = async (req, res) => {
  try {
    const { id } = req.params;

    const test = await Test.findByIdAndDelete(id);

    if (!test) {
      throw new NotFoundError("Test not found.");
    }

    res.status(StatusCodes.OK).json({ message: "Test deleted successfully." });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};
