import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js"; // Check if the file path is correct
import * as assignmentController from "../controllers/assignmentController.js"; // Ensure this path is also correct

const router = express.Router();

// Role-based constants
const ADMIN = "admin";
const STAFF = "staff";
const STUDENT = "student";

// Assignment routes
router.post(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  assignmentController.createAssignment,
);
router.get(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT),
  assignmentController.getAssignments,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT),
  assignmentController.getAssignmentById,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  assignmentController.updateAssignment,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  assignmentController.deleteAssignment,
);

export default router;
