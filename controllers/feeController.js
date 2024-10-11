import Fee from "../models/FeeModel.js";

// Create a new fee record
export const createFee = async (req, res) => {
  try {
    const { student, amountDue, dueDate, session, term } = req.body;
    const fee = new Fee({
      student,
      amountDue,
      dueDate,
      session,
      term,
    });
    await fee.save();
    res.status(201).json(fee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Get all fee records
export const getFees = async (req, res) => {
  try {
    const fees = await Fee.find()
      .populate("student", "name") // populate student's name
      .exec();
    res.status(200).json(fees);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Get fee record by ID
export const getFeeById = async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id)
      .populate("student", "name")
      .exec();
    if (!fee) {
      return res.status(404).json({ message: "Fee record not found" });
    }
    res.status(200).json(fee);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};

// Record an installment payment
export const recordInstallment = async (req, res) => {
  try {
    const { amount, datePaid } = req.body;
    const fee = await Fee.findById(req.params.id);

    if (!fee) {
      return res.status(404).json({ message: "Fee record not found" });
    }

    fee.installments.push({ amount, datePaid });
    fee.amountPaid += amount;

    await fee.save();
    res.status(200).json(fee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Update a fee record (e.g., if fee amount changes)
export const updateFee = async (req, res) => {
  try {
    const { amountDue, dueDate, session, term } = req.body;
    const updatedFee = await Fee.findByIdAndUpdate(
      req.params.id,
      { amountDue, dueDate, session, term, updatedAt: Date.now() },
      { new: true },
    );
    if (!updatedFee) {
      return res.status(404).json({ message: "Fee record not found" });
    }
    res.status(200).json(updatedFee);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
};

// Delete a fee record
export const deleteFee = async (req, res) => {
  try {
    const fee = await Fee.findByIdAndDelete(req.params.id);
    if (!fee) {
      return res.status(404).json({ message: "Fee record not found" });
    }
    res.status(200).json({ message: "Fee record deleted" });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
};
