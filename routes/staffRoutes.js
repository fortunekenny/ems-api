import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as staffController from "../controllers/staffController.js";

const router = express.Router();

// Staff routes
// router.post(
//   "/",
//   authenticateToken,
//   authorizeRole('admin'),
//   staffController.createStaff,
// );
router.get(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  staffController.getStaff,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "staff"),
  staffController.getStaffById,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  staffController.updateStaff,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  staffController.deleteStaff,
);

export default router;
