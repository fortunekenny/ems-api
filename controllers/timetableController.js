import Timetable from "../models/TimetableModel.js";

// Create a timetable entry
export const createTimetable = async (req, res) => {
  try {
    const {
      class: classId,
      subject,
      teacher,
      day,
      time,
      session,
      term,
    } = req.body;
    const timetable = new Timetable({
      class: classId,
      subject,
      teacher,
      day,
      time,
      session,
      term,
    });
    await timetable.save();
    res.status(201).json(timetable);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all timetables
export const getTimetables = async (req, res) => {
  try {
    const timetables = await Timetable.find().populate("class subject teacher");
    res.status(200).json(timetables);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get timetable by ID
export const getTimetableById = async (req, res) => {
  try {
    const timetable = await Timetable.findById(req.params.id).populate(
      "class subject teacher",
    );
    if (!timetable)
      return res.status(404).json({ error: "Timetable not found" });
    res.status(200).json(timetable);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get timetable for a specific class
export const getTimetableByClass = async (req, res) => {
  try {
    const timetable = await Timetable.find({
      class: req.params.classId,
      session: req.query.session,
      term: req.query.term,
    }).populate("class subject teacher");
    res.status(200).json(timetable);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a timetable entry
export const updateTimetable = async (req, res) => {
  try {
    const { subject, teacher, day, time, session, term } = req.body;
    const updatedTimetable = await Timetable.findByIdAndUpdate(
      req.params.id,
      { subject, teacher, day, time, session, term },
      { new: true },
    );
    if (!updatedTimetable)
      return res.status(404).json({ error: "Timetable not found" });
    res.status(200).json(updatedTimetable);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a timetable entry
export const deleteTimetable = async (req, res) => {
  try {
    const timetable = await Timetable.findByIdAndDelete(req.params.id);
    if (!timetable)
      return res.status(404).json({ error: "Timetable not found" });
    res.status(200).json({ message: "Timetable deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
