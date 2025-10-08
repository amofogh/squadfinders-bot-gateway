import mongoose from 'mongoose';

const MessageSchema = new mongoose.Schema({
  message_id: {
    type: Number,
    required: true,
    unique: true,
  },
  message_date: {
    type: Date,
    required: true,
  },
  sender: {
    id: { type: String, default: null },
    username: { type: String, default: null },
    name: { type: String, default: null }
  },
  group: {
    group_id: { type: String, default: null },
    group_title: { type: String, default: null },
    group_username: { type: String, default: null }
  },
  message: { type: String, default: null },
  is_valid: { type: Boolean, default: false },
  is_lfg: { type: Boolean, default: false },
  reason: { type: String, default: null },
  ai_status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'expired', 'canceled_by_user'],
    default: 'pending'
  }
}, {
  timestamps: true
});

// Compound index for group and message
MessageSchema.index({ 'group.group_id': 1, message_id: 1 }, { unique: true });

// Additional indexes for better query performance
MessageSchema.index({ message_date: 1 });
MessageSchema.index({ is_valid: 1 });
MessageSchema.index({ is_lfg: 1 });
MessageSchema.index({ ai_status: 1 });
MessageSchema.index({ createdAt: 1 });
MessageSchema.index({ 'group.group_username': 1 });
MessageSchema.index({ 'sender.username': 1 });

// Compound index for AI processing queries
MessageSchema.index({ is_valid: 1, ai_status: 1, createdAt: 1 });

export const Message = mongoose.model('Message', MessageSchema);