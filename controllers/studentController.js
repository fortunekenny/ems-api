import { StatusCodes } from "http-status-codes";
import NotFoundError from "../errors/not-found.js";
import Attendance from "../models/AttendanceModel.js";
import Class from "../models/ClassModel.js";
import Parent from "../models/ParentModel.js";
import Student from "../models/StudentModel.js";
import Subject from "../models/SubjectModel.js";
import checkPermissions from "../utils/checkPermissions.js";
import calculateAge from "../utils/ageCalculate.js";
import BadRequestError from "../errors/bad-request.js";
import UnauthorizedError from "../errors/unauthorize.js";
import InternalServerError from "../errors/internal-server-error.js";

// Get all students
export const getStudents = async (req, res, next) => {
  try {
    // Define allowed query parameters
    const allowedFilters = [
      "student", // combined filter for firstName, middleName, lastName, studentId
      "classId",
      "status",
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

    const { student, classId, status, term, session, sort, page, limit } =
      req.query;

    // Build an initial match stage for fields stored directly on Assignment
    const matchStage = {};

    if (term) matchStage.term = { $regex: term, $options: "i" };
    if (session) matchStage.session = session;
    if (status) matchStage.status = status;

    // Here we use $or on firstName, middleName, lastName, and employeeId if the 'student' parameter is provided.
    if (student) {
      matchStage.$or = [
        { firstName: { $regex: student, $options: "i" } },
        { middleName: { $regex: student, $options: "i" } },
        { lastName: { $regex: student, $options: "i" } },
        { employeeId: { $regex: student, $options: "i" } },
      ];
    }

    const pipeline = [];
    pipeline.push({ $match: matchStage });

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
    const joinMatch = {};

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
      "a-z": { firstName: 1 },
      "z-a": { firstName: -1 },
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
        firstName: 1,
        middleName: 1,
        lastName: 1,
        classData: {
          _id: "$classData._id",
          className: "$classData.className",
        },
        studentId: 1,
        status: 1,
        term: 1,
        session: 1,
        // Include other fields from student if needed.
      },
    });

    // Execute the aggregation pipeline
    const students = await Student.aggregate(pipeline);

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
    const countResult = await Student.aggregate(countPipeline);
    const totalStudents = countResult[0] ? countResult[0].total : 0;
    const numOfPages = Math.ceil(totalStudents / limitNumber);

    res.status(StatusCodes.OK).json({
      count: totalStudents,
      numOfPages,
      currentPage: pageNumber,
      students,
    });
  } catch (error) {
    console.error("Error getting all students:", error);
    next(new InternalServerError(error.message));
  }
};

export const updateStudentVerification = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { isVerified } = req.body;
    const { role } = req.user;

    // Only admin or proprietor allowed
    if (role !== "admin" && role !== "proprietor") {
      throw new UnauthorizedError(
        "Only admin or proprietor can update student verification status",
      );
    }

    if (typeof isVerified !== "boolean") {
      throw new BadRequestError("isVerified must be a boolean");
    }

    const student = await Student.findById(studentId);
    if (!student) {
      throw new NotFoundError(`Student not found`);
    }

    if (student.isVerified === isVerified) {
      throw new BadRequestError(
        `Student verification status is already '${isVerified}'`,
      );
    }

    student.isVerified = isVerified;
    await student.save();

    res.status(StatusCodes.OK).json({
      message: `Student verification status updated to '${isVerified}'`,
    });
  } catch (error) {
    console.error("Error updating student verification:", error);
    next(new InternalServerError(error.message));
  }
};

