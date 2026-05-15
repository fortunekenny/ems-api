import express from "express";
import {
  createClassroomSession,
  startClassroomSession,
  joinClassroomSession,
  endClassroomSession,
  getClassroomSessions,
  getClassroomSession,
  getSessionAttendance,
  leaveClassroomSession,
  updateSlides,
  changeSlide,
  askQuestion,
  markQuestionAnswered,
} from "../controllers/classroomController.js";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

const teacherAuth = [
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
];

const allAuth = [
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor", "student"),
];

// ─── Sessions ─────────────────────────────────────────────────────────────────
router.post("/classrooms", ...teacherAuth, createClassroomSession);
router.get("/classrooms", ...allAuth, getClassroomSessions);
router.get("/classrooms/:sessionId", ...allAuth, getClassroomSession);
router.post("/classrooms/:sessionId/start", ...teacherAuth, startClassroomSession);
router.post("/classrooms/:sessionId/join", ...allAuth, joinClassroomSession);
router.post("/classrooms/:sessionId/end", ...teacherAuth, endClassroomSession);
router.post("/classrooms/:sessionId/leave", ...allAuth, leaveClassroomSession);

// ─── Slides ───────────────────────────────────────────────────────────────────
router.patch("/classrooms/:sessionId/slides", ...teacherAuth, updateSlides);
router.patch("/classrooms/:sessionId/slide", ...teacherAuth, changeSlide);

// ─── Q&A ──────────────────────────────────────────────────────────────────────
router.post("/classrooms/:sessionId/questions", ...allAuth, askQuestion);
router.patch(
  "/classrooms/:sessionId/questions/:questionId/answer",
  ...teacherAuth,
  markQuestionAnswered,
);

// ─── Attendance ───────────────────────────────────────────────────────────────
router.get(
  "/classrooms/:sessionId/attendance",
  ...teacherAuth,
  getSessionAttendance,
);

export default router;
