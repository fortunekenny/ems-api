import Grade from "../models/GradeModel.js";

// Create a grade
export const createGrade = async (req, res) => {
  try {
    const { student, subject, teacher, grade, session, term, comments } =
      req.body;
    const newGrade = new Grade({
      student,
      subject,
      teacher,
      grade,
      session,
      term,
      comments,
    });
    await newGrade.save();
    res.status(201).json(newGrade);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all grades for a specific student
export const getGradesForStudent = async (req, res) => {
  try {
    const grades = await Grade.find({ student: req.params.studentId }).populate(
      "student subject teacher",
    );
    res.status(200).json(grades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a grade by ID
export const getGradeById = async (req, res) => {
  try {
    const grade = await Grade.findById(req.params.id).populate(
      "student subject teacher",
    );
    if (!grade) return res.status(404).json({ error: "Grade not found" });
    res.status(200).json(grade);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a grade
export const updateGrade = async (req, res) => {
  try {
    const { grade, comments } = req.body;
    const updatedGrade = await Grade.findByIdAndUpdate(
      req.params.id,
      { grade, comments },
      { new: true },
    );
    if (!updatedGrade)
      return res.status(404).json({ error: "Grade not found" });
    res.status(200).json(updatedGrade);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a grade
export const deleteGrade = async (req, res) => {
  try {
    const grade = await Grade.findByIdAndDelete(req.params.id);
    if (!grade) return res.status(404).json({ error: "Grade not found" });
    res.status(200).json({ message: "Grade deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all grades
export const getGrades = async (req, res) => {
  try {
    const grades = await Grade.find().populate("student subject teacher");
    res.status(200).json(grades);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
