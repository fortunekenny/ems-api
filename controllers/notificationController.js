import { StatusCodes } from "http-status-codes";
import InternalServerError from "../errors/internal-server-error.js";
import NotFoundError from "../errors/not-found.js";
import Notification from "../models/NotificationModel.js";
import Parent from "../models/ParentModel.js";
import Staff from "../models/StaffModel.js";
import Student from "../models/StudentModel.js";
import Class from "../models/ClassModel.js";
import Subject from "../models/SubjectModel.js";
import BadRequestError from "../errors/bad-request.js";
import mongoose from "mongoose";

// Create a notification
export const createNotification = async (req, res, next) => {
  try {
    const { recipient, recipientModel, title, message, type, session, term } =
      req.body;
    const { id } = req.user;

    const sender = id;

    const broadcastId = new mongoose.Types.ObjectId();

    if (!sender) {
      throw new BadRequestError("Sender ID is required.");
    }

    const notification = new Notification({
      recipient,
      recipientModel,
      title,
      message,
      sender,
      type,
      session,
      term,
      metadata: { broadcastId },
    });
    await notification.save();
    res.status(StatusCodes.CREATED).json(notification);
  } catch (error) {
    console.error("Error creating notification: ", error);
    next(new InternalServerError(error.message));
  }
};

export const getAllNotifications = async (req, res, next) => {
  try {
    const notifications = await Notification.find(); /* .populate("user") */
    res
      .status(StatusCodes.OK)
      .json({ count: notifications.length, notifications });
  } catch (error) {
    console.error("Error getting notifications: ", error);
    next(new InternalServerError(error.message));
  }
};

// Get notification by ID
export const getNotificationById = async (req, res, next) => {
  try {
    const notification = await Notification.findById(req.params.id).populate(
      "user",
    );
    if (!notification) {
      throw new NotFoundError("Notification not found");
    }
    res.status(StatusCodes.OK).json(notification);
  } catch (error) {
    console.error("Error getting notification: ", error);
    next(new InternalServerError(error.message));
  }
};

// Get all notifications for a specific recipient (user)
export const getNotificationsByRecipient = async (req, res, next) => {
  try {
    /* 
const recipientId = req.user.id; 
// Convert the role to the format expected by the notification schema (e.g., "Parent")
const recipientModel = req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1);

*/

    const recipientId = req.user.userId;

    const recipientModel =
      req.user.role === "admin" ||
      req.user.role === "proprietor" ||
      req.user.role === "teacher"
        ? "Staff"
        : req.user.role.charAt(0).toUpperCase() + req.user.role.slice(1);

    /* const { recipientId, recipientModel } = req.params; */
    if (!recipientId || !recipientModel) {
      throw new BadRequestError(
        "Recipient ID and recipient model are required.",
      );
    }
    const notifications = await Notification.find({
      recipient: recipientId,
      recipientModel,
    }).sort({ createdAt: -1 });

    // Run count queries concurrently
    const [seenCount, unseenCount, readCount, unreadCount] = await Promise.all([
      Notification.countDocuments({
        recipient: recipientId,
        recipientModel,
        isSeen: true,
      }),
      Notification.countDocuments({
        recipient: recipientId,
        recipientModel,
        isSeen: false,
      }),
      Notification.countDocuments({
        recipient: recipientId,
        recipientModel,
        isRead: true,
      }),
      Notification.countDocuments({
        recipient: recipientId,
        recipientModel,
        isRead: false,
      }),
    ]);

    res.status(StatusCodes.OK).json({
      totalCount: notifications.length,
      seenCount,
      unseenCount,
      readCount,
      unreadCount,
      notifications,
    });
  } catch (error) {
    console.error("Error getting notifications: ", error);
    next(new InternalServerError(error.message));
  }
};

