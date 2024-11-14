import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as subjectController from "../controllers/subjectController.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

// Subject routes
router.post(
  "/",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  subjectController.createSubject,
);
router.get(
  "/",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  subjectController.getSubjects,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher"),
  checkStatus,
  subjectController.getSubjectById,
);

router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  subjectController.updateSubject,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  subjectController.deleteSubject,
);

export default router;
