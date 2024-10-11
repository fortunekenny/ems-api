import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as attendanceController from "../controllers/attendanceController.js";

const router = express.Router();

// Role-based constants
const ADMIN = "admin";
const STAFF = "staff";
const STUDENT = "student";

// Route to create or mark attendance
router.post(
  "/attendance",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  attendanceController.markAttendance,
);

// Route to get attendance records for a specific student
router.get(
  "/attendance/:studentId",
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT),
  attendanceController.getAttendanceByStudent,
);

// Route to update attendance
router.patch(
  "/attendance/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  attendanceController.updateAttendance,
);

// Route to delete attendance
router.delete(
  "/attendance/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  attendanceController.deleteAttendance,
);

export default router;
