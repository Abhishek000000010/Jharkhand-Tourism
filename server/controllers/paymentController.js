import Booking from '../models/Booking.js';
import ProcessedWebhook from '../models/ProcessedWebhook.js';
import PlatformSettings from '../models/PlatformSettings.js';
import { isRazorpayConfigured } from '../config/razorpay.js';
import {
  createOrderForBooking,
  verifyCheckoutSignature,
  verifyWebhookSignature,
  confirmBookingPaid,
  failBooking,
  refundPayment,
} from '../services/paymentService.js';
import { resplitAfterRefund } from '../services/refundService.js';
import { notifyBookingConfirmed } from '../services/emailService.js';
import { pushBookingConfirmed } from '../services/notificationService.js';

/** A hold is only payable while it is still a live, unexpired hold. */
const holdIsLive = (booking) =>
  booking.status === 'pending_payment' && booking.holdExpiresAt && booking.holdExpiresAt > new Date();

/**
 * Confirm a payment and queue the resulting emails.
 *
 * All three payment paths — checkout callback, webhook and the local mock gateway —
 * go through here, so notification cannot be forgotten on one of them. Queueing is
 * awaited but can never throw, so a mail problem cannot fail a paid booking.
 */
const confirmAndNotify = async (booking, paymentId, source) => {
  const result = await confirmBookingPaid(booking, paymentId, { source });

  if (result.ok && !result.alreadyConfirmed) {
    await notifyBookingConfirmed(result.booking);
    await pushBookingConfirmed(result.booking);
  }

  return result;
};

// @desc    Create a Razorpay order for a held booking
// @route   POST /api/payments/order
// @access  Private/Tourist
export const createOrder = async (req, res) => {
  try {
    const booking = await Booking.findById(req.body.bookingId);

    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.tourist.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to pay for this booking' });
    }

    if (booking.status === 'confirmed') {
      return res.status(400).json({ success: false, message: 'This booking is already paid for' });
    }

    if (!holdIsLive(booking)) {
      return res.status(409).json({
        success: false,
        message: 'This hold has expired. Please check availability and reserve again.',
      });
    }

    const order = await createOrderForBooking(booking);

    res.status(200).json({
      success: true,
      orderId: order.orderId,
      amountPaise: order.amountPaise,
      currency: 'INR',
      keyId: process.env.RAZORPAY_KEY_ID || null,
      // The client renders a "simulate payment" button instead of the Razorpay sheet
      mock: !isRazorpayConfigured(),
      bookingRef: booking.bookingRef,
      holdExpiresAt: booking.holdExpiresAt,
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ success: false, message: 'Booking not found' });
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Browser callback after Razorpay Checkout succeeds.
 *
 * This is a CONVENIENCE path, not the source of truth: it makes the UI feel instant.
 * The webhook is authoritative, and because both funnel into the same idempotent
 * confirm, it does not matter which arrives first.
 */
// @route   POST /api/payments/verify
// @access  Private/Tourist
export const verifyPayment = async (req, res) => {
  try {
    const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body;

    if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) {
      return res.status(400).json({ success: false, message: 'Incomplete payment details' });
    }

    if (!isRazorpayConfigured() || !verifyCheckoutSignature(req.body)) {
      return res.status(400).json({ success: false, message: 'Payment signature verification failed' });
    }

    const booking = await Booking.findOne({ razorpayOrderId: razorpay_order_id });
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found for this order' });

    if (booking.tourist.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const result = await confirmAndNotify(booking, razorpay_payment_id, 'checkout-callback');

    if (!result.ok) {
      if (result.shouldRefund) {
        // Slot was lost while paying — return the money rather than sell a booking
        // the operator cannot honour.
        await safeRefund(booking, razorpay_payment_id);
      }
      return res.status(409).json({ success: false, message: result.reason, refunded: Boolean(result.shouldRefund) });
    }

    res.status(200).json({ success: true, booking: result.booking });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

/**
 * Local stand-in for Razorpay Checkout, used only when no API keys are present.
 * Hard-refuses to run whenever real credentials exist, so it can never become a way
 * to mark bookings paid for free on a configured deployment.
 */
// @route   POST /api/payments/mock-confirm
// @access  Private/Tourist
export const mockConfirm = async (req, res) => {
  try {
    if (isRazorpayConfigured()) {
      return res.status(403).json({ success: false, message: 'Mock payments are disabled when Razorpay is configured' });
    }

    const booking = await Booking.findById(req.body.bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.tourist.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.status !== 'confirmed' && !holdIsLive(booking)) {
      return res.status(409).json({ success: false, message: 'This hold has expired. Please reserve again.' });
    }

    const paymentId = booking.razorpayPaymentId || `pay_mock_${booking._id}`;
    const result = await confirmAndNotify(booking, paymentId, 'mock-gateway');

    if (!result.ok) return res.status(409).json({ success: false, message: result.reason });

    res.status(200).json({ success: true, booking: result.booking });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ success: false, message: 'Booking not found' });
    res.status(500).json({ success: false, message: error.message });
  }
};

const safeRefund = async (booking, paymentId) => {
  try {
    const refund = await refundPayment(paymentId, booking.amountPaise);
    booking.refundedPaise = booking.amountPaise;
    booking.razorpayRefundId = refund.id;
    await booking.save();
  } catch (err) {
    // A failed refund must be visible, not swallowed — it is money owed to a real person
    console.error(`REFUND FAILED for booking ${booking._id}, payment ${paymentId}:`, err.message);
  }
};

/**
 * Razorpay webhook — the authoritative record of what happened to the money.
 *
 * `req.body` is a raw Buffer here (see the express.raw mount in index.js). It has to
 * be, because the signature is computed over the exact bytes Razorpay sent; verifying
 * against a re-serialised JSON object would fail on any key-order or whitespace change.
 */
// @route   POST /api/payments/webhook
// @access  Public (authenticated by signature)
export const handleWebhook = async (req, res) => {
  const signature = req.headers['x-razorpay-signature'];
  const rawBody = req.body;

  if (!Buffer.isBuffer(rawBody)) {
    console.error('Webhook body was parsed before reaching the handler — signature cannot be verified');
    return res.status(500).json({ success: false });
  }

  if (!verifyWebhookSignature(rawBody, signature)) {
    return res.status(400).json({ success: false, message: 'Invalid webhook signature' });
  }

  let payload;
  try {
    payload = JSON.parse(rawBody.toString('utf8'));
  } catch {
    return res.status(400).json({ success: false, message: 'Malformed webhook payload' });
  }

  // Razorpay sends an id per delivery; fall back to a composite key if it is absent.
  const eventId = req.headers['x-razorpay-event-id'] ||
    `${payload.event}:${payload.payload?.payment?.entity?.id || payload.created_at}`;

  // Claim the event atomically. A duplicate delivery loses the unique-index race and
  // is acknowledged without being processed twice.
  try {
    await ProcessedWebhook.create({ eventId, event: payload.event });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(200).json({ success: true, duplicate: true });
    }
    throw err;
  }

  try {
    await processWebhookEvent(payload);
  } catch (err) {
    // Release the claim so Razorpay's retry can be processed rather than dropped
    await ProcessedWebhook.deleteOne({ eventId }).catch(() => {});
    console.error(`Webhook ${payload.event} failed:`, err.message);
    return res.status(500).json({ success: false });
  }

  // Always 200 once handled, otherwise Razorpay keeps retrying a settled event
  res.status(200).json({ success: true });
};

