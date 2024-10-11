import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as feeController from "../controllers/feeController.js";

const router = express.Router();

// Role-based constants
const ADMIN = "admin";
const STAFF = "staff";

// Fee routes
router.post(
  "/",
  authenticateToken,
  authorizeRole(ADMIN),
  feeController.createFee,
);
router.get(
  "/",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  feeController.getFees,
);
router.get(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  feeController.getFeeById,
);
router.patch(
  "/:id/installment",
  authenticateToken,
  authorizeRole(ADMIN),
  feeController.recordInstallment,
);
router.patch(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  feeController.updateFee,
);
router.delete(
  "/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  feeController.deleteFee,
);

export default router;
