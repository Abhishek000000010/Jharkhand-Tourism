import Booking from '../models/Booking.js';
import OperatorProfile from '../models/OperatorProfile.js';
import { refundQuoteFor, issueRefund } from '../services/refundService.js';
import { todayUtc, toUtcMidnight } from '../services/availabilityService.js';
import {
  notifyBookingCancelled,
  notifyBookingRejected,
  notifyRefundIssued,
} from '../services/emailService.js';
import {
  pushBookingCancelled,
  pushBookingRejected,
  pushBookingSettled,
  pushRefundIssued,
} from '../services/notificationService.js';

const load = async (id) => {
  const booking = await Booking.findById(id);
  return booking;
};

/** The stay is over once the checkout day has arrived. Craft orders never "end". */
const stayHasEnded = (booking) => {
  if (booking.category === 'artisan' || !booking.checkOut) return false;
  return toUtcMidnight(booking.checkOut) <= todayUtc();
};

const stayHasStarted = (booking) => {
  if (booking.category === 'artisan' || !booking.checkIn) return true;
  return toUtcMidnight(booking.checkIn) <= todayUtc();
};

// @desc    What a tourist would get back if they cancelled right now
// @route   GET /api/bookings/:id/cancellation-quote
// @access  Private/Tourist
export const getCancellationQuote = async (req, res) => {
  try {
    const booking = await load(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.tourist.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    const quote = refundQuoteFor(booking);

    res.status(200).json({
      success: true,
      ...quote,
      amountPaise: booking.amountPaise,
      cancellable: booking.status === 'confirmed' && !stayHasEnded(booking),
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ success: false, message: 'Booking not found' });
    // A gateway failure is not our fault and is not a mystery — say which, and
    // never return a 500 with an empty body.
    if (error.gateway) {
      return res.status(502).json({
        success: false,
        message: `${error.message}. The booking was not cancelled — please try again or contact support.`,
      });
    }
    res.status(500).json({ success: false, message: error.message || 'Something went wrong' });
  }
};

// @desc    Tourist cancels a paid booking; refund follows the published policy
// @route   POST /api/bookings/:id/cancel
// @access  Private/Tourist
export const cancelBooking = async (req, res) => {
  try {
    const booking = await load(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.tourist.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to cancel this booking' });
    }

    if (booking.status === 'pending_payment') {
      return res.status(400).json({ success: false, message: 'This booking is not paid for — release the hold instead' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: `Cannot cancel a booking that is ${booking.status.replace('_', ' ')}` });
    }

    // Once the stay is over the operator settles it as completed or no-show;
    // cancelling after the fact would misreport what actually happened.
    if (stayHasEnded(booking)) {
      return res.status(400).json({ success: false, message: 'This booking has already taken place' });
    }

    const quote = refundQuoteFor(booking);
    const result = await issueRefund(booking, quote.refundPaise, { reason: req.body.reason || 'Cancelled by traveller' });

    booking.status = 'cancelled';
    booking.cancelledAt = new Date();
    booking.cancelledBy = 'tourist';
    booking.cancellationReason = req.body.reason || 'Cancelled by traveller';
    await booking.save();

    // Queued, never sent inline — a mail outage must not fail a completed refund
    await notifyBookingCancelled(booking, {
      refundedPaise: result.refunded,
      refundPercent: quote.refundPercent,
    });
    await pushBookingCancelled(booking, { refundedPaise: result.refunded });

    res.status(200).json({
      success: true,
      booking,
      refundedPaise: result.refunded,
      refundPercent: quote.refundPercent,
      note: result.skipped || undefined,
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ success: false, message: 'Booking not found' });
    // A gateway failure is not our fault and is not a mystery — say which, and
    // never return a 500 with an empty body.
    if (error.gateway) {
      return res.status(502).json({
        success: false,
        message: `${error.message}. The booking was not cancelled — please try again or contact support.`,
      });
    }
    res.status(500).json({ success: false, message: error.message || 'Something went wrong' });
  }
};

/**
 * Operator refuses a booking the traveller already paid for.
 *
 * Always a FULL refund regardless of how close the date is — the traveller did nothing
 * wrong — and always a strike, because an operator cancelling confirmed business is the
 * behaviour the department most needs visibility of.
 */
// @route   POST /api/operator/bookings/:id/reject
// @access  Private/Operator
export const rejectBooking = async (req, res) => {
  try {
    const booking = await load(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.operator.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: `Cannot reject a booking that is ${booking.status.replace('_', ' ')}` });
    }

    if (stayHasEnded(booking)) {
      return res.status(400).json({ success: false, message: 'This booking has already taken place' });
    }

    const reason = (req.body.reason || '').trim();
    if (!reason) {
      return res.status(400).json({ success: false, message: 'Please give the traveller a reason' });
    }

    const remaining = booking.amountPaise - (booking.refundedPaise || 0);
    const result = await issueRefund(booking, remaining, { reason });

    booking.status = 'rejected';
    booking.cancelledAt = new Date();
    booking.cancelledBy = 'operator';
    booking.cancellationReason = reason;
    await booking.save();

    // Record the strike against the operator's profile
    const profile = await OperatorProfile.findOne({ user: req.user.id });
    if (profile) {
      profile.strikes = (profile.strikes || 0) + 1;
      profile.strikeHistory.push({
        reason,
        bookingRef: booking.bookingRef || String(booking._id),
        at: new Date(),
      });
      await profile.save();
    }

    await notifyBookingRejected(booking, { reason, refundedPaise: result.refunded });
    await pushBookingRejected(booking, { reason, refundedPaise: result.refunded });

    res.status(200).json({
      success: true,
      booking,
      refundedPaise: result.refunded,
      strikes: profile?.strikes,
    });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ success: false, message: 'Booking not found' });
    // A gateway failure is not our fault and is not a mystery — say which, and
    // never return a 500 with an empty body.
    if (error.gateway) {
      return res.status(502).json({
        success: false,
        message: `${error.message}. The booking was not cancelled — please try again or contact support.`,
      });
    }
    res.status(500).json({ success: false, message: error.message || 'Something went wrong' });
  }
};

