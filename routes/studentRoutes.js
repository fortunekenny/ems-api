import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as studentController from "../controllers/studentController.js";

const router = express.Router();

// Student routes
router.get(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  studentController.getStudents,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "teacher", "parent"),
  studentController.getStudentById,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "teacher", "parent"),
  studentController.updateStudent,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  studentController.deleteStudent,
);

export default router;
