import mongoose from 'mongoose';

const ALLOWED_REACTIONS = ['👍', '❤️', '👎'];

const MessageReactionSchema = new mongoose.Schema({
  message_id: {
    type: Number,
    required: true
  },
  user_id: {
    type: String,
    required: true
  },
  username: {
    type: String,
    default: null
  },
  reaction: {
    type: String,
    enum: ALLOWED_REACTIONS,
    required: true
  },
  reacted_at: {
    type: Date,
    default: Date.now
  },
  source: {
    type: String,
    default: 'bot-crawler'
  },
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: null
  }
}, {
  timestamps: true
});

MessageReactionSchema.index({ message_id: 1, user_id: 1 }, { unique: true });
MessageReactionSchema.index({ user_id: 1, reacted_at: -1 });
MessageReactionSchema.index({ reaction: 1 });
MessageReactionSchema.index({ reacted_at: -1 });
MessageReactionSchema.index({ source: 1 });

export const MessageReaction = mongoose.model('MessageReaction', MessageReactionSchema);
export const MESSAGE_REACTIONS = ALLOWED_REACTIONS;
