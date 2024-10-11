// const Class = require("../models/Class");
import Class from "../models/ClassModel.js";

// Create a new class
export const createClass = async (req, res) => {
  try {
    const {
      className,
      section,
      teacher,
      students,
      subjects,
      session,
      term,
      timetable,
    } = req.body;
    const newClass = new Class({
      className,
      section,
      teacher,
      students,
      subjects,
      session,
      term,
      timetable,
    });
    await newClass.save();
    res.status(201).json(newClass);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all classes
export const getClasses = async (req, res) => {
  try {
    const classes = await Class.find().populate("teacher students subjects");
    res.status(200).json(classes);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get class by ID
export const getClassById = async (req, res) => {
  try {
    const classData = await Class.findById(req.params.id).populate(
      "teacher students subjects",
    );
    if (!classData) return res.status(404).json({ error: "Class not found" });
    res.status(200).json(classData);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update class
export const updateClass = async (req, res) => {
  try {
    const {
      className,
      section,
      teacher,
      students,
      subjects,
      session,
      term,
      timetable,
    } = req.body;
    const updatedClass = await Class.findByIdAndUpdate(
      req.params.id,
      {
        className,
        section,
        teacher,
        students,
        subjects,
        session,
        term,
        timetable,
      },
      { new: true },
    );
    if (!updatedClass)
      return res.status(404).json({ error: "Class not found" });
    res.status(200).json(updatedClass);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete class
export const deleteClass = async (req, res) => {
  try {
    const classData = await Class.findByIdAndDelete(req.params.id);
    if (!classData) return res.status(404).json({ error: "Class not found" });
    res.status(200).json({ message: "Class deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
