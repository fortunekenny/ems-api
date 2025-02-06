import express from "express";
import {
  markStudentAttendanceForMorning,
  markStudentAttendanceForAfternoon,
  getAllAttendanceRecords,
  getAttendanceById,
  deleteStudentAttendanceForTerm,
} from "../controllers/attendanceController.js";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  getAllAttendanceRecords,
);
router.get(
  "/attendanceId",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher", "student", "parent"),
  getAttendanceById,
);
router.patch(
  "/:studentId/markMorning",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  markStudentAttendanceForMorning,
);
router.patch(
  "/:studentId/markAfternoon",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  markStudentAttendanceForAfternoon,
);

router.delete(
  "/student/:studentId/attendance/term",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"), // Ensure only authorized users can delete attendance records
  deleteStudentAttendanceForTerm,
);

export default router;
