import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";
import * as timetableController from "../controllers/timetableController.js";

const router = express.Router();

// Week Timetable CRUD routes
router.post(
  "/week",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  timetableController.createWeekTimetable,
);

router.get(
  "/week",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher", "parent", "student"),
  checkStatus,
  timetableController.getWeekTimetable,
);

router.patch(
  "/week/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  timetableController.updateWeekTimetable,
);

router.delete(
  "/week/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  timetableController.deleteWeekTimetable,
);

export default router;
