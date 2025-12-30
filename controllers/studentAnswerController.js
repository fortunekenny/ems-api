import { StatusCodes } from "http-status-codes";
import mongoose from "mongoose";
import PDFDocument from "pdfkit";
import BadRequestError from "../errors/bad-request.js";
import InternalServerError from "../errors/internal-server-error.js";
import NotFoundError from "../errors/not-found.js";
import Assignment from "../models/AssignmentModel.js";
import ClassWork from "../models/ClassWorkModel.js";
import Exam from "../models/ExamModel.js";
import Grade from "../models/GradeModel.js";
import Question from "../models/QuestionsModel.js";
import Student from "../models/StudentModel.js";
import StudentAnswer from "../models/StudentAnswerModel.js";
import Test from "../models/TestModel.js";
import {
  calculateSemanticSimilarity,
  extractTextFromFile,
} from "../utils/textExtractor.js";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";
// import * as tf from "@tensorflow/tfjs";
// import use from "@tensorflow-models/universal-sentence-encoder";

// Create a new student answer

export const createStudentAnswer = async (req, res, next) => {
  // This operation is performed inside a MongoDB transaction so that
  // no partial writes occur if any error happens.
  const mongoSession = await mongoose.startSession();
  try {
    const { id: userId, role: userRole } = req.user;
    const { student, answers, evaluationTypeId } = req.body;

    if (!answers || !evaluationTypeId) {
      throw new BadRequestError(
        "Answers (or file for file-upload) and evaluationTypeId are required.",
      );
    }

    // Auto-populate term and session from getCurrentTermDetails
    const { term, session } = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    let studentId = userId;
    if (["admin", "proprietor"].includes(userRole)) {
      if (!student)
        throw new BadRequestError("Admin must specify a student ID.");
      studentId = mongoose.Types.ObjectId.createFromHexString(student);
    } else {
      studentId = mongoose.Types.ObjectId.createFromHexString(userId);
    }

    // Run all DB reads/writes inside a transaction to ensure atomicity
    let createdStudentAnswerId = null;
    await mongoSession.withTransaction(async () => {
      const evaluationModelMap = { Test, Assignment, ClassWork, Exam };
      let evaluation = null;

      // Find evaluation (use session on queries)
      for (const [key, Model] of Object.entries(evaluationModelMap)) {
        evaluation = await Model.findById(evaluationTypeId)
          .populate("questions")
          .session(mongoSession);
        if (evaluation) break;
      }

      if (!evaluation) throw new NotFoundError(`Evaluation not found.`);

      // Verify evaluation is for the current term and session
      if (evaluation.term !== term || evaluation.session !== session) {
        throw new BadRequestError(
          `Evaluation is not for the current term (${term}) and session (${session}).`,
        );
      }

      const {
        subject,
        classId,
        evaluationType,
        students,
        questions,
        marksObtainable,
      } = evaluation;

      if (!students.some((s) => s.equals(studentId))) {
        throw new BadRequestError(
          `Student is not in the ${evaluationType} list.`,
        );
      }

      if (
        evaluation.submitted.some((submission) =>
          submission.student.equals(studentId),
        )
      ) {
        throw new BadRequestError(
          `You have already submitted this ${evaluationType}.`,
        );
      }

      // Fetch questions using the transaction session
      const questionData = await Question.find({
        _id: { $in: answers.map((answer) => answer.questionId) },
      }).session(mongoSession);

      if (questionData.length !== answers.length) {
        throw new BadRequestError("Some questions could not be found.");
      }

      const evaluationTotalScore = questions.reduce(
        (sum, question) => sum + question.marks,
        0,
      );

      // Process answers (these operations may call external utilities but do not mutate DB)
      const processedAnswers = await Promise.all(
        answers.map(async (answer) => {
          const question = questionData.find((q) =>
            q._id.equals(answer.questionId),
          );
          if (!question)
            throw new BadRequestError("Some questions could not be found.");

          const { questionType, correctAnswer, marks } = question;
          const correctAnswers = Array.isArray(correctAnswer)
            ? correctAnswer
            : [correctAnswer];

          let isCorrect = false;
          let highestSimilarity = 0;

          // Handle file uploads
          let updatedFiles = answer.files || [];
          if (req.files && req.files.length > 0) {
            updatedFiles = req.files.map((file) => {
              const { path: fileUrl, mimetype, size } = file;
              const allowedTypes = [
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              ];
              if (!allowedTypes.includes(mimetype)) {
                throw new BadRequestError(
                  `Invalid file type: ${mimetype}. Allowed types are PDF, Word, and Excel files.`,
                );
              }
              if (size > 3 * 1024 * 1024) {
                throw new BadRequestError("File size must not exceed 3MB.");
              }
              return { url: fileUrl };
            });
          }

          // Ensure files for file-upload questions
          if (questionType === "file-upload" && updatedFiles.length === 0) {
            throw new BadRequestError(
              `Files are required for question ${question._id}.`,
            );
          }

          if (questionType === "file-upload") {
            const fileText = await extractTextFromFile(updatedFiles[0].url);
            for (let correctAns of correctAnswers) {
              const similarity = await calculateSemanticSimilarity(
                fileText,
                correctAns,
              );
              if (similarity >= 0.4) isCorrect = true;
              if (!isNaN(similarity))
                highestSimilarity = Math.max(highestSimilarity, similarity);
            }
            const marksAwarded = Math.max(
              0,
              Math.round((highestSimilarity || 0) * marks),
            );
            return {
              questionId: answer.questionId,
              answer: fileText,
              files: updatedFiles,
              isCorrect,
              marksAwarded,
            };
          } else {
            const studentAnswers = Array.isArray(answer.answer)
              ? answer.answer
              : [answer.answer];
            for (let correctAns of correctAnswers) {
              for (let studentAns of studentAnswers) {
                if (studentAns == null || correctAns == null) continue;
                const studentAnsStr =
                  typeof studentAns === "string"
                    ? studentAns
                    : String(studentAns);
                const correctAnsStr =
                  typeof correctAns === "string"
                    ? correctAns
                    : String(correctAns);
                const isExactMatch =
                  studentAnsStr.trim().toLowerCase() ===
                  correctAnsStr.trim().toLowerCase();
                if (isExactMatch) {
                  isCorrect = true;
                  highestSimilarity = 1;
                  break;
                }
                const similarity = await calculateSemanticSimilarity(
                  studentAnsStr,
                  correctAnsStr,
                );
                if (similarity >= 0.4) isCorrect = true;
                if (!isNaN(similarity))
                  highestSimilarity = Math.max(highestSimilarity, similarity);
              }
            }
            const marksAwarded = Math.max(
              0,
              Math.round((highestSimilarity || 0) * marks),
            );
            return {
              questionId: answer.questionId,
              answer: studentAnswers,
              files: updatedFiles,
              isCorrect,
              marksAwarded,
            };
          }
        }),
      );

      // Calculate totals and grade
      const markObtained = processedAnswers.reduce(
        (sum, answer) => sum + answer.marksAwarded,
        0,
      );
      const total = marksObtainable ? marksObtainable : evaluationTotalScore;
      const grade = (() => {
        if (evaluationType === "Test" || evaluationType === "Exam") {
          const percentage = (markObtained / total) * 100;
          if (percentage < 30) return "F";
          if (percentage < 40) return "E";
          if (percentage < 50) return "D";
          if (percentage < 60) return "C";
          if (percentage < 70) return "B";
          return "A";
        }
        return null;
      })();

      // Create and save StudentAnswer within transaction
      const studentAnswer = new StudentAnswer({
        student: studentId,
        subject: subject,
        evaluationType: evaluationType,
        evaluationTypeId: evaluationTypeId,
        answers: processedAnswers,
        markObtained,
        grade,
        classId,
        term,
        session,
      });
      await studentAnswer.save({ session: mongoSession });
      createdStudentAnswerId = studentAnswer._id;

      // Mark evaluation as submitted and save (within transaction)
      evaluation.submitted.push({ student: studentId });
      await evaluation.save({ session: mongoSession });

      // Update student's academicRecords for the correct term/session/class
      const studentDoc = await Student.findById(studentId).session(
        mongoSession,
      );
      if (studentDoc) {
        const recordIndex = studentDoc.academicRecords.findIndex(
          (rec) =>
            rec.term === evaluation.term &&
            rec.session === evaluation.session &&
            rec.classId?.toString() === classId.toString(),
        );
        if (recordIndex !== -1) {
          if (evaluationType === "Assignment") {
            studentDoc.academicRecords[recordIndex].assignments = [
              ...(studentDoc.academicRecords[recordIndex].assignments || []),
              createdStudentAnswerId,
            ];
          } else if (evaluationType === "ClassWork") {
            studentDoc.academicRecords[recordIndex].classworks = [
              ...(studentDoc.academicRecords[recordIndex].classworks || []),
              createdStudentAnswerId,
            ];
          } else if (evaluationType === "Test") {
            studentDoc.academicRecords[recordIndex].tests = [
              ...(studentDoc.academicRecords[recordIndex].tests || []),
              createdStudentAnswerId,
            ];
          } else if (evaluationType === "Exam") {
            studentDoc.academicRecords[recordIndex].exam =
              createdStudentAnswerId;
          }
          await studentDoc.save({ session: mongoSession });
        }
      }
    });

    // After successful transaction, retrieve populated result and respond
    const populatedStudentAnswer = await StudentAnswer.findById(
      createdStudentAnswerId,
    ).populate([
      { path: "answers.questionId", select: "_id questionText files" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "student", select: "_id firstName middleName lastName" },
    ]);

    res.status(StatusCodes.CREATED).json({
      message: "Answer submitted successfully",
      populatedStudentAnswer,
    });
  } catch (error) {
    console.log("Error submitting student answer:", error);
    // Ensure any transaction is aborted and session ended
    next(new BadRequestError(error.message));
  } finally {
    mongoSession.endSession();
  }
};

