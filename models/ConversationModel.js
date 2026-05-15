import mongoose from "mongoose";

const participantSchema = new mongoose.Schema(
  {
    participantId: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
    },
    participantModel: {
      type: String,
      required: true,
      enum: ["Staff", "Student", "Parent"],
    },
  },
  { _id: false },
);

const conversationSchema = new mongoose.Schema(
  {
    participants: {
      type: [participantSchema],
      validate: {
        validator: (v) => v.length >= 2,
        message: "A conversation must have at least 2 participants.",
      },
    },
    isGroup: {
      type: Boolean,
      default: false,
    },
    groupName: {
      type: String,
      trim: true,
    },
    groupAdmin: {
      type: mongoose.Schema.Types.ObjectId,
      refPath: "groupAdminModel",
      default: null,
    },
    groupAdminModel: {
      type: String,
      enum: ["Staff", "Student", "Parent"],
      default: null,
    },
    lastMessage: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Message",
      default: null,
    },
  },
  {
    timestamps: true,
  },
);

const Conversation = mongoose.model("Conversation", conversationSchema);

export default Conversation;
