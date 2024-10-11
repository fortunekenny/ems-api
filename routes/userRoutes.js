import express from "express";
import {
  // createUser,
  getUsers,
  getUserById,
  updateUser,
  deleteUser,
  approveUser,
  getUnapprovedUsers,
} from "../controllers/userController.js";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";

const router = express.Router();

// Role-based constants
const ADMIN = "admin";
const STAFF = "staff";
const STUDENT = "student";
const PARENT = "parent";

// User routes
// router.post("/", authenticateToken, authorizeRole(ADMIN), createUser); // Create a new user
router.get("/", authenticateToken, authorizeRole(ADMIN), getUsers); // Get all users
router.get(
  "/unapproved",
  authenticateToken,
  authorizeRole(ADMIN),
  getUnapprovedUsers,
); // Get all unapproved users
router.get("/:id", authenticateToken, authorizeRole(ADMIN), getUserById); // Get user by ID
router.patch("/:id", authenticateToken, authorizeRole(ADMIN), updateUser); // Update user details
router.delete("/:id", authenticateToken, authorizeRole(ADMIN), deleteUser); // Delete user

// Approval routes
router.patch(
  "/approve/:userId",
  authenticateToken,
  authorizeRole(ADMIN),
  approveUser,
); // Approve a user

export default router;
