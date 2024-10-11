import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as reportCardController from "../controllers/reportcardController.js";

const router = express.Router();

// Role-based constants
const ADMIN = "admin";
const STAFF = "staff";
const STUDENT = "student";
const PARENT = "parent"; // Add this role if it's required

// Create a report card
router.post(
  "/report-cards",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  reportCardController.createReportCard,
);

// Get all report cards for a specific student
router.get(
  "/report-cards/student/:studentId",
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT, PARENT),
  reportCardController.getReportCardsForStudent,
);

// Get a specific report card by ID
router.get(
  "/report-cards/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT, PARENT),
  reportCardController.getReportCardById,
);

// Update a report card
router.patch(
  "/report-cards/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  reportCardController.updateReportCard,
);

// Delete a report card
router.delete(
  "/report-cards/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  reportCardController.deleteReportCard,
);

export default router;
