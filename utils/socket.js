import { Server } from "socket.io";

let io;

export const initSocket = (httpServer) => {
  io = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    console.log(`Socket connected: ${socket.id}`);

    // Client calls this with their userId to receive personal events
    socket.on("join", (userId) => {
      socket.join(userId);
    });

    // Join a conversation room to receive real-time messages
    socket.on("join_conversation", (conversationId) => {
      socket.join(conversationId);
    });

    socket.on("leave_conversation", (conversationId) => {
      socket.leave(conversationId);
    });

    // ─── Classroom events ────────────────────────────────────────────────────

    // Join classroom socket room (separate from Livekit — for control events)
    socket.on("classroom:join_room", (sessionId) => {
      socket.join(sessionId);
    });

    socket.on("classroom:leave_room", (sessionId) => {
      socket.leave(sessionId);
    });

    // Student raises hand — broadcast to teacher and whole room
    socket.on("classroom:raise_hand", ({ sessionId, studentId, studentName }) => {
      io.to(sessionId).emit("classroom:hand_raised", { studentId, studentName });
    });

    // Student lowers hand (or teacher dismisses it)
    socket.on("classroom:lower_hand", ({ sessionId, studentId }) => {
      io.to(sessionId).emit("classroom:hand_lowered", { studentId });
    });

    // Teacher allows a student to speak (unmute permission signal)
    socket.on("classroom:allow_speak", ({ sessionId, studentId }) => {
      io.to(studentId).emit("classroom:speak_allowed", { sessionId });
      io.to(sessionId).emit("classroom:speak_allowed_broadcast", { studentId });
    });

    // Teacher mutes a specific student
    socket.on("classroom:mute_student", ({ sessionId, studentId }) => {
      io.to(studentId).emit("classroom:muted", { sessionId });
    });

    // Teacher mutes everyone
    socket.on("classroom:mute_all", ({ sessionId }) => {
      io.to(sessionId).emit("classroom:all_muted");
    });

    // Teacher sends a poll/quick quiz to students
    socket.on("classroom:send_poll", ({ sessionId, poll }) => {
      io.to(sessionId).emit("classroom:poll_received", { poll });
    });

    // Student submits poll answer — sent only to teacher
    socket.on("classroom:poll_answer", ({ sessionId, teacherId, studentId, answer }) => {
      io.to(teacherId).emit("classroom:poll_answer_received", { studentId, answer });
    });

    socket.on("disconnect", () => {
      console.log(`Socket disconnected: ${socket.id}`);
    });
  });

  return io;
};

export const getIO = () => {
  if (!io) throw new Error("Socket.io not initialized.");
  return io;
};
