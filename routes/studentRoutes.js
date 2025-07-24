import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as studentController from "../controllers/studentController.js";
import { checkStatus } from "../utils/checkStatus.js";
import checkPermissions from "../utils/checkPermissions.js";

const router = express.Router();

// Student routes
router.get(
  "/",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  studentController.getStudents,
);

router.get(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher", "parent", "student"),
  // checkPermissions,
  async (req, res, next) => {
    await checkPermissions(req.user, req.params.id);
    next();
  },
  checkStatus,
  // await checkPermissions(req.user, req.body.studentId);
  studentController.getStudentById,
);

router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor", "parent", "student"),
  async (req, res, next) => {
    await checkPermissions(req.user, req.params.id);
    next();
  },
  checkStatus,
  studentController.updateStudent,
);

// Route to update student status (Admin Only)
router.patch(
  "/:studentId/status",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  studentController.updateStudentStatus,
);

// Route to update student isVerified (Admin Only)
router.patch(
  "/:studentId/verification",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  studentController.updateStudentVerification,
);

router.patch(
  "/:studentId/addStudentToAParent",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  studentController.addStudentToParent,
);

router.patch(
  "/:studentId/removeStudentFromAParent",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  studentController.removeStudentFromParent,
);

router.patch(
  "/:studentId/addToClass",
  // "/:id/add-student",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  studentController.addStudentToClass,
);

router.patch(
  "/:studentId/removeFromClass",
  // "/:id/add-student",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  studentController.removeStudentFromClass,
);

router.patch(
  "/:studentId/addToSubject",
  // "/:id/add-student",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher"),
  checkStatus,
  studentController.addStudentToSubject,
);
router.patch(
  "/:studentId/removeFromSubject",
  // "/:id/add-student",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher"),
  checkStatus,
  studentController.removeStudentFromSubject,
);

router.delete(
  "/:studentId",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  studentController.deleteStudent,
);

export default router;
