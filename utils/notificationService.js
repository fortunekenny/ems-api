import mongoose from "mongoose";
import Parent from "../models/ParentModel.js";
import { sendBulkNotifications } from "../controllers/notificationController.js";
import { getIO } from "./socket.js";

// Wraps a notification call so it never crashes the parent request.
const fire = async (fn) => {
  try {
    await fn();
  } catch (err) {
    console.error("[NotificationService]", err.message);
  }
};

// Parents can link to students via father.children, mother.children, or guardian.children
const getParentRecipients = async (studentId) => {
  const parents = await Parent.find({
    $or: [
      { "father.children": studentId },
      { "mother.children": studentId },
      { "guardian.children": studentId },
    ],
  }).select("_id");
  return parents.map((p) => ({ recipientId: p._id, recipientModel: "Parent" }));
};

// Exam scheduled — notify students in the class
export const notifyExamScheduled = async ({
  exam,
  subjectName,
  className,
  students,
  senderId,
}) => {
  await fire(async () => {
    const recipients = students.map((id) => ({
      recipientId: id,
      recipientModel: "Student",
    }));
    if (!recipients.length) return;
    const dateStr = exam.date
      ? new Date(exam.date).toDateString()
      : "an upcoming date";
    await sendBulkNotifications({
      sender: senderId,
      title: `Exam Scheduled: ${subjectName}`,
      message: `A ${subjectName} exam has been scheduled for ${dateStr} in ${className}. Please prepare accordingly.`,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        examId: exam._id,
      },
      recipients,
    });
  });
};

// Test scheduled — notify students in the class
export const notifyTestScheduled = async ({
  test,
  subjectName,
  className,
  students,
  senderId,
}) => {
  await fire(async () => {
    const recipients = students.map((id) => ({
      recipientId: id,
      recipientModel: "Student",
    }));
    if (!recipients.length) return;
    const dateStr = test.date
      ? new Date(test.date).toDateString()
      : "an upcoming date";
    await sendBulkNotifications({
      sender: senderId,
      title: `Test Scheduled: ${subjectName}`,
      message: `A ${subjectName} test has been scheduled for ${dateStr} in ${className}. Please prepare accordingly.`,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        testId: test._id,
      },
      recipients,
    });
  });
};

// Grade published — notify student and their parents
export const notifyGradePublished = async ({
  grade,
  studentId,
  subjectName,
  senderId,
}) => {
  await fire(async () => {
    const parentRecipients = await getParentRecipients(studentId);
    const recipients = [
      { recipientId: studentId, recipientModel: "Student" },
      ...parentRecipients,
    ];
    const pct =
      grade.percentageScore != null
        ? `${Number(grade.percentageScore).toFixed(1)}%`
        : "N/A";
    await sendBulkNotifications({
      sender: senderId,
      title: `Grade Published: ${subjectName}`,
      message: `Your grade for ${subjectName} has been published. You scored ${grade.markObtained}/${grade.markObtainable} (${pct}) — Grade: ${grade.grade}. Check your portal for details.`,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        gradeId: grade._id,
      },
      recipients,
    });
  });
};

// Report card ready — notify student and their parents
export const notifyReportCardReady = async ({
  reportCard,
  studentId,
  className,
  term,
  session,
  senderId,
}) => {
  await fire(async () => {
    const parentRecipients = await getParentRecipients(studentId);
    const recipients = [
      { recipientId: studentId, recipientModel: "Student" },
      ...parentRecipients,
    ];
    await sendBulkNotifications({
      sender: senderId,
      title: "Report Card Available",
      message: `Your ${term} term report card for ${className} (${session} session) is now available. Overall: ${reportCard.overallMarkObtained}/${reportCard.overallMarkObtainable} (${reportCard.overallPercentage}%). Check your portal.`,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        reportCardId: reportCard._id,
      },
      recipients,
    });
  });
};

