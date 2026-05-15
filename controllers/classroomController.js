import { AccessToken } from "livekit-server-sdk";
import { StatusCodes } from "http-status-codes";
import { v4 as uuidv4 } from "uuid";
import ClassroomSession from "../models/ClassroomSessionModel.js";
import ClassroomAttendance from "../models/ClassroomAttendanceModel.js";
import BadRequestError from "../errors/bad-request.js";
import NotFoundError from "../errors/not-found.js";
import UnauthorizedError from "../errors/unauthorize.js";
import { getIO } from "../utils/socket.js";

const LIVEKIT_API_KEY = process.env.LIVEKIT_API_KEY;
const LIVEKIT_API_SECRET = process.env.LIVEKIT_API_SECRET;

const generateToken = async (roomName, identity, isTeacher) => {
  const at = new AccessToken(LIVEKIT_API_KEY, LIVEKIT_API_SECRET, {
    identity,
    ttl: "4h",
  });
  at.addGrant({
    roomJoin: true,
    room: roomName,
    canPublish: isTeacher,
    canSubscribe: true,
    canPublishData: true,
  });
  return at.toJwt();
};

// POST /classrooms — Teacher creates a session
export const createClassroomSession = async (req, res, next) => {
  const { classId, subject, session, term } = req.body;
  const userId = req.user.userId;

  if (!classId || !subject || !session || !term) {
    throw new BadRequestError("classId, subject, session, and term are required.");
  }

  const livekitRoomName = `classroom_${uuidv4()}`;

  const classroomSession = await ClassroomSession.create({
    classId,
    subject,
    teacher: userId,
    session,
    term,
    livekitRoomName,
    status: "scheduled",
  });

  res.status(StatusCodes.CREATED).json({ classroomSession });
};

// POST /classrooms/:sessionId/start — Teacher starts (goes live)
export const startClassroomSession = async (req, res, next) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  const classroomSession = await ClassroomSession.findById(sessionId);
  if (!classroomSession) throw new NotFoundError("Classroom session not found.");
  if (classroomSession.teacher.toString() !== userId.toString()) {
    throw new UnauthorizedError("Only the assigned teacher can start this session.");
  }
  if (classroomSession.status === "ended") {
    throw new BadRequestError("This session has already ended.");
  }

  classroomSession.status = "live";
  classroomSession.startedAt = new Date();
  await classroomSession.save();

  const token = await generateToken(classroomSession.livekitRoomName, userId.toString(), true);

  getIO().to(classroomSession.classId.toString()).emit("classroom:started", {
    sessionId: classroomSession._id,
    livekitRoomName: classroomSession.livekitRoomName,
  });

  res.status(StatusCodes.OK).json({ classroomSession, token, livekitUrl: process.env.LIVEKIT_URL });
};

// POST /classrooms/:sessionId/join — Student or teacher joins
export const joinClassroomSession = async (req, res, next) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;
  const userRole = req.user.role;

  const classroomSession = await ClassroomSession.findById(sessionId)
    .populate("classId", "className")
    .populate("subject", "subjectName")
    .populate("teacher", "firstName lastName");

  if (!classroomSession) throw new NotFoundError("Classroom session not found.");
  if (classroomSession.status !== "live") {
    throw new BadRequestError("This session is not currently live.");
  }

  const isTeacher = userRole === "teacher" || userRole === "admin" || userRole === "proprietor";

  // Track attendance for students
  if (userRole === "student") {
    const existing = await ClassroomAttendance.findOne({
      classroomSession: sessionId,
      student: userId,
    });
    if (!existing) {
      await ClassroomAttendance.create({
        classroomSession: sessionId,
        student: userId,
        joinedAt: new Date(),
      });
    }

    getIO().to(sessionId).emit("classroom:student_joined", { studentId: userId });
  }

  const token = await generateToken(classroomSession.livekitRoomName, userId.toString(), isTeacher);

  res.status(StatusCodes.OK).json({
    classroomSession,
    token,
    livekitUrl: process.env.LIVEKIT_URL,
  });
};

// POST /classrooms/:sessionId/end — Teacher ends the session
export const endClassroomSession = async (req, res, next) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  const classroomSession = await ClassroomSession.findById(sessionId);
  if (!classroomSession) throw new NotFoundError("Classroom session not found.");
  if (classroomSession.teacher.toString() !== userId.toString()) {
    throw new UnauthorizedError("Only the assigned teacher can end this session.");
  }
  if (classroomSession.status === "ended") {
    throw new BadRequestError("Session already ended.");
  }

  classroomSession.status = "ended";
  classroomSession.endedAt = new Date();
  await classroomSession.save();

  // Close all open attendance records
  const endTime = new Date();
  const openAttendances = await ClassroomAttendance.find({
    classroomSession: sessionId,
    leftAt: null,
  });
  await Promise.all(
    openAttendances.map((att) => {
      const duration = Math.round((endTime - att.joinedAt) / 60000);
      att.leftAt = endTime;
      att.durationMinutes = duration;
      return att.save();
    }),
  );

  getIO().to(sessionId).emit("classroom:ended", { sessionId });

  res.status(StatusCodes.OK).json({ message: "Session ended.", classroomSession });
};

// GET /classrooms — Get sessions for a class (query: classId, status)
export const getClassroomSessions = async (req, res, next) => {
  const { classId, status, subject } = req.query;
  const filter = {};
  if (classId) filter.classId = classId;
  if (status) filter.status = status;
  if (subject) filter.subject = subject;

  const sessions = await ClassroomSession.find(filter)
    .populate("classId", "className")
    .populate("subject", "subjectName")
    .populate("teacher", "firstName lastName")
    .sort({ createdAt: -1 });

  res.status(StatusCodes.OK).json({ count: sessions.length, sessions });
};

