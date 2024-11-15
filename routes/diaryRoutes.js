import express from "express";
import {
  createDiary,
  getAllDairies,
  getDiaryById,
  updateDiary,
  approveDiary,
  deleteDiary,
} from "../controllers/diaryController.js";
// import authMiddleware from "../middleware/authMiddleware.js"; // Assuming this handles user authentication
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

// Route to create a new diary entry
router.post(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  createDiary,
);

// Route to get all diary entries
router.get(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"),
  getAllDairies,
);

// Route to get a single diary entry by ID
router.get(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  getDiaryById,
);

// Route to update a diary entry by ID
router.patch(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  updateDiary,
);

router.patch(
  "/approve/:diaryId",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  approveDiary,
);

// Route to delete a diary entry by ID
router.delete(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"),
  deleteDiary,
);

export default router;
