import Notification from '../models/Notification.js';

const FEED_LIMIT = 25;

// @desc    The caller's recent notifications, plus how many are unread
// @route   GET /api/notifications
// @access  Private
export const listNotifications = async (req, res) => {
  try {
    // The bell shows a recent feed, not an archive, so the unread count is queried
    // separately — otherwise an old unread item falling off the end of the list
    // would quietly stop being counted.
    const [notifications, unread] = await Promise.all([
      Notification.find({ user: req.user.id })
        .sort('-createdAt')
        .limit(FEED_LIMIT)
        .lean(),
      Notification.countDocuments({ user: req.user.id, readAt: null }),
    ]);

    res.status(200).json({ success: true, unread, notifications });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Mark one notification read
// @route   POST /api/notifications/:id/read
// @access  Private (owner only)
export const markRead = async (req, res) => {
  try {
    // Scoping the update by user is the authorization check: another account's id
    // simply matches nothing.
    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, user: req.user.id },
      { $set: { readAt: new Date() } },
      { new: true }
    );

    if (!notification) {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }

    res.status(200).json({ success: true, notification });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Notification not found' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Clear the badge in one go
// @route   POST /api/notifications/read-all
// @access  Private
export const markAllRead = async (req, res) => {
  try {
    const result = await Notification.updateMany(
      { user: req.user.id, readAt: null },
      { $set: { readAt: new Date() } }
    );

    res.status(200).json({ success: true, updated: result.modifiedCount });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