// /studentAnswer?student=alex&subject=Mathematics&evaluationType=Test&classId=Grade5&term=first&session=2024/2025&sort=newest&page=1&limit=10

export const getAllStudentsAnswer = async (req, res, next) => {
  try {
    // Define allowed query parameters
    const allowedFilters = [
      "student",
      "subject",
      "evaluationType",
      "classId",
      "term",
      "session",
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
      student, // search term for student names
      subject, // search term for subject name
      evaluationType,
      classId, // search term for class name
      term,
      session,
      sort, // sort criteria (e.g., newest, oldest, a-z, z-a)
      page, // page number for pagination
      limit, // number of records per page
    } = req.query;

    // Build an initial match stage for fields stored directly on StudentAnswer
    const matchStage = {};

    if (evaluationType) matchStage.evaluationType = evaluationType;
    if (term) matchStage.term = term;
    if (session) matchStage.session = session;

    // Start building the aggregation pipeline
    const pipeline = [];
    pipeline.push({ $match: matchStage });

    // Lookup student data from the "students" collection
    pipeline.push({
      $lookup: {
        from: "students",
        localField: "student",
        foreignField: "_id",
        as: "studentData",
      },
    });
    pipeline.push({ $unwind: "$studentData" });

    // Lookup class data from the "classes" collection
    pipeline.push({
      $lookup: {
        from: "classes",
        localField: "classId",
        foreignField: "_id",
        as: "classData",
      },
    });
    pipeline.push({ $unwind: "$classData" });

    // Lookup subject data from the "subjects" collection
    pipeline.push({
      $lookup: {
        from: "subjects",
        localField: "subject",
        foreignField: "_id",
        as: "subjectData",
      },
    });
    pipeline.push({ $unwind: "$subjectData" });

    // Build additional matching criteria based on joined fields
    const joinMatch = {};

    if (student) {
      const studentRegex = {
        $regex: `^${student}$`,
        $options: "i",
      };
      joinMatch.$or = [
        { "studentData.firstName": studentRegex },
        { "studentData.middleName": studentRegex },
        ,
        { "studentData.lastName": studentRegex },
      ];
    }
    if (subject) {
      joinMatch["subjectData.subjectName"] = {
        $regex: `^${subject}$`,
        $options: "i",
      };
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

    // Process the "answers" array:
    // Unwind the answers array to process each element
    pipeline.push({
      $unwind: {
        path: "$answers",
        preserveNullAndEmptyArrays: true,
      },
    });

    // Lookup question data for each answer
    pipeline.push({
      $lookup: {
        from: "questions",
        localField: "answers.questionId",
        foreignField: "_id",
        as: "answers.questionData",
      },
    });
    // Unwind questionData so that we get an object rather than an array
    pipeline.push({
      $unwind: {
        path: "$answers.questionData",
        preserveNullAndEmptyArrays: true,
      },
    });

    // Group back the document to reassemble the answers array
    pipeline.push({
      $group: {
        _id: "$_id",
        answers: { $push: "$answers" },
        evaluationType: { $first: "$evaluationType" },
        term: { $first: "$term" },
        session: { $first: "$session" },
        createdAt: { $first: "$createdAt" },
        studentData: { $first: "$studentData" },
        classData: { $first: "$classData" },
        subjectData: { $first: "$subjectData" },
        // Include other fields if needed
      },
    });

    // Sorting stage: define sort options
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "a-z": { "studentData.firstName": 1 },
      "z-a": { "studentData.firstName": -1 },
    };
    const sortKey = sortOptions[sort] || sortOptions.newest;
    pipeline.push({ $sort: sortKey });

    // Pagination stages: calculate skip and limit
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    pipeline.push({ $skip: (pageNumber - 1) * limitNumber });
    pipeline.push({ $limit: limitNumber });

    // Projection stage: structure the output
    pipeline.push({
      $project: {
        _id: 1,
        evaluationType: 1,
        marksObtained: 1,
        grade: 1,
        term: 1,
        session: 1,
        createdAt: 1,
        studentData: {
          _id: "$studentData._id",
          firstName: "$studentData.firstName",
          middleName: "$studentData.middleName",
          lastName: "$studentData.lastName",
        },
        classData: {
          _id: "$classData._id",
          className: "$classData.className",
        },
        subjectData: {
          _id: "$subjectData._id",
          subjectName: "$subjectData.subjectName",
        },
        answers: {
          // For each answer in the answers array, return only the desired fields from questionData
          $map: {
            input: "$answers",
            as: "ans",
            in: {
              questionId: "$$ans.questionData._id",
              questionText: "$$ans.questionData.questionText",
              files: "$$ans.questionData.files",
              // Optionally, include additional answer fields from $$ans if needed:
              answer: "$$ans.answer",
              isCorrect: "$$ans.isCorrect",
              marksAwarded: "$$ans.marksAwarded",
            },
          },
        },
      },
    });

    // Execute the aggregation pipeline
    const studentAnswers = await StudentAnswer.aggregate(pipeline);

    // For pagination, count total matching documents by replicating the pipeline without $skip, $limit, $sort, $project.
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
    const countResult = await StudentAnswer.aggregate(countPipeline);
    const totalStudentAnswers = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalStudentAnswers / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalStudentAnswers,
      numOfPages,
      currentPage: pageNumber,
      studentAnswers,
    });
  } catch (error) {
    console.error("Error getting student answer:", error);
    next(new InternalServerError(error.message));
  }
};

