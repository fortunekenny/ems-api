import Student from "../models/StudentModel.js";
import NotFoundError from "../errors/not-found.js";
import { StatusCodes } from "http-status-codes";
import checkPermissions from "../utils/checkPermissions.js";

// Get all students
export const getStudents = async (req, res) => {
  try {
    const students = await Student.find().select("-password");
    res.status(StatusCodes.OK).json({ students, count: students.length });
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
        { path: "class" },
        { path: "guardian", select: "_id name email" },
      ]);

    if (!student) {
      throw new NotFoundError(`No student found with id: ${studentId}`);
    }

    res.status(StatusCodes.OK).json(student);
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};

// Update student details
export const updateStudent = async (req, res) => {
  try {
    const { id: studentId } = req.params;
    const {
      name,
      class: classId, // Destructure class and rename it to classId
      guardian,
      session,
      term,
      age,
      gender,
      address,
      medicalHistory,
    } = req.body;

    // Find the student by ID
    const student = await Student.findOne({ _id: studentId });

    if (!student) {
      throw new NotFoundError(`No student found with id: ${studentId}`);
    }

    // Check permissions for the user
    checkPermissions(req.user, student.user);

    // Update student fields with existing values if not provided
    student.name = name || student.name;
    student.class = classId || student.class;
    student.guardian = guardian || student.guardian;
    student.session = session || student.session;
    student.term = term || student.term;
    student.age = age || student.age;
    student.gender = gender || student.gender;
    student.address = address || student.address;
    student.medicalHistory = medicalHistory || student.medicalHistory;

    // Save the updated student
    await student.save();

    res.status(StatusCodes.OK).json(student);
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

    await student.deleteOne();
    res
      .status(StatusCodes.OK)
      .json({ message: "Student deleted successfully" });
  } catch (error) {
    res
      .status(StatusCodes.INTERNAL_SERVER_ERROR)
      .json({ message: error.message });
  }
};
