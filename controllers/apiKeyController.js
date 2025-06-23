import crypto from "crypto";
import ApiKey from "../models/ApikeyModel.js";
import { StatusCodes } from "http-status-codes";
import InternalServerError from "../errors/internal-server-error.js";

// Generate a new API key for an app
export const createApiKey = async (req, res, next) => {
  try {
    const { appName, role, metadata } = req.body;

    const key = crypto.randomBytes(32).toString("hex");

    const apiKey = await ApiKey.create({
      key,
      appName,
      role,
      metadata,
    });

    res.status(StatusCodes.CREATED).json({
      message: "API key created",
      appName: apiKey.appName,
      apiKey: apiKey.key, // only show this once
      role: apiKey.role,
    });
  } catch (error) {
    console.log("Error creating API key:", error);
    next(new InternalServerError(error.message));
  }
};

// Get all existing API keys
export const getAllApiKeys = async (req, res, next) => {
  try {
    const keys = await ApiKey.find().sort({ createdAt: -1 });
    res.status(200).json(keys);
  } catch (error) {
    console.log("Error fetching API keys:", error);
    next(new InternalServerError(error.message));
  }
};

// Deactivate a key (soft delete)
export const deactivateApiKey = async (req, res, next) => {
  try {
    const { id } = req.params;
    await ApiKey.findByIdAndUpdate(id, { active: false });
    res.status(StatusCodes.OK).json({ message: "API key deactivated" });
  } catch (error) {
    console.log("Error deactivating API key:", error);
    next(new InternalServerError(error.message));
  }
};

// Reactivate a previously disabled key
export const reactivateApiKey = async (req, res, next) => {
  try {
    const { id } = req.params;
    await ApiKey.findByIdAndUpdate(id, { active: true });
    res.status(StatusCodes.OK).json({ message: "API key reactivated" });
  } catch (error) {
    console.log("Error reactivating API key:", error);
    next(new InternalServerError(error.message));
  }
};

// Optional: delete key permanently
export const deleteApiKey = async (req, res, next) => {
  try {
    const { id } = req.params;
    await ApiKey.findByIdAndDelete(id);
    res.status(StatusCodes.OK).json({ message: "API key deleted permanently" });
  } catch (error) {
    console.log("Error deleting API key:", error);
    next(new InternalServerError(error.message));
  }
};
