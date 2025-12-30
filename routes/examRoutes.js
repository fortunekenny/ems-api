import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";
import * as examController from "../controllers/examController.js";

const router = express.Router();

// Exam routes
router.post(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  examController.createExam,
);

router.post(
  "/:id/submit",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "student"),
  examController.submitExam,
); // Route to submit ClassWork

router.get(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  examController.getExams,
);
router.get(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher", "student"),
  examController.getExamById,
);
router.patch(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  examController.updateExam,
);

router.patch(
  "/:id/questionslist",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  examController.updateExamQuestionList,
);

router.delete(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"),
  examController.deleteExam,
);

export default router;
