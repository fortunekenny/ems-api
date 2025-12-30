import express from "express";
import {
  createClassWork,
  getAllClassWorks,
  getClassWorkById,
  updateClassWork,
  submitClassWork,
  deleteClassWork,
  updateClassWorkQuestionList,
} from "../controllers/classWorkController.js";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

// Routes
router.post(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  createClassWork,
); // Create ClassWork

router.post(
  "/:id/submit",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "student"),
  submitClassWork,
); // Route to submit ClassWork

router.get(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "student", "teacher"),
  getAllClassWorks,
); // Get all ClassWorks
router.get(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "student", "teacher"),
  getClassWorkById,
); // Get ClassWork by ID
router.patch(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  updateClassWork,
); // Update ClassWork

router.patch(
  "/:id/questionslist",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  updateClassWorkQuestionList,
); // Update ClassWork

router.delete(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"),
  deleteClassWork,
); // Delete ClassWork

export default router;