// Fetch all answers for a specific student and subject
export const getStudentAnswersById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const answer = await StudentAnswer.findById(id).populate([
      /* { path: "answers.questionId", select: "_id questionText files" }, */
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "student", select: "_id firstName middleName lastName" },
    ]);
    if (!answer) {
      throw new NotFoundError("No answers found");
    }

    res.status(StatusCodes.OK).json({ ...answer.toObject() });
  } catch (error) {
    console.error("Error getting student answer by ID:", error);
    next(new InternalServerError(error.message));
  }
};

export const getStudentAnswersByEvaluation = async (req, res, next) => {
  try {
    const { studentId, evaluationTypeId } = req.params; // Extract parameters

    // Validate required parameters
    if (!studentId || !evaluationTypeId) {
      throw new BadRequestError(
        "Both 'studentId' and 'evaluationTypeId' are required.",
      );
    }

    // Fetch student answers with the specified filters
    const studentAnswers = await StudentAnswer.find({
      student: studentId,
      evaluationTypeId: evaluationTypeId,
    })
      .populate("question") // Populate question details
      .populate("subject") // Populate subject details
      // .populate("lessonNote") // Populate lesson note details if needed
      .lean(); // Convert Mongoose documents to plain JavaScript objects

    // Check if answers exist
    if (studentAnswers.length === 0) {
      throw new NotFoundError("No answers found for the specified criteria.");
    }

    // Respond with the data
    res.status(200).json({
      message: "Student answers retrieved successfully.",
      data: studentAnswers,
    });
  } catch (error) {
    next(error);
  }
};

