import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as classController from "../controllers/classController.js";

const router = express.Router();

// Role-based constants
const ADMIN = "admin";
const STAFF = "staff";
const STUDENT = "student";

// Class routes
router.post(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  classController.createClass,
);
router.get(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  classController.getClasses,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT),
  classController.getClassById,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  classController.updateClass,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  classController.deleteClass,
);

export default router;
