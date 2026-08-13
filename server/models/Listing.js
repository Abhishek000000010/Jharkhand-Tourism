import mongoose from 'mongoose';

const listingSchema = new mongoose.Schema({
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
  title: {
    type: String,
    required: true,
    trim: true,
  },
  description: {
    type: String,
    required: true,
    trim: true,
  },
  district: {
    type: String,
    required: true,
    index: true,
  },
  price: {
    type: Number,
    required: true, // Base price (per night, per day, or per item)
    min: [0, 'Price cannot be negative'],
  },
  images: [{
    type: String, // Cloudinary URLs
  }],
  isActive: {
    type: Boolean,
    default: true,
  },
  
  // -- Homestay Specific --
  rooms: {
    type: Number,
    required: function() { return this.category === 'homestay'; },
    min: [1, 'A homestay must have at least 1 room'],
  },
  amenities: [{
    type: String
  }],

  // -- Guide Specific --
  languages: [{
    type: String
  }],
  specialities: [{
    type: String
  }],
  serviceArea: {
    type: String
  },

  // -- Artisan Specific --
  craftType: {
    type: String
  },
  stockQuantity: {
    type: Number,
    default: 0,
    min: [0, 'Stock quantity cannot be negative'],
  },

  // -- Phase 9: Reviews --
  ratingSum: {
    type: Number,
    default: 0
  },
  ratingCount: {
    type: Number,
    default: 0
  }

}, { timestamps: true });

// The public feed always filters on operator + isActive, and usually category/district too.
listingSchema.index({ operator: 1, isActive: 1 });
listingSchema.index({ category: 1, district: 1, isActive: 1 });

export default mongoose.model('Listing', listingSchema);