// Update an existing student answer

export const updateStudentAnswer = async (req, res, next) => {
  try {
    const { id } = req.params; // StudentAnswer ID
    const { id: userId, role: userRole } = req.user;
    const { answers } = req.body; // May be provided or not

    // Fetch existing StudentAnswer
    const studentAnswer = await StudentAnswer.findById(id);
    if (!studentAnswer) {
      throw new NotFoundError("Student answer not found.");
    }

    const { evaluationTypeId, evaluationType, student } = studentAnswer;

    // Dynamically get the model based on the evaluationType
    const EvaluationModel = mongoose.model(evaluationType);
    if (!EvaluationModel) {
      throw new NotFoundError(
        `Evaluation model '${evaluationType}' not found.`,
      );
    }

    // Determine the student ID from the token or student field in the document
    let studentId = userId; // Default to logged-in user
    if (["admin", "proprietor"].includes(userRole)) {
      studentId = student;
    }

    let evaluationTotalScore;

    // Validate and fetch evaluation
    const evaluation = await EvaluationModel.findById(
      evaluationTypeId,
    ).populate("questions");
    if (!evaluation) {
      throw new NotFoundError("Evaluation not found.");
    }

    // Validate student participation in the evaluation
    if (!evaluation.students.some((s) => s.equals(studentId))) {
      throw new BadRequestError(
        `Student is not in the ${evaluationType} list.`,
      );
    }

    // Validate answers and process them if provided
    let processedAnswers = studentAnswer.answers; // default: keep existing answers
    if (answers !== undefined) {
      if (!Array.isArray(answers)) {
        throw new BadRequestError("Answers must be provided as an array.");
      }

      // Fetch questions for validation
      const questionData = await Question.find({
        _id: { $in: answers.map((answer) => answer.questionId) },
      });

      if (questionData.length !== answers.length) {
        throw new BadRequestError("Some questions could not be found.");
      }

      // Calculate the total score for the evaluation
      evaluationTotalScore = questionData.reduce(
        (sum, question) => sum + question.marks,
        0,
      );

      processedAnswers = await Promise.all(
        answers.map(async (answer) => {
          const question = questionData.find((q) =>
            q._id.equals(answer.questionId),
          );
          if (!question) {
            throw new BadRequestError("Some questions could not be found.");
          }

          const { questionType, correctAnswer, marks } = question;
          const correctAnswers = Array.isArray(correctAnswer)
            ? correctAnswer
            : [correctAnswer];

          let isCorrect = false;
          let highestSimilarity = 0;
          let updatedFiles = answer.files || [];

          // Handle file uploads for "file-upload" questions
          if (req.files && req.files.length > 0) {
            updatedFiles = req.files.map((file) => {
              const { path: fileUrl, mimetype, size } = file;
              const allowedTypes = [
                "application/pdf",
                "application/msword",
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
                "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
              ];
              if (!allowedTypes.includes(mimetype)) {
                throw new BadRequestError(
                  `Invalid file type: ${mimetype}. Allowed types are PDF, Word, and Excel files.`,
                );
              }
              if (size > 3 * 1024 * 1024) {
                throw new BadRequestError("File size must not exceed 3MB.");
              }
              return { url: fileUrl };
            });
          }

          // Ensure file-upload questions have files
          if (questionType === "file-upload" && updatedFiles.length === 0) {
            throw new BadRequestError(
              `Files are required for question ${question._id}.`,
            );
          }

          if (questionType === "file-upload") {
            // Process file-upload question
            const fileText = await extractTextFromFile(updatedFiles[0].url);
            for (let correctAns of correctAnswers) {
              const similarity = await calculateSemanticSimilarity(
                fileText,
                correctAns,
              );
              if (similarity >= 0.4) {
                isCorrect = true;
              }
              if (!isNaN(similarity)) {
                highestSimilarity = Math.max(highestSimilarity, similarity);
              }
            }
            const marksAwarded = Math.max(
              0,
              Math.round((highestSimilarity || 0) * marks),
            );
            return {
              questionId: answer.questionId,
              answer: fileText, // Extracted text from file
              files: updatedFiles,
              isCorrect,
              marksAwarded,
            };
          } else {
            // Process other question types
            const studentAnswers = Array.isArray(answer.answer)
              ? answer.answer
              : [answer.answer];
            for (let correctAns of correctAnswers) {
              for (let studentAns of studentAnswers) {
                // Coerce answers to strings so numeric answers (e.g. 21) match correctly
                if (studentAns == null || correctAns == null) {
                  continue;
                }
                const studentAnsStr =
                  typeof studentAns === "string"
                    ? studentAns
                    : String(studentAns);
                const correctAnsStr =
                  typeof correctAns === "string"
                    ? correctAns
                    : String(correctAns);

                const isExactMatch =
                  studentAnsStr.trim().toLowerCase() ===
                  correctAnsStr.trim().toLowerCase();
                if (isExactMatch) {
                  isCorrect = true;
                  highestSimilarity = 1;
                  break;
                }
                const similarity = await calculateSemanticSimilarity(
                  studentAnsStr,
                  correctAnsStr,
                );
                if (similarity >= 0.4) {
                  isCorrect = true;
                }
                if (!isNaN(similarity)) {
                  highestSimilarity = Math.max(highestSimilarity, similarity);
                }
              }
            }
            const marksAwarded = Math.max(
              0,
              Math.round((highestSimilarity || 0) * marks),
            );
            return {
              questionId: answer.questionId,
              answer: studentAnswers,
              files: updatedFiles,
              isCorrect,
              marksAwarded,
            };
          }
        }),
      );
    }

    // Calculate overall marks obtained
    const markObtained = processedAnswers.reduce(
      (sum, answer) => sum + answer.marksAwarded,
      0,
    );

    // Calculate grade based on overall percentage
    const grade = (() => {
      const percentage = (markObtained / evaluationTotalScore) * 100;
      if (percentage < 30) return "F";
      if (percentage >= 30 && percentage < 40) return "E";
      if (percentage >= 40 && percentage < 50) return "D";
      if (percentage >= 50 && percentage < 60) return "C";
      if (percentage >= 60 && percentage < 70) return "B";
      return "A";
    })();

    let newStudentId;
    if (req.body.student) {
      newStudentId = new mongoose.Types.ObjectId(req.body.student);
    }
    // Update studentAnswer document with the new processed answers (if provided) and other fields
    Object.assign(studentAnswer, {
      // Only update answers if they are provided
      ...(answers !== undefined && { answers: processedAnswers }),
      evaluationTypeId,
      markObtained,
      grade,
      subject: evaluation.subject,
      classId: evaluation.classId,
      session: evaluation.session,
      term: evaluation.term,
      lessonWeek: evaluation.lessonWeek,
      lessonNote: evaluation.lessonNote,
      student: newStudentId,
    });

    await studentAnswer.save();

    const populatedStudentAnswerUpdate = await StudentAnswer.findById(
      studentAnswer._id,
    ).populate([
      { path: "answers.questionId", select: "_id questionText files" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "student", select: "_id firstName middleName lastName" },
    ]);

    res.status(StatusCodes.OK).json({
      message: "Student answer updated successfully",
      populatedStudentAnswerUpdate,
    });
  } catch (error) {
    console.error("Error updating student answer:", error);
    next(new BadRequestError(error.message));
  }
};

