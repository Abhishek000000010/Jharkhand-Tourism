import mongoose from 'mongoose';

export const MAX_MESSAGE_LENGTH = 2000;

/**
 * A single message in a conversation.
 *
 * `senderRole` is stored rather than inferred from the user's current role: an
 * account's role could change, and a thread must still render correctly years
 * later showing who said what at the time.
 */
const messageSchema = new mongoose.Schema(
  {
    conversation: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Conversation',
      required: true,
    },
    sender: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    senderRole: {
      type: String,
      enum: ['tourist', 'operator'],
      required: true,
    },
    body: {
      type: String,
      required: [true, 'A message cannot be empty'],
      trim: true,
      maxlength: [MAX_MESSAGE_LENGTH, `A message cannot be longer than ${MAX_MESSAGE_LENGTH} characters`],
    },
    readAt: { type: Date },
  },
  { timestamps: true }
);

// A thread is always read oldest-first within one conversation.
messageSchema.index({ conversation: 1, createdAt: 1 });

export default mongoose.model('Message', messageSchema);
