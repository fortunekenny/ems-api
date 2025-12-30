import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import LessonNote from "../models/LessonNoteModel.js";
import Question from "../models/QuestionsModel.js";
import Staff from "../models/StaffModel.js";
import InternalServerError from "../errors/internal-server-error.js";

// Create a new question
export const createQuestion = async (req, res, next) => {
  try {
    const userId = req.user.id; // Authenticated user ID
    const userRole = req.user.role; // Authenticated user role

    const {
      lessonNote,
      questionText,
      questionType,
      options,
      correctAnswer,
      marks,
      ...rest
    } = req.body;

    // Validate required fields
    if (
      !lessonNote ||
      (!questionText && questionType !== "file-upload") ||
      !questionType ||
      !marks ||
      !correctAnswer
    ) {
      throw new BadRequestError("Please provide all required fields.");
    }

    // Validate options for question types that require them
    if (["multiple-choice", "rank-order"].includes(questionType)) {
      if (!Array.isArray(options) || options.length < 2) {
        throw new BadRequestError(
          "Options must be an array with at least two choices for multiple-choice and rank-order questions.",
        );
      }
    }

    // Ensure correctAnswer is an array
    const correctAnswerArray = Array.isArray(correctAnswer)
      ? correctAnswer
      : [correctAnswer];

    // Validate that lessonNote exists and retrieve related information
    const lessonNoteExists = await LessonNote.findById(lessonNote).populate([
      {
        path: "subject",
        select: "_id subjectName",
      },
    ]);
    // const lessonNoteExists = await LessonNote.findById(lessonNote).populate(
    //   "subject",
    // );

    if (!lessonNoteExists) {
      throw new NotFoundError("LessonNote not found.");
    }

    const subject = lessonNoteExists.subject;

    // const classId = lessonNoteExists.classId;

    // Check if the authenticated user is authorized
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
      const teacher = await Staff.findById(subjectTeacherId).populate({
        path: "teacherRecords.subjects",
        select: "_id subjectName",
      });
      if (!teacher) {
        throw new NotFoundError("Provided subjectTeacher not found.");
      }

      // Flatten all subjects from teacherRecords and normalize IDs for comparison
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
      // Validate that the teacher is assigned the subject
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
          "You are not authorized to create an exam for the selected subject.",
        );
      }

      subjectTeacherId = userId; // Assign the current teacher as the subjectTeacher
    }

    // Set default question data
    const questionData = {
      lessonNote,
      questionText,
      questionType,
      options,
      correctAnswer: correctAnswerArray,
      marks,
      subject,
      classId: lessonNoteExists.classId,
      topic: lessonNoteExists.topic,
      lessonWeek: lessonNoteExists.lessonWeek,
      session: lessonNoteExists.session,
      term: lessonNoteExists.term,
      ...rest,
    };

    // Handle file upload for file-upload question type
    if (questionType === "file-upload" && req.files && req.files.length > 0) {
      // Validate the file types and sizes
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      const filesData = req.files.map((file) => {
        // console.log("Uploading file:", file.originalname); // Log the file name
        // console.log("File MIME type:", file.mimetype); // Log the MIME type

        // Validate each file's mime type and size
        if (!allowedTypes.includes(file.mimetype)) {
          throw new BadRequestError("Invalid file type.");
        }
        if (file.size > 3 * 1024 * 1024) {
          // File size limit: 3MB
          throw new BadRequestError("File size must not exceed 3MB.");
        }

        // Add the file URL to the files array
        return { url: file.path };
      });

      // Add files to the questionData
      questionData.files = filesData;
    }

    // Create the question
    const question = await Question.create(questionData);

    res.status(StatusCodes.CREATED).json({
      message: "Question created successfully",
      question,
    });
  } catch (error) {
    console.log("Error creating question:", error);
    next(new InternalServerError(error.message));
  }
};

