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
import InternalServerError from "../errors/internal-server-error.js";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";

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
      subjectTeacher,
      durationTime,
      marksObtainable,
      session,
      term,
    } = req.body;

    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.role;

    // Get term and session from getCurrentTermDetails if not provided
    const termDetails = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // Use provided term/session or fallback to current term details
    if (!term) {
      term = termDetails.term;
    }
    if (!session) {
      session = termDetails.session;
    }

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
      throw new BadRequestError(
        "All required fields (classId, subject, questions, date, startTime, durationTime) must be provided.",
      );
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

      const teacher = await Staff.findById(subjectTeacherId).populate({
        path: "teacherRecords.subjects",
        select: "_id subjectName",
      });
      if (!teacher) {
        throw new NotFoundError("Provided subjectTeacher not found.");
      }

      // Flatten subjects from teacherRecords and normalize IDs
      const teacherSubjects = (teacher.teacherRecords || []).flatMap((tr) =>
        (tr.subjects || []).map((s) =>
          s && s._id ? s._id.toString() : s.toString(),
        ),
      );
      const subjectId =
        subject && subject._id ? subject._id.toString() : subject.toString();

      const isAssignedSubject = teacherSubjects.includes(subjectId);

      if (!isAssignedSubject) {
        throw new BadRequestError(
          "The specified subjectTeacher is not assigned to the selected subject.",
        );
      }
    } else if (userRole === "teacher") {
      const teacher = await Staff.findById(userId).populate({
        path: "teacherRecords.subjects",
        select: "_id subjectName",
      });
      if (!teacher) {
        throw new NotFoundError("Teacher not found.");
      }

      const teacherSubjectsCurrent = (teacher.teacherRecords || []).flatMap(
        (tr) =>
          (tr.subjects || []).map((s) =>
            s && s._id ? s._id.toString() : s.toString(),
          ),
      );
      const subjectIdCurrent =
        subject && subject._id ? subject._id.toString() : subject.toString();

      isAuthorized = teacherSubjectsCurrent.includes(subjectIdCurrent);

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

    // Fetch and validate questions BEFORE saving the test
    const questionDocs = await Question.find({ _id: { $in: questions } });

    if (questionDocs.length !== questions.length) {
      throw new BadRequestError("Some questions could not be found.");
    }

    // Calculate total marks from questions
    let totalQuestionMarks = 0;
    for (const [index, question] of questionDocs.entries()) {
      // Defensive checks for required fields
      if (!question.subject || !question.classId || !question.term) {
        throw new BadRequestError(
          `Question at index ${
            index + 1
          } is missing subject, classId, or term.`,
        );
      }
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
      // Sum up the marks from each question
      totalQuestionMarks += question.marks || 0;
    }

    // Set marksObtainable to the sum of all question marks
    marksObtainable = totalQuestionMarks;

    // Fetch existing tests for the same subject, term, and class
    const existingTests = await Test.find({
      classId,
      subject,
      term,
    });

    // Calculate total marks for existing tests
    const totalMarks = existingTests.reduce(
      (sum, test) => sum + test.marksObtainable,
      0,
    );

    // Validate total marks do not exceed 40
    if (totalMarks + marksObtainable > 40) {
      throw new BadRequestError(
        `The total marks for all tests in this subject and term cannot exceed 40. Current total: ${totalMarks}, adding this test would make it ${
          totalMarks + marksObtainable
        }.`,
      );
    }

    const test = new Test({
      subjectTeacher: subjectTeacherId,
      classId,
      subject,
      questions,
      students,
      submitted,
      marksObtainable,
      date,
      startTime,
      durationTime,
      session,
      term,
    });

    await test.save();

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
    next(new InternalServerError(error.message));
  }
};

