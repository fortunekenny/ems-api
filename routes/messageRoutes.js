import express from "express";
import {
  createConversation,
  getConversations,
  getConversationById,
  addParticipant,
  removeParticipant,
  leaveConversation,
  sendMessage,
  getMessages,
  markAsRead,
  editMessage,
  deleteMessage,
  addReaction,
  removeReaction,
  forwardMessage,
  broadcastMessage,
  searchMessages,
} from "../controllers/messageController.js";
import {
  authenticateToken,
  authorizeRole,
} from "../middleware/authentication.js";
import { checkStatus } from "../utils/checkStatus.js";

const router = express.Router();

const auth = [
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor", "student", "parent"),
];

// ─── Conversations ────────────────────────────────────────────────────────────
router.post("/conversations", ...auth, createConversation);
router.get("/conversations", ...auth, getConversations);
router.get("/conversations/:conversationId", ...auth, getConversationById);
router.post(
  "/conversations/:conversationId/participants",
  ...auth,
  addParticipant,
);
router.delete(
  "/conversations/:conversationId/participants/:participantId",
  ...auth,
  removeParticipant,
);
router.delete(
  "/conversations/:conversationId/leave",
  ...auth,
  leaveConversation,
);

// ─── Messages ────────────────────────────────────────────────────────────────
router.post("/conversations/:conversationId/messages", ...auth, sendMessage);
router.get("/conversations/:conversationId/messages", ...auth, getMessages);
router.patch("/conversations/:conversationId/read", ...auth, markAsRead);
router.get("/conversations/:conversationId/search", ...auth, searchMessages);
router.patch("/messages/:messageId", ...auth, editMessage);
router.delete("/messages/:messageId", ...auth, deleteMessage);
router.post("/messages/:messageId/reactions", ...auth, addReaction);
router.delete("/messages/:messageId/reactions", ...auth, removeReaction);
router.post("/messages/:messageId/forward", ...auth, forwardMessage);
router.post(
  "/messages/broadcast",
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor"),
  broadcastMessage,
);

export default router;
