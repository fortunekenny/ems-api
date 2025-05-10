// Create an exam
import { StatusCodes } from "http-status-codes";
import Exam from "../models/ExamModel.js";
import Staff from "../models/StaffModel.js";
import Student from "../models/StudentModel.js";
import Subject from "../models/SubjectModel.js";
import Class from "../models/ClassModel.js";
import Question from "../models/QuestionsModel.js";
import StudentAnswer from "../models/StudentAnswerModel.js"; // Adjust the path as needed
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import InternalServerError from "../errors/internal-server-error.js";

export const createExam = async (req, res, next) => {
  try {
    let {
      classId,
      subject,
      questions,
      students,
      submitted,
      date,
      marksObtainable,
      startTime,
      durationTime,
      term,
      session,
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
      //||
      //!marksObtainable
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
          "You are not authorized to create a exam for the selected subject.",
        );
      }

      subjectTeacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError("You are not authorized to create this exam.");
    }

    const classData = await Class.findById(req.body.classId).populate(
      "students",
    );
    if (!classData || !classData.students.length) {
      throw new BadRequestError("Class or students not found.");
    }

    students = classData.students.map((student) => student._id);
    submitted = [];

    // Create the exam
    const exam = new Exam({
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
      term,
      session,
    });

    await exam.save();

    // Fetch and validate questions
    const questionDocs = await Question.find({ _id: { $in: questions } });

    if (questionDocs.length !== questions.length) {
      throw new BadRequestError("Some questions could not be found.");
    }

    for (const [index, question] of questionDocs.entries()) {
      // Perform validations using saved `exam` fields (e.g., `term`)
      if (
        question.subject.toString() !== exam.subject.toString() ||
        question.classId.toString() !== exam.classId.toString() ||
        question.term.toString().toLowerCase() !==
          exam.term.toString().toLowerCase()
      ) {
        throw new BadRequestError(
          `Question at index ${
            index + 1
          } does not match the class, subject, or term.`,
        );
      }
    }

    const populatedExam = await Exam.findById(exam._id).populate([
      {
        path: "questions",
        select: "_id questionType questionText options files",
      },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "subjectTeacher", select: "_id name" },
    ]);

    res.status(StatusCodes.CREATED).json({
      message: "Exam created successfully.",
      exam: populatedExam,
    });
  } catch (error) {
    console.error("Error creating test:", error);
    next(new BadRequestError(error.message));
  }
};

