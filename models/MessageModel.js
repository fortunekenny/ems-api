import mongoose from "mongoose";

const attachmentSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    fileType: { type: String, required: true },
    fileSize: { type: Number },
  },
  { _id: false },
);

const readReceiptSchema = new mongoose.Schema(
  {
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    participantModel: {
      type: String,
      enum: ["Staff", "Student", "Parent"],
      required: true,
    },
    readAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const reactionSchema = new mongoose.Schema(
  {
    emoji: { type: String, required: true },
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    participantModel: {
      type: String,
      enum: ["Staff", "Student", "Parent"],
      required: true,
    },
  },
  { _id: false },
);

const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Conversation",
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "senderModel",
    },
    senderModel: {
      type: String,
      required: true,
      enum: ["Staff", "Student", "Parent"],
    },
    content: {
      type: String,
      trim: true,
      default: null,
    },
    attachments: [attachmentSchema],
    replyTo: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
    reactions: [reactionSchema],
    readBy: [readReceiptSchema],
    editedAt: {
      type: Date,
      default: null,
    },
    isDeleted: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
  },
);

messageSchema.pre("validate", function (next) {
  if (!this.content && (!this.attachments || this.attachments.length === 0)) {
    return next(
      new Error("A message must have content or at least one attachment."),
    );
  }
  next();
});

const Message = mongoose.model("Message", messageSchema);

export default Message;
