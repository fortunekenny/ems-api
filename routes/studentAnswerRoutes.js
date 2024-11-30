import express from "express";
import {
  createStudentAnswer,
  getAnswersForStudentAndSubject,
  updateStudentAnswer,
  deleteStudentAnswer,
  getStudentAnswersByEvaluation,
} from "../controllers/studentAnswerController.js";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";
import upload from "../cloudinaryConfiguration.js";

const router = express.Router();

// Routes for student answers
/*router.post(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  createStudentAnswer,
); // Create a new student */
router.post(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  upload.array("files", 5), // Middleware to handle up to 5 files
  createStudentAnswer,
);
router.get(
  "/:studentId/:subjectId",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor", "student"),
  getAnswersForStudentAndSubject,
); // Fetch answers by student and subject
router.get(
  "/student/:studentId/evaluation/:evaluationTypeId/answers",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  getStudentAnswersByEvaluation,
);
/*router.patch(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"),
  updateStudentAnswer,
); // Update an existing answer*/
router.patch(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"),
  upload.array("files", 5), // Middleware to handle file uploads
  updateStudentAnswer,
);

router.delete(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"),
  deleteStudentAnswer,
); // Delete an answer

export default router;
