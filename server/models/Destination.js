import mongoose from 'mongoose';

/**
 * A place to visit in Jharkhand.
 *
 * Deliberately NOT a Listing. A Listing is inventory an operator sells and a
 * tourist books; a Destination is a public place that exists whether or not
 * anyone has anything to sell there. Conflating the two is what produced
 * waterfalls priced "per night" with a random room count.
 */
const destinationSchema = new mongoose.Schema({
  slug: {
    type: String,
    required: true,
    unique: true,
    index: true,
  },
  name: {
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
  type: {
    type: String,
    enum: [
      'waterfall', 'temple', 'dam', 'park', 'wildlife', 'hill',
      'lake', 'fort', 'museum', 'heritage', 'city', 'other',
    ],
    required: true,
    index: true,
  },
  images: [{ type: String }],
  coordinates: {
    lat: { type: Number },
    lng: { type: Number },
  },
  bestSeason: {
    type: String,
    default: 'October to March',
  },
  howToReach: {
    type: String,
    default: '',
  },
  sourceUrl: {
    type: String,
    default: '',
  },
  isActive: {
    type: Boolean,
    default: true,
  },
}, { timestamps: true });

// The explore feed filters on district/type and always on isActive.
destinationSchema.index({ district: 1, type: 1, isActive: 1 });
// Free-text search across name + description for the search box.
destinationSchema.index({ name: 'text', description: 'text' });

export default mongoose.model('Destination', destinationSchema);
