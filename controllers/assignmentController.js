import Assignment from "../models/AssignmentModel.js";
import LessonNote from "../models/LessonNoteModel.js";
import Staff from "../models/StaffModel.js";
import Class from "../models/ClassModel.js";
import Question from "../models/QuestionsModel.js";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import { StatusCodes } from "http-status-codes";
import InternalServerError from "../errors/internal-server-error.js";
import {
  createNotificationForAssignment,
  sendBulkNotifications,
} from "./notificationController.js";
import mongoose from "mongoose";
import Subject from "../models/SubjectModel.js";
import Student from "../models/StudentModel.js";
import UnauthorizedError from "../errors/unauthorize.js";

// Create a new assignment

export const createAssignment = async (req, res, next) => {
  try {
    const { lessonNote, questions, marksObtainable } = req.body;
    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.role;

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
        throw new BadRequestError("Teacher not found.");
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
    let totalMarks = 0;
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
      // Sum up the marks from each question
      totalMarks += question.marks || 0;
    }

    // Set marksObtainable to the sum of all question marks
    req.body.marksObtainable = totalMarks;

    // Fetch students for the class
    const classData = await Class.findById(classId).populate("students");
    if (!classData || !classData.students.length) {
      throw new BadRequestError("Class or students not found.");
    }

    // Populate students and initialize the submitted array
    req.body.students = classData.students.map((student) => student._id);
    req.body.submitted = []; // Initially an empty array

    const notificationTitle = `New assignment: Week ${note.lessonWeek}`;

    const notificationMessage = `You have a new assignment for week ${note.lessonWeek} on the topic: ${note.topic}, subtopic: ${note.subTopic}. Please check your portal for details.`;

    const recipients = [
      // ...staffs.map((staff) => ({
      //   recipientId: staff._id,
      //   recipientModel: "Staff",
      // })),
      ...classData.students.map((student) => ({
        recipientId: student._id,
        recipientModel: "Student",
      })),
    ];

    // Create the assignment
    const assignment = new Assignment(req.body);
    await assignment.save();

    note.assignment = assignment._id;
    await note.save(); // Update the lesson note with the assignment ID

    // Push assignment._id into each student's academicRecords.assignments for the correct session/term/class
    const studentIds = assignment.students;
    await Promise.all(
      studentIds.map(async (studentId) => {
        await Student.updateOne(
          {
            _id: studentId,
            "academicRecords.session": session,
            "academicRecords.term": term,
            "academicRecords.classId": classId,
          },
          { $addToSet: { "academicRecords.$.assignments": assignment._id } },
        );
      }),
    );

    // After assignment is saved, trigger notifications for the class.
    // await createNotificationForAssignment(assignment, req.user.userId);

    await sendBulkNotifications({
      sender: req.user.userId,
      title: notificationTitle,
      message: notificationMessage,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        assignmentId: assignment._id,
      },
      recipients: recipients,
    });

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
      { path: "subjectTeacher", select: "_id firstName" },
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
    next(new InternalServerError(error.message));
  }
};