// Update notification
export const updateNotification = async (req, res, next) => {
  try {
    const { title, message } = req.body;
    const updatedNotification = await Notification.findByIdAndUpdate(
      req.params.id,
      { title, message, updatedAt: Date.now() },
      { new: true },
    );
    if (!updatedNotification) {
      throw new NotFoundError("Notification not found");
    }
    res.status(Status.OK).json(updatedNotification);
  } catch (error) {
    console.error("Error updating notification: ", error);
    next(new InternalServerError(error.message));
  }
};

export const markNotificationAsSeen = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const updatedNotification = await Notification.findByIdAndUpdate(
      notificationId,
      { isSeen: true, seenAt: new Date() },
      { new: true },
    );
    if (!updatedNotification) {
      throw new NotFoundError("Notification not found");
    }
    res.status(StatusCodes.OK).json({ updatedNotification });
  } catch (error) {
    console.error("Error marking notification as seen: ", error);
    next(new InternalServerError(error.message));
  }
};
export const markNotificationAsRead = async (req, res, next) => {
  try {
    const { notificationId } = req.params;
    const updatedNotification = await Notification.findByIdAndUpdate(
      notificationId,
      { isRead: true, readAt: new Date() },
      { new: true },
    );
    if (!updatedNotification) {
      throw new NotFoundError("Notification not found");
    }
    res.status(StatusCodes.OK).json({
      message: "Notification updated successfully",
      updatedNotification,
    });
  } catch (error) {
    console.error("Error marking notification as read: ", error);
    next(new InternalServerError(error.message));
  }
};

export const sendNotificationToAllStudents = async (req, res, next) => {
  try {
    const { title, message, type, metadata } = req.body;
    if (!title || !message || !type) {
      throw new BadRequestError("Title, message, and type are required.");
    }

    const { userId } = req.user;

    const sender = userId;

    const broadcastId = new mongoose.Types.ObjectId();

    // Retrieve all active students
    const students = await Student.find({ status: "active" }).select("_id");
    if (!students.length) {
      throw new NotFoundError("No active students found.");
    }
    // Create a notification for each student
    const notifications = students.map((student) => ({
      recipient: student._id,
      recipientModel: "Student",
      title,
      message,
      sender,
      type,
      metadata: { broadcastId },
    }));
    await Notification.insertMany(notifications);
    res.status(StatusCodes.OK).json({
      msg: "Notifications sent successfully to all active students.",
      count: notifications.length,
    });
  } catch (error) {
    console.error("Error sending notifications to all students:", error);
    next(new InternalServerError(error.message));
  }
};

export const sendNotificationToAllStaff = async (req, res, next) => {
  try {
    const { title, message, type } = req.body;
    if (!title || !message || !type) {
      throw new BadRequestError("Title, message, and type are required.");
    }

    const { userId } = req.user;

    const sender = userId;

    const broadcastId = new mongoose.Types.ObjectId();

    // Retrieve all active staff
    const staffs = await Staff.find({ status: "active" }).select("_id");
    if (!staffs.length) {
      throw new NotFoundError("No active staff found.");
    }
    // Create a notification for each staff member
    const notifications = staffs.map((staff) => ({
      recipient: staff._id,
      recipientModel: "Staff",
      title,
      message,
      sender,
      type,
      metadata: { broadcastId },
    }));
    await Notification.insertMany(notifications);
    res.status(StatusCodes.OK).json({
      msg: "Notifications sent successfully to all active staff.",
      count: notifications.length,
    });
  } catch (error) {
    console.error("Error sending notifications to all staff:", error);
    next(new InternalServerError(error.message));
  }
};
export const sendNotificationToAllParent = async (req, res, next) => {
  try {
    const { title, message, type } = req.body;
    if (!title || !message || !type) {
      throw new BadRequestError("Title, message, and type are required.");
    }

    const { userId } = req.user;

    const sender = userId;

    const broadcastId = new mongoose.Types.ObjectId();

    // Retrieve all active parent
    const parents = await Parent.find({ status: "active" }).select("_id");
    if (!parents.length) {
      throw new NotFoundError("No active parent found.");
    }
    // Create a notification for each parent member
    const notifications = parents.map((parent) => ({
      recipient: parent._id,
      recipientModel: "Parent",
      title,
      message,
      sender,
      type,
      metadata: { broadcastId },
    }));
    await Notification.insertMany(notifications);
    res.status(StatusCodes.OK).json({
      msg: "Notifications sent successfully to all active parent.",
      count: notifications.length,
    });
  } catch (error) {
    console.error("Error sending notifications to all parent:", error);
    next(new InternalServerError(error.message));
  }
};