/*export const createQuestion = async (req, res) => {
  const {
    lessonNote,
    questionText,
    questionType,
    options,
    correctAnswer,
    marks,
  } = req.body;

  // Validate that required fields are provided
  if (!lessonNote || !questionText || !questionType || !marks) {
    throw new BadRequestError("Please provide all required fields.");
  }

  // Validate that lessonNote exists and retrieve related information
  const lessonNoteExists = await LessonNote.findById(lessonNote).populate(
    "subject",
  );

  if (!lessonNoteExists) {
    throw new NotFoundError("LessonNote not found.");
  }

  // Check if the authenticated user is authorized (must be a subject teacher for the lessonNote, admin, or proprietor)
  const isAuthorized =
    req.user.role === "admin" ||
    req.user.role === "proprietor" ||
    (lessonNoteExists.subject.subjectTeachers &&
      lessonNoteExists.subject.subjectTeachers.includes(req.user.id));

  if (!isAuthorized) {
    return res.status(StatusCodes.FORBIDDEN).json({
      message: "You are not authorized to create questions for this subject.",
    });
  }

  // Set the classId and lessonWeek from the lessonNote
  const questionData = {
    lessonNote,
    questionText,
    questionType,
    options,
    correctAnswer,
    marks,
    subject: lessonNoteExists.subject,
    classId: lessonNoteExists.classId,
    lessonWeek: lessonNoteExists.lessonWeek,
    session: lessonNoteExists.session,
    term: lessonNoteExists.term,
  };

  // Create the question
  const question = await Question.create(questionData);
  res.status(StatusCodes.CREATED).json({ question });
};*/

export const getAllQuestions = async (req, res, next) => {
  try {
    const allowedFilters = [
      "subjectTeacher",
      "subject",
      "classId",
      "term",
      "session",
      "lessonWeek",
      "topic",
      "questionType",
      "marks",
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
      lessonWeek,
      topic,
      questionType,
      marks,
      sort,
      page,
      limit,
    } = req.query;

    // Build an initial match stage for fields stored directly on Assignment
    const matchStage = {};

    if (term) matchStage.term = { $regex: term, $options: "i" };
    if (session) matchStage.session = session;
    if (lessonWeek) matchStage.lessonWeek = lessonWeek;
    if (marks) matchStage.marks = marks;
    if (topic) matchStage.topic = { $regex: topic, $options: "i" };
    if (questionType)
      matchStage.questionType = { $regex: questionType, $options: "i" };

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
        lessonWeek: 1,
        topic: 1,
        subTopic: 1,
        marks: 1,
        questionType: 1,
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
    const questions = await Question.aggregate(pipeline);

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
    const countResult = await Question.aggregate(countPipeline);
    const totalQuestions = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalQuestions / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalQuestions,
      numOfPages,
      currentPage: pageNumber,
      questions,
    });
  } catch (error) {
    console.error("Error getting questions:", error);
    next(new InternalServerError(error.message));
  }
};

