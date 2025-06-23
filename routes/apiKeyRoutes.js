import express from "express";
import {
  createApiKey,
  getAllApiKeys,
  deactivateApiKey,
  reactivateApiKey,
  deleteApiKey,
} from "../controllers/apiKeyController.js";

import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

// Must be admin to manage keys
router.use(authenticateToken, authorizeRole("admin"), checkStatus);

router.post("/", createApiKey);
router.get("/", getAllApiKeys);
router.patch("/deactivate/:id", deactivateApiKey);
router.patch("/reactivate/:id", reactivateApiKey);
router.delete("/:id", deleteApiKey);

export default router;
