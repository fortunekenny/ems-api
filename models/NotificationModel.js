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

/* const notificationSchema = new mongoose.Schema({
  user: { type: mongoose.Schema.Types.ObjectId, ref: "User", required: true }, // Link to User
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ["email", "sms", "app"], required: true }, // Notification type
  session: { type: String, default: session }, // e.g., 2023/2024
  term: { type: String, default: term }, // e.g., First, Second, Third
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now },
}); */

const notificationSchema = new mongoose.Schema(
  {
    // Dynamic reference: recipient can be a Parent, Student, or Staff.
    recipient: {
      type: mongoose.Schema.Types.ObjectId,
      required: true,
      refPath: "recipientModel", // this field determines which model is referenced
    },
    // This field indicates which model the recipient field refers to.
    recipientModel: {
      type: String,
      required: true,
      enum: ["Parent", "Student", "Staff"],
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: false,
    }, // Link to sender
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
      // required: false,
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

export default mongoose.model("Notification", notificationSchema);
