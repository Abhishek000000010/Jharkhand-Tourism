import mongoose from 'mongoose';

export const EMAIL_TYPES = [
  'booking_confirmed_traveller',
  'booking_confirmed_operator',
  'booking_cancelled_traveller',
  'booking_cancelled_operator',
  'booking_rejected_traveller',
  'refund_issued_traveller',
  'operator_approved',
  'operator_rejected',
];

/**
 * Durable outbox for transactional email.
 *
 * Nothing is ever sent inline. A booking writes a job here and returns immediately, and
 * a background worker delivers it. That inversion is the whole point: if Brevo is down,
 * or slow, or the credentials are wrong, the traveller's payment still completes and the
 * message goes out when the provider recovers.
 */
const emailJobSchema = new mongoose.Schema(
  {
    type: {
      type: String,
      enum: EMAIL_TYPES,
      required: true,
    },
    to: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
    },
    subject: { type: String, required: true },
    html: { type: String, required: true },
    text: { type: String, required: true },

    /**
     * Booking whose voucher PDF should be attached. Stored as a reference rather than
     * the file itself — a queued job stays a few kilobytes instead of half a megabyte,
     * and the PDF is regenerated from live data at send time.
     */
    attachVoucherFor: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Booking',
    },

    /**
     * Makes enqueueing idempotent. A replayed payment webhook re-runs the same event,
     * and the unique index means the second attempt is dropped instead of emailing the
     * traveller twice.
     */
    dedupeKey: {
      type: String,
      unique: true,
      sparse: true,
    },

    status: {
      type: String,
      enum: ['pending', 'sent', 'failed'],
      default: 'pending',
    },
    attempts: { type: Number, default: 0 },
    maxAttempts: { type: Number, default: 5 },
    nextAttemptAt: { type: Date, default: Date.now },
    lastError: { type: String },
    sentAt: { type: Date },
  },
  { timestamps: true }
);

// The worker's only query: pending jobs that are due.
emailJobSchema.index({ status: 1, nextAttemptAt: 1 });

export default mongoose.model('EmailJob', emailJobSchema);
