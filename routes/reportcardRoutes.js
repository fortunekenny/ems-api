import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";
import * as reportCardController from "../controllers/reportcardController.js";

const router = express.Router();

// Create a report card
router.post(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  reportCardController.createReportCard,
);
// Create class report card
router.post(
  "/allClassStudents",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  reportCardController.createReportCardsForClass,
);

router.get(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  reportCardController.getReportCards,
);

// Get all report cards for a specific student
router.get(
  "/report-cards/student/:studentId",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher"),
  reportCardController.getReportCardsForStudent,
);

// Get a specific report card by ID
router.get(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher", "student", "parent"),
  reportCardController.getReportCardById,
);

// Update a report card
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher"),
  reportCardController.updateReportCard,
);

// Delete a report card
router.delete(
  "/:reportCardId",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  reportCardController.deleteReportCard,
);

export default router;
