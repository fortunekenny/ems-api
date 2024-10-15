import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as classController from "../controllers/classController.js";

const router = express.Router();

// Class routes
router.post(
  "/",
  authenticateToken,
  authorizeRole("admin"),
  classController.createClass,
);
router.get(
  "/",
  authenticateToken,
  authorizeRole("admin", "teacher"),
  classController.getClasses,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "teacher"),
  classController.getClassById,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  classController.updateClass,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  classController.deleteClass,
);

export default router;
