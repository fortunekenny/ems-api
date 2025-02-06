import express from "express";
import {
  createStudentAnswer,
  getAllStudentsAnswer,
  getStudentAnswersById,
  updateStudentAnswer,
  deleteStudentAnswer,
  getStudentAnswersByEvaluation,
  downloadStudentAnswers,
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
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  getAllStudentsAnswer,
);
router.get(
  "/:studentAnswerId",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor", "student", "parent"),
  getStudentAnswersById,
); // Fetch answers by studentAnswerId

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
  authorizeRole("admin", "proprietor", "student"),
  upload.array("files", 5), // Middleware to handle file uploads
  updateStudentAnswer,
);

router.get(
  "/answers/:id/download",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "student", "teacher"),
  downloadStudentAnswers,
);

router.delete(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"),
  deleteStudentAnswer,
); // Delete an answer

export default router;
