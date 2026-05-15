import Conversation from "../models/ConversationModel.js";
import Message from "../models/MessageModel.js";
import { getIO } from "../utils/socket.js";
import { StatusCodes } from "http-status-codes";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import InternalServerError from "../errors/internal-server-error.js";

// Maps req.user.role to the Mongoose model name
const resolveParticipantModel = (role) => {
  if (["admin", "teacher", "proprietor"].includes(role)) return "Staff";
  if (role === "student") return "Student";
  if (role === "parent") return "Parent";
  return null;
};

// ─── Conversations ────────────────────────────────────────────────────────────

// POST /conversations
export const createConversation = async (req, res, next) => {
  try {
    const { participants, isGroup, groupName } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const senderModel = resolveParticipantModel(userRole);

    if (!senderModel) throw new BadRequestError("Unrecognized user role.");
    if (!participants || participants.length < 1)
      throw new BadRequestError("At least one other participant is required.");

    // Build full participant list including the creator
    const allParticipants = [
      { participantId: userId, participantModel: senderModel },
      ...participants,
    ];

    // For 1-on-1: check if a conversation already exists between the two participants
    if (!isGroup && allParticipants.length === 2) {
      const [a, b] = allParticipants;
      const existing = await Conversation.findOne({
        isGroup: false,
        "participants.participantId": {
          $all: [a.participantId, b.participantId],
        },
        $expr: { $eq: [{ $size: "$participants" }, 2] },
      });
      if (existing) {
        return res.status(StatusCodes.OK).json(existing);
      }
    }

    if (isGroup && !groupName)
      throw new BadRequestError(
        "groupName is required for group conversations.",
      );

    const conversation = await Conversation.create({
      participants: allParticipants,
      isGroup: isGroup || false,
      groupName: isGroup ? groupName : undefined,
      groupAdmin: isGroup ? userId : undefined,
      groupAdminModel: isGroup ? senderModel : undefined,
    });

    // Notify all participants
    allParticipants.forEach(({ participantId }) => {
      getIO()
        .to(participantId.toString())
        .emit("conversation_created", conversation);
    });

    res.status(StatusCodes.CREATED).json(conversation);
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// GET /conversations
export const getConversations = async (req, res, next) => {
  try {
    const userId = req.user.id;

    const conversations = await Conversation.find({
      "participants.participantId": userId,
    })
      .populate("lastMessage")
      .sort({ updatedAt: -1 });

    res.status(StatusCodes.OK).json(conversations);
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// GET /conversations/:conversationId
export const getConversationById = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      "participants.participantId": userId,
    }).populate("lastMessage");

    if (!conversation) throw new NotFoundError("Conversation not found.");

    res.status(StatusCodes.OK).json(conversation);
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// POST /conversations/:conversationId/participants
export const addParticipant = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { participantId, participantModel } = req.body;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new NotFoundError("Conversation not found.");
    if (!conversation.isGroup)
      throw new BadRequestError(
        "Cannot add participants to a 1-on-1 conversation.",
      );
    if (conversation.groupAdmin.toString() !== userId.toString())
      throw new BadRequestError("Only the group admin can add participants.");

    const alreadyIn = conversation.participants.some(
      (p) => p.participantId.toString() === participantId,
    );
    if (alreadyIn)
      throw new BadRequestError("Participant is already in the conversation.");

    conversation.participants.push({ participantId, participantModel });
    await conversation.save();

    getIO()
      .to(conversationId)
      .emit("participant_added", { conversationId, participantId });

    res.status(StatusCodes.OK).json(conversation);
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// DELETE /conversations/:conversationId/participants/:participantId
export const removeParticipant = async (req, res, next) => {
  try {
    const { conversationId, participantId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new NotFoundError("Conversation not found.");
    if (!conversation.isGroup)
      throw new BadRequestError(
        "Cannot remove participants from a 1-on-1 conversation.",
      );
    if (conversation.groupAdmin.toString() !== userId.toString())
      throw new BadRequestError(
        "Only the group admin can remove participants.",
      );

    conversation.participants = conversation.participants.filter(
      (p) => p.participantId.toString() !== participantId,
    );
    await conversation.save();

    getIO()
      .to(conversationId)
      .emit("participant_removed", { conversationId, participantId });

    res.status(StatusCodes.OK).json(conversation);
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// DELETE /conversations/:conversationId/leave
export const leaveConversation = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;

    const conversation = await Conversation.findById(conversationId);
    if (!conversation) throw new NotFoundError("Conversation not found.");
    if (!conversation.isGroup)
      throw new BadRequestError("Cannot leave a 1-on-1 conversation.");

    conversation.participants = conversation.participants.filter(
      (p) => p.participantId.toString() !== userId.toString(),
    );

    // Assign a new admin if the admin left
    if (
      conversation.groupAdmin.toString() === userId.toString() &&
      conversation.participants.length > 0
    ) {
      conversation.groupAdmin = conversation.participants[0].participantId;
      conversation.groupAdminModel =
        conversation.participants[0].participantModel;
    }

    await conversation.save();

    getIO()
      .to(conversationId)
      .emit("participant_removed", { conversationId, participantId: userId });

    res.status(StatusCodes.OK).json({ message: "Left conversation." });
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// ─── Messages ────────────────────────────────────────────────────────────────

// POST /conversations/:conversationId/messages
export const sendMessage = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { content, attachments, replyTo } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const senderModel = resolveParticipantModel(userRole);

    if (!senderModel) throw new BadRequestError("Unrecognized user role.");

    const conversation = await Conversation.findOne({
      _id: conversationId,
      "participants.participantId": userId,
    });
    if (!conversation) throw new NotFoundError("Conversation not found.");

    const message = await Message.create({
      conversation: conversationId,
      sender: userId,
      senderModel,
      content: content || null,
      attachments: attachments || [],
      replyTo: replyTo || null,
    });

    // Update conversation's lastMessage and bump updatedAt for sorting
    conversation.lastMessage = message._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    // Broadcast to everyone in the conversation room
    getIO().to(conversationId).emit("new_message", message);

    res.status(StatusCodes.CREATED).json(message);
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// GET /conversations/:conversationId/messages?page=1&limit=20
export const getMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 20;

    const conversation = await Conversation.findOne({
      _id: conversationId,
      "participants.participantId": userId,
    });
    if (!conversation) throw new NotFoundError("Conversation not found.");

    const total = await Message.countDocuments({
      conversation: conversationId,
      isDeleted: false,
    });

    const messages = await Message.find({
      conversation: conversationId,
      isDeleted: false,
    })
      .populate({ path: "replyTo", select: "content sender senderModel" })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);

    res.status(StatusCodes.OK).json({
      total,
      page,
      pages: Math.ceil(total / limit),
      messages,
    });
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// PATCH /conversations/:conversationId/read
export const markAsRead = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;
    const participantModel = resolveParticipantModel(userRole);

    await Message.updateMany(
      {
        conversation: conversationId,
        isDeleted: false,
        "readBy.participantId": { $ne: userId },
      },
      {
        $push: {
          readBy: {
            participantId: userId,
            participantModel,
            readAt: new Date(),
          },
        },
      },
    );

    getIO()
      .to(conversationId)
      .emit("messages_read", { conversationId, readBy: userId });

    res.status(StatusCodes.OK).json({ message: "Messages marked as read." });
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// PATCH /messages/:messageId
export const editMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { content } = req.body;
    const userId = req.user.id;

    if (!content)
      throw new BadRequestError("Content is required to edit a message.");

    const message = await Message.findById(messageId);
    if (!message) throw new NotFoundError("Message not found.");
    if (message.sender.toString() !== userId.toString())
      throw new BadRequestError("You can only edit your own messages.");
    if (message.isDeleted)
      throw new BadRequestError("Cannot edit a deleted message.");

    message.content = content;
    message.editedAt = new Date();
    await message.save();

    getIO().to(message.conversation.toString()).emit("message_edited", message);

    res.status(StatusCodes.OK).json(message);
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// DELETE /messages/:messageId
export const deleteMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;
    const userRole = req.user.role;

    const message = await Message.findById(messageId);
    if (!message) throw new NotFoundError("Message not found.");

    const isOwner = message.sender.toString() === userId.toString();
    const isAdmin = ["admin", "proprietor"].includes(userRole);

    if (!isOwner && !isAdmin)
      throw new BadRequestError(
        "You are not authorized to delete this message.",
      );

    message.isDeleted = true;
    message.content = null;
    message.attachments = [];
    await message.save();

    getIO()
      .to(message.conversation.toString())
      .emit("message_deleted", {
        messageId,
        conversationId: message.conversation,
      });

    res.status(StatusCodes.OK).json({ message: "Message deleted." });
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// POST /messages/:messageId/reactions
export const addReaction = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { emoji } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const participantModel = resolveParticipantModel(userRole);

    if (!emoji) throw new BadRequestError("emoji is required.");

    const message = await Message.findById(messageId);
    if (!message) throw new NotFoundError("Message not found.");
    if (message.isDeleted)
      throw new BadRequestError("Cannot react to a deleted message.");

    // Remove existing reaction from this user then add the new one
    message.reactions = message.reactions.filter(
      (r) => r.participantId.toString() !== userId.toString(),
    );
    message.reactions.push({ emoji, participantId: userId, participantModel });
    await message.save();

    getIO()
      .to(message.conversation.toString())
      .emit("reaction_added", { messageId, reactions: message.reactions });

    res.status(StatusCodes.OK).json(message);
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// DELETE /messages/:messageId/reactions
export const removeReaction = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const userId = req.user.id;

    const message = await Message.findById(messageId);
    if (!message) throw new NotFoundError("Message not found.");

    message.reactions = message.reactions.filter(
      (r) => r.participantId.toString() !== userId.toString(),
    );
    await message.save();

    getIO()
      .to(message.conversation.toString())
      .emit("reaction_removed", { messageId, reactions: message.reactions });

    res.status(StatusCodes.OK).json(message);
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// POST /messages/:messageId/forward
export const forwardMessage = async (req, res, next) => {
  try {
    const { messageId } = req.params;
    const { conversationId } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const senderModel = resolveParticipantModel(userRole);

    const source = await Message.findById(messageId);
    if (!source || source.isDeleted)
      throw new NotFoundError("Message not found.");

    const conversation = await Conversation.findOne({
      _id: conversationId,
      "participants.participantId": userId,
    });
    if (!conversation)
      throw new NotFoundError("Target conversation not found.");

    const forwarded = await Message.create({
      conversation: conversationId,
      sender: userId,
      senderModel,
      content: source.content,
      attachments: source.attachments,
    });

    conversation.lastMessage = forwarded._id;
    conversation.updatedAt = new Date();
    await conversation.save();

    getIO().to(conversationId).emit("new_message", forwarded);

    res.status(StatusCodes.CREATED).json(forwarded);
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// POST /messages/broadcast
// Sends the same message to multiple recipients individually.
// Each recipient gets it as a separate 1-on-1 conversation (like WhatsApp broadcast).
// Body: { content, attachments, recipients: [{ participantId, participantModel }] }
export const broadcastMessage = async (req, res, next) => {
  try {
    const { content, attachments, recipients } = req.body;
    const userId = req.user.id;
    const userRole = req.user.role;
    const senderModel = resolveParticipantModel(userRole);

    if (!senderModel) throw new BadRequestError("Unrecognized user role.");
    if (!recipients || recipients.length === 0)
      throw new BadRequestError("At least one recipient is required.");
    if (!content && (!attachments || attachments.length === 0))
      throw new BadRequestError(
        "Message must have content or at least one attachment.",
      );

    const results = await Promise.allSettled(
      recipients.map(async ({ participantId, participantModel }) => {
        // Find or create a 1-on-1 conversation with this recipient
        let conversation = await Conversation.findOne({
          isGroup: false,
          "participants.participantId": { $all: [userId, participantId] },
          $expr: { $eq: [{ $size: "$participants" }, 2] },
        });

        if (!conversation) {
          conversation = await Conversation.create({
            isGroup: false,
            participants: [
              { participantId: userId, participantModel: senderModel },
              { participantId, participantModel },
            ],
          });
        }

        const message = await Message.create({
          conversation: conversation._id,
          sender: userId,
          senderModel,
          content: content || null,
          attachments: attachments || [],
        });

        conversation.lastMessage = message._id;
        conversation.updatedAt = new Date();
        await conversation.save();

        // Emit to the recipient's personal room
        getIO().to(participantId.toString()).emit("new_message", message);

        return { participantId, messageId: message._id };
      }),
    );

    const delivered = results
      .filter((r) => r.status === "fulfilled")
      .map((r) => r.value);

    const failed = results
      .filter((r) => r.status === "rejected")
      .map((r, i) => ({
        participantId: recipients[i]?.participantId,
        reason: r.reason?.message,
      }));

    res.status(StatusCodes.CREATED).json({
      message: `Broadcast sent to ${delivered.length} of ${recipients.length} recipients.`,
      delivered,
      failed,
    });
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};

// GET /conversations/:conversationId/search?q=keyword
export const searchMessages = async (req, res, next) => {
  try {
    const { conversationId } = req.params;
    const { q } = req.query;
    const userId = req.user.id;

    if (!q) throw new BadRequestError("Search query 'q' is required.");

    const conversation = await Conversation.findOne({
      _id: conversationId,
      "participants.participantId": userId,
    });
    if (!conversation) throw new NotFoundError("Conversation not found.");

    const messages = await Message.find({
      conversation: conversationId,
      isDeleted: false,
      content: { $regex: q, $options: "i" },
    }).sort({ createdAt: -1 });

    res.status(StatusCodes.OK).json(messages);
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};
