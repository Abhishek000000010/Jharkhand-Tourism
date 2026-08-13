import { todayUtc, toUtcMidnight } from './availabilityService.js';
import { refundPayment, computeSplit, currentCommissionPercent } from './paymentService.js';

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/**
 * The cancellation policy, expressed as data so it can be shown to the tourist
 * BEFORE they pay and applied afterwards from the same single source.
 *
 * `minDays` is the whole number of calendar days between today and the start of the
 * stay, so "more than 7 days" is `>= 8`. Bands are evaluated top down.
 */
export const CANCELLATION_POLICY = [
  { minDays: 8, refundPercent: 100, label: 'More than 7 days before', summary: 'Full refund' },
  { minDays: 3, refundPercent: 50, label: '3 to 7 days before', summary: '50% refund' },
  { minDays: -Infinity, refundPercent: 0, label: 'Less than 3 days before', summary: 'No refund' },
];

/**
 * Whole calendar days from today (UTC) until the booking starts.
 * Negative once the start date has passed. Null for craft orders, which have no dates.
 */
export const daysUntilStart = (booking, now = new Date()) => {
  if (booking.category === 'artisan' || !booking.checkIn) return null;
  const start = toUtcMidnight(booking.checkIn);
  const today = toUtcMidnight(now) || todayUtc();
  return Math.round((start.getTime() - today.getTime()) / MS_PER_DAY);
};

/**
 * What a tourist would get back if they cancelled right now.
 *
 * Craft orders sit outside the time-based bands entirely: there is no check-in date to
 * count down to, and the model has no dispatch state, so there is no point at which a
 * craft order stops being refundable. Treated as fully refundable and flagged as such.
 */
export const refundQuoteFor = (booking, now = new Date()) => {
  const alreadyRefunded = booking.refundedPaise || 0;
  // Guard: a refund can never exceed what is still un-refunded, and never go negative
  const refundable = Math.max(0, booking.amountPaise - alreadyRefunded);

  if (booking.category === 'artisan') {
    return {
      refundPercent: 100,
      refundPaise: refundable,
      daysUntilStart: null,
      band: 'Craft order',
      summary: 'Full refund before dispatch',
    };
  }

  const days = daysUntilStart(booking, now);
  const band = CANCELLATION_POLICY.find(b => days >= b.minDays) ||
    CANCELLATION_POLICY[CANCELLATION_POLICY.length - 1];

  // Percentage applies to the ORIGINAL amount, then is capped by what is left to refund,
  // so a partial admin refund can never combine with a policy refund to overpay.
  const byPolicy = Math.round((booking.amountPaise * band.refundPercent) / 100);

  return {
    refundPercent: band.refundPercent,
    refundPaise: Math.min(byPolicy, refundable),
    daysUntilStart: days,
    band: band.label,
    summary: band.summary,
  };
};

/**
 * Human-readable policy for a specific booking, used to show terms before payment.
 * Returns the concrete dates each band expires on rather than abstract day counts.
 */
export const policyPreview = (checkInInput) => {
  const checkIn = toUtcMidnight(checkInInput);
  if (!checkIn) {
    return { bands: [{ label: 'Craft orders', summary: 'Full refund before dispatch' }] };
  }

  const dayBefore = (n) => new Date(checkIn.getTime() - n * MS_PER_DAY).toISOString().slice(0, 10);

  return {
    checkIn: checkIn.toISOString().slice(0, 10),
    bands: [
      { label: `Cancel before ${dayBefore(7)}`, summary: 'Full refund' },
      { label: `Cancel before ${dayBefore(3)}`, summary: '50% refund' },
      { label: `On or after ${dayBefore(3)}`, summary: 'No refund' },
    ],
  };
};

/**
 * Recompute the commission split after money has been given back.
 *
 * The platform only takes commission on what it actually keeps, so a half-refunded
 * booking yields half the commission. Keeps the invariant
 * `commissionPaise + operatorPayoutPaise === amountPaise - refundedPaise`.
 */
export const resplitAfterRefund = async (booking) => {
  const net = Math.max(0, booking.amountPaise - (booking.refundedPaise || 0));
  // Reuse the rate frozen on the booking, never today's rate
  const percent = booking.commissionPercent ?? (await currentCommissionPercent());
  const split = computeSplit(net, percent);

  booking.commissionPaise = split.commissionPaise;
  booking.operatorPayoutPaise = split.operatorPayoutPaise;
  return booking;
};

/**
 * Issue a refund and record it on the booking.
 *
 * Idempotent and arithmetic-safe:
 *   - refunding 0 is a no-op rather than an error
 *   - the amount is clamped to what remains un-refunded, so repeated calls cannot
 *     return more than the tourist actually paid
 *   - a booking that was never paid has nothing to refund
 */
export const issueRefund = async (booking, requestedPaise, { reason = '' } = {}) => {
  if (!booking.razorpayPaymentId) {
    return { refunded: 0, skipped: 'Booking was never paid' };
  }

  const remaining = Math.max(0, booking.amountPaise - (booking.refundedPaise || 0));
  const amount = Math.min(Math.max(0, Math.round(requestedPaise)), remaining);

  if (amount <= 0) {
    return { refunded: 0, skipped: remaining <= 0 ? 'Already fully refunded' : 'Policy gives no refund' };
  }

  const refund = await refundPayment(booking.razorpayPaymentId, amount);

  booking.refundedPaise = (booking.refundedPaise || 0) + amount;
  booking.razorpayRefundId = refund.id;
  if (reason) booking.cancellationReason = reason;

  await resplitAfterRefund(booking);

  return { refunded: amount, refundId: refund.id };
};
