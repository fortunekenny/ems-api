import express from "express";
import {
  createNotification,
  getNotificationById,
  getNotificationsByRecipient,
  updateNotification,
  deleteNotification,
} from "../controllers/notificationController.js";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";

const router = express.Router();

const ADMIN = "admin";
const STAFF = "staff";
const STUDENT = "student";
const PARENT = "parent";

// Notification routes
router.post(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  createNotification,
); // Create notification
router.get(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  getNotificationById,
); // Get notification by ID
router.get(
  "/recipient/:userId",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  getNotificationsByRecipient,
); // Get all notifications for a specific user (recipient)
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  updateNotification,
); // Update notification
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  deleteNotification,
); // Delete notification

export default router;
