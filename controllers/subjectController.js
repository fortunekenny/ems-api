// const Subject = require("../models/Subject");
import Subject from "../models/SubjectModel.js";

// Create a new subject
export const createSubject = async (req, res) => {
  try {
    const {
      subjectName,
      subjectCode,
      teacher,
      class: classId,
      session,
      term,
    } = req.body;
    const subject = new Subject({
      subjectName,
      subjectCode,
      teacher,
      class: classId,
      session,
      term,
    });
    await subject.save();
    res.status(201).json(subject);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all subjects
export const getSubjects = async (req, res) => {
  try {
    const subjects = await Subject.find().populate("teacher class");
    res.status(200).json(subjects);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get subject by ID
export const getSubjectById = async (req, res) => {
  try {
    const subject = await Subject.findById(req.params.id).populate(
      "teacher class",
    );
    if (!subject) return res.status(404).json({ error: "Subject not found" });
    res.status(200).json(subject);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update subject
export const updateSubject = async (req, res) => {
  try {
    const {
      subjectName,
      subjectCode,
      teacher,
      class: classId,
      session,
      term,
    } = req.body;
    const updatedSubject = await Subject.findByIdAndUpdate(
      req.params.id,
      { subjectName, subjectCode, teacher, class: classId, session, term },
      { new: true },
    );
    if (!updatedSubject)
      return res.status(404).json({ error: "Subject not found" });
    res.status(200).json(updatedSubject);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete subject
export const deleteSubject = async (req, res) => {
  try {
    const subject = await Subject.findByIdAndDelete(req.params.id);
    if (!subject) return res.status(404).json({ error: "Subject not found" });
    res.status(200).json({ message: "Subject deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
