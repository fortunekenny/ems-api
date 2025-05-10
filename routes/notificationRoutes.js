import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";
import * as notificationController from "../controllers/notificationController.js";

const router = express.Router();

// Notification routes
router.post(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  notificationController.createNotification,
); // Create notification

router.post(
  "/allStudent/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  notificationController.sendNotificationToAllStudents,
);

router.post(
  "/allStaff/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  notificationController.sendNotificationToAllStaff,
);

router.post(
  "/allParent/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  notificationController.sendNotificationToAllParent,
);

router.post(
  "/allStudentsInClass/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  notificationController.sendNotificationToStudentsInClass,
);

router.post(
  "/assignmentNotification/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  notificationController.createNotificationForAssignment,
);

router.post(
  "/classworkNotification/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  notificationController.createNotificationForClasswork,
);

router.get(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor"),
  notificationController.getAllNotifications,
);

router.get(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher", "parent", "student", "staff"),
  notificationController.getNotificationById,
); // Get notification by ID

router.get(
  "/recipient/:userId",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher", "parent", "student", "staff"),
  notificationController.getNotificationsByRecipient,
); // Get all notifications for a specific user (recipient)

router.patch(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  notificationController.updateNotification,
); // Update notification

router.patch(
  "/seen/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher", "parent", "student", "staff"),
  notificationController.markNotificationAsSeen,
);

router.patch(
  "/read/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher", "parent", "student", "staff"),
  notificationController.markNotificationAsRead,
);

router.delete(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  notificationController.deleteNotification,
); // Delete notification

router.delete(
  "/:broadcastId/bulkDelete",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "proprietor", "teacher"),
  notificationController.deleteBroadcastNotifications,
); // Delete bulk notification

export default router;
