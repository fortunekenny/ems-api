import express from "express";
import * as parentController from "../controllers/parentController.js";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";

const router = express.Router();

// Parent routes
// router.post(
//   "/",
//   authenticateToken,
//   authorizeRole(),
//   parentController.createParent,
// ); // Create parent
router.get(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  parentController.getParents,
); // Get all parents
router.get(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "teacher"),
  parentController.getParentById,
); // Get parent by ID
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "parent"),
  parentController.updateParent,
); // Update parent
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  parentController.deleteParent,
); // Delete parent

export default router;
