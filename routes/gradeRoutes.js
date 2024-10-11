import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as gradeController from "../controllers/gradeController.js";

const router = express.Router();

// Role-based constants
const ADMIN = "admin";
const STAFF = "staff";
const STUDENT = "student";

// Create a grade
router.post(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  gradeController.createGrade,
);

// Get all grades
router.get(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  gradeController.getGrades,
);

// Get grades for a specific student
router.get(
  "/student/:studentId",
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT),
  gradeController.getGradesForStudent,
);

// Get a specific grade by ID
router.get(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT),
  gradeController.getGradeById,
);

// Update a grade
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  gradeController.updateGrade,
);

// Delete a grade
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  gradeController.deleteGrade,
);

export default router;
