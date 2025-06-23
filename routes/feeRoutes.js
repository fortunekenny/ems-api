import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";
import * as feeController from "../controllers/feeController.js";

const router = express.Router();

// Fee routes
router.post(
  "/",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  feeController.createFee,
);
router.get(
  "/",
  authenticateToken,
  authorizeRole("admin", "proprietor", "parent", "student", "teacher"),
  checkStatus,
  feeController.getFees,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor", "parent", "student", "teacher"),
  checkStatus,
  feeController.getFeeById,
);
router.patch(
  "/:id/installment",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  feeController.recordInstallment,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  feeController.updateFee,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole("admin", "proprietor"),
  checkStatus,
  feeController.deleteFee,
);

export default router;