/* export const createAssignment = async (req, res, next) => {
  try {
    const { lessonNote, questions, marksObtainable } = req.body;
    const { id: userId, role: userRole } = req.user;

    if (!questions || !Array.isArray(questions) || questions.length === 0) {
      throw new BadRequestError(
        "Questions must be provided and cannot be empty.",
      );
    }
    if (!lessonNote) {
      throw new BadRequestError("Lesson note must be provided.");
    }

    const note = await LessonNote.findById(lessonNote).populate(
      "classId subject",
    );
    if (!note) {
      throw new BadRequestError("Lesson note not found.");
    }

    const { classId, subject, topic, subTopic, lessonWeek } = note;
    Object.assign(req.body, {
      classId,
      subject,
      topic,
      subTopic,
      lessonWeek,
    });

    let isAuthorized = false;
    let subjectTeacherId;

    if (["admin", "proprietor"].includes(userRole)) {
      subjectTeacherId = req.body.subjectTeacher;

      if (!subjectTeacherId) {
        throw new BadRequestError(
          "For admin or proprietor, 'subjectTeacher' must be provided.",
        );
      }

      const teacher = await Staff.findById(subjectTeacherId).populate(
        "subjects",
      );
      if (!teacher) {
        throw new NotFoundError("Provided subjectTeacher not found.");
      }

      const isAssigned = teacher.subjects.some(
        (s) => s.toString() === subject._id.toString(),
      );
      if (!isAssigned) {
        throw new BadRequestError(
          "SubjectTeacher is not assigned to the selected subject.",
        );
      }

      isAuthorized = true;
    } else if (userRole === "teacher") {
      const teacher = await Staff.findById(userId).populate("subjects");
      if (!teacher) {
        throw new BadRequestError("Teacher not found.");
      }

      isAuthorized = teacher.subjects.some(
        (s) => s.toString() === subject._id.toString(),
      );

      if (!isAuthorized) {
        throw new BadRequestError(
          "You're not authorized to create this assignment.",
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

    const questionDocs = await Question.find({ _id: { $in: questions } });
    if (questionDocs.length !== questions.length) {
      throw new BadRequestError("Some questions could not be found.");
    }

    for (const [i, q] of questionDocs.entries()) {
      if (
        q.subject.toString() !== subject._id.toString() ||
        q.classId.toString() !== classId._id.toString()
      ) {
        throw new BadRequestError(
          `Question at index ${i + 1} doesn't match class or subject.`,
        );
      }
    }

    const classData = await Class.findById(classId).populate("students");
    if (!classData || !classData.students.length) {
      throw new BadRequestError("Class or students not found.");
    }

    req.body.students = classData.students.map((s) => s._id);
    req.body.submitted = [];

    const assignment = new Assignment(req.body);
    await assignment.save();

    note.assignment = assignment._id;
    await note.save();

    const notificationTitle = `New Assignment - Week ${lessonWeek}`;
    const notificationMessage = `You have a new assignment on "${topic}" - ${subTopic}. Check your portal.`;

    const recipients = classData.students.map((student) => ({
      recipientId: student._id,
      recipientModel: "Student",
    }));

    await sendBulkNotifications({
      sender: userId,
      title: notificationTitle,
      message: notificationMessage,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        assignmentId: assignment._id,
      },
      recipients,
    });

    const populatedAssignment = await Assignment.findById(
      assignment._id,
    ).populate([
      {
        path: "questions",
        select: "_id questionType questionText options files",
      },
      { path: "classId", select: "_id className" },
      { path: "subject", select: "_id subjectName" },
      { path: "subjectTeacher", select: "_id firstName" },
      { path: "lessonNote", select: "_id lessonWeek lessonPeriod" },
    ]);

    res.status(StatusCodes.CREATED).json({
      message: "Assignment created successfully",
      populatedAssignment,
    });
  } catch (error) {
    console.error("Error creating assignment:", error);
    next(new BadRequestError(error.message));
  }
}; */

// Get all assignments

export const getAssignments = async (req, res, next) => {
  try {
    // Define allowed query parameters
    const allowedFilters = [
      "subjectTeacher",
      "subject",
      "classId",
      "term",
      "session",
      "lessonWeek",
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
      subjectTeacher, // search term for subject teacher's name
      subject, // search term for subject's name
      classId, // search term for class name
      term,
      session,
      lessonWeek,
      topic,
      sort, // sort criteria (e.g., newest, oldest, a-z, z-a)
      page, // page number for pagination
      limit, // number of records per page
    } = req.query;

    // Build an initial match stage for fields stored directly on Assignment
    const matchStage = {};

    if (term) matchStage.term = { $regex: term, $options: "i" };
    if (session) matchStage.session = session;
    if (lessonWeek) matchStage.lessonWeek = lessonWeek;
    if (topic) matchStage.topic = { $regex: topic, $options: "i" };

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
      // joinMatch["classData.className"] = { $regex: classId, $options: "i" };
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
    const assignments = await Assignment.aggregate(pipeline);

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
    const countResult = await Assignment.aggregate(countPipeline);
    const totalAssignments = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalAssignments / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalAssignments,
      numOfPages,
      currentPage: pageNumber,
      assignments,
    });
  } catch (error) {
    console.log("Error getting assignments:", error);
    next(new InternalServerError(error.message));
  }
};