/**
 * Traveller never turned up. No refund, but the booking still counts as revenue —
 * the operator held the room and could not resell it.
 */
// @route   POST /api/operator/bookings/:id/no-show
// @access  Private/Operator
export const markNoShow = async (req, res) => {
  try {
    const booking = await load(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.operator.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: `Cannot mark a booking that is ${booking.status.replace('_', ' ')}` });
    }

    // Nobody can fail to turn up for a stay that has not begun
    if (!stayHasStarted(booking)) {
      return res.status(400).json({ success: false, message: 'This booking has not started yet' });
    }

    booking.status = 'no_show';
    await booking.save();

    // Being marked a no-show has real consequences for the traveller, so they are
    // told rather than finding out from a silent status change.
    await pushBookingSettled(booking, 'no_show');

    res.status(200).json({ success: true, booking, note: 'No refund issued; the booking still counts as revenue.' });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ success: false, message: 'Booking not found' });
    // A gateway failure is not our fault and is not a mystery — say which, and
    // never return a 500 with an empty body.
    if (error.gateway) {
      return res.status(502).json({
        success: false,
        message: `${error.message}. The booking was not cancelled — please try again or contact support.`,
      });
    }
    res.status(500).json({ success: false, message: error.message || 'Something went wrong' });
  }
};

// @desc    Operator settles a finished booking
// @route   POST /api/operator/bookings/:id/complete
// @access  Private/Operator
export const markCompleted = async (req, res) => {
  try {
    const booking = await load(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    if (booking.operator.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.status !== 'confirmed') {
      return res.status(400).json({ success: false, message: `Cannot complete a booking that is ${booking.status.replace('_', ' ')}` });
    }

    // Craft orders complete on handover; dated bookings only once the stay is over.
    if (booking.category !== 'artisan' && !stayHasEnded(booking)) {
      return res.status(400).json({ success: false, message: 'This booking has not finished yet' });
    }

    booking.status = 'completed';
    await booking.save();

    // Completion is what unlocks reviewing, so this doubles as the prompt.
    await pushBookingSettled(booking, 'completed');

    res.status(200).json({ success: true, booking });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ success: false, message: 'Booking not found' });
    // A gateway failure is not our fault and is not a mystery — say which, and
    // never return a 500 with an empty body.
    if (error.gateway) {
      return res.status(502).json({
        success: false,
        message: `${error.message}. The booking was not cancelled — please try again or contact support.`,
      });
    }
    res.status(500).json({ success: false, message: error.message || 'Something went wrong' });
  }
};

/**
 * Admin override for dispute resolution — refund any amount up to what remains.
 * Deliberately separate from the policy engine: this is a human decision, logged.
 */
// @route   POST /api/admin/bookings/:id/refund
// @access  Private/Admin
export const adminRefund = async (req, res) => {
  try {
    const booking = await load(req.params.id);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });

    if (!booking.razorpayPaymentId) {
      return res.status(400).json({ success: false, message: 'This booking was never paid for' });
    }

    const reason = (req.body.reason || '').trim();
    if (!reason) return res.status(400).json({ success: false, message: 'A reason is required for a manual refund' });

    // Default to refunding everything still outstanding
    const remaining = booking.amountPaise - (booking.refundedPaise || 0);
    const requested = req.body.amountPaise !== undefined ? Number(req.body.amountPaise) : remaining;

    if (!Number.isFinite(requested) || requested <= 0) {
      return res.status(400).json({ success: false, message: 'Refund amount must be a positive number of paise' });
    }

    if (requested > remaining) {
      return res.status(400).json({
        success: false,
        message: `Cannot refund more than the ${remaining} paise still outstanding on this booking`,
      });
    }

    const result = await issueRefund(booking, requested, { reason });

    // A fully refunded booking is no longer a live booking
    if (booking.refundedPaise >= booking.amountPaise && booking.status === 'confirmed') {
      booking.status = 'cancelled';
      booking.cancelledAt = new Date();
      booking.cancelledBy = 'admin';
    }

    await booking.save();

    if (result.refunded > 0) {
      await notifyRefundIssued(booking, { refundedPaise: result.refunded, reason });
      await pushRefundIssued(booking, { refundedPaise: result.refunded, reason });
    }

    res.status(200).json({ success: true, booking, refundedPaise: result.refunded, note: result.skipped || undefined });
  } catch (error) {
    if (error.name === 'CastError') return res.status(404).json({ success: false, message: 'Booking not found' });
    // A gateway failure is not our fault and is not a mystery — say which, and
    // never return a 500 with an empty body.
    if (error.gateway) {
      return res.status(502).json({
        success: false,
        message: `${error.message}. The booking was not cancelled — please try again or contact support.`,
      });
    }
    res.status(500).json({ success: false, message: error.message || 'Something went wrong' });
  }
};
