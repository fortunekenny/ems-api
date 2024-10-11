import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as subjectController from "../controllers/subjectController.js";

const router = express.Router();

// Role-based constants
const ADMIN = "admin";
const STAFF = "staff";

// Subject routes
router.post(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  subjectController.createSubject,
);
router.get(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  subjectController.getSubjects,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  subjectController.getSubjectById,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  subjectController.updateSubject,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  subjectController.deleteSubject,
);

export default router;
