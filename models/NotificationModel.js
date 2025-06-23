import mongoose from "mongoose";
import {
  getCurrentTermDetails,
  startTermGenerationDate,
  holidayDurationForEachTerm,
} from "../utils/termGenerator.js";

const { session, term } = getCurrentTermDetails(
  startTermGenerationDate,
  holidayDurationForEachTerm,
);

const notificationSchema = new mongoose.Schema(
  {
    // Dynamic reference: recipient can be a Parent, Student, or Staff.
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "recipientModel", // this field determines which model is referenced
      index: true, // for efficient queries
    },
    // This field indicates which model the recipient field refers to.
    recipientModel: {
      type: String,
      required: true,
      enum: ["Parent", "Student", "Staff"],
      index: true, // for efficient queries
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff", // Only staff can send notifications
      required: false,
    },
    title: {
      type: String,
      required: true,
      trim: true,
    },
    message: {
      type: String,
      required: true,
      trim: true,
    },
    type: {
      type: String,
      enum: ["email", "sms", "app", "none"],
      default: "none",
    },
    session: {
      type: String,
      default: session, // Adjust as needed
    },
    term: {
      type: String,
      default: term, // Adjust as needed
    },
    isRead: {
      type: Boolean,
      default: false,
    },
    readAt: {
      type: Date,
    },
    unreadCount: {
      type: Number,
      default: 0,
    },
    // New fields to track if the notification has been seen.
    isSeen: {
      type: Boolean,
      default: false,
    },
    seenAt: {
      type: Date,
    },
    metadata: {
      type: mongoose.Schema.Types.Mixed,
    },
  },
  {
    timestamps: true, // Automatically adds createdAt and updatedAt fields
  },
);

// Compound index for efficient recipient lookups
notificationSchema.index({ recipient: 1, recipientModel: 1 });

export default mongoose.model("Notification", notificationSchema);