const processWebhookEvent = async (payload) => {
  // Refunds carry their own entity and may be initiated from the Razorpay dashboard
  // rather than by us, so the booking has to be reconciled either way.
  if (payload.event === 'refund.processed' || payload.event === 'refund.created') {
    const refund = payload.payload?.refund?.entity;
    if (!refund) return;

    const booking = await Booking.findOne({ razorpayPaymentId: refund.payment_id });
    if (!booking) {
      console.warn(`Webhook ${payload.event}: no booking for payment ${refund.payment_id}`);
      return;
    }

    // Trust Razorpay's total rather than adding to ours — that stays correct even if a
    // refund was issued outside this application, and cannot double-count our own.
    const refunded = Math.min(Number(refund.amount) || 0, booking.amountPaise);
    if (refunded > (booking.refundedPaise || 0)) {
      booking.refundedPaise = refunded;
      booking.razorpayRefundId = refund.id;
      await resplitAfterRefund(booking);
      await booking.save();
    }
    return;
  }

  const entity = payload.payload?.payment?.entity;
  if (!entity) return;

  const booking = await Booking.findOne({
    $or: [
      { razorpayOrderId: entity.order_id },
      ...(entity.notes?.bookingId ? [{ _id: entity.notes.bookingId }] : []),
    ],
  });

  if (!booking) {
    console.warn(`Webhook ${payload.event}: no booking for order ${entity.order_id}`);
    return;
  }

  if (payload.event === 'payment.captured') {
    const result = await confirmAndNotify(booking, entity.id, 'webhook');
    if (!result.ok && result.shouldRefund) await safeRefund(booking, entity.id);
    return;
  }

  if (payload.event === 'payment.failed') {
    await failBooking(booking, 'Razorpay reported payment.failed');
  }
};

// @desc    Platform settings (commission)
// @route   GET /api/admin/settings
// @access  Private/Admin
export const getSettings = async (req, res) => {
  try {
    const settings = await PlatformSettings.current();
    res.status(200).json({ success: true, settings });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Update the platform commission rate
// @route   PUT /api/admin/settings
// @access  Private/Admin
export const updateSettings = async (req, res) => {
  try {
    const settings = await PlatformSettings.current();

    if (req.body.commissionPercent !== undefined) {
      const pct = Number(req.body.commissionPercent);
      if (!Number.isFinite(pct) || pct < 0 || pct > 50) {
        return res.status(400).json({ success: false, message: 'Commission must be between 0 and 50 percent' });
      }
      settings.commissionPercent = pct;
    }

    await settings.save();

    res.status(200).json({
      success: true,
      settings,
      note: 'Existing bookings keep the rate they were created under.',
    });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
