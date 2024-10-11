import Notification from "../models/NotificationModel.js";

// Create a notification
export const createNotification = async (req, res) => {
  try {
    const { title, message, user, type, session, term } = req.body;
    const notification = new Notification({
      title,
      message,
      user,
      type,
      session,
      term,
    });
    await notification.save();
    res.status(201).json(notification);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Get notification by ID
export const getNotificationById = async (req, res) => {
  try {
    const notification = await Notification.findById(req.params.id).populate(
      "user",
    );
    if (!notification) {
      return res.status(404).json({ message: "Notification not found" });
    }
    res.status(200).json(notification);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Get all notifications for a specific recipient (user)
export const getNotificationsByRecipient = async (req, res) => {
  try {
    const notifications = await Notification.find({
      user: req.params.userId,
      session: req.query.session,
      term: req.query.term,
    }).populate("user");
    res.status(200).json(notifications);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

// Update notification
export const updateNotification = async (req, res) => {
  try {
    const { title, message } = req.body;
    const updatedNotification = await Notification.findByIdAndUpdate(
      req.params.id,
      { title, message, updatedAt: Date.now() },
      { new: true },
    );
    if (!updatedNotification)
      return res.status(404).json({ error: "Notification not found" });
    res.status(200).json(updatedNotification);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

// Delete notification
export const deleteNotification = async (req, res) => {
  try {
    const notification = await Notification.findByIdAndDelete(req.params.id);
    if (!notification)
      return res.status(404).json({ error: "Notification not found" });
    res.status(200).json({ message: "Notification deleted successfully" });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};