// GET /classrooms/:sessionId — Single session details
export const getClassroomSession = async (req, res, next) => {
  const { sessionId } = req.params;

  const classroomSession = await ClassroomSession.findById(sessionId)
    .populate("classId", "className")
    .populate("subject", "subjectName")
    .populate("teacher", "firstName lastName")
    .populate("questions.studentId", "firstName lastName");

  if (!classroomSession) throw new NotFoundError("Classroom session not found.");

  res.status(StatusCodes.OK).json({ classroomSession });
};

// GET /classrooms/:sessionId/attendance — Get attendance list (teacher/admin)
export const getSessionAttendance = async (req, res, next) => {
  const { sessionId } = req.params;

  const classroomSession = await ClassroomSession.findById(sessionId);
  if (!classroomSession) throw new NotFoundError("Classroom session not found.");

  const attendance = await ClassroomAttendance.find({ classroomSession: sessionId })
    .populate("student", "firstName lastName admissionNumber");

  res.status(StatusCodes.OK).json({ count: attendance.length, attendance });
};

// POST /classrooms/:sessionId/leave — Student leaves session
export const leaveClassroomSession = async (req, res, next) => {
  const { sessionId } = req.params;
  const userId = req.user.userId;

  const att = await ClassroomAttendance.findOne({
    classroomSession: sessionId,
    student: userId,
    leftAt: null,
  });

  if (att) {
    att.leftAt = new Date();
    att.durationMinutes = Math.round((att.leftAt - att.joinedAt) / 60000);
    await att.save();
  }

  getIO().to(sessionId).emit("classroom:student_left", { studentId: userId });

  res.status(StatusCodes.OK).json({ message: "Left the session." });
};

// PATCH /classrooms/:sessionId/slides — Teacher uploads slides (URLs)
export const updateSlides = async (req, res, next) => {
  const { sessionId } = req.params;
  const { slides } = req.body;
  const userId = req.user.userId;

  if (!Array.isArray(slides) || slides.length === 0) {
    throw new BadRequestError("slides must be a non-empty array.");
  }

  const classroomSession = await ClassroomSession.findById(sessionId);
  if (!classroomSession) throw new NotFoundError("Classroom session not found.");
  if (classroomSession.teacher.toString() !== userId.toString()) {
    throw new UnauthorizedError("Only the teacher can update slides.");
  }

  classroomSession.slides = slides.map((s, i) => ({
    url: s.url,
    fileName: s.fileName,
    order: i,
  }));
  await classroomSession.save();

  getIO().to(sessionId).emit("classroom:slides_updated", { slides: classroomSession.slides });

  res.status(StatusCodes.OK).json({ slides: classroomSession.slides });
};

// PATCH /classrooms/:sessionId/slide — Teacher changes current slide
export const changeSlide = async (req, res, next) => {
  const { sessionId } = req.params;
  const { slideIndex } = req.body;
  const userId = req.user.userId;

  if (slideIndex === undefined || slideIndex === null) {
    throw new BadRequestError("slideIndex is required.");
  }

  const classroomSession = await ClassroomSession.findById(sessionId);
  if (!classroomSession) throw new NotFoundError("Classroom session not found.");
  if (classroomSession.teacher.toString() !== userId.toString()) {
    throw new UnauthorizedError("Only the teacher can change slides.");
  }
  if (slideIndex < 0 || slideIndex >= classroomSession.slides.length) {
    throw new BadRequestError("Invalid slide index.");
  }

  classroomSession.currentSlide = slideIndex;
  await classroomSession.save();

  getIO().to(sessionId).emit("classroom:slide_changed", { slideIndex });

  res.status(StatusCodes.OK).json({ currentSlide: slideIndex });
};

// POST /classrooms/:sessionId/questions — Student asks a question
export const askQuestion = async (req, res, next) => {
  const { sessionId } = req.params;
  const { question } = req.body;
  const userId = req.user.userId;

  if (!question || !question.trim()) {
    throw new BadRequestError("question is required.");
  }

  const classroomSession = await ClassroomSession.findById(sessionId);
  if (!classroomSession) throw new NotFoundError("Classroom session not found.");
  if (classroomSession.status !== "live") {
    throw new BadRequestError("Session is not live.");
  }

  classroomSession.questions.push({ studentId: userId, question: question.trim() });
  await classroomSession.save();

  const newQuestion = classroomSession.questions[classroomSession.questions.length - 1];

  getIO().to(sessionId).emit("classroom:new_question", {
    questionId: newQuestion._id,
    studentId: userId,
    question: newQuestion.question,
    askedAt: newQuestion.askedAt,
  });

  res.status(StatusCodes.CREATED).json({ question: newQuestion });
};

// PATCH /classrooms/:sessionId/questions/:questionId/answer — Teacher marks question answered
export const markQuestionAnswered = async (req, res, next) => {
  const { sessionId, questionId } = req.params;
  const userId = req.user.userId;

  const classroomSession = await ClassroomSession.findById(sessionId);
  if (!classroomSession) throw new NotFoundError("Classroom session not found.");
  if (classroomSession.teacher.toString() !== userId.toString()) {
    throw new UnauthorizedError("Only the teacher can mark questions answered.");
  }

  const q = classroomSession.questions.id(questionId);
  if (!q) throw new NotFoundError("Question not found.");

  q.answered = true;
  q.answeredAt = new Date();
  await classroomSession.save();

  getIO().to(sessionId).emit("classroom:question_answered", { questionId });

  res.status(StatusCodes.OK).json({ question: q });
};
