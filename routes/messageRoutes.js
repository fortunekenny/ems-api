import express from "express";
import mongoose from "mongoose";
import BadRequestError from "../errors/bad-request.js";
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

// Validate ObjectId params before hitting any controller
router.param("conversationId", (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new BadRequestError("Invalid conversationId."));
  next();
});

router.param("messageId", (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new BadRequestError("Invalid messageId."));
  next();
});

router.param("participantId", (req, res, next, id) => {
  if (!mongoose.Types.ObjectId.isValid(id))
    return next(new BadRequestError("Invalid participantId."));
  next();
});

const auth = [
  authenticateToken,
  checkStatus,
  authorizeRole("admin", "teacher", "proprietor", "student", "parent"),
];

// ─── Conversations ────────────────────────────────────────────────────────────
/* 
POST   /api/v1/message/conversations
GET    /api/v1/message/conversations
GET    /api/v1/message/conversations/:conversationId
POST   /api/v1/message/conversations/:conversationId/participants
DELETE /api/v1/message/conversations/:conversationId/participants/:participantId
DELETE /api/v1/message/conversations/:conversationId/leave

*/

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

/* 
POST   /api/v1/message/conversations/:conversationId/messages
GET    /api/v1/message/conversations/:conversationId/messages?page=1&limit=20
PATCH  /api/v1/message/conversations/:conversationId/read
GET    /api/v1/message/conversations/:conversationId/search?q=keyword
PATCH  /api/v1/message/messages/:messageId
DELETE /api/v1/message/messages/:messageId
POST   /api/v1/message/messages/:messageId/reactions
DELETE /api/v1/message/messages/:messageId/reactions
POST   /api/v1/message/messages/:messageId/forward
POST   /api/v1/message/messages/broadcast   (admin/teacher/proprietor only)

*/

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