/* export const getAssignments = async (req, res, next) => {
  try {
    // Allowed query params
    const allowedFilters = [
      "subjectTeacher",
      "subject",
      "classId",
      "lessonWeek",
      "topic",
      "sort",
      "page",
      "limit",
    ];

    const providedFilters = Object.keys(req.query);
    const unknownFilters = providedFilters.filter(
      (key) => !allowedFilters.includes(key),
    );

    if (unknownFilters.length > 0) {
      throw new BadRequestError(
        `Unknown query parameter(s): ${unknownFilters.join(", ")}`,
      );
    }

    const {
      subjectTeacher,
      subject,
      classId,
      lessonWeek,
      topic,
      sort,
      page,
      limit,
    } = req.query;

    const matchStage = {};
    if (lessonWeek) matchStage.lessonWeek = Number(lessonWeek);
    if (topic) matchStage.topic = { $regex: topic, $options: "i" };

    const pipeline = [{ $match: matchStage }];

    // Lookups
    pipeline.push(
      {
        $lookup: {
          from: "staffs",
          localField: "subjectTeacher",
          foreignField: "_id",
          as: "subjectTeacherData",
        },
      },
      {
        $unwind: {
          path: "$subjectTeacherData",
          preserveNullAndEmptyArrays: true,
        },
      },
      {
        $lookup: {
          from: "subjects",
          localField: "subject",
          foreignField: "_id",
          as: "subjectData",
        },
      },
      { $unwind: { path: "$subjectData", preserveNullAndEmptyArrays: true } },
      {
        $lookup: {
          from: "classes",
          localField: "classId",
          foreignField: "_id",
          as: "classData",
        },
      },
      { $unwind: { path: "$classData", preserveNullAndEmptyArrays: true } },
    );

    // Filter by joined data
    const orConditions = [];

    if (subjectTeacher) {
      const regex = new RegExp(`^${subjectTeacher}$`, "i");
      orConditions.push(
        { "subjectTeacherData.firstName": regex },
        { "subjectTeacherData.middleName": regex },
        { "subjectTeacherData.lastName": regex },
      );
    }

    if (subject) {
      const regex = new RegExp(`^${subject}$`, "i");
      orConditions.push(
        { "subjectData.subjectName": regex },
        { "subjectData.subjectCode": regex },
      );
    }

    if (classId) {
      orConditions.push({
        "classData.className": new RegExp(`^${classId}$`, "i"),
      });
    }

    if (orConditions.length > 0) {
      pipeline.push({ $match: { $or: orConditions } });
    }

    // Sorting
    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "a-z": { "subjectData.subjectName": 1 },
      "z-a": { "subjectData.subjectName": -1 },
    };
    pipeline.push({ $sort: sortOptions[sort] || sortOptions.newest });

    // Pagination
    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    pipeline.push({ $skip: (pageNumber - 1) * limitNumber });
    pipeline.push({ $limit: limitNumber });

    // Projection
    pipeline.push({
      $project: {
        _id: 1,
        // evaluationType: 1,
        lessonWeek: 1,
        topic: 1,
        subTopic: 1,
        marksObtainable: 1,
        createdAt: 1,
        numberOfQuestions: { $size: "$questions" },
        numberOfSubmissions: { $size: "$submitted" },
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

    const assignments = await Assignment.aggregate(pipeline);

    // Count total (exclude pagination stages)
    const countPipeline = pipeline.filter(
      (stage) =>
        !(stage.$skip || stage.$limit || stage.$sort || stage.$project),
    );
    countPipeline.push({ $count: "total" });
    const countResult = await Assignment.aggregate(countPipeline);
    const totalAssignments = countResult[0]?.total || 0;
    const numOfPages = Math.ceil(totalAssignments / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalAssignments,
      numOfPages,
      currentPage: pageNumber,
      assignments,
    });
  } catch (error) {
    console.log("Error getting assignments:", error);
    next(new InternalServerError(error.message));
  }
}; */

