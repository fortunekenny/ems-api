import Student from "../models/StudentModel.js";

// Create a new student
/*export const createStudent = async (req, res) => {
  try {
    const {
      user,
      studentID,
      class: classId,
      guardian,
      session,
      term,
      age,
      gender,
      address,
      medicalHistory,
    } = req.body;
    const student = new Student({
      user,
      studentID,
      class: classId,
      guardian,
      session,
      term,
      age,
      gender,
      address,
      medicalHistory,
    });
    await student.save();
    res.status(201).json(student);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};*/

// Get all students
export const getStudents = async (req, res) => {
  try {
    const students = await Student.find().populate("user class guardian");
    res.status(200).json(students);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get student by ID
export const getStudentById = async (req, res) => {
  try {
    const student = await Student.findById(req.params.id).populate(
      "user class guardian",
    );
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.status(200).json(student);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update student details
export const updateStudent = async (req, res) => {
  try {
    const {
      class: classId,
      guardian,
      session,
      term,
      age,
      gender,
      address,
      medicalHistory,
    } = req.body;
    const updatedStudent = await Student.findByIdAndUpdate(
      req.params.id,
      {
        class: classId,
        guardian,
        session,
        term,
        age,
        gender,
        address,
        medicalHistory,
      },
      { new: true },
    );
    if (!updatedStudent)
      return res.status(404).json({ error: "Student not found" });
    res.status(200).json(updatedStudent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete student
export const deleteStudent = async (req, res) => {
  try {
    const student = await Student.findByIdAndDelete(req.params.id);
    if (!student) return res.status(404).json({ error: "Student not found" });
    res.status(200).json({ message: "Student deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
