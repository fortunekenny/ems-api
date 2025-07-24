import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as staffController from "../controllers/staffController.js";
import { checkStatus } from "../utils/checkStatus.js";
import checkPermissions from "../utils/checkPermissions.js";

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

/* 
  async (req, res, next) => {
    await checkPermissions(req.user, req.params.id);
    next();
  },
*/

router
  .route("/:staffId")
  .get(
    [
      authenticateToken,
      authorizeRole("admin", "proprietor", "teacher", "non-teacher"),
      checkPermissions,
      checkStatus,
    ],
    staffController.getStaffById,
  )
  .patch(
    [
      authenticateToken,
      authorizeRole("admin", "proprietor", "teacher", "non-teacher"),
      checkStatus,
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
    [authenticateToken, checkStatus, authorizeRole("admin", "proprietor")],
    staffController.rolloverTeacherRecords,
  );

export default router;
