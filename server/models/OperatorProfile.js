import mongoose from 'mongoose';

const operatorProfileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true // One user can only have one operator profile
    },
    businessName: {
      type: String,
      required: [true, 'Please provide a business name'],
      trim: true,
    },
    contactPhone: {
      type: String,
      required: [true, 'Please provide a contact phone number'],
      trim: true,
      unique: true, // One phone number = one operator, per the duplicate-registration rule
      match: [/^[6-9]\d{9}$/, 'Please provide a valid 10-digit Indian mobile number'],
    },
    district: {
      type: String,
      required: [true, 'Please specify the district'],
    },
    kycDocumentId: {
      type: String,
      required: [true, 'KYC Document is required'],
    },
    status: {
      type: String,
      enum: ['pending', 'approved', 'rejected'],
      default: 'pending'
    },
    rejectionReason: {
      type: String,
      default: ''
    },

    /**
     * Strikes recorded when an operator refuses a booking a traveller had already paid
     * for. Kept as a running count plus an audit trail, because "why does this operator
     * have 3 strikes" is a question the department will need answered.
     */
    strikes: {
      type: Number,
      default: 0,
      min: 0
    },
    strikeHistory: [{
      reason: { type: String },
      bookingRef: { type: String },
      at: { type: Date, default: Date.now }
    }]
  },
  {
    timestamps: true,
  }
);

// Admin queue is always filtered by status
operatorProfileSchema.index({ status: 1 });

// Note: the previous compound index on { businessName, contactPhone } did not actually
// stop duplicate registrations — the same phone could be reused with a different
// business name. Uniqueness now lives on contactPhone alone (declared above).

const OperatorProfile = mongoose.model('OperatorProfile', operatorProfileSchema);
export default OperatorProfile;
