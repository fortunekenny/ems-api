import express from "express";
import * as parentController from "../controllers/parentController.js";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

router.get(
  "/",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  parentController.getParents,
); // Get all parents

router.get(
  "/:parentId",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher", "parent" /* , "student" */),
  checkStatus,
  parentController.getParentByParentId,
); // Get parent by ID

router.get(
  "/:userId/user",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher", "parent" /* , "student" */),
  checkStatus,
  parentController.getParentByUserId,
); // Get parent by user ID

router.patch(
  "/:id",
  authenticateToken,
  authorizeRole(
    "admin",
    "proprietor",
    "parent",
    "mother",
    "father",
    "singleParent",
  ),
  checkStatus,
  parentController.updateParent,
); // Update parent

// Route to update parent status (Admin Only)
router.patch(
  "/:userId/status",
  authenticateToken, // Middleware to authenticate the user
  authorizeRole("admin", "proprietor"), // Only admins can update parent status
  parentController.updateParentStatus,
);

router.patch(
  "/:parentId/verify",
  authenticateToken, // Middleware to authenticate the user
  authorizeRole("admin", "proprietor"), // Only admins can update parent status
  parentController.updateParentVerificationStatus,
);

router.patch(
  "/:studentId/assignParent",
  authenticateToken, // Middleware to authenticate the user
  authorizeRole("admin", "proprietor"), // Only admins can update parent status
  parentController.assignParentToStudent,
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  parentController.deleteParent,
); // Delete parent

export default router;
