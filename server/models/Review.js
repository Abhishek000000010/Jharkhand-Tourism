import mongoose from 'mongoose';

const reviewSchema = new mongoose.Schema({
  booking: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Booking',
    required: true,
    unique: true, // One review per booking
  },
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
  operator: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5,
  },
  comment: {
    type: String,
    required: true,
    trim: true,
  },
  operatorReply: {
    type: String,
    trim: true,
  },
}, { timestamps: true });

// For querying all reviews on a listing
reviewSchema.index({ listing: 1, createdAt: -1 });
// For operator checking their reviews
reviewSchema.index({ operator: 1, createdAt: -1 });

export default mongoose.model('Review', reviewSchema);
