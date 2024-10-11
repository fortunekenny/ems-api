// const Exam = require("../models/Exam");

import Exam from "../models/ExamModel.js";

// Create an exam
export const createExam = async (req, res) => {
  try {
    const { name, class: classId, subjects, date, session, term } = req.body;
    const exam = new Exam({
      name,
      class: classId,
      subjects,
      date,
      session,
      term,
    });
    await exam.save();
    res.status(201).json(exam);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all exams
export const getExams = async (req, res) => {
  try {
    const exams = await Exam.find().populate("class subjects");
    res.status(200).json(exams);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get exam by ID
export const getExamById = async (req, res) => {
  try {
    const exam = await Exam.findById(req.params.id).populate("class subjects");
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    res.status(200).json(exam);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update an exam
export const updateExam = async (req, res) => {
  try {
    const { name, subjects, date, session, term } = req.body;
    const updatedExam = await Exam.findByIdAndUpdate(
      req.params.id,
      { name, subjects, date, session, term },
      { new: true },
    );
    if (!updatedExam) return res.status(404).json({ error: "Exam not found" });
    res.status(200).json(updatedExam);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete an exam
export const deleteExam = async (req, res) => {
  try {
    const exam = await Exam.findByIdAndDelete(req.params.id);
    if (!exam) return res.status(404).json({ error: "Exam not found" });
    res.status(200).json({ message: "Exam deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
