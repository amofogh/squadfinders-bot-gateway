import mongoose from 'mongoose';

const ReactionSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    index: true
  },
  username: {
    type: String,
    default: null
  },
  chat_id: {
    type: String,
    required: true,
    index: true
  },
  message_id: {
    type: Number,
    required: true,
    index: true
  },
  emoji: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['add', 'remove'],
    default: 'add'
  },
  message_date: {
    type: Date,
    default: () => new Date(),
    index: true
  },
  meta: {
    type: Object,
    default: {}
  }
}, {
  timestamps: true
});

// Compound indexes
ReactionSchema.index({ user_id: 1, message_id: 1, emoji: 1, message_date: -1 });
ReactionSchema.index({ user_id: 1, message_date: -1 });
ReactionSchema.index({ message_id: 1 });
ReactionSchema.index({ chat_id: 1 });
ReactionSchema.index({ emoji: 1 });

export const Reaction = mongoose.model('Reaction', ReactionSchema);