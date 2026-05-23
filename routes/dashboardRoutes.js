import express from "express";
import {
  getStudentDashboard,
  getParentDashboard,
  getTeacherDashboard,
  getAdminDashboard,
  getStaffDashboard,
} from "../controllers/dashboardController.js";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

const auth = (...roles) => [
  authenticateToken,
  checkStatus,
  authorizeRole(...roles),
];


// Self-access routes — admin/proprietor can pass ?userId= to view any user's data

/* 
FOR ADMIN/PROPRIETOR DASHBOARD VIEWS:


GET /api/v1/dashboard/dashboard/parent?userId=<parentDocId>
GET /api/v1/dashboard/dashboard/student?userId=<studentId>
GET /api/v1/dashboard/dashboard/teacher?userId=<staffId>
GET /api/v1/dashboard/dashboard/staff?userId=<staffId>
*/

router.get(
  "/dashboard/student",
  ...auth("student", "admin", "proprietor"),
  getStudentDashboard,
);
router.get(
  "/dashboard/parent",
  ...auth("parent", "admin", "proprietor"),
  getParentDashboard,
);
router.get(
  "/dashboard/teacher",
  ...auth("teacher", "admin", "proprietor"),
  getTeacherDashboard,
);
router.get(
  "/dashboard/staff",
  ...auth("staff", "admin", "proprietor"),
  getStaffDashboard,
);

// Admin / Proprietor overview dashboard
router.get(
  "/dashboard/admin",
  ...auth("admin", "proprietor"),
  getAdminDashboard,
);

export default router;

