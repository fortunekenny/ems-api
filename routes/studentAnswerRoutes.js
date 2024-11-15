import express from "express";
import {
  createStudentAnswer,
  getAnswersForStudentAndSubject,
  updateStudentAnswer,
  deleteStudentAnswer,
} from "../controllers/studentAnswerController.js";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

// Routes for student answers
router.post(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  createStudentAnswer,
); // Create a new student answer
router.get(
  "/:studentId/:subjectId",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor", "student"),
  getAnswersForStudentAndSubject,
); // Fetch answers by student and subject
router.patch(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"),
  updateStudentAnswer,
); // Update an existing answer
router.delete(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"),
  deleteStudentAnswer,
); // Delete an answer

export default router;
