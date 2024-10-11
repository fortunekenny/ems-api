import ReportCard from "../models/ReportcardModel.js";

// Create a report card
export const createReportCard = async (req, res) => {
  try {
    const {
      student,
      class: classId,
      grades,
      session,
      term,
      comments,
    } = req.body;
    const reportCard = new ReportCard({
      student,
      class: classId,
      grades,
      session,
      term,
      comments,
    });
    await reportCard.save();
    res.status(201).json(reportCard);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get all report cards for a specific student
export const getReportCardsForStudent = async (req, res) => {
  try {
    const reportCards = await ReportCard.find({
      student: req.params.studentId,
      session: req.query.session,
      term: req.query.term,
    }).populate("student class grades");
    res.status(200).json(reportCards);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get report card by ID
export const getReportCardById = async (req, res) => {
  try {
    const reportCard = await ReportCard.findById(req.params.id).populate(
      "student class grades",
    );
    if (!reportCard)
      return res.status(404).json({ error: "Report card not found" });
    res.status(200).json(reportCard);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update a report card
export const updateReportCard = async (req, res) => {
  try {
    const { grades, comments, session, term } = req.body;
    const updatedReportCard = await ReportCard.findByIdAndUpdate(
      req.params.id,
      { grades, comments, session, term },
      { new: true },
    );
    if (!updatedReportCard)
      return res.status(404).json({ error: "Report card not found" });
    res.status(200).json(updatedReportCard);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete a report card
export const deleteReportCard = async (req, res) => {
  try {
    const reportCard = await ReportCard.findByIdAndDelete(req.params.id);
    if (!reportCard)
      return res.status(404).json({ error: "Report card not found" });
    res.status(200).json({ message: "Report card deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
