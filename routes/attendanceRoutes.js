import express from "express";
import {
  getAttendanceForStudent,
  markAttendanceForToday,
  getAttendanceForClass,
  getClassAttendanceForToday,
  deleteStudentAttendanceForTerm,
} from "../controllers/attendanceController.js";
import {
  authenticateToken,
  authorizeRole,
  authorizeClassTeacherOrAdminOrParent,
  authorizeClassTeacherOrAdmin,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

router.patch(
  "/student/:studentId/mark",
  authenticateToken,
  checkStatus,
  // authorizeClassTeacherOrAdmin,
  authorizeRole("admin proprietor teacher"),
  markAttendanceForToday,
);
router.get(
  "/student/:studentId/attendance",
  authenticateToken,
  checkStatus,
  // authorizeClassTeacherOrAdminOrParent,
  authorizeRole("admin", "proprietor", "teacher", "parent", "student"),
  getAttendanceForStudent,
);
router.get(
  "/class/:classId/attendance",
  authenticateToken,
  checkStatus,
  // authorizeClassTeacherOrAdmin,
  authorizeRole("admin", "proprietor", "teacher"),
  getAttendanceForClass,
);
router.get(
  "/class/:classId/today",
  authenticateToken,
  checkStatus,
  // authorizeClassTeacherOrAdmin,
  authorizeRole("admin", "proprietor", "teacher"),
  getClassAttendanceForToday,
);

router.delete(
  "/student/:studentId/attendance/term",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"), // Ensure only authorized users can delete attendance records
  deleteStudentAttendanceForTerm,
);

export default router;
