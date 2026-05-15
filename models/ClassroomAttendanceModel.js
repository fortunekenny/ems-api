import mongoose from "mongoose";

const classroomAttendanceSchema = new mongoose.Schema(
  {
    classroomSession: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "ClassroomSession",
      required: true,
    },
    student: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Student",
      required: true,
    },
    joinedAt: { type: Date, default: Date.now },
    leftAt: { type: Date, default: null },
    durationMinutes: { type: Number, default: null },
  },
  { timestamps: true },
);

classroomAttendanceSchema.index(
  { classroomSession: 1, student: 1 },
  { unique: true },
);

const ClassroomAttendance = mongoose.model(
  "ClassroomAttendance",
  classroomAttendanceSchema,
);

export default ClassroomAttendance;
