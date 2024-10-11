import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as studentController from "../controllers/studentController.js";

const router = express.Router();

// Role-based constants
const ADMIN = "admin";
const STAFF = "staff";
const STUDENT = "student";
const PARENT = "parent";

// Student routes
// router.post(
//   "/",
//   authenticateToken,
//   authorizeRole(ADMIN, STAFF),
//   studentController.createStudent,
// );
router.get(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  studentController.getStudents,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT, PARENT),
  studentController.getStudentById,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  studentController.updateStudent,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  studentController.deleteStudent,
);

export default router;
