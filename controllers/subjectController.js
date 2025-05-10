import Subject from "../models/SubjectModel.js";
import Class from "../models/ClassModel.js"; // Import the Class model
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import UnauthorizedError from "../errors/unauthorize.js"; // Direct import of UnauthorizedError
import checkPermissions from "../utils/checkPermissions.js";
import InternalServerError from "../errors/internal-server-error.js";

// Create a new subject
export const createSubject = async (req, res, next) => {
  try {
    const {
      subjectName,
      subjectCode,
      students,
      subjectTeachers,
      classId,
      session,
      term,
    } = req.body;

    // Check if subject already exists
    const subjectAlreadyExists = await Subject.findOne({ subjectCode });
    if (subjectAlreadyExists) {
      throw new BadRequestError("Subject already exists");
    }

    // Create the subject
    const subject = new Subject({
      subjectName,
      subjectCode,
      students,
      subjectTeachers,
      classId,
      session,
      term,
    });
    await subject.save();

    // Find the class by classId
    const assignedClass = await Class.findById(classId);
    if (!assignedClass) {
      throw new BadRequestError(`Class with id ${classId} not found`);
    }

    // Append the newly created subject's _id into the class's subjects array
    assignedClass.subjects.push(subject._id);
    await assignedClass.save(); // Save the class with the updated subjects array

    // Return subject details
    res.status(StatusCodes.CREATED).json({
      subject,
      message: `Subject created and added to class ${assignedClass.className}`,
    });
  } catch (error) {
    console.error("Error in createSubject", error);
    next(new InternalServerError(error.message));
  }
};

// Get all subjects
export const getSubjects = async (req, res, next) => {
  try {
    const allowedFilters = [
      "subject",
      "subjectTeacher",
      "classId",
      "session",
      "term",
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
      subject,
      subjectTeacher,
      classId,
      session,
      term,
      sort,
      page,
      limit,
    } = req.query;

    // Build an initial match stage for fields stored directly on Assignment
    const matchStage = {};

    if (term) matchStage.term = { $regex: term, $options: "i" };
    if (session) matchStage.session = session;

    if (subject) {
      matchStage.$or = [
        { subjectName: { $regex: subject, $options: "i" } },
        { subjectCode: { $regex: subject, $options: "i" } },
      ];
    }

    const pipeline = [];
    pipeline.push({ $match: matchStage });

    // Lookup to join subjectTeacher data from the "staff" collection
    pipeline.push({
      $lookup: {
        from: "staffs", // collection name for staff (ensure this matches your DB)
        localField: "subjectTeachers",
        foreignField: "_id",
        as: "subjectTeacherData",
      },
    });
    pipeline.push({ $unwind: "$subjectTeacherData" });

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
      "a-z": { subjectName: 1 },
      "z-a": { subjectName: -1 },
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
        subjectName: 1,
        subjectCode: 1,
        term: 1,
        session: 1,
        subjectTeacher: {
          _id: "$subjectTeacherData._id",
          firstName: "$subjectTeacherData.firstName",
          lastName: "$subjectTeacherData.lastName",
        },
        classId: {
          _id: "$classData._id",
          className: "$classData.className",
        },
      },
    });
    // Execute the aggregation pipeline
    const subjects = await Subject.aggregate(pipeline);

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
    const countResult = await Subject.aggregate(countPipeline);
    const totalSubjects = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalSubjects / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalSubjects,
      numOfPages,
      currentPage: pageNumber,
      subjects,
    });
  } catch (error) {
    console.error("Error in getting subjects", error);
    next(new InternalServerError(error.message));
  }
};

// Get subject by ID
export const getSubjectById = async (req, res) => {
  try {
    const { id: subjectId } = req.params;

    const subject = await Subject.findOne({ _id: subjectId }).populate([
      { path: "classId", select: "_id className" },
      { path: "subjectTeachers", select: "_id name email employeeID" },
      { path: "students", select: "_id name email studentID" },
    ]);
    if (!subject) {
      throw new NotFoundError(`No subject found with id: ${classId}`);
    }
    res.status(StatusCodes.OK).json(subject);
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Update subject
export const updateSubject = async (req, res) => {
  try {
    const { id: subjectId } = req.params;

    const {
      subjectName,
      subjectCode,
      students,
      subjectTeachers,
      classId,
      session,
    } = req.body;

    // Find the subject by ID
    const subject = await Subject.findOne({ _id: subjectId });

    if (!subject) {
      throw new NotFoundError(`No subject found with id: ${subjectId}`);
    }

    const term = generateCurrentTerm(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // Check if the current user has permission to update
    checkPermissions(req.user, subject.user);

    // Save the old classId before updating
    const oldClassId = subject.classId;

    // Update subject fields
    subject.subjectName = subjectName || subject.subjectName;
    subject.subjectCode = subjectCode || subject.subjectCode;
    subject.students = students || subject.students;
    subject.subjectTeachers = subjectTeachers || subject.subjectTeachers;
    subject.classId = classId || subject.classId;
    subject.session = session || subject.session;
    subject.term = term || subject.term;

    await subject.save();

    // Handle updating the class's subjects array

    // If the classId was changed, we need to update the old and new class's subjects array
    if (classId && classId !== oldClassId) {
      // Remove the subject from the old class's subjects array
      if (oldClassId) {
        const oldClass = await Class.findById(oldClassId);
        if (oldClass) {
          oldClass.subjects = oldClass.subjects.filter(
            (subjectId) => subjectId.toString() !== subject._id.toString(),
          );
          await oldClass.save(); // Save the old class after removing the subject
        }
      }

      // Add the subject to the new class's subjects array
      const newClass = await Class.findById(classId);
      if (newClass) {
        if (!newClass.subjects.includes(subject._id)) {
          newClass.subjects.push(subject._id); // Append the subject's _id to the new class
        }
        await newClass.save(); // Save the new class with the updated subjects array
      }
    }

    res.status(StatusCodes.OK).json({ subject });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Delete subject
export const deleteSubject = async (req, res) => {
  try {
    const { id: subjectId } = req.params;
    const subjectToDelete = await Subject.findOne({ _id: subjectId });

    if (!subjectToDelete) {
      throw new NotFoundError(`No subject found with id: ${subjectId}`);
    }

    // Ensure only admins can delete a subject
    if (req.user.role !== "admin") {
      throw new UnauthorizedError("Only admins can delete subject records.");
    }

    // Remove the subject from all teachers' subjects lists
    await Staff.updateMany(
      { subjects: subjectId },
      { $pull: { subjects: subjectId } },
    );

    // Find all classes associated with this subject
    const classes = await Class.find({ subjectId }); // Assuming subjectId is a reference in the class

    // Remove the subject from each class's subjectTeachers list
    await Promise.all(
      classes.map(async (classItem) => {
        classItem.subjectTeachers = classItem.subjectTeachers.filter(
          (teacherId) => {
            // Check if teacherId exists in the subjectTeachers of the subject
            return !subjectToDelete.subjectTeachers.includes(
              teacherId.toString(),
            );
          },
        );
        await classItem.save(); // Save the updated class
      }),
    );

    // Now delete the subject
    await subjectToDelete.deleteOne();

    res
      .status(StatusCodes.OK)
      .json({ message: "Subject deleted successfully and references updated" });
  } catch (error) {
    console.error(error); // Log the error for debugging
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};
