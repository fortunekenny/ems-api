import Staff from "../models/StaffModel.js";

// Controller to get all staff members
export const getStaff = async (req, res) => {
  try {
    const staff = await Staff.find().populate("user");
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Controller to get a staff member by ID
export const getStaffById = async (req, res) => {
  try {
    const staff = await Staff.findById(req.params.id).populate("user");
    if (!staff) {
      return res.status(404).json({ message: "Staff not found" });
    }
    res.json(staff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Controller to update a staff member
export const updateStaff = async (req, res) => {
  try {
    const updatedStaff = await Staff.findByIdAndUpdate(
      req.params.id,
      req.body,
      { new: true },
    ).populate("user");
    if (!updatedStaff) {
      return res.status(404).json({ message: "Staff not found" });
    }
    res.json(updatedStaff);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Controller to delete a staff member
export const deleteStaff = async (req, res) => {
  try {
    const deletedStaff = await Staff.findByIdAndDelete(req.params.id);
    if (!deletedStaff) {
      return res.status(404).json({ message: "Staff not found" });
    }
    res.json({ message: "Staff deleted successfully" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
