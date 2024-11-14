import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as classController from "../controllers/classController.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

// Class routes
router.post(
  "/",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  classController.createClass,
);
router.get(
  "/",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher"),
  checkStatus,
  classController.getClasses,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor", "teacher"),
  checkStatus,
  classController.getClassById,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  classController.updateClass,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin"),
  checkStatus,
  classController.deleteClass,
);

export default router;
