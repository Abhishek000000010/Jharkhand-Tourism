import mongoose from 'mongoose';

/**
 * Ledger of Razorpay webhook events we have already handled.
 *
 * Razorpay retries webhooks, and can deliver the same event more than once even
 * without a retry. Inserting the event id into a unique index BEFORE doing any work
 * turns "have I seen this?" into an atomic operation — a duplicate delivery fails the
 * insert and is dropped, rather than double-confirming or double-refunding a booking.
 */
const processedWebhookSchema = new mongoose.Schema(
  {
    eventId: {
      type: String,
      required: true,
      unique: true,
    },
    event: { type: String },
    // Kept for debugging a failed delivery; expires so the collection can't grow forever.
    handledAt: {
      type: Date,
      default: Date.now,
      expires: 60 * 60 * 24 * 30, // 30 days
    },
  },
  { timestamps: true }
);

export default mongoose.model('ProcessedWebhook', processedWebhookSchema);
