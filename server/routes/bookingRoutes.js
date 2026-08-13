import express from 'express';
import {
  checkListingAvailability,
  getListingCalendar,
  createHold,
  getMyBookings,
  releaseHold,
  downloadVoucher,
  verifyVoucher,
} from '../controllers/bookingController.js';
import { getCancellationQuote, cancelBooking } from '../controllers/cancellationController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public — anyone browsing can see what's free before signing up
router.post('/check', checkListingAvailability);
router.get('/calendar/:listingId', getListingCalendar);

// Public, but authenticated by the HMAC in the voucher QR code
router.get('/verify/:id', verifyVoucher);

// Tourist only
router.post('/hold', protect, authorize('tourist'), createHold);
router.get('/mine', protect, authorize('tourist'), getMyBookings);

// Voucher is readable by the booking's tourist OR the operator scanning them in
router.get('/:id/voucher', protect, downloadVoucher);

// Cancellation — quote first so the traveller sees the refund before confirming
router.get('/:id/cancellation-quote', protect, authorize('tourist'), getCancellationQuote);
router.post('/:id/cancel', protect, authorize('tourist'), cancelBooking);

router.delete('/:id', protect, authorize('tourist'), releaseHold);

export default router;
