import mongoose from 'mongoose';

/**
 * One thread between a traveller and an operator about one listing.
 *
 * Keyed on (listing, tourist) rather than on a booking, because the most valuable
 * message is the one sent BEFORE booking — "is there parking?", "can I check in at
 * 11pm?". A thread that later results in a booking keeps its history, so the
 * operator can see what was promised.
 *
 * `operator` is denormalised off the listing so the operator's inbox is a single
 * indexed query, and so the thread survives a listing being reassigned or renamed.
 */
const conversationSchema = new mongoose.Schema(
  {
    listing: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Listing',
      required: true,
    },
    tourist: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    operator: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },

    // Snapshot of the latest message so an inbox renders without touching the
    // messages collection at all.
    lastMessage: { type: String, default: '', trim: true },
    lastMessageAt: { type: Date },
    lastSenderRole: { type: String, enum: ['tourist', 'operator'] },

    // Per-side unread counters. Kept on the thread rather than derived from
    // message read flags so the sidebar badge is one cheap aggregate.
    unreadTourist: { type: Number, default: 0, min: 0 },
    unreadOperator: { type: Number, default: 0, min: 0 },
  },
  { timestamps: true }
);

// One thread per traveller per listing — the upsert in startConversation relies on
// this to stay race-free when a tourist double-clicks "Message host".
conversationSchema.index({ listing: 1, tourist: 1 }, { unique: true });

// Both inboxes list newest-first for one participant.
conversationSchema.index({ operator: 1, lastMessageAt: -1 });
conversationSchema.index({ tourist: 1, lastMessageAt: -1 });

export default mongoose.model('Conversation', conversationSchema);
