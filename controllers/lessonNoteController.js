// controllers/lessonNoteController.js
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import InternalServerError from "../errors/internal-server-error.js";
import NotFoundError from "../errors/not-found.js";
import Assignment from "../models/AssignmentModel.js";
import Classwork from "../models/ClassWorkModel.js";
import LessonNote from "../models/LessonNoteModel.js";
import Staff from "../models/StaffModel.js";
import {
  getCurrentTermDetails,
  holidayDurationForEachTerm,
  startTermGenerationDate,
} from "../utils/termGenerator.js";
import {
  createNotificationForLessonNote,
  sendBulkNotifications,
} from "./notificationController.js";
import Class from "../models/ClassModel.js";
import { ObjectId } from "mongoose";
import mongoose from "mongoose";

// Create a new lesson note
export const createLessonNote = async (req, res, next) => {
  try {
    const { assignment, evaluation, subject } = req.body;
    const { id: userId, role: userRole } = req.user; // Authenticated user ID and role

    // Get current term details
    const {
      startDate: termStartDate,
      isHoliday,
      nextTermStartDate,
      weekOfTerm: currentWeekOfTerm,
    } = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // Holiday constraint: If in holiday, lesson notes can only be created from one week before the new term starts onward
    /*if (isHoliday) {
      const oneWeekBeforeNextTerm = new Date(nextTermStartDate);
      oneWeekBeforeNextTerm.setDate(oneWeekBeforeNextTerm.getDate() - 7);

      if (new Date(lessonDate) < oneWeekBeforeNextTerm) {
        throw new BadRequestError(
          `During holidays, lesson notes can only be scheduled starting one week before the next term starts (${oneWeekBeforeNextTerm.toDateString()}).`,
        );
      }
    }*/

    // Lesson notes for the current week cannot be created in the current week itself
    /*if (lessonWeek === currentWeekOfTerm) {
      throw new BadRequestError(
        `Lesson notes for the current week (${currentWeekOfTerm}) cannot be created in the same week. This should be in the previous week.`,
      );
    }*/

    // Lesson notes for future weeks (e.g., Week 5, Week 6, etc.) can be created from the current week onward
    /*if (lessonWeek <= currentWeekOfTerm) {
      throw new BadRequestError(
        `Lesson notes can only be created for future weeks (${
          currentWeekOfTerm + 1
        } and beyond).`,
      );
    }*/

    // Check authorization
    let teacherId;
    let isAuthorized = false;
    // let teacherDoc;

    if (["admin", "proprietor"].includes(userRole)) {
      isAuthorized = true;
      teacherId = req.body.teacher;

      // Ensure 'subjectTeacher' field is provided
      if (!teacherId) {
        throw new BadRequestError(
          "For admin or proprietor, the 'teacher' field must be provided.",
        );
      }

      const teacher = await Staff.findById(teacherId).populate([
        { path: "subjects", select: "_id subjectName" },
      ]);
      if (!teacher) {
        throw new NotFoundError("Provided teacher not found.");
      }

      const isAssignedSubject = teacher.subjects.some(
        (subjectItem) => subjectItem && subjectItem.equals(subject),
      );

      if (!isAssignedSubject) {
        throw new BadRequestError(
          "The specified teacher is not assigned to the selected subject.",
        );
      }
    } else if (userRole === "teacher") {
      // For teachers, validate that the requested subject is assigned to them
      const teacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new NotFoundError("Teacher not found.");
      }

      isAuthorized = teacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to create lesson note for this subject.",
        );
      }

      teacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to create this lesson note.",
      );
    }

    const updater = await Staff.findById(req.user.userId);
    if (!updater) {
      throw new BadRequestError("Updater not found.");
    }

    const classData = await Class.findOne({
      _id: req.body.classId,
      // term: req.body.term,
      // session: req.body.session,
    }).populate("subjects", "subjectName");
    if (!classData) {
      throw new NotFoundError("Class not found.");
    }
    // Find subject data from the class's subjects.
    const subjectData = classData.subjects.find(
      (subj) => subj._id.toString() === subject.toString(),
    );
    if (!subjectData) {
      throw new NotFoundError("Subject data not found in class.");
    }

    // Create and save the new lesson note
    const lessonNote = new LessonNote(req.body);
    await lessonNote.save();

    const notificationTitle = `New Lesson Note: Week ${lessonNote.lessonWeek}`;

    const notificationMessage = `A new lesson note for week ${lessonNote.lessonWeek} has been submitted by ${updater.firstName} ${updater.lastName} for ${subjectData.subjectName} on the topic: ${lessonNote.topic}, subtopic: ${lessonNote.subTopic}. Please check your portal for details.`;

    const staffs = await Staff.find({
      role: { $in: ["admin", "proprietor"] },
      status: "active",
    }).select("_id");

    // Prepare recipients
    const recipients = [
      ...staffs.map((staff) => ({
        recipientId: staff._id,
        recipientModel: "Staff",
      })),
      // ...students.map((student) => ({ recipientId: student._id, recipientModel: "Student" })),
    ];

    /*     await createNotificationForLessonNote(
      lessonNote,
      req.user.userId,
      notificationTitle,
      notificationMessage,
    ); */

    await sendBulkNotifications({
      sender: req.user.userId,
      title: notificationTitle,
      message: notificationMessage,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        lessonNoteId: lessonNote._id,
      },
      recipients: recipients,
    });

    const populatedLessonNote = await LessonNote.findById(
      lessonNote._id,
    ).populate([
      { path: "teacher", select: "_id name" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      {
        path: "evaluation",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionText questionType options",
        },
      },
      {
        path: "assignment",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionType questionText options files",
        },
      },
    ]);

    res.status(StatusCodes.CREATED).json({
      message: "Lesson Note submitted successfully",
      populatedLessonNote,
    });
  } catch (error) {
    next(
      error instanceof BadRequestError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

// Get all lesson notes
export const getAllLessonNotes = async (req, res, next) => {
  try {
    const allowedFilters = [
      "teacher",
      "subject",
      "classId",
      "term",
      "session",
      "lessonWeek",
      "topic",
      "approved",
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
      teacher,
      subject,
      classId,
      term,
      session,
      lessonWeek,
      topic,
      approved,
      sort,
      page,
      limit,
    } = req.query;

    // Build an initial match stage for fields stored directly on Assignment
    const matchStage = {};

    if (term) matchStage.term = { $regex: term, $options: "i" };
    if (session) matchStage.session = session;
    if (lessonWeek) matchStage.lessonWeek = lessonWeek;
    if (topic) matchStage.topic = { $regex: topic, $options: "i" };
    if (approved) matchStage.approved = { $regex: approved, $options: "i" };

    const pipeline = [];
    pipeline.push({ $match: matchStage });

    // Lookup to join teacher data from the "staff" collection
    pipeline.push({
      $lookup: {
        from: "staffs", // collection name for staff (ensure this matches your DB)
        localField: "teacher",
        foreignField: "_id",
        as: "teacherData",
      },
    });
    pipeline.push({ $unwind: "$teacherData" });

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
    // Since teacher, subject, and classId are references, we match on their joined data:
    const joinMatch = {};

    if (teacher) {
      const teacherRegex = {
        $regex: `^${teacher}$`,
        $options: "i",
      };
      joinMatch.$or = [
        {
          "teacherData.firstName": teacherRegex,
        },
        {
          "teacherData.middleName": teacherRegex,
        },
        {
          "teacherData.lastName": teacherRegex,
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
        approved: 1,
        createdAt: 1,
        teacher: {
          _id: "$teacherData._id",
          firstName: "$teacherData.firstName",
          lastName: "$teacherData.lastName",
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
    const lessonNotes = await LessonNote.aggregate(pipeline);

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
    const countResult = await LessonNote.aggregate(countPipeline);
    const totalLessonNotes = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalLessonNotes / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalLessonNotes,
      numOfPages,
      currentPage: pageNumber,
      lessonNotes,
    });
  } catch (error) {
    console.error("Error getting lesson notes:", error);
    next(new InternalServerError(error.message));
  }
};

// Get a single lesson note by ID
export const getLessonNoteById = async (req, res, next) => {
  try {
    const lessonNote = await LessonNote.findById(req.params.id).populate([
      {
        path: "teacher",
        select: "_id firstName",
      },
      {
        path: "classId",
        select: "_id className",
      },
      {
        path: "subject",
        select: "_id subjectName subjectCode",
      },
    ]);
    if (!lessonNote) {
      throw new NotFoundError("Lesson note not found");
    }
    res.status(StatusCodes.OK).json(lessonNote);
  } catch (error) {
    next(
      error instanceof NotFoundError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

// Get lesson notes by subject
export const getLessonNoteBySubject = async (req, res, next) => {
  try {
    const { subjectId } = req.params;
    const lessonNotes = await LessonNote.find({ subject: subjectId }).populate([
      {
        path: "teacher",
        select: "_id firstName",
      },
      {
        path: "classId",
        select: "_id className",
      },
      {
        path: "subject",
        select: "_id subjectName subjectCode",
      },
    ]);
    if (lessonNotes.length === 0) {
      throw new NotFoundError(
        "No lesson notes found for the specified subject",
      );
    }
    res.status(StatusCodes.OK).json(lessonNotes);
  } catch (error) {
    next(
      error instanceof NotFoundError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

// Get lesson notes by class
export const getLessonNoteByClass = async (req, res, next) => {
  try {
    const { classId } = req.params;
    const lessonNotes = await LessonNote.find({ classId }).populate([
      {
        path: "teacher",
        select: "_id firstName",
      },
      {
        path: "classId",
        select: "_id className",
      },
      {
        path: "subject",
        select: "_id subjectName subjectCode",
      },
    ]);
    if (lessonNotes.length === 0) {
      throw new NotFoundError("No lesson notes found for the specified class");
    }
    res.status(StatusCodes.OK).json(lessonNotes);
  } catch (error) {
    next(
      error instanceof NotFoundError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

// Get lesson notes by status
export const getLessonNoteByApprovalStatus = async (req, res, next) => {
  try {
    const { approved } = req.params;

    // Validate and convert the approved parameter to a boolean
    if (approved !== "true" && approved !== "false") {
      throw new BadRequestError(
        "Invalid approved status. Use 'true' or 'false'.",
      );
    }
    const isApproved = approved === "true";

    // Find lesson notes based on the approved status
    const lessonNotes = await LessonNote.find({
      approved: isApproved,
    }).populate([
      {
        path: "teacher",
        select: "_id firstName",
      },
      {
        path: "classId",
        select: "_id className",
      },
      {
        path: "subject",
        select: "_id subjectName subjectCode",
      },
    ]);

    // Handle the case when no lesson notes are found
    if (lessonNotes.length === 0) {
      const statusMessage = isApproved ? "approved" : "unapproved";
      throw new NotFoundError(`No lesson notes are ${statusMessage}.`);
    }

    // Respond with the list of lesson notes
    res.status(StatusCodes.OK).json(lessonNotes);
  } catch (error) {
    next(
      error instanceof NotFoundError
        ? error
        : new BadRequestError(error.message),
    );
  }
};

// Get lesson notes by week
export const getLessonNoteByWeek = async (req, res, next) => {
  try {
    const { week } = req.params;
    const lessonNotes = await LessonNote.find({ lessonWeek: week }).populate([
      {
        path: "teacher",
        select: "_id firstName",
      },
      {
        path: "classId",
        select: "_id className",
      },
      {
        path: "subject",
        select: "_id subjectName subjectCode",
      },
    ]);
    if (lessonNotes.length === 0) {
      throw new NotFoundError(`No lesson notes found for week ${week}`);
    }
    res.status(StatusCodes.OK).json(lessonNotes);
  } catch (error) {
    console.log("Error getting lesson notes by week:", error);
    next(new InternalServerError(error.message));
  }
};

// Update a lesson note

/*export const updateLessonNote = async (req, res, next) => {
  try {
    const { id } = req.params; // Lesson note ID from request params
    const { id: userId, role: userRole } = req.user; // Authenticated user details

    // Fetch the existing lesson note to validate authorization
    const lessonNote = await LessonNote.findById(id).populate("teacher");
    if (!lessonNote) {
      throw new NotFoundError("Lesson note not found.");
    }

    const { teacher, evaluation, assignment } = lessonNote;

    // Authorization check
    if (
      !["admin", "proprietor"].includes(userRole) &&
      teacher.toString() !== userId
    ) {
      throw new BadRequestError(
        "You are not authorized to update this lesson note.",
      );
    }

    // Populate assignment and evaluation
    const assignmentId = assignment?.toString();
    const evaluationId = evaluation?.toString();

    const populatedAssignment = assignmentId
      ? await Assignment.findById(assignmentId).populate("questions")
      : null;
    if (assignmentId && !populatedAssignment) {
      throw new NotFoundError("Assignment not found.");
    }

    const populatedEvaluation = evaluationId
      ? await Classwork.findById(evaluationId).populate("questions")
      : null;
    if (evaluationId && !populatedEvaluation) {
      throw new NotFoundError("Evaluation not found.");
    }

    // Update lesson note
    const updatedLessonNote = await LessonNote.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    // Fully populate the updated lesson note
    const populatedLessonNoteUpdate = await LessonNote.findById(
      updatedLessonNote._id,
    ).populate([
      { path: "teacher", select: "_id name" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      {
        path: "evaluation",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionText questionType options",
        },
      },
      {
        path: "assignment",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionType questionText options files",
        },
      },
    ]);

    res.status(StatusCodes.OK).json({
      message: "Lesson Note updated successfully",
      populatedLessonNoteUpdate,
    });
  } catch (error) {
    if (error.name === "CastError") {
      next(new BadRequestError("Invalid lesson note ID."));
    } else {
      next(
        error instanceof NotFoundError || error instanceof BadRequestError
          ? error
          : new BadRequestError(error.message),
      );
    }
  }
};*/

/*export const updateLessonNote = async (req, res, next) => {
  try {
    const { id } = req.params; // Lesson note ID
    const { id: userId, role: userRole } = req.user; // Authenticated user

    // Fetch the existing lesson note
    const lessonNote = await LessonNote.findById(id).populate("teacher");

    if (!lessonNote) {
      throw new NotFoundError("Lesson note not found.");
    }

    let { teacher, evaluation, assignment } = lessonNote;

    console.log("Initial Assignment Content:", assignment);
    console.log("Initial Evaluation Content:", evaluation);

    // Authorization check
    if (
      !["admin", "proprietor"].includes(userRole) &&
      teacher.toString() !== userId
    ) {
      throw new BadRequestError(
        "You are not authorized to update this lesson note.",
      );
    }

    // Handle legacy `assignment` and `evaluation` formats
    if (Array.isArray(assignment)) {
      // If assignment is an array, handle it as legacy data
      console.warn("Legacy format detected for assignment.");
      assignment = assignment[0] || null;
    }

    if (Array.isArray(evaluation)) {
      // If evaluation is an array, handle it as legacy data
      console.warn("Legacy format detected for evaluation.");
      evaluation = evaluation[0] || null;
    }

    // Validate and populate assignment
    if (assignment) {
      const assignmentId = assignment.toString();
      assignment = await Assignment.findById(assignmentId).populate(
        "questions",
      );
      if (!assignment) {
        throw new NotFoundError("Assignment not found.");
      }
    }

    // Validate and populate evaluation
    if (evaluation) {
      const evaluationId = evaluation.toString();
      evaluation = await Classwork.findById(evaluationId).populate("questions");
      if (!evaluation) {
        throw new NotFoundError("Evaluation not found.");
      }
    }

    // Update lesson note
    const updatedLessonNote = await LessonNote.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true,
    });

    // Fully populate updated lesson note
    const populatedLessonNoteUpdate = await LessonNote.findById(
      updatedLessonNote._id,
    ).populate([
      { path: "teacher", select: "_id name" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      {
        path: "evaluation",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionText questionType options",
        },
      },
      {
        path: "assignment",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionType questionText options files",
        },
      },
    ]);

    res.status(StatusCodes.OK).json({
      message: "Lesson Note updated successfully",
      populatedLessonNoteUpdate,
    });
  } catch (error) {
    next(
      error instanceof NotFoundError || error instanceof BadRequestError
        ? error
        : new BadRequestError(error.message),
    );
  }
};*/

export const updateLessonNote = async (req, res, next) => {
  try {
    const { id } = req.params; // Test ID from request params
    const { id: userId, role: userRole } = req.user; // Authenticated user ID and role

    // Fetch the existing lesson note to validate authorization
    const lessonNote = await LessonNote.findById(id).populate("teacher");

    if (!lessonNote) {
      throw new NotFoundError("Lesson note not found.");
    }

    let { teacher, classId, subject, evaluation, assignment } = lessonNote;

    // Check authorization
    let teacherId;
    let isAuthorized = false;
    let teacherDoc;

    if (["admin", "proprietor"].includes(userRole)) {
      isAuthorized = true;
      teacherId = teacher;

      teacherDoc = await Staff.findById(teacherId).populate([
        { path: "subjects", select: "_id subjectName" },
      ]);
      if (!teacherDoc) {
        throw new NotFoundError("Provided teacher not found.");
      }

      const isAssignedSubject = subjectTeacher.subjects.some(
        (subjectItem) => subjectItem && subjectItem.equals(subject),
      );

      if (!isAssignedSubject) {
        throw new BadRequestError(
          "The specified teacher is not assigned to the selected subject.",
        );
      }
    } else if (userRole === "teacher") {
      // For teachers, validate that the requested subject is assigned to them
      const subjectTeacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new NotFoundError("Teacher not found.");
      }

      isAuthorized = subjectTeacher.subjects.some(
        (subjectItem) => subjectItem.toString() === subject.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You are not authorized to create lesson note for this subject.",
        );
      }

      teacherId = userId;
    }

    if (!isAuthorized) {
      throw new BadRequestError(
        "You are not authorized to create this lesson note.",
      );
    }

    /*let teacherId = userId; // Default to logged-in user
    if (["admin", "proprietor"].includes(userRole)) {
      teacherId = teacher;
    }*/

    /*     // Convert ObjectId to string if necessary
    const assignmentId = assignment.toString();

    // Query with the ID
    assignment = await Assignment.findById(assignmentId).populate("questions");
    if (!assignment) {
      throw new NotFoundError("Assignment not found.");
    }

    const assignmentLessonNoteId = assignment.lessonNote.toString();

    if (assignmentLessonNoteId !== id) {
      throw new BadRequestError(`This assignment is not for this lesson note.`);
    }

    const evaluationId = evaluation.toString();

    evaluation = await Classwork.findById(evaluationId).populate("questions");
    if (!evaluation) {
      throw new NotFoundError("evaluation not found.");
    }

    const evaluationLessonNoteId = evaluation.lessonNote.toString();

    if (evaluationLessonNoteId !== id) {
      throw new BadRequestError(`This evaluation is not for this lesson note.`);
    } */

    const updater = await Staff.findById(req.user.userId);
    if (!updater) {
      throw new BadRequestError("Updater not found.");
    }

    const classData = await Class.findOne({
      _id: lessonNote.classId,
      term: lessonNote.term,
      session: lessonNote.session,
    }).populate("subjects", "subjectName");
    if (!classData) {
      throw new NotFoundError("Class not found.");
    }
    // Find subject data from the class's subjects.
    const subjectData = classData.subjects.find(
      (subj) => subj._id.toString() === subject.toString(),
    );
    if (!subjectData) {
      throw new NotFoundError("Subject data not found in class.");
    }

    // Find the lesson note by ID and update it
    const updatedLessonNote = await LessonNote.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true, runValidators: true },
    );

    const notificationTitle = `Lesson Note Updated`;

    const notificationMessage = `${classData.className} ${subjectData.subjectName} lesson note for week ${lessonNote.lessonWeek} on the topic ${lessonNote.topic}, subtopic ${lessonNote.subTopic} has been updated by ${updater.firstName} ${updater.lastName}. Please check your portal for details.`;

    /*     await createNotificationForLessonNote(
      lessonNote,
      req.user.userId,
      notificationTitle,
      notificationMessage,
    ); */

    const staffs = await Staff.find({
      role: { $in: ["admin", "proprietor"] },
      status: "active",
    }).select("_id");

    // Prepare recipients
    const recipients = [
      ...staffs.map((staff) => ({
        recipientId: staff._id,
        recipientModel: "Staff",
      })),
    ];

    await sendBulkNotifications({
      sender: req.user.userId,
      title: notificationTitle,
      message: notificationMessage,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        lessonNoteId: lessonNote._id,
      },
      recipients: recipients,
    });

    const populatedLessonNoteUpdate = await LessonNote.findById(
      updatedLessonNote._id,
    ).populate([
      { path: "teacher", select: "_id firstName lastName" },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      {
        path: "evaluation",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionText questionType options",
        },
      },
      {
        path: "assignment",
        select: "_id questions",
        populate: {
          path: "questions",
          select: "_id questionType questionText options files",
        },
      },
    ]);

    res.status(StatusCodes.OK).json({
      message: "Lesson Note updated successfully",
      populatedLessonNoteUpdate,
    });
  } catch (error) {
    console.log("Error updating lesson note:", error);
    next(new InternalServerError(error.message));
  }
};

//update lessonNote approval status
export const approveLessonNote = async (req, res, next) => {
  const { lessonNoteId } = req.params; // Get lessonNote ID from the URL params

  if (!lessonNoteId) {
    throw new BadRequestError("LessonNote ID is required.");
  }

  try {
    // Find the LessonNote by its ID
    const lessonNote = await LessonNote.findById(lessonNoteId);
    if (!lessonNote) {
      throw new NotFoundError("LessonNote not found.");
    }

    // Check if the lessonNote is already approved
    if (lessonNote.approved) {
      return res.status(StatusCodes.OK).json({
        message: "This lessonNote has already been approved.",
      });
    }

    const updater = await Staff.findById(req.user.userId);
    if (!updater) {
      throw new BadRequestError("Updater not found.");
    }

    const classData = await Class.findOne({
      _id: req.body.classId,
      term: req.body.term,
      session: req.body.session,
    }).populate("subjects", "subjectName");
    if (!classData) {
      throw new NotFoundError("Class not found.");
    }

    // Find subject data from the class's subjects.
    const subjectData = classData.subjects.find(
      (subj) => subj._id.toString() === subject.toString(),
    );
    if (!subjectData) {
      throw new NotFoundError("Subject data not found in class.");
    }

    // Update the approved status to true
    lessonNote.approved = true;
    lessonNote.updatedAt = Date.now(); // Update the `updatedAt` field

    // Save the updated lessonNote
    await lessonNote.save();

    const notificationTitle = `Lesson Note Approved`;

    const notificationMessage = `${classData.className} ${subjectData.subjectName} lesson note for week ${lessonNote.lessonWeek} on the topic ${lessonNote.topic}, subtopic ${lessonNote.subTopic} has been approved by the ${updater.role}: ${updater.firstName} ${updater.lastName}. Please check your portal for details.`;

    const recipients = [lessonNote.teacher];

    await sendBulkNotifications({
      sender: req.user.userId,
      title: notificationTitle,
      message: notificationMessage,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        lessonNoteId: lessonNote._id,
      },
      recipients: recipients,
    });

    // Return the updated lessonNote
    res.status(StatusCodes.OK).json({
      message: "LessonNote approved successfully.",
      lessonNote,
    });
  } catch (error) {
    console.error("Error approving lessonNote:", error);
    next(new BadRequestError(error.message));
  }
};

// Delete a lesson note
export const deleteLessonNote = async (req, res, next) => {
  try {
    const { userId } = req.user;

    // Find the associated LessonNote document
    const lessonNoteDoc = await LessonNote.findById(req.params.id);
    if (!lessonNoteDoc) {
      throw new NotFoundError("Lesson note not found.");
    }

    const staffsData = await Staff.find({
      $or: [{ role: { $in: ["admin", "proprietor"] }, status: "active" }],
    });

    if (!staffsData) {
      throw new NotFoundError("Staff not found.");
    }

    const staff = staffsData.find((staff) => staff._id.equals(userId));

    const notificationMessage = `The lesson note for week ${lessonNoteDoc.lessonWeek} has been deleted by ${staff.firstName} ${staff.lastName}. Please check your portal for details.`;

    const recipients = [
      ...staffsData.map((staff) => {
        return {
          recipientId: staff._id,
          recipientModel: "Staff",
        };
      }),
    ];

    await sendBulkNotifications({
      sender: req.user.userId,
      title: "Lesson Note Deleted",
      message: notificationMessage,
      recipients: recipients,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
      },
    });

    await LessonNote.findByIdAndDelete(lessonNoteDoc._id);

    res
      .status(StatusCodes.OK)
      .json({ message: "Lesson note deleted successfully" });
  } catch (error) {
    console.log("Error deleting assignment:", error);
    next(new InternalServerError(error.message));
  }
};
