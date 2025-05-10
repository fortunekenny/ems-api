import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as studentController from "../controllers/studentController.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

// Student routes
router.get(
  "/",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  studentController.getStudents,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher", "parent", "student"),
  checkStatus,
  studentController.getStudentById,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor", "parent", "student"),
  checkStatus,
  studentController.updateStudent,
);

// Route to update student status (Admin Only)
router.patch(
  "/student/:id/status",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  studentController.updateStudentStatus,
);

// Route to update student isVerified (Admin Only)
router.patch(
  "/student/:studentId/verification",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  studentController.updateStudentVerification,
);

router.patch(
  "/student/:studentId/addStudentToAParent",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  studentController.addStudentToParent,
);

router.patch(
  "/student/:studentId/removeStudentFromAParent",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  studentController.removeStudentFromParent,
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  studentController.deleteStudent,
);

export default router;
