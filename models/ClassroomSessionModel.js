import mongoose from "mongoose";

const mediaItemSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    type: {
      type: String,
      required: true,
      enum: ["slide", "image", "pdf", "video", "audio"],
    },
    order: { type: Number, required: true },
  },
  { _id: false },
);

const strokeSchema = new mongoose.Schema(
  {
    tool: {
      type: String,
      enum: ["pen", "highlighter", "eraser"],
      default: "pen",
    },
    color: { type: String, default: "#000000" },
    size: { type: Number, default: 3 },
    points: [
      {
        _id: false,
        x: { type: Number, required: true },
        y: { type: Number, required: true },
      },
    ],
    drawnAt: { type: Date, default: Date.now },
  },
  { _id: true },
);

const questionSchema = new mongoose.Schema(
  {
    studentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    question: { type: String, required: true, trim: true },
    askedAt: { type: Date, default: Date.now },
    answered: { type: Boolean, default: false },
    answeredAt: { type: Date, default: null },
  },
  { _id: true },
);

const classroomSessionSchema = new mongoose.Schema(
  {
    classId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Class",
      required: true,
    },
    subject: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Subject",
      required: true,
    },
    teacher: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Staff",
      required: true,
    },
    session: { type: String, required: true },
    term: {
      type: String,
      required: true,
      enum: ["First Term", "Second Term", "Third Term"],
    },
    livekitRoomName: { type: String, required: true, unique: true },
    status: {
      type: String,
      enum: ["scheduled", "live", "ended"],
      default: "scheduled",
    },
    startedAt: { type: Date, default: null },
    endedAt: { type: Date, default: null },
    media: [mediaItemSchema],
    currentMediaIndex: { type: Number, default: 0 },
    boardStrokes: [strokeSchema],
    questions: [questionSchema],
    recordingUrl: { type: String, default: null },
  },
  { timestamps: true },
);

const ClassroomSession = mongoose.model(
  "ClassroomSession",
  classroomSessionSchema,
);

export default ClassroomSession;
