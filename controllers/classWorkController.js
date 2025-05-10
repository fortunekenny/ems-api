import ClassWork from "../models/ClassWorkModel.js";
import LessonNote from "../models/LessonNoteModel.js";
import Class from "../models/ClassModel.js";
import Question from "../models/QuestionsModel.js";
import Staff from "../models/StaffModel.js";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import { StatusCodes } from "http-status-codes";
import InternalServerError from "../errors/internal-server-error.js";
import { createNotificationForClasswork } from "./notificationController.js";
import Subject from "../models/SubjectModel.js";

// Create ClassWork

export const createClassWork = async (req, res, next) => {
  try {
    const { lessonNote, questions, marksObtainable } = req.body;
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
    // if (!marksObtainable) {
    //   throw new BadRequestError("MarksObtainable must be provided.");
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
          } does not match either the class or subject or term.`,
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

    note.evaluation = classWork._id; // Update the lesson note with the classWork ID
    await note.save();

    // After classwork is saved, trigger notifications for the class.
    await createNotificationForClasswork(classWork, req.user.userId);

    // Populate fields for the response
    const populatedClassWork = await ClassWork.findById(classWork._id).populate(
      [
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
    // if (evaluationType) matchStage.evaluationType = evaluationType;
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
    const classWorks = await ClassWork.aggregate(pipeline);

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
    const countResult = await ClassWork.aggregate(countPipeline);
    const totalClassWorks = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalClassWorks / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalClassWorks,
      numOfPages,
      currentPage: pageNumber,
      classWorks,
    });
  } catch (error) {
    console.error("Error getting class work(s):", error);
    next(new InternalServerError(error.message));
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

    const { subject, questions, classId, term, subjectTeacher } = classWork; // Use data from the existing classWork document

    let subjectTeacherId;
    let isAuthorized = false;

    if (["admin", "proprietor"].includes(userRole)) {
      isAuthorized = true;
      subjectTeacherId = subjectTeacher;

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
          "The specified subject teacher is not assigned to the selected subject.",
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

    const staffs = await Staff.find({
      role: { $in: ["admin", "proprietor"] },
      status: "active",
    }).select("_id");

    const notificationTitle = `Class Work Updated`;

    const notificationMessage = `The ${subjectData.subjectName} class work for week ${classWork.lessonWeek} on the topic: ${classWork.topic}, subtopic: ${classWork.subTopic}, has been updated. Please check your portal for details `;

    // Prepare recipients
    const recipients = [
      ...classWork.students.map((student) => ({
        recipientId: student._id,
        recipientModel: "Student",
      })),
      ...staffs.map((staff) => ({
        recipientId: staff._id,
        recipientModel: "Staff",
      })),
    ];

    await sendBulkNotifications({
      sender: req.user.userId,
      title: notificationTitle,
      message: notificationMessage,
      recipients: recipients,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        classWorkId: updatedClassWork._id,
      },
    });

    res
      .status(StatusCodes.OK)
      .json({ message: "class work updated successfully.", updatedClassWork });
  } catch (error) {
    console.error("Error updating class work:", error);
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
    console.error("Error submitting class work:", error);
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

    const staffsData = await Staff.find({
      $or: [{ role: { $in: ["admin", "proprietor"] }, status: "active" }],
    });
    if (!staffsData) {
      throw new NotFoundError("Staff not found.");
    }

    const staff = staffsData.find((staff) => staff._id.equals(userId));

    const notificationMessage = `The class work for week ${classWork.lessonWeek} has been deleted by ${staff.firstName} ${staff.lastName}. Please check your portal for details.`;

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
      title: "Class Work Deleted",
      message: notificationMessage,
      recipients: recipients,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
      },
    });

    // Delete the ClassWork document
    await ClassWork.findByIdAndDelete(id);

    res
      .status(StatusCodes.OK)
      .json({ message: "ClassWork deleted successfully." });
  } catch (error) {
    console.error("Error deleting class work:", error);
    next(new BadRequestError(error.message));
  }
};
