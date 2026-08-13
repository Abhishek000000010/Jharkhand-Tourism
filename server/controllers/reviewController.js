import Review from '../models/Review.js';
import Booking from '../models/Booking.js';
import Listing from '../models/Listing.js';
import { pushReviewReceived, pushReviewReplied } from '../services/notificationService.js';

// @desc    Create a review for a booking
// @route   POST /api/reviews
// @access  Private/Tourist
export const createReview = async (req, res) => {
  const { bookingId, rating, comment } = req.body;

  try {
    const booking = await Booking.findById(bookingId);
    if (!booking) return res.status(404).json({ success: false, message: 'Booking not found' });
    
    if (booking.tourist.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized' });
    }

    if (booking.status !== 'completed') {
      return res.status(400).json({ success: false, message: 'You can only review a completed booking' });
    }

    // rating is required and must be 1-5
    const parsedRating = parseInt(rating);
    if (isNaN(parsedRating) || parsedRating < 1 || parsedRating > 5) {
      return res.status(400).json({ success: false, message: 'Rating must be between 1 and 5' });
    }

    const newReview = await Review.create({
      booking: booking._id,
      tourist: req.user.id,
      listing: booking.listing,
      operator: booking.operator,
      rating: parsedRating,
      comment
    });

    // Update aggregate on Listing safely using $inc
    const listing = await Listing.findByIdAndUpdate(booking.listing, {
      $inc: { ratingSum: parsedRating, ratingCount: 1 }
    });

    await pushReviewReceived({
      operatorId: booking.operator,
      touristName: req.user.name,
      listingTitle: listing?.title,
      rating: parsedRating,
    });

    res.status(201).json({ success: true, review: newReview });
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'You have already reviewed this booking' });
    }
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Reply to a review
// @route   POST /api/reviews/:id/reply
// @access  Private/Operator
export const replyToReview = async (req, res) => {
  const { reply } = req.body;
  if (!reply) return res.status(400).json({ success: false, message: 'Reply text is required' });

  try {
    const review = await Review.findById(req.params.id);
    if (!review) return res.status(404).json({ success: false, message: 'Review not found' });

    if (review.operator.toString() !== req.user.id) {
      return res.status(403).json({ success: false, message: 'Not authorized to reply to this review' });
    }

    if (review.operatorReply) {
      return res.status(400).json({ success: false, message: 'You have already replied to this review' });
    }

    review.operatorReply = reply;
    await review.save();

    const listing = await Listing.findById(review.listing).select('title').lean();
    await pushReviewReplied({ touristId: review.tourist, listingTitle: listing?.title });

    res.status(200).json({ success: true, review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all reviews for a listing
// @route   GET /api/reviews/listing/:listingId
// @access  Public
export const getListingReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ listing: req.params.listingId })
      .populate('tourist', 'name')
      .sort('-createdAt')
      .lean();
    res.status(200).json({ success: true, count: reviews.length, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Get all reviews for the logged-in operator
// @route   GET /api/reviews/operator
// @access  Private/Operator
export const getOperatorReviews = async (req, res) => {
  try {
    const reviews = await Review.find({ operator: req.user.id })
      .populate('tourist', 'name')
      .populate('listing', 'title category')
      .sort('-createdAt')
      .lean();
    res.status(200).json({ success: true, count: reviews.length, reviews });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// @desc    Check if a booking has a review
// @route   GET /api/reviews/booking/:bookingId
// @access  Private/Tourist
export const getBookingReview = async (req, res) => {
  try {
    const review = await Review.findOne({ booking: req.params.bookingId }).lean();
    res.status(200).json({ success: true, review });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
