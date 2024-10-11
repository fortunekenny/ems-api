import Assignment from "../models/AssignmentModel.js";

// Create a new assignment
export const createAssignment = async (req, res) => {
  try {
    const {
      title,
      description,
      dueDate,
      teacher,
      class: classId,
      students,
      session,
      term,
    } = req.body;

    const newAssignment = new Assignment({
      title,
      description,
      dueDate,
      teacher,
      class: classId,
      students,
      session,
      term,
    });

    const savedAssignment = await newAssignment.save();
    res.status(201).json(savedAssignment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get all assignments
export const getAssignments = async (req, res) => {
  try {
    const assignments = await Assignment.find()
      .populate("teacher", "name") // populate teacher's name
      .populate("class", "name") // populate class name
      .populate("students", "name"); // populate students' names
    res.json(assignments);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get assignment by ID
export const getAssignmentById = async (req, res) => {
  try {
    const assignment = await Assignment.findById(req.params.id)
      .populate("teacher", "name")
      .populate("class", "name")
      .populate("students", "name");

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.json(assignment);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Update an assignment
export const updateAssignment = async (req, res) => {
  try {
    const {
      title,
      description,
      dueDate,
      teacher,
      class: classId,
      students,
      session,
      term,
    } = req.body;

    const updatedAssignment = await Assignment.findByIdAndUpdate(
      req.params.id,
      {
        title,
        description,
        dueDate,
        teacher,
        class: classId,
        students,
        session,
        term,
        updatedAt: Date.now(),
      },
      { new: true },
    );

    if (!updatedAssignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.json(updatedAssignment);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete an assignment
export const deleteAssignment = async (req, res) => {
  try {
    const assignment = await Assignment.findByIdAndDelete(req.params.id);

    if (!assignment) {
      return res.status(404).json({ message: "Assignment not found" });
    }
    res.json({ message: "Assignment deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
