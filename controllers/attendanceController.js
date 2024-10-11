import Attendance from "../models/AttendanceModel.js";

// Create or mark an attendance record
export const markAttendance = async (req, res) => {
  try {
    const { student, date, status, session, term, remarks } = req.body;
    const attendance = new Attendance({
      student,
      date,
      status,
      session,
      term,
      remarks,
    });
    await attendance.save();
    res.status(201).json(attendance);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all attendance records for a specific student
export const getAttendanceByStudent = async (req, res) => {
  try {
    const attendance = await Attendance.find({
      student: req.params.studentId,
      session: req.query.session,
      term: req.query.term,
    }).populate("student");
    res.status(200).json(attendance);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update attendance record
export const updateAttendance = async (req, res) => {
  try {
    const { status, remarks } = req.body;
    const updatedAttendance = await Attendance.findByIdAndUpdate(
      req.params.id,
      { status, remarks },
      { new: true },
    );
    if (!updatedAttendance)
      return res.status(404).json({ error: "Attendance not found" });
    res.status(200).json(updatedAttendance);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete attendance record
export const deleteAttendance = async (req, res) => {
  try {
    const attendance = await Attendance.findByIdAndDelete(req.params.id);
    if (!attendance)
      return res.status(404).json({ error: "Attendance not found" });
    res.status(200).json({ message: "Attendance deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
