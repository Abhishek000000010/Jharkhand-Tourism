import crypto from 'crypto';
import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import PlatformSettings from '../models/PlatformSettings.js';
import { getRazorpay, isRazorpayConfigured } from '../config/razorpay.js';
import { checkAvailability } from './availabilityService.js';

/**
 * Split a gross amount between the platform and the operator.
 *
 * The operator payout is derived by SUBTRACTION rather than by a second percentage
 * calculation. That guarantees commission + payout === amount exactly, with no rounding
 * gap that would otherwise silently lose or invent a paisa on every booking.
 */
export const computeSplit = (amountPaise, commissionPercent) => {
  const pct = Math.min(Math.max(Number(commissionPercent) || 0, 0), 100);
  const commissionPaise = Math.round((amountPaise * pct) / 100);
  return {
    commissionPercent: pct,
    commissionPaise,
    operatorPayoutPaise: amountPaise - commissionPaise,
  };
};

export const currentCommissionPercent = async () => {
  const settings = await PlatformSettings.current();
  return settings.commissionPercent;
};

/** Short, unambiguous booking reference for the voucher (no easily-confused characters). */
export const generateBookingRef = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let out = '';
  const bytes = crypto.randomBytes(8);
  for (let i = 0; i < 8; i++) out += alphabet[bytes[i] % alphabet.length];
  return `JH-${out.slice(0, 4)}-${out.slice(4)}`;
};

/**
 * HMAC that ties a QR code to a specific booking.
 *
 * Without this an operator could be shown a QR for any booking id; with it, only the
 * server could have produced the token, so scanning proves the booking is genuine.
 */
export const voucherToken = (bookingId) =>
  crypto.createHmac('sha256', process.env.JWT_SECRET).update(String(bookingId)).digest('hex').slice(0, 32);