// Get assignment by ID
export const getAssignmentById = async (req, res, next) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate({
        path: "questions",
        select: "_id questionType questionText options files marks",
      })
      .populate({ path: "classId", select: "_id className" })
      .populate({ path: "subject", select: "_id subjectName" })
      .populate({ path: "subjectTeacher", select: "_id firstName lastName" })
      .populate({ path: "lessonNote", select: "_id lessonWeek lessonPeriod" });

    if (!assignment) {
      throw new NotFoundError("Assignment not found.");
    }

    res.status(StatusCodes.OK).json({ ...assignment.toObject() });
  } catch (error) {
    console.log("Error getting assignment by ID:", error);
    next(new InternalServerError(error.message));
  }
};

// Update an assignment
export const updateAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.role; // Authenticated user role

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

      // Flatten subjects from teacherRecords and normalize IDs
      const teacherSubjectsCurrent = (teacher.teacherRecords || []).flatMap(
        (tr) =>
          (tr.subjects || []).map((s) =>
            s && s._id ? s._id.toString() : s.toString(),
          ),
      );
      const subjectIdCurrent =
        subject && subject._id ? subject._id.toString() : subject.toString();

      // Check if the teacher is authorized for this assignment's subject
      isAuthorized = teacherSubjectsCurrent.includes(subjectIdCurrent);

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
      { path: "subjectTeacher", select: "_id firstName" },
      {
        path: "lessonNote",
        select: "_id lessonweek lessonPeriod",
      },
    ]);

    const subjectData = await Subject.findById(subject);

    if (!subjectData) {
      throw new NotFoundError("Subject not found.");
    }

    const notificationTitle = `Assignment updated`;

    const notificationMessage = `The ${subjectData.subjectName} assignment for week ${assignment.lessonWeek} on the topic: ${assignment.topic}, subtopic: ${assignment.subTopic}, has been updated. Please check your portal for details `;

    // Prepare recipients
    const recipients = [
      ...assignment.students.map((student) => ({
        recipientId: student._id,
        recipientModel: "Student",
      })),
    ];

    await sendBulkNotifications({
      sender: req.user.userId,
      title: notificationTitle,
      message: notificationMessage,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        assignmentId: id,
      },
      recipients: recipients,
    });

    res.status(StatusCodes.OK).json({
      message: "Assignment updated successfully.",
      updatedAssignment,
    });
  } catch (error) {
    console.log("Error updating assignment:", error);
    next(new InternalServerError(error.message));
  }
};

/* export const updateAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const { id: userId, role: userRole } = req.user; // Authenticated user ID and role

    const assignment = await Assignment.findById(id).populate("lessonNote");
    if (!assignment) {
      throw new NotFoundError("Assignment not found");
    }

    const { subject, questions, classId, marksObtainable } = assignment; // removed term, session

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

      // Check if the teacher is authorized for this assignment's subject
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
      if (
        question.subject.toString() !== subject.toString() ||
        question.classId.toString() !== classId.toString()
      ) {
        throw new BadRequestError(
          `Question at index ${index + 1} does not match the class or subject.`,
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
      { path: "subjectTeacher", select: "_id firstName" },
      {
        path: "lessonNote",
        select: "_id lessonWeek lessonPeriod",
      },
    ]);

    const subjectData = await Subject.findById(subject);

    if (!subjectData) {
      throw new NotFoundError("Subject not found.");
    }

    const notificationTitle = `Assignment updated`;

    const notificationMessage = `The ${subjectData.subjectName} assignment for week ${assignment.lessonWeek} on the topic: ${assignment.topic}, subtopic: ${assignment.subTopic}, has been updated. Please check your portal for details `;

    const recipients = [
      ...assignment.students.map((student) => ({
        recipientId: student._id,
        recipientModel: "Student",
      })),
    ];

    await sendBulkNotifications({
      sender: req.user.userId,
      title: notificationTitle,
      message: notificationMessage,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        assignmentId: id,
      },
      recipients: recipients,
    });

    res.status(StatusCodes.OK).json({
      message: "Assignment updated successfully.",
      updatedAssignment,
    });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
}; */