// Get all tests
export const getAllTests = async (req, res, next) => {
  try {
    const allowedFilters = [
      "subjectTeacher",
      "subject",
      "classId",
      "term",
      "session",
      "topic",
      "sort",
      "page",
      "limit",
    ];

    // Get provided query keys
    const providedFilters = Object.keys(req.query);

    // Check for unknown parameters (ignore case differences if needed)
    const unknownFilters = providedFilters.filter(
      (key) => !allowedFilters.includes(key),
    );

    if (unknownFilters.length > 0) {
      // Return error if unknown parameters are present
      throw new BadRequestError(
        `Unknown query parameter(s): ${unknownFilters.join(", ")}`,
      );
    }

    const {
      subjectTeacher,
      subject,
      classId,
      term,
      session,
      sort,
      page,
      limit,
    } = req.query;

    // Build an initial match stage for fields stored directly on Assignment
    const matchStage = {};

    if (term) matchStage.term = { $regex: term, $options: "i" };
    if (session) matchStage.session = session;

    const pipeline = [];
    pipeline.push({ $match: matchStage });

    // Lookup to join subjectTeacher data from the "staff" collection
    pipeline.push({
      $lookup: {
        from: "staffs", // collection name for staff (ensure this matches your DB)
        localField: "subjectTeacher",
        foreignField: "_id",
        as: "subjectTeacherData",
      },
    });
    pipeline.push({ $unwind: "$subjectTeacherData" });

    // Lookup to join subject data from the "subjects" collection
    pipeline.push({
      $lookup: {
        from: "subjects",
        localField: "subject",
        foreignField: "_id",
        as: "subjectData",
      },
    });
    pipeline.push({ $unwind: "$subjectData" });

    // Lookup to join class data from the "classes" collection
    pipeline.push({
      $lookup: {
        from: "classes",
        localField: "classId",
        foreignField: "_id",
        as: "classData",
      },
    });
    pipeline.push({ $unwind: "$classData" });

    // Build additional matching criteria based on joined fields.
    // Since subjectTeacher, subject, and classId are references, we match on their joined data:
    const joinMatch = {};

    if (subjectTeacher) {
      const subjectTeacherRegex = {
        $regex: `^${subjectTeacher}$`,
        $options: "i",
      };
      joinMatch.$or = [
        {
          "subjectTeacherData.firstName": subjectTeacherRegex,
        },
        {
          "subjectTeacherData.middleName": subjectTeacherRegex,
        },
        {
          "subjectTeacherData.lastName": subjectTeacherRegex,
        },
      ];
    }

    if (subject) {
      const subjectRegex = { $regex: `^${subject}$`, $options: "i" };
      joinMatch.$or = [
        { "subjectData.subjectName": subjectRegex },
        { "subjectData.subjectCode": subjectRegex },
      ];
    }
    if (classId) {
      joinMatch["classData.className"] = {
        $regex: `^${classId}$`,
        $options: "i",
      };
    }
    if (Object.keys(joinMatch).length > 0) {
      pipeline.push({ $match: joinMatch });
    }

    // Sorting stage: define sort options.
    // Adjust the sort options to suit your requirements.
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "a-z": { "subjectData.subjectName": 1 },
      "z-a": { "subjectData.subjectName": -1 },
    };
    const sortKey = sortOptions[sort] || sortOptions.newest;
    pipeline.push({ $sort: sortKey });

    // Pagination stages: Calculate skip and limit.
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    pipeline.push({ $skip: (pageNumber - 1) * limitNumber });
    pipeline.push({ $limit: limitNumber });

    // Projection stage: structure the output.
    pipeline.push({
      $project: {
        _id: 1,
        term: 1,
        session: 1,
        subjectTeacher: {
          _id: "$subjectTeacherData._id",
          firstName: "$subjectTeacherData.firstName",
          lastName: "$subjectTeacherData.lastName",
        },
        subject: {
          _id: "$subjectData._id",
          subjectName: "$subjectData.subjectName",
          subjectCode: "$subjectData.subjectCode",
        },
        classId: {
          _id: "$classData._id",
          className: "$classData.className",
        },
      },
    });

    // Execute the aggregation pipeline
    const tests = await Test.aggregate(pipeline);

    // Count total matching documents for pagination.
    // We use a similar pipeline without $skip, $limit, $sort, and $project.
    const countPipeline = pipeline.filter(
      (stage) =>
        !(
          "$skip" in stage ||
          "$limit" in stage ||
          "$sort" in stage ||
          "$project" in stage
        ),
    );
    countPipeline.push({ $count: "total" });
    const countResult = await Test.aggregate(countPipeline);
    const totalTests = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalTests / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalTests,
      numOfPages,
      currentPage: pageNumber,
      tests,
    });
  } catch (error) {
    console.error("Error getting tests:", error);
    next(new InternalServerError(error.message));
  }
};

// Get test by ID
export const getTestById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const test = await Test.findById(id)
      .populate({
        path: "questions",
        select: "_id questionType questionText options files",
      })
      .populate({ path: "classId", select: "_id className" })
      .populate({ path: "subject", select: "_id subjectName" })
      .populate({ path: "subjectTeacher", select: "_id name" });
    if (!test) {
      throw new NotFoundError("Test not found.");
    }
    res.status(StatusCodes.OK).json({ ...test.toObject() });
  } catch (error) {
    console.error("Error getting test:", error);
    next(new InternalServerError(error.message));
  }
};

// Update an test