// Get all questions for a specific lesson note
export const getQuestionsByLessonNote = async (req, res, next) => {
  try {
    const { lessonNoteId } = req.params;

    const questions = await Question.find({
      lessonNote: lessonNoteId,
    }).populate([
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
        select: "_id firstName lastName",
      },
      {
        path: "lessonNote",
        select: "_id lessonweek lessonPeriod",
      },
    ]);
    if (questions.length === 0) {
      throw new NotFoundError("No questions found for this lesson note.");
    }

    res.status(StatusCodes.OK).json({ questions });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

// Get a specific question by ID
export const getQuestionById = async (req, res, next) => {
  try {
    const { id } = req.params;

    const question = await Question.findById(id)
      .populate({
        path: "classId",
        select: "_id className",
      })
      .populate({
        path: "subject",
        select: "_id subjectName",
      })
      .populate({
        path: "subjectTeacher",
        select: "_id firstName lastName",
      })
      .populate({
        path: "lessonNote",
        select: "_id lessonweek lessonPeriod",
      });
    if (!question) {
      throw new NotFoundError("Question not found.");
    }

    res.status(StatusCodes.OK).json({ ...question.toObject() });
  } catch (error) {
    console.log("Error fetching question by ID:", error);
    next(new InternalServerError(error.message));
  }
};

// Update a question by ID
export const updateQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { questionType, subject: bodySubject, ...rest } = req.body;

    const userId = req.user.id; // Authenticated user ID
    const userRole = req.user.role; // Authenticated user role

    let subjectTeacherId;
    let isAuthorized = false;

    // Fetch the question along with its subject
    const question = await Question.findById(id);

    if (!question) {
      throw new NotFoundError("Question not found.");
    }

    // Extract the subject from the question
    const subject = question.subject;

    // console.log("subject: ", subject);
    // console.log("subject's teacher: ", subject);

    if (!subject) {
      throw new BadRequestError(
        "Subject is not associated with this question.",
      );
    }

    // Check if the authenticated user is authorized (must be a subject teacher for the lessonNote, admin, or proprietor)
    if (userRole === "admin" || userRole === "proprietor") {
      isAuthorized = true;
      subjectTeacherId = req.body.subjectTeacher;

      // Ensure 'subjectTeacher' field is provided
      if (!subjectTeacherId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'subjectTeacher' field must be provided.",
        );
      }

      // if (!mongoose.Types.ObjectId.isValid(subjectTeacherId)) {
      //   throw new BadRequestError("Invalid subjectTeacher ID format.");
      // }

      // Validate that the subjectTeacher exists and is valid
      const teacher = await Staff.findById(subjectTeacherId).populate({
        path: "teacherRecords.subjects",
        select: "_id subjectName",
      });
      if (!teacher) {
        throw new NotFoundError("Provided subjectTeacher not found.");
      }

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
      // Validate that the teacher is assigned the subject
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
          "You are not authorized to update a question for the selected subject.",
        );
      }

      subjectTeacherId = userId; // Assign the current teacher as the subjectTeacher
    }

    // Validate options for question types that require them (on update)
    if (
      questionType &&
      ["multiple-choice", "rank-order"].includes(questionType)
    ) {
      if (!Array.isArray(req.body.options) || req.body.options.length < 2) {
        throw new BadRequestError(
          "Options must be an array with at least two choices for multiple-choice and rank-order questions.",
        );
      }
    }

    // Ensure correctAnswer is an array if provided
    if (req.body.correctAnswer && !Array.isArray(req.body.correctAnswer)) {
      req.body.correctAnswer = [req.body.correctAnswer];
    }

    // Prepare update data
    const updateData = { ...rest };

    // Handle file uploads for "file-upload" type
    if (questionType === "file-upload" && req.files) {
      const allowedTypes = [
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      ];

      // Process and validate each file
      const uploadedFiles = req.files.map((file) => {
        const { path: fileUrl, mimetype, size } = file;

        if (!allowedTypes.includes(mimetype)) {
          throw new BadRequestError(
            `Invalid file type: ${mimetype}. Allowed types are PDF, Word, and Excel files.`,
          );
        }

        if (size > 3 * 1024 * 1024) {
          throw new BadRequestError("File size must not exceed 5MB.");
        }

        return {
          url: fileUrl,
        };
      });

      // Add the files to the update data
      updateData.files = uploadedFiles;
    }

    // Update the question
    const updatedQuestion = await Question.findByIdAndUpdate(id, updateData, {
      new: true,
      runValidators: true,
    });

    res.status(StatusCodes.OK).json({
      message: "Question updated successfully.",
      question: updatedQuestion,
    });
  } catch (error) {
    console.log("Error updating question:", error);
    next(new InternalServerError(error.message));
  }
};

