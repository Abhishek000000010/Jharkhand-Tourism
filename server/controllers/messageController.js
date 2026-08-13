import Conversation from '../models/Conversation.js';
import Message, { MAX_MESSAGE_LENGTH } from '../models/Message.js';
import Listing from '../models/Listing.js';
import Booking from '../models/Booking.js';
import OperatorProfile from '../models/OperatorProfile.js';
import { pushMessage } from '../services/notificationService.js';

const PAGE_SIZE = 100;

/**
 * Which side of the thread the caller is on.
 *
 * Membership is decided by the ids stored on the conversation, never by the user's
 * role alone — an operator is not a participant in every operator's threads.
 */
const sideOf = (conversation, userId) => {
  if (String(conversation.tourist?._id || conversation.tourist) === userId) return 'tourist';
  if (String(conversation.operator?._id || conversation.operator) === userId) return 'operator';
  return null;
};

/** Load a conversation the caller actually belongs to, or say why not. */
const loadThread = async (id, userId) => {
  const conversation = await Conversation.findById(id)
    .populate('listing', 'title category district images price')
    .populate('tourist', 'name email')
    .populate('operator', 'name email');

  if (!conversation) return { error: 'notFound' };

  const side = sideOf(conversation, userId);
  if (!side) return { error: 'forbidden' };

  return { conversation, side };
};

/**
 * The booking, if any, that this thread is really about.
 *
 * Prefers a stay that is still live over one that is finished, so a thread opened
 * during a stay shows that stay rather than last year's. Computed on read instead
 * of stored, because a thread can outlive several bookings.
 */
const relatedBooking = async (listingId, touristId) => {
  const live = await Booking.findOne({
    listing: listingId,
    tourist: touristId,
    status: { $in: ['pending_payment', 'confirmed'] },
  })
    .sort('checkIn')
    .select('bookingRef status checkIn checkOut units amountPaise')
    .lean();

  if (live) return live;

  return Booking.findOne({ listing: listingId, tourist: touristId })
    .sort('-createdAt')
    .select('bookingRef status checkIn checkOut units amountPaise')
    .lean();
};

const shape = (conversation, side) => ({
  _id: conversation._id,
  listing: conversation.listing,
  tourist: conversation.tourist,
  operator: conversation.operator,
  lastMessage: conversation.lastMessage,
  lastMessageAt: conversation.lastMessageAt,
  lastSenderRole: conversation.lastSenderRole,
  unread: side === 'tourist' ? conversation.unreadTourist : conversation.unreadOperator,
  // Whichever participant the caller is talking TO — saves every view doing this.
  counterpart: side === 'tourist' ? conversation.operator : conversation.tourist,
});

