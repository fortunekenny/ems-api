import express from "express";
import {
  createClassWork,
  getAllClassWorks,
  getClassWorkById,
  updateClassWork,
  deleteClassWork,
} from "../controllers/classWorkController.js";

const router = express.Router();

// Routes
router.post("/", createClassWork); // Create ClassWork
router.get("/", getAllClassWorks); // Get all ClassWorks
router.get("/:id", getClassWorkById); // Get ClassWork by ID
router.put("/:id", updateClassWork); // Update ClassWork
router.delete("/:id", deleteClassWork); // Delete ClassWork

export default router;
