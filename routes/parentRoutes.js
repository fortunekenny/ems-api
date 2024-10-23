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
  authorizeRole("admin"),
  checkStatus,
  parentController.getParents,
); // Get all parents
router.get(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "teacher", "parent"),
  checkStatus,
  parentController.getParentById,
); // Get parent by ID
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "parent"),
  checkStatus,
  parentController.updateParent,
); // Update parent

// Route to update parent status (Admin Only)
router.patch(
  "/:id/status",
  authenticateToken, // Middleware to authenticate the user
  authorizeRole("admin"), // Only admins can update parent status
  parentController.updateParentStatus,
);

router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  parentController.deleteParent,
); // Delete parent

export default router;
