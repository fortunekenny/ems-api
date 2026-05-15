import mongoose from "mongoose";

const slideSchema = new mongoose.Schema(
  {
    url: { type: String, required: true },
    fileName: { type: String, required: true },
    order: { type: Number, required: true },
  },
  { _id: false },
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
    slides: [slideSchema],
    currentSlide: { type: Number, default: 0 },
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