// Delete a student answer
export const deleteStudentAnswer = async (req, res, next) => {
  try {
    const { id } = req.params; // StudentAnswer ID to be deleted

    // Find the StudentAnswer document
    const studentAnswer = await StudentAnswer.findById(id);
    if (!studentAnswer) {
      throw new NotFoundError("Student answer not found.");
    }

    const {
      evaluationTypeId,
      student,
      evaluationType,
      subject,
      classId,
      term,
      session,
    } = studentAnswer;

    // Determine evaluation model dynamically
    const evaluationModelMap = {
      Test,
      Assignment,
      ClassWork,
      Exam,
    };
    const evaluationModel = evaluationModelMap[evaluationType];
    if (!evaluationModel) {
      throw new BadRequestError("Invalid evaluation type.");
    }

    // Find the associated evaluation document
    const evaluation = await evaluationModel.findById(evaluationTypeId);
    if (!evaluation) {
      throw new NotFoundError("Evaluation not found.");
    }

    // Remove the studentAnswer ID from the submitted list
    evaluation.submitted = evaluation.submitted.filter(
      (submission) => submission.student.toString() !== student.toString(),
    );
    await evaluation.save();

    // Clean up Grade data if this is an Exam or Test
    if (evaluationType === "Exam" || evaluationType === "Test") {
      const gradeData = await Grade.findOne({
        student: student,
        subject: subject,
        classId: classId,
        term: term,
        session: session,
      });

      if (gradeData) {
        if (evaluationType === "Exam") {
          gradeData.exam = null;
          gradeData.examScore = 0;
        } else if (evaluationType === "Test") {
          // Remove this test from the tests array
          gradeData.tests = gradeData.tests.filter(
            (testId) => testId.toString() !== evaluationTypeId.toString(),
          );
          // Recalculate testsScore
          gradeData.testsScore = gradeData.tests.reduce(
            (sum, testId) =>
              sum + (gradeData.testsScore?.[testId.toString()] || 0),
            0,
          );
        }
        await gradeData.save();
      }
    }

    // Delete the StudentAnswer document
    await StudentAnswer.findByIdAndDelete(id);

    res
      .status(StatusCodes.OK)
      .json({ message: "Student answer deleted successfully." });
  } catch (error) {
    console.error("Error deleting student answer:", error);
    next(new BadRequestError(error.message));
  }
};