export const sendNotificationToStudentsInClass = async (req, res, next) => {
  try {
    const { classId, title, message, type } = req.body;
    if (!classId || !title || !message) {
      throw new BadRequestError("classId, title, message, are required.");
    }

    const { userId } = req.user;

    const sender = userId;

    const broadcastId = new mongoose.Types.ObjectId();

    // Retrieve class information (assuming the class document contains a "students" array)
    const classData = await Class.findById(classId).select("students");
    if (!classData || !classData.students || classData.students.length === 0) {
      throw new NotFoundError("No students found for this class.");
    }
    // Filter for active students only
    const activeStudents = await Student.find({
      _id: { $in: classData.students },
      status: "active",
    }).select("_id");
    if (!activeStudents.length) {
      throw new NotFoundError("No active students found for this class.");
    }
    // Create a notification for each active student
    const notifications = activeStudents.map((student) => ({
      recipient: student._id,
      recipientModel: "Student",
      title,
      message,
      sender,
      type,
      metadata: { broadcastId },
    }));
    await Notification.insertMany(notifications);
    res.status(StatusCodes.OK).json({
      msg: "Notifications sent successfully to active students in the class.",
      count: notifications.length,
    });
  } catch (error) {
    console.error("Error sending notifications to students in class:", error);
    next(new InternalServerError(error.message));
  }
};

export const createNotificationForAssignment = async (
  assignment,
  userId,
  type = "none",
) => {
  // try {

  const sender = userId;

  const broadcastId = new mongoose.Types.ObjectId();

  // Retrieve the class document to get its student list (or however you store it)

  const classData = await Class.findById(assignment.classId);
  // const classData = await Class.findById(assignment.classId);
  if (!classData || !classData.students || classData.students.length === 0) {
    throw new BadRequestError("No students found for this class.");
  }

  const activeStudents = await Student.find({
    _id: { $in: classData.students },
    status: "active",
  }).select("_id");

  if (!activeStudents.length) {
    throw new NotFoundError("No active students found for this class.");
  }

  const notifications = activeStudents.map((student) => ({
    recipient: student._id, // Using a dynamic reference, see refPath approach
    recipientModel: "Student", // Change if needed
    title: `New Assignment: ${assignment.topic}`,
    message: `A new assignment has been posted: ${assignment.subTopic}. Please check your portal for details.`,
    sender,
    type: type, // or "email", "sms"
    metadata: { broadcastId: broadcastId, assignmentId: assignment._id },
  }));

  // Bulk insert notifications
  await Notification.insertMany(notifications);
};

export const createNotificationForClasswork = async (
  classwork,
  userId,
  type = "none",
) => {
  // try {

  // const { userId } = req.user;
  const sender = userId;

  const broadcastId = new mongoose.Types.ObjectId();

  // Retrieve the class document to get its student list (or however you store it)

  const classData = await Class.findById(classwork.classId);
  // const classData = await Class.findById(classwork.classId);
  if (!classData || !classData.students || classData.students.length === 0) {
    throw new BadRequestError("No students found for this class.");
  }

  const activeStudents = await Student.find({
    _id: { $in: classData.students },
    status: "active",
  }).select("_id");

  if (!activeStudents.length) {
    throw new NotFoundError("No active students found for this class.");
  }

  const notifications = activeStudents.map((student) => ({
    recipient: student._id, // Using a dynamic reference, see refPath approach
    recipientModel: "Student", // Change if needed
    title: `New Classwork: ${classwork.topic}`,
    message: `A new classwork has been posted: ${classwork.subTopic}. Please check your portal for details.`,
    sender,
    type: type, // or "email", "sms"
    metadata: { broadcastId: broadcastId, classworkId: classwork._id },
  }));

  // Bulk insert notifications
  await Notification.insertMany(notifications);
};

