import Parent from "../models/ParentModel.js";

// Create a parent record
// export const createParent = async (req, res) => {
//   try {
//     const { user, children, session, term } = req.body;
//     const parent = new Parent({ user, children, session, term });
//     await parent.save();
//     res.status(201).json(parent);
//   } catch (error) {
//     res.status(400).json({ error: error.message });
//   }
// };

// Get all parents
export const getParents = async (req, res) => {
  try {
    const parents = await Parent.find().populate("user children");
    res.status(200).json(parents);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get a parent by ID
export const getParentById = async (req, res) => {
  try {
    const parent = await Parent.findById(req.params.id).populate(
      "user children",
    );
    if (!parent) return res.status(404).json({ error: "Parent not found" });
    res.status(200).json(parent);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update parent record
export const updateParent = async (req, res) => {
  try {
    const { children, session, term } = req.body;
    const updatedParent = await Parent.findByIdAndUpdate(
      req.params.id,
      { children, session, term },
      { new: true },
    );
    if (!updatedParent)
      return res.status(404).json({ error: "Parent not found" });
    res.status(200).json(updatedParent);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete parent record
export const deleteParent = async (req, res) => {
  try {
    const parent = await Parent.findByIdAndDelete(req.params.id);
    if (!parent) return res.status(404).json({ error: "Parent not found" });
    res.status(200).json({ message: "Parent deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
