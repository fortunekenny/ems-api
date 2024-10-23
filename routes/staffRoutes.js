import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as staffController from "../controllers/staffController.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

router
  .route("/")
  .get(
    [authenticateToken, checkStatus, authorizeRole("admin")],
    staffController.getStaff,
  );

router
  .route("/staff/all")
  .delete(
    [authenticateToken, checkStatus, authorizeRole("admin")],
    staffController.deleteAllStaff,
  );

router
  .route("/:id")
  .get(
    [authenticateToken, checkStatus, authorizeRole("admin", "staff")],
    staffController.getStaffById,
  )
  .patch(
    [authenticateToken, checkStatus, authorizeRole("admin")],
    staffController.updateStaff,
  )
  .delete(
    [authenticateToken, checkStatus, authorizeRole("admin")],
    staffController.deleteStaff,
  );

router
  .route("/staff/:id/status")
  .patch(
    [authenticateToken, checkStatus, authorizeRole("admin")],
    staffController.updateStaffStatus,
  );

/*
// Staff routes
router.get(
  "/",
  authenticateToken,
  checkStatus,
  authorizeRole("admin"),
  staffController.getStaff,
);

// DELETE all staff route (only admin can perform this)
router.delete(
  "/staff/all",
  authenticateToken,
  checkStatus,
  authorizeRole("admin"),
  staffController.deleteAllStaff,
);

// Route to get a single staff member by ID
router.get(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "staff"),
  staffController.getStaffById,
);

// Route to update staff status (Admin Only)
router.patch(
  "/staff/:id/status",
  authenticateToken,
  checkStatus,
  authorizeRole("admin"),
  staffController.updateStaffStatus,
);

// Route to update a staff member
router.patch(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin"),
  staffController.updateStaff,
);

// Route to delete a single staff member
router.delete(
  "/:id",
  authenticateToken,
  checkStatus,
  authorizeRole("admin"),
  staffController.deleteStaff,
);*/

export default router;
