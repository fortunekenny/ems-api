import { StatusCodes } from "http-status-codes";
import Fee from "../models/FeeModel.js";
import {
  getCurrentTermDetails,
  holidayDurationForEachTerm,
  startTermGenerationDate,
} from "../utils/termGenerator.js";
import InternalServerError from "../errors/internal-server-error.js";
import NotFoundError from "../errors/not-found.js";

// Create a new fee record
export const createFee = async (req, res, next) => {
  try {
    const { student, amountDue, dueDate } = req.body;

    // Use getCurrentTermDetails to determine session and term
    const termDetails = getCurrentTermDetails(
      holidayDurationForEachTerm,
      startTermGenerationDate,
    );

    const fee = new Fee({
      student,
      amountDue,
      dueDate,
      session: termDetails.session,
      term:
        termDetails.term.charAt(0).toUpperCase() + termDetails.term.slice(1), // Capitalize
    });
    await fee.save();
    res.status(StatusCodes.CREATED).json(fee);
  } catch (error) {
    console.log("Error creating fee record:", error);
    next(new InternalServerError(error.message));
  }
};

// Get all fee records
export const getFees = async (req, res) => {
  try {
    const fees = await Fee.find()
      .populate("student", "name") // populate student's name
      .exec();
    res.status(StatusCodes.OK).json(fees);
  } catch (error) {
    console.log("Error fetching fee records:", error);
    next(new InternalServerError(error.message));
  }
};

// Get fee record by ID
export const getFeeById = async (req, res) => {
  try {
    const fee = await Fee.findById(req.params.id)
      .populate("student", "name")
      .exec();
    if (!fee) {
      throw new NotFoundError("Fee record not found");
    }
    res.status(StatusCodes.OK).json(fee);
  } catch (error) {
    console.log("Error fetching fee record:", error);
    next(new InternalServerError(error.message));
  }
};

// Record an installment payment
export const recordInstallment = async (req, res) => {
  try {
    const { amount, datePaid } = req.body;
    const fee = await Fee.findById(req.params.id);

    if (!fee) {
      throw new NotFoundError("Fee record not found");
    }

    fee.installments.push({ amount, datePaid });
    fee.amountPaid += amount;

    await fee.save();
    res.status(StatusCodes.OK).json(fee);
  } catch (error) {
    console.log("Error recording installment:", error);
    next(new InternalServerError(error.message));
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
      throw new NotFoundError("Fee record not found");
    }
    res.status(StatusCodes.OK).json(updatedFee);
  } catch (error) {
    console.log("Error updating fee record:", error);
    next(new InternalServerError(error.message));
  }
};

// Delete a fee record
export const deleteFee = async (req, res) => {
  try {
    const fee = await Fee.findByIdAndDelete(req.params.id);
    if (!fee) {
      throw new NotFoundError("Fee record not found");
    }
    res.status(StatusCodes.OK).json({ message: "Fee record deleted" });
  } catch (error) {
    console.log("Error deleting fee record:", error);
    next(new InternalServerError(error.message));
  }
};
