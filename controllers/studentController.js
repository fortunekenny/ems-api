import Student from "../models/StudentModel.js";
import Class from "../models/ClassModel.js";
import Subject from "../models/SubjectModel.js";
import Parent from "../models/ParentModel.js";
import NotFoundError from "../errors/not-found.js";
import { StatusCodes } from "http-status-codes";
import checkPermissions from "../utils/checkPermissions.js";
import Attendance from "../models/AttendanceModel.js";

// Get all students
export const getStudents = async (req, res) => {
  try {
    const students = await Student.find().select("-password");
    res.status(StatusCodes.OK).json({ count: students.length, students });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Get a student by ID
export const getStudentById = async (req, res) => {
  try {
    const { id: studentId } = req.params;
    // const student = await Student.findOne({ _id: studentId }).populate('class, guardian')
    const student = await Student.findOne({ _id: studentId })
      .select("-password")
      .populate([
        {
          path: "classId",
          select: "_id className classTeacher subjectTeachers subjects",
        },
        { path: "guardian", select: "_id name email" },
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
export const updateStudent = async (req, res) => {
  const { id: studentId } = req.params;
  const { name, email, classId, age, gender, address, guardianId } = req.body; // Fields to update

  try {
    // Find the student by ID
    const student = await Student.findById(studentId);
    if (!student) {
      throw new NotFoundError(`No student found with id: ${studentId}`);
    }

    // Generate current term and session
    const term = generateCurrentTerm(
      startTermGenerationDate,
      holidayDurationForEachTerm,
    );

    // Check for duplicate email
    if (email && email !== student.email) {
      const emailAlreadyExists = await Student.findOne({ email });
      if (emailAlreadyExists) {
        throw new BadRequestError("Email already exists.");
      }
    }

    checkPermissions(req.user, student.user);

    // Step 1: Remove student from previous guardian (if guardian changes)
    if (guardianId && guardianId !== student.guardian.toString()) {
      const previousGuardian = await Parent.findById(student.guardian);
      if (previousGuardian) {
        // Remove student from the previous guardian's children array
        previousGuardian.children.pull(student._id);
        await previousGuardian.save();
      }

      const newGuardian = await Parent.findById(guardianId);
      if (!newGuardian) {
        throw new NotFoundError(`Guardian with id ${guardianId} not found`);
      }
      student.guardian = guardianId; // Update the student's guardian
      newGuardian.children.push(student._id); // Add the student to the new guardian
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

    // Step 4: Update student fields (name, email, age, gender, address)
    student.name = name || student.name;
    student.email = email || student.email;
    student.age = age || student.age;
    student.gender = gender || student.gender;
    student.address = address || student.address;

    // Save the updated student record
    await student.save();

    res.status(StatusCodes.OK).json({
      message: "Student updated successfully",
      student,
    });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Update student status
export const updateStudentStatus = async (req, res) => {
  try {
    const { id: studentId } = req.params;
    const { status } = req.body; // Status to update (active or inactive)

    // Ensure status is valid
    if (!["active", "inactive"].includes(status)) {
      return res.status(StatusCodes.BAD_REQUEST).json({
        message: "Invalid status. Allowed values are 'active' or 'inactive'.",
      });
    }

    // Find the student
    const student = await Student.findById(studentId);

    if (!student) {
      throw new NotFoundError(`No student found with id: ${studentId}`);
    }

    // Update the student's status
    student.status = status;
    await student.save();

    res.status(StatusCodes.OK).json({
      message: `Student status updated to '${status}'.`,
      student,
    });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Delete student (Admin Only)
export const deleteStudent = async (req, res) => {
  try {
    const { id: studentId } = req.params;
    const student = await Student.findOne({ _id: studentId });

    if (!student) {
      throw new NotFoundError(`No student found with id: ${studentId}`);
    }

    // Ensure only admins can delete a student
    if (req.user.role !== "admin") {
      throw new UnauthorizedError("Only admins can delete student records.");
    }

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
    if (student.guardian) {
      await Parent.updateOne(
        { _id: student.guardian },
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
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};
