import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import UnauthorizedError from "../errors/unauthorize.js"; // Direct import of UnauthorizedError
import InternalServerError from "../errors/internal-server-error.js";
import Class from "../models/ClassModel.js";
import checkPermissions from "../utils/checkPermissions.js";
import {
  generateCurrentTerm,
  holidayDurationForEachTerm,
  startTermGenerationDate,
} from "../utils/termGenerator.js"; // Import the term generation function

// Create a new class
export const createClass = async (req, res) => {
  try {
    const {
      className,
      section,
      classTeacher,
      subjectTeachers,
      subjects,
      session,
      timetable,
    } = req.body;

    // Check if class already exists
    const classAlreadyExists = await Class.findOne({ className });
    if (classAlreadyExists) {
      throw new BadRequestError("Class already exists");
    }

    const term = generateCurrentTerm(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    const newClass = new Class({
      className,
      section,
      classTeacher,
      subjectTeachers,
      subjects,
      session,
      term,
      timetable,
    });
    await newClass.save();

    // Return class details
    res.status(StatusCodes.CREATED).json({
      newClass,
    });
  } catch (error) {
    res.status(StatusCodes.BAD_REQUEST).json({ error: error.message });
  }
};

// Get all classes
export const getClasses = async (req, res, next) => {
  try {
    // Define allowed query parameters
    const allowedFilters = [
      "className",
      "classTeacher",
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

    const { className, classTeacher, term, session, sort, page, limit } =
      req.query;

    const matchStage = {};

    if (term) matchStage.term = { $regex: term, $options: "i" };
    if (session) matchStage.session = session;
    if (className) matchStage.className = className;
    // if (topic) matchStage.topic = { $regex: topic, $options: "i" };

    const pipeline = [];
    pipeline.push({ $match: matchStage });

    // Lookup to join subjectTeacher data from the "staff" collection
    pipeline.push({
      $lookup: {
        from: "staffs", // collection name for staff (ensure this matches your DB)
        localField: "classTeacher",
        foreignField: "_id",
        as: "classTeacherData",
      },
    });
    pipeline.push({ $unwind: "$classTeacherData" });

    const joinMatch = {};

    if (classTeacher) {
      const classTeacherRegex = {
        $regex: `^${classTeacher}$`,
        $options: "i",
      };
      joinMatch.$or = [
        {
          "classTeacherData.firstName": classTeacherRegex,
        },
        {
          "classTeacherData.middleName": classTeacherRegex,
        },
        {
          "classTeacherData.lastName": classTeacherRegex,
        },
      ];
    }

    if (Object.keys(joinMatch).length > 0) {
      pipeline.push({ $match: joinMatch });
    }

    const sortOptions = {
      newest: { createdAt: -1 },
      oldest: { createdAt: 1 },
      "a-z": { className: 1 },
      "z-a": { className: -1 },
    };

    const sortKey = sortOptions[sort] || sortOptions.newest;
    pipeline.push({ $sort: sortKey });

    const pageNumber = Number(page) || 1;
    const limitNumber = Number(limit) || 10;
    pipeline.push({ $skip: (pageNumber - 1) * limitNumber });
    pipeline.push({ $limit: limitNumber });

    // Projection stage: structure the output.
    pipeline.push({
      $project: {
        _id: 1,
        className: 1,
        term: 1,
        session: 1,
        createdAt: 1,
        classTeacher: {
          _id: "$classTeacherData._id",
          firstName: "$classTeacherData.firstName",
          lastName: "$classTeacherData.lastName",
        },
      },
    });

    const classes = await Class.aggregate(pipeline);

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

    const countResult = await Class.aggregate(countPipeline);

    const totalClasses = countResult[0] ? countResult[0].total : 0;

    const numOfPages = Math.ceil(totalClasses / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalClasses,
      numOfPages,
      currentPage: pageNumber,
      classes,
    });
  } catch (error) {
    console.error("Error getting classes:", error);
    next(new InternalServerError(error.message));
  }
};

// Get class by ID
export const getClassById = async (req, res) => {
  try {
    const { id: classId } = req.params;

    // Find the class by ID
    const classData = await Class.findOne({ _id: classId }).populate([
      { path: "classTeacher", select: "_id name email employeeID" },
      { path: "subjectTeachers", select: "_id name email employeeID" },
      { path: "students", select: "_id name email studentID" },
      {
        path: "subjects",
        select: "_id subjectName subjectCode subjectTeachers",
      },
    ]);

    if (!classData) {
      throw new NotFoundError(`No class found with id: ${classId}`);
    }
    res.status(StatusCodes.OK).json(classData);
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Update class
export const updateClass = async (req, res) => {
  try {
    const { id: classId } = req.params;
    const {
      className,
      section,
      classTeacher,
      subjectTeachers,
      subjects,
      session,
      timetable,
      students,
    } = req.body;

    // Find the class by ID
    const updatedClass = await Class.findOne({ _id: classId });

    if (!updatedClass) {
      throw new NotFoundError(`No class found with id: ${classId}`);
    }

    const term = generateCurrentTerm(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // Check if the current user has permission to update
    checkPermissions(req.user, updatedClass.user);

    // Store the previous class teacher ID for comparison
    const previousClassTeacherId = updatedClass.classTeacher;

    // Update class fields
    updatedClass.className = className || updatedClass.className;
    updatedClass.section = section || updatedClass.section;
    updatedClass.classTeacher = classTeacher || updatedClass.classTeacher;
    updatedClass.subjectTeachers =
      subjectTeachers || updatedClass.subjectTeachers;
    updatedClass.subjects = subjects || updatedClass.subjects;
    updatedClass.session = session || updatedClass.session;
    updatedClass.term = term || updatedClass.term;
    updatedClass.timetable = timetable || updatedClass.timetable;
    updatedClass.students = students || updatedClass.students;

    // Save the updated class
    await updatedClass.save();

    // If the class teacher has changed, update staff's classTeacher reference
    /*if (classTeacher && classTeacher !== previousClassTeacherId?.toString()) {
      // Find the staff member associated with the new class teacher
      const staffMember = await Staff.findOne({ _id: classTeacher });
      if (staffMember) {
        // Update attendance records for this class
        const attendanceUpdateResult = await Attendance.updateMany(
          {
            classId: classId, // Assuming attendance records use classId to filter
            date: { $gte: new Date() }, // Change this to the appropriate date condition
          },
          { $set: { classTeacher: classTeacher } }, // Set new class teacher ID
        );

        console.log(
          `Updated ${attendanceUpdateResult.modifiedCount} attendance records with new classTeacher.`,
        );

        // Update the staff member's classTeacher
        staffMember.isClassTeacher = classId; // Assuming this is the relevant field
        await staffMember.save();
      }
    }*/

    res.status(StatusCodes.OK).json(updatedClass);
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Delete class
export const deleteClass = async (req, res) => {
  try {
    const { id: classId } = req.params;
    const classToDelete = await Class.findOne({ _id: classId });

    if (!classToDelete) {
      throw new NotFoundError(`No class found with id: ${classId}`);
    }

    // Ensure only admins can delete a class
    if (req.user.role !== "admin") {
      throw new UnauthorizedError("Only admins can delete class records.");
    }

    await classToDelete.deleteOne();
    res.status(StatusCodes.OK).json({ message: "Class deleted successfully" });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};