export const verifyVoucherToken = (bookingId, token) => {
  const expected = voucherToken(bookingId);
  const a = Buffer.from(expected);
  const b = Buffer.from(String(token || ''));
  // Constant-time compare, and length check first because timingSafeEqual throws on mismatch
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/** Signature Razorpay Checkout returns to the browser on success. */
export const verifyCheckoutSignature = ({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) => {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  const a = Buffer.from(expected);
  const b = Buffer.from(String(razorpay_signature || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/** Signature on an incoming webhook, computed over the RAW request body. */
export const verifyWebhookSignature = (rawBody, signature) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) return false;

  const expected = crypto.createHmac('sha256', secret).update(rawBody).digest('hex');
  const a = Buffer.from(expected);
  const b = Buffer.from(String(signature || ''));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
};

/**
 * Create (or reuse) the Razorpay order for a booking.
 *
 * Reusing an existing order id matters: a tourist who closes the payment sheet and
 * reopens it must not generate a second order for the same hold.
 */
export const createOrderForBooking = async (booking) => {
  if (booking.razorpayOrderId) {
    return { orderId: booking.razorpayOrderId, amountPaise: booking.amountPaise, reused: true };
  }

  let orderId;

  if (isRazorpayConfigured()) {
    const order = await getRazorpay().orders.create({
      amount: booking.amountPaise, // Razorpay expects the smallest currency unit — paise
      currency: 'INR',
      receipt: booking.bookingRef || String(booking._id),
      notes: { bookingId: String(booking._id), category: booking.category },
    });
    orderId = order.id;
  } else {
    // Mock gateway — deterministic id so the flow is inspectable in the database
    orderId = `order_mock_${booking._id}`;
  }

  booking.razorpayOrderId = orderId;
  await booking.save();

  return { orderId, amountPaise: booking.amountPaise, reused: false };
};

/**
 * Payments that never went through a real gateway — the mock checkout and the
 * demo seed both mint their own ids. Razorpay has no record of them, so asking
 * it to refund one returns 404.
 */
export const isMockPaymentId = (paymentId = '') =>
  /^pay_(mock|demo)_/.test(paymentId) || /^order_mock_/.test(paymentId);

/**
 * Razorpay SDK errors are plain objects carrying `statusCode` and
 * `error.description` — they have no `.message`. Rethrowing them as-is made
 * every gateway failure surface as a blank 500 with no explanation.
 */
export const normalizeGatewayError = (err, action = 'Payment gateway request') => {
  if (err instanceof Error && err.message) return err;

  const description = err?.error?.description || err?.description;
  const status = err?.statusCode || err?.error?.code;
  const error = new Error(
    description
      ? `${action} failed: ${description}`
      : `${action} failed with status ${status ?? 'unknown'}`
  );
  error.statusCode = status;
  error.gateway = true;
  return error;
};

export const refundPayment = async (paymentId, amountPaise) => {
  // A payment the gateway never saw is refunded locally. Without this, any
  // booking created by the seed or the mock checkout throws a 404 on cancel.
  if (!isRazorpayConfigured() || isMockPaymentId(paymentId)) {
    return { id: `rfnd_mock_${paymentId}`, amount: amountPaise, mock: true };
  }

  try {
    return await getRazorpay().payments.refund(paymentId, { amount: amountPaise });
  } catch (err) {
    throw normalizeGatewayError(err, 'Refund');
  }
};

/**
 * Mark a booking paid. THE single place any payment path may confirm a booking —
 * browser callback, webhook, and mock gateway all funnel through here.
 *
 * Idempotent by design:
 *   - already confirmed with this payment id  -> no-op, reports success
 *   - already confirmed with a different id   -> refuses, so two payments can't both win
 *   - unique index on razorpayPaymentId       -> a racing duplicate loses at the database
 *
 * Also performs the last-second availability re-check the README calls for. The hold
 * reserves inventory, but if it expired while the tourist was on the payment page,
 * somebody else may legitimately have taken the slot. In that case the money is
 * refunded rather than confirming a booking the operator cannot honour.
 */
export const confirmBookingPaid = async (booking, paymentId, { source = 'unknown' } = {}) => {
  // --- Idempotency ---
  if (booking.status === 'confirmed') {
    if (booking.razorpayPaymentId === paymentId) {
      return { ok: true, alreadyConfirmed: true, booking };
    }
    return { ok: false, reason: 'Booking is already paid for by a different payment', booking };
  }

  if (['cancelled', 'rejected'].includes(booking.status)) {
    return { ok: false, reason: `Booking was ${booking.status} before payment completed`, booking, shouldRefund: true };
  }

  // --- Last-second availability re-check ---
  const listing = await Listing.findById(booking.listing).lean();
  if (!listing) {
    return { ok: false, reason: 'Listing no longer exists', booking, shouldRefund: true };
  }

  const stillFree = await checkAvailability(listing, {
    checkIn: booking.checkIn,
    checkOut: booking.checkOut,
    date: booking.checkIn,
    units: booking.units,
    excludeBookingId: booking._id, // ignore our own hold, we're asking about everyone else
  });

  if (!stillFree.available) {
    return { ok: false, reason: stillFree.reason || 'Those dates were taken while payment was in progress', booking, shouldRefund: true };
  }

  // --- Freeze the commission split at the moment of payment ---
  const percent = await currentCommissionPercent();
  const split = computeSplit(booking.amountPaise, percent);

  booking.status = 'confirmed';
  booking.razorpayPaymentId = paymentId;
  booking.paidAt = new Date();
  booking.holdExpiresAt = undefined;
  booking.commissionPercent = split.commissionPercent;
  booking.commissionPaise = split.commissionPaise;
  booking.operatorPayoutPaise = split.operatorPayoutPaise;
  if (!booking.bookingRef) booking.bookingRef = generateBookingRef();

  try {
    await booking.save();
  } catch (err) {
    // Duplicate key on razorpayPaymentId means a concurrent path confirmed first.
    // Re-read and report success — the booking IS paid, just not by this call.
    if (err.code === 11000) {
      const fresh = await Booking.findById(booking._id);
      return { ok: true, alreadyConfirmed: true, booking: fresh };
    }
    throw err;
  }

  console.log(`Booking ${booking.bookingRef} confirmed via ${source} (payment ${paymentId})`);
  return { ok: true, booking };
};

/**
 * Payment failed or was abandoned. The hold is released so the inventory goes back on
 * sale immediately rather than waiting for the 10-minute expiry to lapse.
 */
export const failBooking = async (booking, reason = 'Payment failed') => {
  if (booking.status !== 'pending_payment') return booking;

  booking.status = 'expired';
  booking.holdExpiresAt = new Date();
  await booking.save();

  console.log(`Booking ${booking._id} released: ${reason}`);
  return booking;
};
