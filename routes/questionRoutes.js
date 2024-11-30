import express from "express";
import {
  createQuestion,
  getQuestionsByLessonNote,
  getQuestionById,
  updateQuestion,
  deleteQuestion,
} from "../controllers/questionController.js";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";
import upload from "../cloudinaryConfiguration.js";

const router = express.Router();

// Route to create a question
router.post(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  upload.array("files", 5), // Middleware to handle up to 5 files
  createQuestion,
);

/*router.post(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  createQuestion,
);*/

// Route to get all questions for a specific lesson note
router.get(
  "/lessonNote/:lessonNoteId",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  getQuestionsByLessonNote,
);

// Route to get a specific question by ID
router.get(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  getQuestionById,
);

// Route to update a question by ID
router.patch(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  upload.array("files", 5), // Middleware to handle file uploads
  updateQuestion,
);
/*router.patch(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  updateQuestion,
);*/

// Route to delete a question by ID
router.delete(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  deleteQuestion,
);

export default router;
