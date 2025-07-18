import express from "express";
import {
  createLessonNote,
  getAllLessonNotes,
  getLessonNoteById,
  updateLessonNote,
  deleteLessonNote,
  getLessonNoteBySubject,
  getLessonNoteByClass,
  getLessonNoteByApprovalStatus,
  getLessonNoteByWeek,
  approveLessonNote,
} from "../controllers/lessonNoteController.js";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

// Create a new lesson note
router.post(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  createLessonNote,
);

// Get all lesson notes
router.get(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"),
  getAllLessonNotes,
);

// Get a single lesson note by ID
router.get(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  getLessonNoteById,
);

router.get(
  "/subject/:subjectId",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  getLessonNoteBySubject,
); // New route for getting by subject
router.get(
  "/class/:classId",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  getLessonNoteByClass,
); // New route for getting by class
router.get(
  "/approved/:approved",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  getLessonNoteByApprovalStatus,
); // New route for status
router.get(
  "/week/:week",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  getLessonNoteByWeek,
); // New route for week

// Update a lesson note
router.patch(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  updateLessonNote,
);
router.patch(
  "/approve/:lessonNoteId",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  approveLessonNote,
);

// Delete a lesson note
router.delete(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"),
  deleteLessonNote,
);

export default router;
