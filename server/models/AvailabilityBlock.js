import mongoose from 'mongoose';

/**
 * An operator closing their own inventory — personal use, maintenance, a festival
 * they're attending. Kept in its own collection rather than as a fake Booking so
 * that Booking stays clean for the payment work in Phase 5, but the availability
 * engine treats a block exactly like a full-capacity booking.
 *
 * A block closes the WHOLE listing for its range (all rooms of a homestay), which
 * is what "I'm shut that week" means in practice.
 */
const availabilityBlockSchema = new mongoose.Schema(
  {
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

    // Same half-open [start, end) convention as Booking.
    startDate: {
      type: Date,
      required: true,
    },
    endDate: {
      type: Date,
      required: true,
    },

    reason: {
      type: String,
      trim: true,
      default: '',
    },
  },
  { timestamps: true }
);

availabilityBlockSchema.index({ listing: 1, startDate: 1, endDate: 1 });

export default mongoose.model('AvailabilityBlock', availabilityBlockSchema);
