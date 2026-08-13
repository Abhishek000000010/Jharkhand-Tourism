import mongoose from 'mongoose';

// Statuses that still occupy inventory. `pending_payment` only counts while its
// hold is unexpired — see ACTIVE_BOOKING_FILTER below.
export const OCCUPYING_STATUSES = ['confirmed', 'completed', 'no_show'];

export const BOOKING_STATUSES = [
  'pending_payment', // 10-minute hold while the tourist pays (Phase 5 attaches Razorpay)
  'confirmed',       // paid and accepted
  'cancelled',       // tourist pulled out
  'rejected',        // operator refused
  'expired',         // hold ran out before payment
  'completed',       // stay/tour finished
  'no_show',         // tourist never turned up — still counts as revenue
];

/**
 * Mongo filter for bookings that currently consume capacity.
 *
 * A confirmed booking always counts. A pending hold only counts until it expires,
 * which is what stops an abandoned checkout from blocking a room forever.
 */
export const ACTIVE_BOOKING_FILTER = () => ({
  $or: [
    { status: { $in: OCCUPYING_STATUSES } },
    { status: 'pending_payment', holdExpiresAt: { $gt: new Date() } },
  ],
});

const bookingSchema = new mongoose.Schema(
  {
    tourist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },
    // Denormalised from the listing so the operator's dashboard can query their
    // own bookings without a join, and so the record survives a listing rename.
    operator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    category: {
      type: String,
      enum: ['homestay', 'guide', 'artisan'],
      required: true,
    },

    // Half-open interval [checkIn, checkOut): the checkout day is NOT a booked
    // night, so one guest leaving on the 15th frees that night for the next.
    // A guide's single day is stored as [day, day + 1) so the same overlap
    // arithmetic works for both date-based categories.
    checkIn: {
      type: Date,
      required: function () { return this.category !== 'artisan'; },
    },
    checkOut: {
      type: Date,
      required: function () { return this.category !== 'artisan'; },
    },

    // Rooms for a homestay, always 1 for a guide, quantity for an artisan order.
    units: {
      type: Number,
      required: true,
      min: [1, 'A booking must be for at least 1 unit'],
    },

    // Money is stored in paise, never rupees, and snapshotted at booking time so
    // a later price change cannot rewrite history.
    pricePerUnitPaise: {
      type: Number,
      required: true,
      min: 0,
    },
    amountPaise: {
      type: Number,
      required: true,
      min: 0,
    },

    // --- Commission split, frozen when the booking is created ---
    // The admin can change the platform rate at any time; these three fields make sure
    // that never rewrites what an operator was already promised.
    // Invariant: commissionPaise + operatorPayoutPaise === amountPaise.
    commissionPercent: { type: Number, default: 0, min: 0 },
    commissionPaise: { type: Number, default: 0, min: 0 },
    operatorPayoutPaise: { type: Number, default: 0, min: 0 },

    // --- Razorpay ---
    razorpayOrderId: { type: String },
    // Unique + sparse is what makes payment confirmation idempotent: a replayed
    // webhook cannot attach the same payment to a second booking.
    razorpayPaymentId: { type: String, unique: true, sparse: true },
    paidAt: { type: Date },

    // Refunds proper belong to Phase 6, but a payment that lands after the hold has
    // been lost has to be refunded immediately, so the fields exist from here.
    refundedPaise: { type: Number, default: 0, min: 0 },
    razorpayRefundId: { type: String },

    // Short human-readable reference printed on the voucher
    bookingRef: { type: String, unique: true, sparse: true },

    // Cloudinary copy of the issued voucher. Stored as an authenticated `raw`
    // asset in its own folder, so only the public_id is kept here — the file
    // itself needs a signed URL to open, because it carries the guest's name,
    // phone number and payment reference.
    voucherPublicId: { type: String },
    voucherArchivedAt: { type: Date },

    // --- Cancellation (Phase 6) ---
    cancelledAt: { type: Date },
    // Who ended the booking — drives whether the operator takes a strike
    cancelledBy: { type: String, enum: ['tourist', 'operator', 'admin'] },
    cancellationReason: { type: String, trim: true },

    status: {
      type: String,
      enum: BOOKING_STATUSES,
      default: 'pending_payment',
    },
    // Only meaningful while status is pending_payment.
    holdExpiresAt: {
      type: Date,
    },

    guestName: { type: String, trim: true },
    guestPhone: { type: String, trim: true },
  },
  { timestamps: true }
);

// The availability sweep always filters listing + status + date range.
bookingSchema.index({ listing: 1, status: 1, checkIn: 1, checkOut: 1 });
bookingSchema.index({ tourist: 1, createdAt: -1 });
bookingSchema.index({ operator: 1, createdAt: -1 });

export default mongoose.model('Booking', bookingSchema);