export const createNotificationForLessonNote = async (
  lessonNote,
  userId,
  title,
  message,
  type = "none",
) => {
  // try {

  // const { userId } = req.user;
  const sender = userId;

  const broadcastId = new mongoose.Types.ObjectId();

  const classData = await Class.findById(lessonNote.classId);
  // const classData = await Class.findById(lessonNote.classId);
  if (!classData) {
    throw new BadRequestError("No class found.");
  }

  // const teacherData = await Staff.findById(lessonNote.teacher);
  const teacherData = await Staff.findById(sender);
  if (!teacherData) {
    throw new BadRequestError("No teacher found.");
  }

  const subjectData = await Subject.findById(lessonNote.subject);
  if (!subjectData) {
    throw new BadRequestError("No subject found.");
  }

  const staffs = await Staff.find({
    role: { $in: ["admin", "proprietor"] },
    status: "active",
  }).select("_id");

  const notifications = staffs.map((staff) => ({
    recipient: staff._id, // Using a dynamic reference, see refPath approach
    recipientModel: "Staff", // Change if needed
    title: title,
    message: message,
    sender,
    type: type, // or "email", "sms"
    metadata: { broadcastId: broadcastId, lessonNoteId: lessonNote._id },
  }));

  // Bulk insert notifications
  await Notification.insertMany(notifications);
};

export const sendBulkNotifications = async (options) => {
  const {
    sender,
    title,
    message,
    type = "none",
    metadata = {},
    recipients,
  } = options;

  if (
    !sender ||
    !title ||
    !message ||
    !recipients ||
    !Array.isArray(recipients)
  ) {
    throw new BadRequestError(
      "Missing required parameters or invalid recipients array.",
    );
  }

  // Create notifications for each recipient
  const notifications = recipients.map((recipient) => ({
    recipient: recipient.recipientId,
    recipientModel: recipient.recipientModel,
    title: title,
    message: message,
    sender: sender,
    type: type,
    metadata: metadata,
  }));

  // Bulk insert notifications
  await Notification.insertMany(notifications);
};

/* 

    const updater = await Staff.findById(req.user.userId);
    if (!updater) {
      throw new BadRequestError("Updater not found.");
    }

    const classData = await Class.findOne({
      _id: req.body.classId,
      term: req.body.term,
      session: req.body.session,
    }).populate("subjects", "subjectName");
    if (!classData) {
      throw new NotFoundError("Class not found.");
    }
      
    // Find subject data from the class's subjects.
    const subjectData = classData.subjects.find(
      (subj) => subj._id.toString() === subject.toString(),
    );
    if (!subjectData) {
      throw new NotFoundError("Subject data not found in class.");
    }



    const staffs = await Staff.find({
      role: { $in: ["admin", "proprietor"] },
      status: "active",
    }).select("_id");

    // Prepare recipients
    const recipients = [
      ...staffs.map((staff) => ({
        recipientId: staff._id,
        recipientModel: "Staff",
      })),
      // ...students.map((student) => ({ recipientId: student._id, recipientModel: "Student" })),
    ];


    const notificationTitle = `Lesson Note Updated`;

    const notificationMessage = `${classData.className} ${subjectData.subjectName} lesson note for week ${lessonNote.lessonWeek} on the topic ${lessonNote.topic} has been updated by ${updater.firstName} ${updater.lastName}. Please check your portal for details.`;

    await sendBulkNotifications({
      sender: req.user.userId,
      title: notificationTitle,
      message: notificationMessage,
      metadata: {
        broadcastId: new mongoose.Types.ObjectId(),
        lessonNoteId: lessonNote._id,
      },
      recipients: recipients,
    });
*/