// Get a student by ID
export const getStudentById = async (req, res) => {
  try {
    const { id: studentId } = req.params;
    // const student = await Student.findOne({ _id: studentId }).populate('class, parentGuardianId')
    const student = await Student.findOne({ _id: studentId })
      .select("-password")
      .populate([
        {
          path: "classId",
          select: "_id className classTeacher subjectTeachers subjects",
          populate: [
            { path: "classTeacher", select: "_id firstName lastName" },
            { path: "subjectTeachers", select: "_id firstName lastName" },
            { path: "subjects", select: "_id subjectName" },
          ],
        },
        { path: "parentGuardianId", select: "_id name firstName lastName" },
      ]);

    if (!student) {
      throw new NotFoundError(`No student found with id: ${studentId}`);
    }

    checkPermissions(req.user, student.user);

    res.status(StatusCodes.OK).json(student);
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Update student details
export const updateStudent = async (req, res, next) => {
  const { id: studentId } = req.params;
  const {
    firstName,
    middleName,
    lastName,
    houseNumber,
    streetName,
    townOrCity,
    dateOfBirth,
    age,
    gender,
    email,
    role,
    term,
    session,
    parentGuardianId,
    classId,
  } = req.body; // Fields to update

  try {
    // Find the student by ID
    const student = await Student.findById(studentId);
    if (!student) {
      throw new NotFoundError(`No student found with id: ${studentId}`);
    }

    // Check for duplicate email
    if (email && email !== student.email) {
      const emailAlreadyExists = await Student.findOne({ email });
      if (emailAlreadyExists) {
        throw new BadRequestError("Email already exists.");
      }
    }

    checkPermissions(req.user, student.user);

    // Step 1: Remove student from previous parentGuardianId (if parentGuardianId changes)
    if (
      parentGuardianId &&
      parentGuardianId !== student.parentGuardianId.toString()
    ) {
      const previousGuardian = await Parent.findById(student.parentGuardianId);
      if (previousGuardian) {
        // Remove student from the previous parentGuardianId's children array
        previousGuardian.children.pull(student._id);
        await previousGuardian.save();
      }

      const newGuardian = await Parent.findById(parentGuardianId);
      if (!newGuardian) {
        throw new NotFoundError(
          `Guardian with id ${parentGuardianId} not found`,
        );
      }
      student.parentGuardianId = parentGuardianId; // Update the student's parentGuardianId
      newGuardian.children.push(student._id); // Add the student to the new parentGuardianId
      await newGuardian.save();
    }

    // Step 2: Remove student from previous class and subjects (if class changes)
    if (classId && classId !== student.classId.toString()) {
      // Remove student from previous class
      const previousClass = await Class.findById(student.classId);
      if (previousClass) {
        previousClass.students.pull(student._id);
        await previousClass.save();
      }

      // Remove student from all subjects associated with the previous class
      const previousSubjects = await Subject.find({
        _id: { $in: previousClass.subjects },
      });
      for (const subject of previousSubjects) {
        subject.students.pull(student._id); // Remove student from the subject
        await subject.save();
      }

      // Add student to the new class
      const newClass = await Class.findById(classId);
      if (!newClass) {
        throw new NotFoundError(`Class with id ${classId} not found`);
      }
      student.classId = classId; // Update student's class
      newClass.students.push(student._id); // Add student to new class
      await newClass.save();

      // Step 3: Add student to the new class's subjects
      const newSubjects = await Subject.find({
        _id: { $in: newClass.subjects },
      });
      for (const subject of newSubjects) {
        // Ensure the student is added to the subjects' students array
        if (!subject.students.includes(student._id)) {
          subject.students.push(student._id);
          await subject.save();
        }
      }
    }

    age = calculateAge(dateOfBirth);
    if (email) student.email = email;
    if (role) student.role = role;
    if (firstName) student.firstName = firstName;
    if (middleName) student.middleName = middleName;
    if (lastName) student.lastName = lastName;
    if (houseNumber) student.houseNumber = houseNumber;
    if (streetName) student.streetName = streetName;
    if (townOrCity) student.townOrCity = townOrCity;
    if (dateOfBirth) student.dateOfBirth = dateOfBirth;
    if (gender) student.gender = gender;
    if (term) student.term = term;
    if (session) student.session = session;
    if (parentGuardianId) student.parentGuardianId = parentGuardianId;
    if (classId) student.classId = classId;

    // Save the updated student record
    await student.save();

    const updatedPopulatedStudent = await Student.findById(student._id)
      .select("-password")
      .populate([
        {
          path: "classId",
          select: "_id className classTeacher subjectTeachers subjects",
          populate: [
            { path: "classTeacher", select: "_id firstName lastName" },
            { path: "subjectTeachers", select: "_id firstName lastName" },
            { path: "subjects", select: "_id subjectName" },
          ],
        },
        { path: "parentGuardianId", select: "_id name firstName lastName" },
      ]);

    res.status(StatusCodes.OK).json({
      message: "Student updated successfully",
      updatedPopulatedStudent,
    });
  } catch (error) {
    console.error("Error updating student:", error);
    next(new BadRequestError(error.message));
  }
};

// Update student status
export const updateStudentStatus = async (req, res, next) => {
  try {
    const { id: studentId } = req.params;
    const { status } = req.body; // Status to update (active or inactive)

    // Ensure status is valid
    if (!["active", "inactive"].includes(status)) {
      throw new BadRequestError(
        "Invalid status. Allowed values are 'active' or 'inactive'.",
      );
    }

    // Find the student
    const student = await Student.findById(studentId);

    if (!student) {
      throw new NotFoundError(`Student not found`);
    }

    // Update the student's status
    student.status = status;
    await student.save();

    res.status(StatusCodes.OK).json({
      message: `Student status updated to '${status}'.`,
    });
  } catch (error) {
    console.error("Error updating student:", error);
    next(new BadRequestError(error.message));
  }
};

export const addStudentToParent = async (req, res, next) => {
  try {
    const { studentId } = req.params; // student ID from URL
    const { parentId, parentRole } = req.body; // parentId and role (father, mother, singleParent) from body
    const { role } = req.user;

    // Only admin or proprietor can perform this action
    if (role !== "admin" && role !== "proprietor") {
      throw new UnauthorizedError(
        "Only admin or proprietor can add students to a parent",
      );
    }

    // Validate parentRole
    if (!["father", "mother", "singleParent"].includes(parentRole)) {
      throw new BadRequestError("Invalid parentRole specified");
    }

    // Find the parent document
    const parent = await Parent.findById(parentId);
    if (!parent) {
      throw new NotFoundError("Parent record not found");
    }

    const targetSection = parent[parentRole];

    if (!targetSection) {
      throw new NotFoundError(`No data found under ${parentRole}`);
    }

    if (!Array.isArray(targetSection.children)) {
      targetSection.children = [];
    }

    if (targetSection.children.includes(studentId)) {
      throw new BadRequestError("Student already linked to this parent role");
    }

    targetSection.children.push(studentId);
    await parent.save();

    res.status(StatusCodes.OK).json({
      message: `Student successfully added to ${parentRole}`,
    });
  } catch (error) {
    console.log("Add student error:", error);
    next(new InternalServerError(error.message));
  }
};

// Remove student from parent
export const removeStudentFromParent = async (req, res, next) => {
  try {
    const { studentId } = req.params;
    const { parentId, parentRole } = req.body;
    const { role } = req.user;

    // Only admin or proprietor can perform this action
    if (role !== "admin" && role !== "proprietor") {
      throw new UnauthorizedError(
        "Only admin or proprietor can remove students from a parent",
      );
    }

    // Validate parentRole
    if (!["father", "mother", "singleParent"].includes(parentRole)) {
      throw new BadRequestError("Invalid parentRole specified");
    }

    // Find the parent document
    const parent = await Parent.findById(parentId);
    if (!parent) {
      throw new NotFoundError("Parent record not found");
    }

    const targetSection = parent[parentRole];

    if (!targetSection || !Array.isArray(targetSection.children)) {
      throw new NotFoundError(
        `No valid ${parentRole} data or children list found`,
      );
    }

    const index = targetSection.children.indexOf(studentId);
    if (index === -1) {
      throw new NotFoundError("Student not linked to this parent role");
    }

    targetSection.children.splice(index, 1); // Remove student
    await parent.save();

    res.status(StatusCodes.OK).json({
      message: `Student successfully removed from ${parentRole}`,
    });
  } catch (error) {
    console.log("Remove student error:", error);
    next(new InternalServerError(error.message));
  }
};

// Delete student (Admin Only)
export const deleteStudent = async (req, res, next) => {
  try {
    const { id: studentId } = req.params;
    const student = await Student.findOne({ _id: studentId });

    // console.log("role", req.user.role);

    if (!student) {
      throw new NotFoundError(`No student found with id: ${studentId}`);
    }

    // Ensure only admins can delete a student
    // if (req.user.role !== "admin") {
    //   throw new UnauthorizedError("Only admins can delete student records.");
    // }

    // Step 1: Remove the student from all related classes
    await Class.updateMany(
      { students: studentId }, // Find classes where the student is referenced
      { $pull: { students: studentId } }, // Remove the student from the students array
    );

    // Step 2: Remove the student from all related subjects
    await Subject.updateMany(
      { students: studentId }, // Find subjects where the student is referenced
      { $pull: { students: studentId } }, // Remove the student from the students array
    );

    // Step 3: Optionally, remove the student from the parent's children array
    if (student.parentGuardianId) {
      await Parent.updateOne(
        { _id: student.parentGuardianId },
        { $pull: { children: studentId } }, // Remove the student from the parent's children array
      );
    }

    // Step 4: Delete all attendance records associated with the student
    await Attendance.deleteMany({ student: studentId });

    // Step 5: Delete the student record
    await student.deleteOne();

    res
      .status(StatusCodes.OK)
      .json({ message: "Student and associated records deleted successfully" });
  } catch (error) {
    console.error("Error deleting student:", error);
    next(new BadRequestError(error.message));
  }
};
