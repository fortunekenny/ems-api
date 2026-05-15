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

    // Track response metadata
    let gradeAction = "No grade affected";

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
        // console.log("Deleting grade");
        await Grade.findByIdAndDelete(gradeData._id);
        gradeAction = "Grade deleted";
      }
    }

    // Delete the StudentAnswer document
    await StudentAnswer.findByIdAndDelete(id);

    res
      .status(StatusCodes.OK)
      .json({
        message: "Student answer deleted successfully.",
        gradeAction
      });
  } catch (error) {
    console.log("Error deleting student answer:", error);
    next(new BadRequestError(error.message));
  }
};


export const downloadStudentAnswers = async (req, res, next) => {
  try {
    const { id } = req.params;

    const studentAnswer = await StudentAnswer.findById(id).populate([
      { path: "answers.questionId", select: "questionText" },
      { path: "classId", select: "className" },
      { path: "subject", select: "subjectName" },
      { path: "student", select: "_id firstName middleName lastName" },
    ]);

    if (!studentAnswer) {
      return next(new Error("Student answer not found."));
    }

    const doc = new PDFDocument({ margin: 50 });

    const fileName = `${studentAnswer.student.firstName}_${studentAnswer.student.lastName}_${studentAnswer.subject.subjectName}_${studentAnswer.evaluationType}.pdf`;

    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${fileName}"`);

    doc.pipe(res);

    // Color palette
    const colors = {
      primary: "#2563eb",
      secondary: "#1e40af",
      success: "#16a34a",
      danger: "#dc2626",
      text: "#1f2937",
      textLight: "#6b7280",
      border: "#e5e7eb",
      cardBg: "#f9fafb",
      accent: "#8b5cf6"
    };

    // Utility — Modern section header
    const sectionHeader = (title) => {
      doc.moveDown(0.8);

      const headerY = doc.y;

      // Background bar
      doc
        .rect(40, headerY, 520, 28)
        .fillAndStroke(colors.primary, colors.secondary);

      // Title text
      doc
        .fillColor("#ffffff")
        .font("Helvetica-Bold")
        .fontSize(13)
        .text(title, 55, headerY + 8);

      doc.y = headerY + 28;
      doc.moveDown(1);
    };

    // Utility — Info box
    const infoBox = (label, value) => {
      const startY = doc.y;

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(colors.textLight)
        .text(`${label}:`, { continued: true });

      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(colors.text)
        .text(` ${value}`);

      doc.moveDown(0.3);
    };

    // HEADER WITH SCHOOL BRANDING
    // Top accent bar
    doc
      .rect(0, 0, 612, 8)
      .fillAndStroke(colors.primary, colors.secondary);

    doc.y = 30;

    // School name
    doc
      .font("Helvetica-Bold")
      .fontSize(24)
      .fillColor(colors.primary)
      .text("SHEPHERD NURSERY & PRIMARY SCHOOL", { align: "center" });

    doc.moveDown(0.4);

    doc
      .font("Helvetica-Oblique")
      .fontSize(10)
      .fillColor(colors.textLight)
      .text("Student Evaluation Report", { align: "center" });

    doc.moveDown(0.8);

    // Decorative divider
    const dividerY = doc.y;
    doc
      .moveTo(150, dividerY)
      .lineTo(462, dividerY)
      .strokeColor(colors.primary)
      .lineWidth(2)
      .stroke();

    doc.circle(150, dividerY, 4).fillAndStroke(colors.accent, colors.accent);
    doc.circle(462, dividerY, 4).fillAndStroke(colors.accent, colors.accent);

    doc.moveDown(1.5);

    // STUDENT INFO CARD
    const cardY = doc.y;
    const cardHeight = 110;

    // Shadow
    doc
      .rect(53, cardY + 3, 506, cardHeight)
      .fillOpacity(0.1)
      .fill("#000000")
      .fillOpacity(1);

    // Main card
    doc
      .roundedRect(50, cardY, 506, cardHeight, 8)
      .fillAndStroke(colors.cardBg, colors.border);

    doc.y = cardY + 10;

    sectionHeader("Student Information");

    infoBox(
      "Name",
      `${studentAnswer.student.firstName} ${studentAnswer.student.lastName}`
    );
    infoBox("Class", studentAnswer.classId.className);
    infoBox("Subject", studentAnswer.subject.subjectName);

    doc.y = cardY + cardHeight + 15;

    // EVALUATION DETAILS CARD
    const evalCardY = doc.y;
    const evalHeight = studentAnswer.lessonWeek ? 140 : 125;

    // Shadow
    doc
      .rect(53, evalCardY + 3, 506, evalHeight)
      .fillOpacity(0.1)
      .fill("#000000")
      .fillOpacity(1);

    // Main card
    doc
      .roundedRect(50, evalCardY, 506, evalHeight, 8)
      .fillAndStroke(colors.cardBg, colors.border);

    doc.y = evalCardY + 10;

    sectionHeader("Evaluation Details");

    infoBox("Type", studentAnswer.evaluationType);
    if (studentAnswer.lessonWeek) {
      infoBox("Week", `Week ${studentAnswer.lessonWeek}`);
    }
    infoBox("Term", studentAnswer.term || "N/A");
    infoBox("Session", studentAnswer.session || "N/A");

    doc.y = evalCardY + evalHeight + 20;

    // QUESTIONS SECTION
    sectionHeader("Questions & Answers");

    studentAnswer.answers.forEach((answer, index) => {
      const { questionId, answer: studentAnswerText, files, isCorrect, marksAwarded } = answer;

      // Page guard
      if (doc.y > 650) {
        doc.addPage();
        doc.y = 50;
      }

      const qCardY = doc.y;
      const qCardX = 50;
      const qCardWidth = 506;
      const contentX = qCardX + 60;
      const contentWidth = qCardWidth - 70;

      // Question number badge
      doc
        .roundedRect(qCardX, qCardY, 35, 35, 5)
        .fillAndStroke(colors.primary, colors.secondary);

      doc
        .font("Helvetica-Bold")
        .fontSize(16)
        .fillColor("#ffffff")
        .text(`${index + 1}`, qCardX, qCardY + 10, {
          width: 35,
          align: "center"
        });

      // Calculate heights for proper card sizing
      let contentY = qCardY + 15;

      const questionText = questionId?.questionText || "Question text unavailable";
      const questionHeight = doc.heightOfString(questionText, { width: contentWidth });

      const answerText = studentAnswerText || (files?.length ? "[File Upload]" : "N/A");
      const answerHeight = doc.heightOfString(answerText, { width: contentWidth - 10 });

      const filesHeight = files?.length > 0 ? 20 + (files.length * 15) : 0;

      const totalCardHeight = questionHeight + answerHeight + filesHeight + 90;

      // Question card shadow
      doc
        .roundedRect(qCardX + 43, qCardY + 3, qCardWidth - 40, totalCardHeight, 8)
        .fillOpacity(0.08)
        .fill("#000000")
        .fillOpacity(1);

      // Question card background
      doc
        .roundedRect(qCardX + 45, qCardY, qCardWidth - 40, totalCardHeight, 8)
        .fillAndStroke("#ffffff", colors.border);

      // Question text
      doc.y = contentY;
      doc
        .font("Helvetica-Bold")
        .fontSize(11)
        .fillColor(colors.text)
        .text(questionText, contentX, doc.y, { width: contentWidth });

      doc.moveDown(0.6);

      // Answer section with background
      const answerBoxY = doc.y;
      doc
        .rect(contentX - 5, answerBoxY - 5, contentWidth + 10, answerHeight + 25)
        .fillOpacity(0.5)
        .fill(colors.cardBg)
        .fillOpacity(1);

      doc.y = answerBoxY;
      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(colors.primary)
        .text("Answer:", contentX, doc.y, { continued: false });

      doc.y += 12;
      doc
        .font("Helvetica")
        .fontSize(10)
        .fillColor(colors.text)
        .text(answerText, contentX, doc.y, { width: contentWidth });

      doc.moveDown(0.6);

      // Status and marks section
      const statusY = doc.y;
      const badgeWidth = 85;
      const badgeColor = isCorrect ? colors.success : colors.danger;

      doc
        .roundedRect(contentX, statusY, badgeWidth, 20, 4)
        .fillAndStroke(badgeColor, badgeColor);

      doc
        .font("Helvetica-Bold")
        .fontSize(9)
        .fillColor("#ffffff")
        .text(isCorrect ? "CORRECT" : "INCORRECT", contentX, statusY + 6, {
          width: badgeWidth,
          align: "center"
        });

      doc
        .font("Helvetica-Bold")
        .fontSize(10)
        .fillColor(colors.text)
        .text(`Marks: ${marksAwarded ?? "N/A"}`, contentX + badgeWidth + 15, statusY + 5);

      // Files section
      if (files?.length > 0) {
        doc.y = statusY + 30;
        doc
          .font("Helvetica-Bold")
          .fontSize(9)
          .fillColor(colors.textLight)
          .text("Attachments:", contentX, doc.y);

        doc.moveDown(0.3);
        files.forEach((file, i) => {
          doc
            .font("Helvetica")
            .fontSize(9)
            .fillColor(colors.primary)
            .text(`File ${i + 1}`, contentX + 10, doc.y, {
              link: file.url,
              underline: true,
            });
          doc.moveDown(0.2);
        });
      }

      doc.y = qCardY + totalCardHeight + 15;
    });

    // SUMMARY CARD
    if (doc.y > 680) doc.addPage();

    doc.moveDown(1);

    const summaryY = doc.y;
    const summaryHeight = 120;

    // Summary card shadow
    doc
      .roundedRect(53, summaryY + 3, 506, summaryHeight, 8)
      .fillOpacity(0.1)
      .fill("#000000")
      .fillOpacity(1);

    // Summary card
    doc
      .roundedRect(50, summaryY, 506, summaryHeight, 8)
      .fillAndStroke("#f0f9ff", colors.border);

    doc
      .rect(50, summaryY, 10, summaryHeight)
      .fill(colors.accent);

    doc.y = summaryY + 10;

    sectionHeader("Performance Summary");

    // Content area - center aligned
    const contentStartY = summaryY + 60;

    // Marks display - left side
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(colors.textLight)
      .text("Total Marks Obtained", 80, contentStartY);

    doc
      .font("Helvetica-Bold")
      .fontSize(32)
      .fillColor(colors.primary)
      .text(studentAnswer.markObtained || 0, 80, contentStartY + 20);

    // Vertical divider
    doc
      .moveTo(280, contentStartY - 5)
      .lineTo(280, contentStartY + 55)
      .strokeColor(colors.border)
      .lineWidth(2)
      .stroke();

    // Grade display - right side
    doc
      .font("Helvetica-Bold")
      .fontSize(12)
      .fillColor(colors.textLight)
      .text("Grade Achieved", 320, contentStartY);

    // Grade badge
    doc
      .roundedRect(320, contentStartY + 18, 140, 38, 6)
      .fillAndStroke(colors.accent, colors.accent);

    doc
      .font("Helvetica-Bold")
      .fontSize(22)
      .fillColor("#ffffff")
      .text(studentAnswer.grade || "N/A", 320, contentStartY + 26, {
        width: 140,
        align: "center"
      });

    doc.y = summaryY + summaryHeight + 20;

    // FOOTER
    doc.moveDown(1);

    doc
      .moveTo(50, doc.y)
      .lineTo(556, doc.y)
      .strokeColor(colors.border)
      .lineWidth(1)
      .stroke();

    doc.moveDown(0.5);

    doc
      .font("Helvetica-Oblique")
      .fontSize(9)
      .fillColor(colors.textLight)
      .text(
        `Generated on ${new Date().toLocaleString("en-US", {
          dateStyle: "long",
          timeStyle: "short"
        })}`,
        { align: "center" }
      );

    // Bottom accent bar
    const pageHeight = doc.page.height;
    doc
      .rect(0, pageHeight - 8, 612, 8)
      .fillAndStroke(colors.primary, colors.secondary);

    doc.end();

  } catch (err) {
    console.log("PDF generation failed:", err);
    next(new Error("Failed to generate PDF."));
  }
};