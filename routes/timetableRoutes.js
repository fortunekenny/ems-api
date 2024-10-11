import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as timetableController from "../controllers/timetableController.js";

const router = express.Router();

// Role-based constants
const ADMIN = "admin";
const STAFF = "staff";
const STUDENT = "student";

// Timetable routes
router.post(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  timetableController.createTimetable,
);

router.get(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT),
  timetableController.getTimetables, // Fetch all timetables
);

router.get(
  "/class/:classId", // Get timetable for a specific class
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT),
  timetableController.getTimetableByClass,
);

router.get(
  "/:id", // Get timetable by ID
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT),
  timetableController.getTimetableById, // Ensure this function exists in the controller
);

router.patch(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  timetableController.updateTimetable,
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  timetableController.deleteTimetable,
);

export default router;
