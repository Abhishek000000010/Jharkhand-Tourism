import mongoose from 'mongoose';

/**
 * Types are stored rather than derived so the bell can pick an icon and a tone
 * without the client having to know anything about booking states.
 */
export const NOTIFICATION_TYPES = [
  'booking_confirmed',   // to both sides when payment clears
  'booking_cancelled',   // traveller pulled out — to the host
  'booking_rejected',    // host pulled out — to the traveller
  'booking_completed',   // host marked the stay finished — to the traveller
  'booking_no_show',     // host marked a no-show — to the traveller
  'refund_issued',       // admin refund — to the traveller
  'message_received',
  'review_received',     // to the host
  'review_replied',      // to the traveller
  'operator_approved',
  'operator_rejected',
];

const notificationSchema = new mongoose.Schema(
  {
    // Who should SEE this. Never the person who caused it.
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    type: {
      type: String,
      enum: NOTIFICATION_TYPES,
      required: true,
    },
    title: { type: String, required: true, trim: true },
    body: { type: String, default: '', trim: true },

    // Where clicking it should take them, as an in-app path. Stored at write time
    // because the recipient's role decides the route, and the reader has no way
    // to work that out later.
    link: { type: String, default: '' },

    readAt: { type: Date, default: null },
  },
  { timestamps: true }
);

// The bell always reads one user's newest first, and counts their unread.
notificationSchema.index({ user: 1, createdAt: -1 });
notificationSchema.index({ user: 1, readAt: 1 });

export default mongoose.model('Notification', notificationSchema);
