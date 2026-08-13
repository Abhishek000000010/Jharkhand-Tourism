import express from 'express';
import {
  createReview,
  replyToReview,
  getListingReviews,
  getOperatorReviews,
  getBookingReview
} from '../controllers/reviewController.js';
import { protect, authorize } from '../middleware/authMiddleware.js';

const router = express.Router();

// Public
router.get('/listing/:listingId', getListingReviews);

// Tourist
router.post('/', protect, authorize('tourist'), createReview);
router.get('/booking/:bookingId', protect, authorize('tourist'), getBookingReview);

// Operator
router.get('/operator', protect, authorize('operator'), getOperatorReviews);
router.post('/:id/reply', protect, authorize('operator'), replyToReview);

export default router;