export const downloadStudentAnswers = async (req, res, next) => {
  try {
    const { id } = req.params; // StudentAnswer ID

    // Fetch the StudentAnswer from the database
    const studentAnswer = await StudentAnswer.findById(id).populate([
      { path: "answers.questionId", select: "questionText" },
      { path: "classId", select: "className" },
      { path: "subject", select: "subjectName" },
      { path: "student", select: "_id firstName middleName lastName" },
      // { path: "student", select: "name" },
    ]);

    if (!studentAnswer) {
      return next(new Error("Student answer not found."));
    }

    // Create a new PDF document
    const doc = new PDFDocument();

    // Set response headers for PDF download
    const fileName = `${studentAnswer.student.firstName.replace(
      /[^a-zA-Z0-9]/g,
      "_",
    )}_${studentAnswer.student.lastName.replace(
      /[^a-zA-Z0-9]/g,
      "_",
    )}_${studentAnswer.subject.subjectName.replace(/[^a-zA-Z0-9]/g, "_")}_${
      studentAnswer.evaluationType
    }${
      studentAnswer.evaluationType === "Assignment" ||
      studentAnswer.evaluationType === "ClassWork"
        ? `_Week_${studentAnswer.lessonWeek}`
        : ""
    }.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    // Pipe the PDF to the response
    doc.pipe(res);

    // Add content to the PDF
    doc
      .fontSize(20)
      .text(
        `${studentAnswer.student.firstName} ${
          studentAnswer.student.lastName
        }'s ${studentAnswer.subject.subjectName} ${
          studentAnswer.evaluationType
        }${
          studentAnswer.evaluationType === "Assignment" ||
          studentAnswer.evaluationType === "Classwork"
            ? ` Week_${studentAnswer.lessonWeek}`
            : ""
        }`,
        { align: "center" },
      )
      .moveDown();

    doc
      .fontSize(15)
      .text(
        `Student Name: ${studentAnswer.student.firstName} ${studentAnswer.student.middleName} ${studentAnswer.student.lastName}`,
      );
    doc.text(`Class: ${studentAnswer.classId.className}`);
    doc.text(`Subject: ${studentAnswer.subject.subjectName}`);
    doc.text(`Evaluation Type: ${studentAnswer.evaluationType}`);
    doc.text(
      `${
        studentAnswer.evaluationType === "Assignment" ||
        studentAnswer.evaluationType === "Classwork"
          ? `Week: ${studentAnswer.lessonWeek}`
          : ""
      }`,
    );

    doc.moveDown();

    doc.text("Questions And Answers:", { underline: true });
    studentAnswer.answers.forEach((answer, index) => {
      const {
        questionId,
        answer: studentAnswerText,
        files,
        isCorrect,
        marksAwarded,
      } = answer;

      doc.moveDown();
      doc
        // .font("system-ui")
        .text(`Question ${index + 1}: ${questionId.questionText}`);
      doc.text(
        `Student Answer: ${studentAnswerText || "N/A"} || ${
          isCorrect ? "Correct" : "Incorrect"
        }`,
      );
      // doc.text(`${isCorrect ? "Correct ✔" : "Wrong ✖"}`);
      doc.text(`Marks: ${marksAwarded}`);
      if (files.length > 0) {
        doc.text("Files:");
        files.forEach((file, fileIndex) => {
          doc.text(`  ${fileIndex + 1}. ${file.url}`);
        });
      }
    });

    // Finalize the PDF and end the stream
    doc.end();
  } catch (error) {
    console.error("Error generating PDF:", error);
    next(new Error("Failed to generate PDF."));
  }
};
