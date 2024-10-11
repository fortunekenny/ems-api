import express from "express";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import * as libraryController from "../controllers/libraryController.js";

const router = express.Router();

// Role-based constants
const ADMIN = "admin";
const STAFF = "staff";
const STUDENT = "student";

router.post(
  "/library",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  libraryController.addBook,
);
router.get(
  "/library",
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT),
  libraryController.getBooks,
);
router.get(
  "/library/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF, STUDENT),
  libraryController.getBookById,
);
router.patch(
  "/library/:id",
  authenticateToken,
  authorizeRole(ADMIN, STAFF),
  libraryController.updateBook,
);
router.delete(
  "/library/:id",
  authenticateToken,
  authorizeRole(ADMIN),
  libraryController.deleteBook,
);

export default router;
