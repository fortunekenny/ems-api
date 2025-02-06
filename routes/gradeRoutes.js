import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";
import * as gradeController from "../controllers/gradeController.js";

const router = express.Router();

// Create a grade
router.post(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  gradeController.createGrade,
);

// Get all grades
router.get(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  gradeController.getGrades,
);

// Get grades for a specific student
router.get(
  "/student/:studentId",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher"),
  gradeController.getGradesForStudent,
);

// Get a specific grade by ID
router.get(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher"),
  gradeController.getGradeById,
);

// Update a grade
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher"),
  gradeController.updateGrade,
);

// Delete a grade
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  gradeController.deleteGrade,
);

export default router;