/* const senderId = new mongoose.Types.ObjectId(); // Example sender ID
const classId = new mongoose.Types.ObjectId(); // Example class ID

// Fetch staff and students
const staffs = await Staff.find({ role: { $in: ["admin", "proprietor"] } }).select("_id");
const students = await Student.find({ class: classId }).select("_id");

// Prepare recipients
const recipients = [
  ...staffs.map((staff) => ({ recipientId: staff._id, recipientModel: "Staff" })),
  ...students.map((student) => ({ recipientId: student._id, recipientModel: "Student" })),
];

// Create notifications
await createNotifications({
  sender: senderId,
  title: "New Lesson Note",
  message: "A new lesson note has been created for your class.",
  type: "app",
  metadata: { broadcastId: new mongoose.Types.ObjectId(), lessonNoteId: new mongoose.Types.ObjectId() },
  recipients: recipients,
});
*/

/*
  Deletes all notifications associated with a given broadcast.
  Expects req.params.broadcastId to identify the broadcast.
 */
/* export const deleteBroadcastNotifications = async (req, res, next) => {
  try {
    const { broadcastId } = req.params;
    if (!broadcastId) {
      throw new BadRequestError(
        "Broadcast ID is required to delete broadcast notifications.",
      );
    }

    // Delete all notification documents where metadata.broadcastId matches the provided ID.
    const result = await Notification.deleteMany({
      "metadata.broadcastId": broadcastId,
    });
    if (result.deletedCount === 0) {
      throw new NotFoundError(
        "No notifications found for the specified broadcast.",
      );
    }

    res.status(StatusCodes.OK).json({
      message: "Broadcast notifications deleted successfully.",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting broadcast notifications:", error);
    next(new InternalServerError(error.message));
  }
}; */

/* export const deleteBroadcastNotifications = async (req, res, next) => {
  try {
    const { broadcastId } = req.params;
    if (!broadcastId) {
      throw new BadRequestError(
        "Broadcast ID is required to delete broadcast notifications.",
      );
    }

    console.log("Broadcast ID:", broadcastId);
    console.log("BroadcastID type:", typeof broadcastId);
    // Debug: log how many notifications match this broadcastId
    const matchingNotifications = await Notification.find({
      "metadata.broadcastId": broadcastId,
    });
    console.log("Matching notifications:", matchingNotifications);

    // Delete all notification documents where metadata.broadcastId matches the provided ID.
    const result = await Notification.deleteMany({
      "metadata.broadcastId": broadcastId,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundError(
        "No notifications found for the specified broadcast.",
      );
    }

    res.status(StatusCodes.OK).json({
      message: "Broadcast notifications deleted successfully.",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting broadcast notifications:", error);
    next(new InternalServerError(error.message));
  }
}; */

export const deleteBroadcastNotifications = async (req, res, next) => {
  try {
    const { broadcastId } = req.params;
    if (!broadcastId) {
      throw new BadRequestError(
        "Broadcast ID is required to delete broadcast notifications.",
      );
    }

    // Convert the broadcastId from string to an ObjectId.
    const broadcastIdObj = new mongoose.Types.ObjectId(broadcastId);

    // Debug: log the type and value
    console.log(
      "Deleting notifications with broadcastId (ObjectId):",
      broadcastIdObj,
    );

    // Delete all notification documents where metadata.broadcastId equals the broadcastIdObj.
    const result = await Notification.deleteMany({
      "metadata.broadcastId": broadcastIdObj,
    });

    if (result.deletedCount === 0) {
      throw new NotFoundError(
        "No notifications found for the specified broadcast.",
      );
    }

    res.status(StatusCodes.OK).json({
      message: "Broadcast notifications deleted successfully.",
      deletedCount: result.deletedCount,
    });
  } catch (error) {
    console.error("Error deleting broadcast notifications:", error);
    next(new InternalServerError(error.message));
  }
};

// Delete notification
export const deleteNotification = async (req, res, next) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification) {
      throw new NotFoundError("Notification not found");
    }
    res
      .status(StatusCodes.OK)
      .json({ message: "Notification deleted successfully" });
  } catch (error) {
    next(new InternalServerError(error.message));
  }
};
