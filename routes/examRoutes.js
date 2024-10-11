import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as examController from "../controllers/examController.js";

const router = express.Router();

// Role-based constants
const ADMIN = "admin";
const STAFF = "staff";
const STUDENT = "student";

// Exam routes
router.post(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  examController.createExam,
);
router.get(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  examController.getExams,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT),
  examController.getExamById,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  examController.updateExam,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  examController.deleteExam,
);

export default router;