export const updateTest = async (req, res, next) => {
  try {
    const { id } = req.params; // Test ID from request params
    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.role;

    // Find the test to be updated
    const test = await Test.findById(id).populate("subjectTeacher");
    if (!test) {
      throw new NotFoundError("Test not found.");
    }

    const { subject, questions, subjectTeacher, classId, term } = test; // Use subject from the existing test document

    let subjectTeacherId;
    let isAuthorized = false;

    if (["admin", "proprietor"].includes(userRole)) {
      isAuthorized = true;
      // subjectTeacherId = req.body.subjectTeacher;

      // const teacher = await Staff.findById(subjectTeacherId).populate([
      //   { path: "subjects", select: "_id subjectName" },
      // ]);
      // if (!teacher) {
      //   throw new NotFoundError("Provided subjectTeacher not found.");
      // }

      // const isAssignedSubject = teacher.subjects.some(
      //   (subjectItem) => subjectItem && subjectItem.equals(subject),
      // );

      // if (!isAssignedSubject) {
      //   throw new BadRequestError(
      //     "The specified subjectTeacher is not assigned to the selected subject.",
      //   );
      // }
    } else if (userRole === "teacher") {
      const teacher = await Staff.findById(userId).populate({
        path: "teacherRecords.subjects",
        select: "_id subjectName",
      });
      if (!teacher) {
        throw new NotFoundError("Teacher not found.");
      }

      const teacherSubjectsCurrent = (teacher.teacherRecords || []).flatMap(
        (tr) =>
          (tr.subjects || []).map((s) =>
            s && s._id ? s._id.toString() : s.toString(),
          ),
      );
      const subjectIdCurrent =
        subject && subject._id ? subject._id.toString() : subject.toString();

      // Check if the teacher is authorized for this test's subject
      isAuthorized = teacherSubjectsCurrent.includes(subjectIdCurrent);

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to update this test for this subject.",
        );
      }

      subjectTeacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError("You are not authorized to update this test.");
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
    console.error("Error creating test:", error);
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

// Update questions list on a Test (set by index, push question, or pull by index)
export const updateTestQuestionList = async (req, res, next) => {
  try {
    const { id } = req.params; // test id
    const { action, index, value } = req.body;

    if (!action || !["set", "push", "pull"].includes(action)) {
      throw new BadRequestError(
        "Invalid or missing action. Use 'set', 'push' or 'pull'.",
      );
    }

    const test = await Test.findById(id);
    if (!test) throw new NotFoundError("Test not found.");

    // Authorization: subjectTeacher or admin/proprietor
    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole)
      throw new BadRequestError("User authentication required.");

    const isOwner = test.subjectTeacher
      ? test.subjectTeacher.toString() === userId.toString()
      : false;
    if (!(isOwner || userRole === "admin" || userRole === "proprietor")) {
      throw new BadRequestError(
        "You are not authorized to modify questions for this test.",
      );
    }

    let updatedTest;

    if (action === "set") {
      if (typeof index !== "number" || index < 0) {
        throw new BadRequestError(
          "For 'set' action provide a valid non-negative numeric 'index'.",
        );
      }
      if (!value)
        throw new BadRequestError(
          "For 'set' action provide a 'value' (question id).",
        );

      // validate question exists and matches test context
      const q = await Question.findById(value);
      if (!q) throw new NotFoundError("Provided question not found.");
      if (
        q.subject.toString() !== test.subject.toString() ||
        q.classId.toString() !== test.classId.toString() ||
        q.term.toString().toLowerCase() !== test.term.toString().toLowerCase()
      ) {
        throw new BadRequestError(
          "Question does not match test subject, class or term.",
        );
      }

      const update = { $set: {} };
      update.$set[`questions.${index}`] = value;
      updatedTest = await Test.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      }).populate([
        {
          path: "questions",
          select: "_id questionType questionText options files",
        },
        { path: "classId", select: "_id className" },
        { path: "subject", select: "_id subjectName" },
        { path: "subjectTeacher", select: "_id firstName" },
      ]);
    } else if (action === "push") {
      if (!value)
        throw new BadRequestError(
          "For 'push' action provide a 'value' (question id) to append.",
        );

      const q = await Question.findById(value);
      if (!q) throw new NotFoundError("Provided question not found.");
      if (
        q.subject.toString() !== test.subject.toString() ||
        q.classId.toString() !== test.classId.toString() ||
        q.term.toString().toLowerCase() !== test.term.toString().toLowerCase()
      ) {
        throw new BadRequestError(
          "Question does not match test subject, class or term.",
        );
      }

      updatedTest = await Test.findByIdAndUpdate(
        id,
        { $push: { questions: value } },
        { new: true, runValidators: true },
      ).populate([
        {
          path: "questions",
          select: "_id questionType questionText options files",
        },
        { path: "classId", select: "_id className" },
        { path: "subject", select: "_id subjectName" },
        { path: "subjectTeacher", select: "_id firstName" },
      ]);
    } else if (action === "pull") {
      if (typeof index !== "number" || index < 0) {
        throw new BadRequestError(
          "For 'pull' action provide a valid non-negative numeric 'index'.",
        );
      }

      const doc = await Test.findById(id);
      if (!doc) throw new NotFoundError("Test not found.");
      const arr = Array.isArray(doc.questions) ? doc.questions.slice() : [];
      if (index >= arr.length)
        throw new BadRequestError("Index out of range for questions array.");
      arr.splice(index, 1);
      doc.questions = arr;
      updatedTest = await doc.save();
      updatedTest = await Test.findById(updatedTest._id).populate([
        {
          path: "questions",
          select: "_id questionType questionText options files",
        },
        { path: "classId", select: "_id className" },
        { path: "subject", select: "_id subjectName" },
        { path: "subjectTeacher", select: "_id firstName" },
      ]);
    }

    res.status(StatusCodes.OK).json({
      message: `Questions list ${action} operation successful.`,
      test: updatedTest,
    });
  } catch (error) {
    console.error("Error updating test questions:", error);
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