// Update questions list on an Assignment (set by index, push question, or pull by index)
export const updateAssignmentQuestionList = async (req, res, next) => {
  try {
    const { id } = req.params; // assignment id
    const { action, index, value } = req.body;

    if (!action || !["set", "push", "pull"].includes(action)) {
      throw new BadRequestError(
        "Invalid or missing action. Use 'set', 'push' or 'pull'.",
      );
    }

    const assignment = await Assignment.findById(id);
    if (!assignment) throw new NotFoundError("Assignment not found.");

    // Authorization: subjectTeacher or admin/proprietor
    const userId = req.user?.userId || req.user?.id;
    const userRole = req.user?.role;
    if (!userId || !userRole)
      throw new BadRequestError("User authentication required.");

    const isOwner = assignment.subjectTeacher
      ? assignment.subjectTeacher.toString() === userId.toString()
      : false;
    if (!(isOwner || userRole === "admin" || userRole === "proprietor")) {
      throw new BadRequestError(
        "You are not authorized to modify questions for this assignment.",
      );
    }

    let updatedAssignment;

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

      // validate question exists and matches assignment context
      const q = await Question.findById(value);
      if (!q) throw new NotFoundError("Provided question not found.");
      if (
        q.subject.toString() !== assignment.subject.toString() ||
        q.classId.toString() !== assignment.classId.toString() ||
        q.term.toString().toLowerCase() !==
          assignment.term.toString().toLowerCase()
      ) {
        throw new BadRequestError(
          "Question does not match assignment subject, class or term.",
        );
      }

      const update = { $set: {} };
      update.$set[`questions.${index}`] = value;
      updatedAssignment = await Assignment.findByIdAndUpdate(id, update, {
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
        { path: "lessonNote", select: "_id lessonweek lessonPeriod" },
      ]);
    } else if (action === "push") {
      if (!value)
        throw new BadRequestError(
          "For 'push' action provide a 'value' (question id) to append.",
        );

      const q = await Question.findById(value);
      if (!q) throw new NotFoundError("Provided question not found.");
      if (
        q.subject.toString() !== assignment.subject.toString() ||
        q.classId.toString() !== assignment.classId.toString() ||
        q.term.toString().toLowerCase() !==
          assignment.term.toString().toLowerCase()
      ) {
        throw new BadRequestError(
          "Question does not match assignment subject, class or term.",
        );
      }

      updatedAssignment = await Assignment.findByIdAndUpdate(
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
        { path: "lessonNote", select: "_id lessonweek lessonPeriod" },
      ]);
    } else if (action === "pull") {
      if (typeof index !== "number" || index < 0) {
        throw new BadRequestError(
          "For 'pull' action provide a valid non-negative numeric 'index'.",
        );
      }

      const doc = await Assignment.findById(id);
      if (!doc) throw new NotFoundError("Assignment not found.");
      const arr = Array.isArray(doc.questions) ? doc.questions.slice() : [];
      if (index >= arr.length)
        throw new BadRequestError("Index out of range for questions array.");
      arr.splice(index, 1);
      doc.questions = arr;
      updatedAssignment = await doc.save();
      updatedAssignment = await Assignment.findById(
        updatedAssignment._id,
      ).populate([
        {
          path: "questions",
          select: "_id questionType questionText options files",
        },
        { path: "classId", select: "_id className" },
        { path: "subject", select: "_id subjectName" },
        { path: "subjectTeacher", select: "_id firstName" },
        { path: "lessonNote", select: "_id lessonweek lessonPeriod" },
      ]);
    }

    res.status(StatusCodes.OK).json({
      message: `Questions list ${action} operation successful.`,
      assignment: updatedAssignment,
    });
  } catch (error) {
    console.log("Error updating assignment questions:", error);
    next(new InternalServerError(error.message));
  }
};

