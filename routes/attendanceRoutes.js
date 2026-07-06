import express from "express";
import {
  markStudentAttendanceForMorning,
  markStudentAttendanceForAfternoon,
  getAllAttendanceRecords,
  getAttendanceById,
  updateAttendanceStatus,
  deleteStudentAttendanceForTerm,
  createStudentTermAttendance,
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
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher", "student", "parent"),
  getAttendanceById,
);
router.patch(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  updateAttendanceStatus,
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
  authorizeRole("admin", "proprietor"),
  deleteStudentAttendanceForTerm,
);
router.post(
  "/:studentId/createTermAttendance",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  createStudentTermAttendance,
);

export default router;