// Fee created — notify parents
export const notifyFeeCreated = async ({ fee, studentId, senderId }) => {
  await fire(async () => {
    const recipients = await getParentRecipients(studentId);
    if (!recipients.length) return;
    const dueStr = fee.dueDate
      ? new Date(fee.dueDate).toDateString()
      : "the stated date";
    await sendBulkNotifications({
      sender: senderId,
      title: "New School Fee Posted",
      message: `A fee of ₦${Number(fee.amountDue).toLocaleString()} has been posted for ${fee.term} term (${fee.session} session), due by ${dueStr}. Please ensure timely payment.`,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        feeId: fee._id,
      },
      recipients,
    });
  });
};

// Payment recorded — notify parents
export const notifyPaymentRecorded = async ({
  fee,
  studentId,
  amount,
  senderId,
}) => {
  await fire(async () => {
    const recipients = await getParentRecipients(studentId);
    if (!recipients.length) return;
    const remaining = (fee.amountDue || 0) - (fee.amountPaid || 0);
    await sendBulkNotifications({
      sender: senderId,
      title: "Fee Payment Received",
      message: `A payment of ₦${Number(amount).toLocaleString()} has been received. Outstanding balance: ₦${Math.max(0, remaining).toLocaleString()}. Check your portal for the updated record.`,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        feeId: fee._id,
      },
      recipients,
    });
  });
};

// Student absent — notify parents
export const notifyAttendanceAbsent = async ({
  studentId,
  studentName,
  date,
  senderId,
}) => {
  await fire(async () => {
    const recipients = await getParentRecipients(studentId);
    if (!recipients.length) return;
    const dateStr = date ? new Date(date).toDateString() : "today";
    await sendBulkNotifications({
      sender: senderId,
      title: "Absence Alert",
      message: `${studentName} was marked absent on ${dateStr}. Please contact the school if this was unplanned.`,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        studentId,
      },
      recipients,
    });
  });
};

// Staff account status changed — notify the staff member
export const notifyStaffStatusChanged = async ({
  staff,
  newStatus,
  senderId,
}) => {
  await fire(async () => {
    await sendBulkNotifications({
      sender: senderId,
      title: "Account Status Updated",
      message: `Your account status has been updated to '${newStatus}'. Contact your administrator if you have questions.`,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        staffId: staff._id,
      },
      recipients: [{ recipientId: staff._id, recipientModel: "Staff" }],
    });
  });
};

// Staff verification changed — notify the staff member
export const notifyStaffVerification = async ({
  staff,
  isVerified,
  senderId,
}) => {
  await fire(async () => {
    await sendBulkNotifications({
      sender: senderId,
      title: isVerified ? "Account Verified" : "Verification Revoked",
      message: isVerified
        ? "Your staff account has been verified. You now have full access to all portal features."
        : "Your staff account verification has been revoked. Please contact your administrator.",
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        staffId: staff._id,
      },
      recipients: [{ recipientId: staff._id, recipientModel: "Staff" }],
    });
  });
};

// New message — socket-only push to each participant except the sender
// No DB write: unread state is tracked via the message readBy array
export const notifyNewMessage = ({ conversationId, message, participants, senderId }) => {
  try {
    const io = getIO();
    participants.forEach(({ participantId }) => {
      if (participantId.toString() === senderId.toString()) return;
      io.to(participantId.toString()).emit("new_notification", {
        type: "message",
        conversationId,
        messageId: message._id,
        senderId,
        content: message.content ? message.content.substring(0, 80) : "(attachment)",
      });
    });
  } catch (err) {
    console.error("[NotificationService] notifyNewMessage:", err.message);
  }
};

// Live classroom started — notify students in the class
export const notifyClassroomStarted = async ({
  classroomSession,
  students,
  senderId,
}) => {
  await fire(async () => {
    const recipients = students.map((id) => ({
      recipientId: id,
      recipientModel: "Student",
    }));
    if (!recipients.length) return;
    await sendBulkNotifications({
      sender: senderId,
      title: "Live Class Started",
      message: `Your live class session has started. Join now to participate.`,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        sessionId: classroomSession._id,
      },
      recipients,
    });
  });
};
