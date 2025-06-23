import Subject from "../models/SubjectModel.js";
import Class from "../models/ClassModel.js"; // Import the Class model
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import UnauthorizedError from "../errors/unauthorize.js"; // Direct import of UnauthorizedError
import InternalServerError from "../errors/internal-server-error.js";
import Student from "../models/StudentModel.js"; // Import the Student model
import Staff from "../models/StaffModel.js"; // Import the Staff model

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
      throw new BadRequestError(`Class not found`);
    }

    // Append the newly created subject's _id into the class's subjects array
    assignedClass.subjects.push(subject._id);
    await assignedClass.save(); // Save the class with the updated subjects array

    // Return subject details
    res.status(StatusCodes.CREATED).json({
      subject,
      message: `Subject created and added to ${assignedClass.className} class`,
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
export const getSubjectById = async (req, res, next) => {
  try {
    const { id: subjectId } = req.params;

    const subject = await Subject.findOne({ _id: subjectId }).populate([
      { path: "classId", select: "_id className" },
      { path: "subjectTeachers", select: "_id name email employeeID" },
      { path: "students", select: "_id name email studentID" },
    ]);
    if (!subject) {
      throw new NotFoundError(`Subject not found`);
    }
    res.status(StatusCodes.OK).json(subject);
  } catch (error) {
    console.error("Error in getting subject by ID", error);
    next(new InternalServerError(error.message));
  }
};

// Update subject
export const updateSubject = async (req, res, next) => {
  try {
    const { id: subjectId } = req.params;

    const {
      subjectName,
      subjectCode,
      students,
      subjectTeachers,
      classId,
      session,
      term,
    } = req.body;

    // Find the subject by ID
    const subject = await Subject.findOne({ _id: subjectId });

    if (!subject) {
      throw new NotFoundError(`No subject found with id: ${subjectId}`);
    }

    // Check if the current user has permission to update
    // checkPermissions(req.user, subject.user);

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
    console.error("Error in updating subject", error);
    next(new InternalServerError(error.message));
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
    console.error("Error in deleting subject", error);
    next(new InternalServerError(error.message));
  }
};

// Change subject teacher for a subject
export const changeSubjectTeacher = async (req, res, next) => {
  try {
    const { id: subjectId } = req.params;
    const { subjectTeachers } = req.body; // Array of new teacher IDs

    if (!subjectTeachers || !Array.isArray(subjectTeachers)) {
      throw new BadRequestError("subjectTeachers must be an array");
    }

    // Find the subject
    const subject = await Subject.findById(subjectId);
    if (!subject) {
      throw new NotFoundError(`Subject not found`);
    }

    // Get the classId for this subject
    const subjectClassId = subject.classId?.toString();
    const previousTeacherIds = subject.subjectTeachers.map((id) =>
      id.toString(),
    );
    const newTeacherIds = Array.isArray(subjectTeachers)
      ? subjectTeachers.map((id) => id.toString())
      : [];

    // Remove this subject from all previous teachers' subjects arrays
    await Staff.updateMany(
      { _id: { $in: previousTeacherIds } },
      { $pull: { subjects: subjectId } },
    );

    // Get the class for this subject
    const subjectClass = subjectClassId
      ? await Class.findById(subjectClassId)
      : null;

    // For each previous teacher, check if they have any other subject in this class
    for (const prevTeacherId of previousTeacherIds) {
      if (!newTeacherIds.includes(prevTeacherId)) {
        const prevTeacher = await Staff.findById(prevTeacherId);
        if (prevTeacher) {
          // Remove the subject from their subjects array (already done above)
          // Check if they have any other subject in this class
          const otherSubjects = await Subject.find({
            _id: { $in: prevTeacher.subjects },
            classId: subjectClassId,
          });
          if (otherSubjects.length === 0 && subjectClass) {
            // Remove the teacher from class.subjectTeachers if present
            subjectClass.subjectTeachers = subjectClass.subjectTeachers.filter(
              (id) => id.toString() !== prevTeacherId,
            );
            await subjectClass.save();

            // Remove the class from their classes array
            prevTeacher.classes = prevTeacher.classes.filter(
              (clsId) => clsId.toString() !== subjectClassId,
            );
            await prevTeacher.save();
          }
        }
      }
    }

    // Add new subject teachers to class.subjectTeachers if not already present
    if (subjectClass) {
      for (const teacherId of newTeacherIds) {
        if (
          !subjectClass.subjectTeachers
            .map((id) => id.toString())
            .includes(teacherId)
        ) {
          subjectClass.subjectTeachers.push(teacherId);
        }
      }
      await subjectClass.save();
    }

    // Add this subject to all new teachers' subjects arrays and add the class to their classes array if not present
    if (Array.isArray(subjectTeachers) && subjectTeachers.length > 0) {
      for (const teacherId of subjectTeachers) {
        const teacher = await Staff.findById(teacherId);
        if (teacher) {
          // Add subject if not present
          if (
            !teacher.subjects.map((id) => id.toString()).includes(subjectId)
          ) {
            teacher.subjects.push(subjectId);
          }
          // Add class if not present
          if (
            subjectClassId &&
            !teacher.classes.map((id) => id.toString()).includes(subjectClassId)
          ) {
            teacher.classes.push(subjectClassId);
          }
          await teacher.save();
        }
      }
      subject.subjectTeachers = subjectTeachers;
    } else {
      subject.subjectTeachers = [];
    }

    await subject.save();

    res.status(StatusCodes.OK).json({
      message: "Subject teacher(s) updated successfully",
      subject,
    });
  } catch (error) {
    console.log("Error in changing subject teacher", error);
    next(new InternalServerError(error.message));
  }
};
