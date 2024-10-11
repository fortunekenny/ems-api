import express from "express";
import * as parentController from "../controllers/parentController.js";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";

const router = express.Router();

const ADMIN = "admin";
const STAFF = "staff";
const STUDENT = "student";
const PARENT = "parent";

// Parent routes
// router.post(
//   "/",
//   authenticateToken,
//   authorizeRole(ADMIN),
//   parentController.createParent,
// ); // Create parent
router.get(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  parentController.getParents,
); // Get all parents
router.get(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  parentController.getParentById,
); // Get parent by ID
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  parentController.updateParent,
); // Update parent
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  parentController.deleteParent,
); // Delete parent

export default router;