export const submitAssignment = async (req, res, next) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    const student = await Student.findById(userId);
    if (!student) {
      throw new NotFoundError("Student not found");
    }

    const assignment = await Assignment.findById(id);
    if (!assignment) {
      throw new NotFoundError("Assignment not found");
    }

    // Check if the student is part of the class
    if (!assignment.students.includes(student._id)) {
      throw new UnauthorizedError("You are not authorized to this assignment.");
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

    const subjectData = await Subject.findById(assignment.subject);
    if (!subjectData) {
      throw new NotFoundError("Subject not found.");
    }

    const notificationTitle = `Assignment Submitted`;

    const notificationMessage = `${student.firstName} ${student.lastName} submitted ${subjectData.subjectName} assignment for week ${assignment.lessonWeek} on the topic: ${assignment.topic}, subtopic: ${assignment.subTopic}. Please check your portal for details `;

    // Prepare recipients
    const recipients = [
      {
        recipientId: assignment.subjectTeacher,
        recipientModel: "Staff",
      },
    ];

    await sendBulkNotifications({
      sender: req.user.userId,
      title: notificationTitle,
      message: notificationMessage,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        assignmentId: id,
        studentId: student._id,
      },
      recipients: recipients,
    });

    res
      .status(StatusCodes.OK)
      .json({ message: "Assignment submitted successfully." });
  } catch (error) {
    next(new BadRequestError(error.message));
  }
};

export const deleteAssignment = async (req, res, next) => {
  try {
    const { id } = req.params; // Assignment ID to be deleted
    if (!id) {
      throw new BadRequestError("Assignment ID is required.");
    }
    const { userId, userRole, role } = req.user;
    const userRoleValue = userRole || role;

    // Find the Assignment document
    const assignment = await Assignment.findById(id);
    if (!assignment) {
      throw new NotFoundError("Assignment not found.");
    }

    // Authorization: Allow deletion if user is the subjectTeacher, or is admin/proprietor
    const isSubjectTeacher =
      assignment.subjectTeacher &&
      assignment.subjectTeacher.toString() ===
        (userId || req.user?.userId).toString();
    const isAdmin = ["admin", "proprietor"].includes(userRoleValue);

    if (!isSubjectTeacher && !isAdmin) {
      throw new UnauthorizedError(
        "You are not authorized to delete this assignment.",
      );
    }
    // Extract the lessonNote reference from the assignment
    const { lessonNote } = assignment;
    if (!lessonNote) {
      throw new NotFoundError("Assignment does not reference any lesson note.");
    }

    // Find the associated LessonNote document
    const lessonNoteDoc = await LessonNote.findById(lessonNote);
    if (!lessonNoteDoc) {
      throw new NotFoundError("Associated lesson note not found.");
    }

    // Since the schema defines `assignment` as a single ObjectId,
    // check if it matches the assignment ID and set it to null if so.
    if (lessonNoteDoc.assignment && lessonNoteDoc.assignment.equals(id)) {
      lessonNoteDoc.assignment = null;
    }

    await lessonNoteDoc.save();

    const staffsData = await Staff.find({
      $or: [{ role: { $in: ["admin", "proprietor"] }, status: "active" }],
    });
    if (!staffsData) {
      throw new NotFoundError("Staff not found.");
    }

    const staff = staffsData.find((staff) => staff._id.equals(userId));

    const notificationMessage = `The assignment for week ${lessonNoteDoc.lessonWeek} has been deleted by ${staff.firstName} ${staff.lastName}. Please check your portal for details.`;

    const recipients = [
      ...staffsData.map((staff) => {
        return {
          recipientId: staff._id,
          recipientModel: "Staff",
        };
      }),
    ];

    /*  await sendBulkNotifications({
      sender: req.user.userId,
      title: "Assignment Deleted",
      message: notificationMessage,
      recipients: recipients,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        lessonNoteId: lessonNoteDoc._id,
      },
    }); */

    // Delete the Assignment document
    await Assignment.findByIdAndDelete(id);

    res
      .status(StatusCodes.OK)
      .json({ message: "Assignment deleted successfully." });
  } catch (error) {
    console.log("Error deleting assignment:", error);
    next(new InternalServerError(error.message));
  }
};