// @desc    Open (or reopen) the thread between this traveller and a listing's host
// @route   POST /api/messages/conversations
// @access  Private/Tourist
export const startConversation = async (req, res) => {
  try {
    const listing = await Listing.findById(req.body.listingId).lean();

    // Same visibility rule as booking: an unapproved or paused listing is not
    // contactable, and the 404 is deliberately indistinguishable from "no such id".
    if (!listing || !listing.isActive) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    const profile = await OperatorProfile.findOne({ user: listing.operator, status: 'approved' }).lean();
    if (!profile) {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }

    // Upsert against the unique (listing, tourist) index, so a double-click cannot
    // produce two threads for the same pair.
    const conversation = await Conversation.findOneAndUpdate(
      { listing: listing._id, tourist: req.user.id },
      { $setOnInsert: { listing: listing._id, tourist: req.user.id, operator: listing.operator } },
      { new: true, upsert: true, setDefaultsOnInsert: true }
    )
      .populate('listing', 'title category district images price')
      .populate('tourist', 'name email')
      .populate('operator', 'name email');

    res.status(200).json({ success: true, conversation: shape(conversation, 'tourist') });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Listing not found' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Every thread the caller is part of, newest activity first
// @route   GET /api/messages/conversations
// @access  Private (tourist or operator)
export const listConversations = async (req, res) => {
  try {
    const side = req.user.role === 'operator' ? 'operator' : 'tourist';

    const conversations = await Conversation.find({ [side]: req.user.id })
      .populate('listing', 'title category district images price')
      .populate('tourist', 'name email')
      .populate('operator', 'name email')
      // An empty thread (created by opening the composer and walking away) sorts
      // to the top by createdAt so the tourist can find and finish it.
      .sort({ lastMessageAt: -1, createdAt: -1 })
      .lean();

    res.status(200).json({
      success: true,
      side,
      conversations: conversations.map(c => shape(c, side)),
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Unread total for the sidebar badge
// @route   GET /api/messages/unread
// @access  Private (tourist or operator)
export const getUnreadCount = async (req, res) => {
  try {
    const side = req.user.role === 'operator' ? 'operator' : 'tourist';
    const field = side === 'operator' ? 'unreadOperator' : 'unreadTourist';

    const [row] = await Conversation.aggregate([
      { $match: { [side]: req.user._id } },
      { $group: { _id: null, total: { $sum: `$${field}` } } },
    ]);

    res.status(200).json({ success: true, unread: row?.total || 0 });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Read one thread. Opening it marks the caller's side as read.
// @route   GET /api/messages/conversations/:id
// @access  Private (participants only)
export const getThread = async (req, res) => {
  try {
    const { conversation, side, error } = await loadThread(req.params.id, req.user.id);
    if (error === 'notFound') return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, message: 'Not part of this conversation' });

    const [messages, booking] = await Promise.all([
      Message.find({ conversation: conversation._id })
        .sort('createdAt')
        .limit(PAGE_SIZE)
        .lean(),
      relatedBooking(conversation.listing._id, conversation.tourist._id),
    ]);

    // Opening the thread IS reading it.
    const field = side === 'tourist' ? 'unreadTourist' : 'unreadOperator';
    if (conversation[field] > 0) {
      conversation[field] = 0;
      await conversation.save();

      await Message.updateMany(
        { conversation: conversation._id, senderRole: { $ne: side }, readAt: null },
        { $set: { readAt: new Date() } }
      );
    }

    res.status(200).json({
      success: true,
      side,
      conversation: shape(conversation, side),
      booking,
      messages,
    });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Post a message into a thread
// @route   POST /api/messages/conversations/:id/messages
// @access  Private (participants only)
export const sendMessage = async (req, res) => {
  try {
    const body = String(req.body.body || '').trim();

    if (!body) {
      return res.status(400).json({ success: false, message: 'Write something first' });
    }
    if (body.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({
        success: false,
        message: `Messages are limited to ${MAX_MESSAGE_LENGTH} characters`,
      });
    }

    const { conversation, side, error } = await loadThread(req.params.id, req.user.id);
    if (error === 'notFound') return res.status(404).json({ success: false, message: 'Conversation not found' });
    if (error === 'forbidden') return res.status(403).json({ success: false, message: 'Not part of this conversation' });

    const message = await Message.create({
      conversation: conversation._id,
      sender: req.user.id,
      senderRole: side,
      body,
    });

    // Bump the other side's unread count, never your own.
    const theirs = side === 'tourist' ? 'unreadOperator' : 'unreadTourist';
    conversation[theirs] = (conversation[theirs] || 0) + 1;
    conversation.lastMessage = body.slice(0, 140);
    conversation.lastMessageAt = message.createdAt;
    conversation.lastSenderRole = side;
    await conversation.save();

    const recipientRole = side === 'tourist' ? 'operator' : 'tourist';
    await pushMessage({
      recipientId: conversation[recipientRole]._id,
      recipientRole,
      conversationId: conversation._id,
      senderName: req.user.name,
      listingTitle: conversation.listing?.title,
      body,
    });

    res.status(201).json({ success: true, message });
  } catch (error) {
    if (error.name === 'CastError') {
      return res.status(404).json({ success: false, message: 'Conversation not found' });
    }
    if (error.name === 'ValidationError') {
      return res.status(400).json({ success: false, message: error.message });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};
