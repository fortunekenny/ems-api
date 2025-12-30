import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";
import * as assignmentController from "../controllers/assignmentController.js"; // Ensure this path is also correct

const router = express.Router();

// Assignment routes
router.post(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  assignmentController.createAssignment,
);
router.post(
  "/:id/submit",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "student"),
  assignmentController.submitAssignment,
); // Route to submit assignment

router.get(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "student", "teacher"),
  assignmentController.getAssignments,
);

router.get(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "student", "teacher"),
  assignmentController.getAssignmentById,
);

router.patch(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  assignmentController.updateAssignment,
);

router.patch(
  "/:id/questionslist",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  assignmentController.updateAssignmentQuestionList,
);

router.delete(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"),
  assignmentController.deleteAssignment,
);

export default router;
