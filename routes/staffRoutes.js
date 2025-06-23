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
    [authenticateToken, checkStatus, authorizeRole("admin", "proprietor")],
    staffController.getStaff,
  );

// router
//   .route("/staff/all")
//   .delete(
//     [authenticateToken, checkStatus, authorizeRole("admin")],
//     staffController.deleteAllStaff,
//   );

router
  .route("/:staffId")
  .get(
    [
      authenticateToken,
      checkStatus,
      authorizeRole("admin", "proprietor", "teacher", "non-teacher"),
    ],
    staffController.getStaffById,
  )
  .patch(
    [
      authenticateToken,
      checkStatus,
      authorizeRole("admin", "proprietor", "teacher", "non-teacher"),
    ],
    staffController.updateStaff,
  )
  .delete(
    [authenticateToken, checkStatus, authorizeRole("admin", "proprietor")],
    staffController.deleteStaff,
  );

router
  .route("/:staffId/status")
  .patch(
    [authenticateToken, checkStatus, authorizeRole("admin", "proprietor")],
    staffController.updateStaffStatus,
  );

router
  .route("/:staffId/verify")
  .patch(
    [authenticateToken, checkStatus, authorizeRole("admin", "proprietor")],
    staffController.updateStaffVerification,
  );

router
  .route("/:staffId/classTeacher")
  .patch(
    [authenticateToken, checkStatus, authorizeRole("admin", "proprietor")],
    staffController.changeClassTeacher,
  );

router
  .route("/rolloverTeacherRecords")
  .post(
    [
      authenticateToken,
      checkStatus,
      authorizeRole("admin", "proprietor")
    ],
    staffController.rolloverTeacherRecords
  );

export default router;
