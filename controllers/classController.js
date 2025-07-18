import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import UnauthorizedError from "../errors/unauthorize.js"; // Direct import of UnauthorizedError
import InternalServerError from "../errors/internal-server-error.js";
import Class from "../models/ClassModel.js";
import checkPermissions from "../utils/checkPermissions.js";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js"; // Import the term generation function

// Create a new class
export const createClass = async (req, res, next) => {
  try {
    const { className, section } = req.body;

    // Check if class already exists
    const classAlreadyExists = await Class.findOne({ className });
    if (classAlreadyExists) {
      throw new BadRequestError("Class already exists");
    }

    const newClass = new Class({
      className,
      section,
      subjectTeachers: [],
      students: [],
      subjects: [],
    });
    await newClass.save();

    // Return class details
    res.status(StatusCodes.CREATED).json({
      newClass,
    });
  } catch (error) {
    console.log("Error in creating class", error);
    next(new InternalServerError(error.message));
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

    // If no query parameters are provided, return all classes (no filter)
    const hasFilters = providedFilters.some((key) =>
      allowedFilters.includes(key),
    );
    let matchStage = {};
    let classTeacher = undefined;
    let sort, page, limit;
    if (hasFilters) {
      const {
        className: qClassName,
        classTeacher: qClassTeacher,
        term,
        session,
        sort: qSort,
        page: qPage,
        limit: qLimit,
      } = req.query;
      if (term) matchStage.term = { $regex: term, $options: "i" };
      if (session) matchStage.session = session;
      if (qClassName) matchStage.className = qClassName;
      if (qClassTeacher) classTeacher = qClassTeacher;
      sort = qSort;
      page = qPage;
      limit = qLimit;
    }
    // Provide default values if not set
    sort = sort || "newest";
    page = Number(page) || 1;
    limit = Number(limit) || 10;

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
    pipeline.push({
      $unwind: {
        path: "$classTeacherData",
        preserveNullAndEmptyArrays: true,
      },
    });
    // Lookup for subjectTeachers
    pipeline.push({
      $lookup: {
        from: "staffs",
        localField: "subjectTeachers",
        foreignField: "_id",
        as: "subjectTeachersData",
      },
    });
    // Lookup for students
    pipeline.push({
      $lookup: {
        from: "students",
        localField: "students",
        foreignField: "_id",
        as: "studentsData",
      },
    });
    // Lookup for subjects
    pipeline.push({
      $lookup: {
        from: "subjects",
        localField: "subjects",
        foreignField: "_id",
        as: "subjectsData",
      },
    });

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

    pipeline.push({ $skip: (page - 1) * limit });
    pipeline.push({ $limit: limit });

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
        subjectTeachers: {
          $map: {
            input: "$subjectTeachersData",
            as: "teacher",
            in: {
              _id: "$$teacher._id",
              firstName: "$$teacher.firstName",
              lastName: "$$teacher.lastName",
            },
          },
        },
        students: {
          $map: {
            input: "$studentsData",
            as: "student",
            in: {
              _id: "$$student._id",
              firstName: "$$student.firstName",
              lastName: "$$student.lastName",
            },
          },
        },
        subjects: {
          $map: {
            input: "$subjectsData",
            as: "subject",
            in: {
              _id: "$$subject._id",
              subjectName: "$$subject.subjectName",
              subjectCode: "$$subject.subjectCode",
            },
          },
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

    const numOfPages = Math.ceil(totalClasses / limit);

    res.status(StatusCodes.OK).json({
      count: totalClasses,
      numOfPages,
      currentPage: page,
      classes,
    });
  } catch (error) {
    console.log("Error getting classes:", error);
    next(new InternalServerError(error.message));
  }
};

// Get class by ID
export const getClassById = async (req, res, next) => {
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
    console.log("Error getting class by ID:", error);
    next(new InternalServerError(error.message));
  }
};
// Update class
export const updateClass = async (req, res, next) => {
  try {
    const { id: classId } = req.params;
    const {
      className,
      section,
      classTeacher,
      subjectTeachers,
      subjects,
      timetable,
      students,
    } = req.body;

    // Find the class by ID
    const updatedClass = await Class.findOne({ _id: classId });

    if (!updatedClass) {
      throw new NotFoundError(`No class found with id: ${classId}`);
    }

    const { term, session } = getCurrentTermDetails(
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
    console.log("Error in updating class", error);
    next(new InternalServerError(error.message));
  }
};

// Delete class
export const deleteClass = async (req, res, next) => {
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
    console.log("Error in deleting class", error);
    next(new InternalServerError(error.message));
  }
};

// Controller to create a new class for a new term and/or session
export const createClassForNewTermOrSession = async (req, res, next) => {
  try {
    const { className, section } = req.body;

    // Get current term/session details
    const termDetails = getCurrentTermDetails(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    let { term, session, isHoliday, nextTerm, nextSession } = termDetails;

    // If it's a holiday, use nextTerm and/or nextSession
    if (isHoliday) {
      term = nextTerm;
      session = nextSession;
    }

    // Check if class already exists for this term and session
    const classExists = await Class.findOne({
      className,
      term,
      session,
    });
    if (classExists) {
      throw new BadRequestError(
        `Class "${className}" already exists for term "${term}" and session "${session}".`,
      );
    }

    // Create the new class
    const newClass = new Class({
      className,
      section,
      classTeacher: null, // Assuming no class teacher for
      subjectTeachers: [],
      subjects: [],
      students: [],
      session,
      term,
      timetable: null, // Assuming no timetable for new class creation
    });
    await newClass.save();

    res.status(StatusCodes.CREATED).json({
      message: "Class created for new term/session successfully",
      newClass,
    });
  } catch (error) {
    console.log("Error creating class for new term/session:", error);
    next(new InternalServerError(error.message));
  }
};
