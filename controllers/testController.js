// Create an test
import { StatusCodes } from "http-status-codes";
import Test from "../models/TestModel.js";
import Staff from "../models/StaffModel.js";
import Student from "../models/StudentModel.js";
import Subject from "../models/SubjectModel.js";
import StudentAnswer from "../models/StudentAnswerModel.js"; // Adjust the path as needed
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";

export const createTest = async (req, res, next) => {
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
};

// Get all tests
export const getTests = async (req, res, next) => {
  try {
    const tests = await Test.find().populate("questions class subjects");
    res.status(StatusCodes.OK).json(tests);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Get test by ID
export const getTestById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const test = await Test.findById(id).populate("questions class subjects");
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

    // Authorization check
    let isAuthorized = false;

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
};

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
