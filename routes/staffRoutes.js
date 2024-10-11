import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as staffController from "../controllers/staffController.js";

const router = express.Router();

// Role-based constants
const ADMIN = "admin";
const STAFF = "staff";

// Staff routes
// router.post(
//   "/",
//   authenticateToken,
//   authorizeRole(ADMIN),
//   staffController.createStaff,
// );
router.get(
  "/",
  authenticateToken,
  authorizeRole(ADMIN),
  staffController.getStaff,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  staffController.getStaffById,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  staffController.updateStaff,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  staffController.deleteStaff,
);

export default router;