// Update a single option entry (set by index, push new option, or pull by index)
export const updateQuestionOption = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, index, value } = req.body;

    if (!action || !["set", "push", "pull"].includes(action)) {
      throw new BadRequestError(
        "Invalid or missing action. Use 'set', 'push' or 'pull'.",
      );
    }

    const question = await Question.findById(id);
    if (!question) {
      throw new NotFoundError("Question not found.");
    }

    // Authorization: only the subjectTeacher for the question or admin/proprietor can modify options
    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.role;

    if (!userId || !userRole) {
      return next(new BadRequestError("User authentication required."));
    }

    const isOwner = question.subjectTeacher
      ? question.subjectTeacher.toString() === userId.toString()
      : false;

    if (!(isOwner || userRole === "admin" || userRole === "proprietor")) {
      return next(
        new BadRequestError(
          "You are not authorized to modify options for this question.",
        ),
      );
    }

    let updatedQuestion;

    if (action === "set") {
      if (typeof index !== "number" || index < 0) {
        throw new BadRequestError(
          "For 'set' action provide a valid non-negative numeric 'index'.",
        );
      }
      if (typeof value === "undefined") {
        throw new BadRequestError("For 'set' action provide a 'value'.");
      }

      const update = { $set: {} };
      update.$set[`options.${index}`] = value;

      updatedQuestion = await Question.findByIdAndUpdate(id, update, {
        new: true,
        runValidators: true,
      });
    } else if (action === "push") {
      if (typeof value === "undefined") {
        throw new BadRequestError(
          "For 'push' action provide a 'value' to append.",
        );
      }

      updatedQuestion = await Question.findByIdAndUpdate(
        id,
        { $push: { options: value } },
        { new: true, runValidators: true },
      );
    } else if (action === "pull") {
      // For pull we'll support removing by index. Provide 'index' (number).
      if (typeof index !== "number" || index < 0) {
        throw new BadRequestError(
          "For 'pull' action provide a valid non-negative numeric 'index'.",
        );
      }

      // Load the document, remove the index, then save to ensure validators run.
      const doc = await Question.findById(id);
      if (!doc) throw new NotFoundError("Question not found.");

      const opts = Array.isArray(doc.options) ? doc.options.slice() : [];
      if (index >= opts.length) {
        throw new BadRequestError("Index out of range for options array.");
      }

      opts.splice(index, 1);
      doc.options = opts;
      updatedQuestion = await doc.save();
    }

    res.status(StatusCodes.OK).json({
      message: `Option ${action} operation successful.`,
      question: updatedQuestion,
    });
  } catch (error) {
    console.log("Error updating question option:", error);
    next(new InternalServerError(error.message));
  }
};

/*export const updateQuestion = async (req, res) => {
  try {
    const { id } = req.params;

    // Find the question and populate the lessonNote's subject to check authorization
    const question = await Question.findById(id).populate({
      path: "lessonNote",
      populate: {
        path: "subject",
        model: "Subject",
      },
    });

    if (!question) {
      throw new NotFoundError("Question not found.");
    }

    // Check if the authenticated user is authorized (must be a subject teacher for the lessonNote, admin, or proprietor)
    const isAuthorized =
      req.user.role === "admin" ||
      req.user.role === "proprietor" ||
      (question.lessonNote.subject.subjectTeachers &&
        question.lessonNote.subject.subjectTeachers.includes(req.user.id));

    if (!isAuthorized) {
      return res.status(StatusCodes.FORBIDDEN).json({
        message: "You are not authorized to update questions for this subject.",
      });
    }

    // Update the question with new data
    const updatedQuestion = await Question.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    res.status(StatusCodes.OK).json({ question: updatedQuestion });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};*/

// Delete a question by ID
/*export const deleteQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;

    const question = await Question.findByIdAndDelete(id);
    if (!question) {
      throw new NotFoundError("Question not found.");
    }

    res
      .status(StatusCodes.OK)
      .json({ message: "Question deleted successfully." });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};*/

import { v2 as cloudinary } from "cloudinary"; // Import Cloudinary correctly

// Ensure cloudinary is properly initialized
cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

export const deleteQuestion = async (req, res, next) => {
  try {
    const { id } = req.params;

    // Find the question by ID
    const question = await Question.findById(id);
    if (!question) {
      throw new NotFoundError("Question not found.");
    }

    // If questionType is "file-upload", delete associated files from Cloudinary
    if (
      question.questionType === "file-upload" &&
      question.files &&
      question.files.length > 0
    ) {
      const deletePromises = question.files.map(async (file) => {
        // Extract public_id from the URL
        const parts = file.url.split("/upload/")[1].split("/"); // Split after "/upload/"
        parts.shift(); // Remove the first part (version number if present)
        const publicId = decodeURIComponent(parts.join("/").split(".")[0]); // Join folder/filename, exclude extension

        // Determine if the file is a raw resource
        const isRawFile = file.url.includes("/raw/");

        // Delete from Cloudinary
        return cloudinary.uploader.destroy(publicId, {
          resource_type: isRawFile ? "raw" : "image",
        });
      });

      // Wait for all files to be deleted
      const deleteResults = await Promise.all(deletePromises);
    }

    // Delete the question from the database
    await Question.findByIdAndDelete(id);

    res.status(StatusCodes.OK).json({
      message: "Question deleted successfully.",
    });
  } catch (error) {
    console.error("Error deleting question or files:", error);
    next(new InternalServerError(error.message));
  }
};