// Get all exams
export const getExams = async (req, res, next) => {
  try {
    // Define allowed query parameters
    const allowedFilters = [
      "subjectTeacher",
      "subject",
      "evaluationType",
      "classId",
      "term",
      "session",
      "week",
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

    //queryObject["student.name"] = { $regex: name, $options: "i" }; // Case-insensitive search

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
        // evaluationType: 1,
        term: 1,
        session: 1,
        lessonWeek: 1,
        topic: 1,
        createdAt: 1,
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
        // Include other fields from Assignment if needed.
      },
    });

    // Execute the aggregation pipeline
    const exams = await Exam.aggregate(pipeline);

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
    const countResult = await Exam.aggregate(countPipeline);
    const totalExams = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalExams / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalExams,
      numOfPages,
      currentPage: pageNumber,
      exams,
    });
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// Get exam by ID
export const getExamById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findById(id).populate([
      {
        path: "questions",
        select: "_id questionType questionText options files",
      },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "subjectTeacher", select: "_id name" },
    ]);
    if (!exam) {
      throw new NotFoundError("Exam not found.");
    }
    res.status(StatusCodes.OK).json(exam);
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Update an exam
export const updateExam = async (req, res, next) => {
  try {
    const { id } = req.params; // Exam ID from request params
    const { id: userId, role: userRole } = req.user; // Authenticated user ID and role

    // Find the exam to be updated
    const exam = await Exam.findById(id).populate("subjectTeacher");
    if (!exam) {
      throw new NotFoundError("Exam not found.");
    }

    const { subject, questions, classId, term } = exam;

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
      throw new BadRequestError("You are not authorized to update this exam.");
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

    // Update the exam
    const updatedExam = await Exam.findByIdAndUpdate(id, req.body, {
      new: true, // Return the updated document
      runValidators: true, // Validate the update against the schema
    }).populate([
      {
        path: "questions",
        select: "_id questionType questionText options files",
      },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "subjectTeacher", select: "_id firstName" },
    ]);

    res.status(StatusCodes.OK).json({
      message: "Exam updated successfully.",
      updatedExam,
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

export const submitExam = async (req, res, next) => {
  try {
    const { id } = req.params; // Exam ID
    const userId = req.user.id;
    const userRole = req.user.role;

    let studentId = userId; // Default to the authenticated user for students

    if (userRole === "admin" || userRole === "proprietor") {
      studentId = req.body.studentId;

      if (!studentId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'studentId' field must be provided.",
        );
      }

      // Validate the student exists
      const student = await Student.findById(studentId);
      if (!student) {
        throw new NotFoundError("Provided student not found.");
      }
    }

    const exam = await Exam.findById(id);
    if (!exam) throw new NotFoundError("Exam not found.");

    // Check if the student is in the exam's student list for the current term and session
    const isStudentInExam = exam.students.some((examStudent) => {
      return (
        examStudent.student.toString() === studentId.toString() &&
        examStudent.term === exam.term &&
        examStudent.session === exam.session
      );
    });

    if (!isStudentInExam) {
      throw new BadRequestError(
        "The specified student is not part of this exam's student list for the current term and session.",
      );
    }

    // Check if already submitted
    const alreadySubmitted = exam.submitted.find(
      (submission) => submission.student.toString() === studentId,
    );

    if (alreadySubmitted) {
      throw new BadRequestError("This exam has already been submitted.");
    }

    // Add submission
    exam.submitted.push({ student: studentId });

    // Update exam status
    exam.status = "submitted";

    await exam.save();

    res.status(StatusCodes.OK).json({
      message: "Exam submitted successfully.",
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

export const getExamDetailsWithAnswers = async (req, res, next) => {
  try {
    const { id } = req.params; // Exam ID

    // Fetch the exam and populate the questions
    const exam = await Exam.findById(id).populate("questions");
    if (!exam) {
      throw new Error("Exam not found");
    }

    // Fetch answers for each question
    const questionsWithAnswers = await Promise.all(
      exam.questions.map(async (question) => {
        const answers = await StudentAnswer.find({ question: question._id });
        return {
          question: question,
          answers: answers, // List of answers for this question
        };
      }),
    );

    res.status(StatusCodes.OK).json({
      examDetails: exam,
      questionsWithAnswers,
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

/*export const getExamWithAnswers = async (req, res, next) => {
  try {
    const { id } = req.params; // Exam ID
    const studentId = req.user.id; // Current student's ID

    // Fetch the exam with populated questions
    const exam = await Exam.findById(id)
      .populate({
        path: "questions", // Populate questions
        model: "Questions",
      })
      .populate("students", "name email") // Populate students for additional data if needed
      .lean();

    if (!exam) {
      return res.status(404).json({ message: "Exam not found" });
    }

    // Fetch answers for the current student's exam
    const studentAnswers = await StudentAnswer.find({
      student: studentId,
      lessonNote: exam.lessonNote, // Assuming answers link to lesson notes
    }).lean();

    // Map questions with their answers
    const questionsWithAnswers = exam.questions.map((question) => {
      const answer = studentAnswers.find(
        (ans) => ans.question.toString() === question._id.toString(),
      );

      return {
        questionText: question.questionText,
        questionType: question.questionType,
        options: question.options || null,
        correctAnswer: question.correctAnswer || null,
        marks: question.marks,
        studentAnswer: answer ? answer.answer : null, // Answer provided by the student
        isCorrect: answer ? answer.isCorrect : null, // Whether the answer is correct
        marksAwarded: answer ? answer.marksAwarded : 0, // Marks given for this answer
      };
    });

    res.status(200).json({
      examId: exam._id,
      subject: exam.subject,
      classId: exam.classId,
      session: exam.session,
      term: exam.term,
      evaluationType: exam.evaluationType,
      questions: questionsWithAnswers,
    });
  } catch (error) {
    next(error);
  }
};*/

// Delete an exam
export const deleteExam = async (req, res) => {
  try {
    const { id } = req.params;

    const exam = await Exam.findByIdAndDelete(id);

    if (!exam) {
      throw new NotFoundError("Exam not found.");
    }

    res.status(StatusCodes.OK).json({ message: "Exam deleted successfully." });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

/*
export const submitExam = async (req, res, next) => {
  try {
    const { id } = req.params; // Exam ID
    const userId = req.user.id;
    const userRole = req.user.role;

    let studentId = userId; // Default to the authenticated user for students

    if (userRole === "admin" || userRole === "proprietor") {
      studentId = req.body.studentId;

      if (!studentId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'studentId' field must be provided."
        );
      }

      // Validate the student exists
      const student = await Student.findById(studentId);
      if (!student) {
        throw new NotFoundError("Provided student not found.");
      }
    }

    const exam = await Exam.findById(id);
    if (!exam) throw new NotFoundError("Exam not found.");

    // Check if the student is in the exam's student list for the current term and session
    const isStudentInExam = exam.students.some((examStudent) => {
      return (
        examStudent.student.toString() === studentId.toString() &&
        examStudent.term === exam.term &&
        examStudent.session === exam.session
      );
    });

    if (!isStudentInExam) {
      throw new BadRequestError(
        "The specified student is not part of this exam's student list for the current term and session."
      );
    }

    // Check if already submitted
    const alreadySubmitted = exam.submitted.find(
      (submission) => submission.student.toString() === studentId
    );

    if (alreadySubmitted) {
      throw new BadRequestError("This exam has already been submitted.");
    }

    // Add submission
    exam.submitted.push({ student: studentId });

    // Update exam status
    exam.status = "submitted";

    await exam.save();

    res.status(StatusCodes.OK).json({
      message: "Exam submitted successfully.",
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
}; adjust code such that createStudentAnswer controller is initiated for all question in exam. Questions list with the following details student is studentId, subject is exam. Subject, evaluationType is exam.evaluationType, evaluationTypeId is id, question is question._id, answer is exam.answer
*/

/*
Example Payload for Admin/Proprietor
{
  "classId": "class_id_here",
  "subject": "subject_id_here",
  "questions": ["question_id_1", "question_id_2"],
  "date": "2024-11-20",
  "startTime": "10:00 AM",
  "durationTime": 90,
  "session": "2023/2024",
  "term": "First",
  "subjectTeacher": "teacher_id_here"
}
*/

/*
Example Payload for Teacher
The subjectTeacher field is not required for teacher users:
{
  "classId": "class_id_here",
  "subject": "subject_id_here",
  "questions": ["question_id_1", "question_id_2"],
  "date": "2024-11-20",
  "startTime": "10:00 AM",
  "durationTime": 90,
  "session": "2023/2024",
  "term": "First"
}
*/
