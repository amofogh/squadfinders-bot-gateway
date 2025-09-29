import mongoose from 'mongoose';

// Schema for storing the content of a deleted message
const DeletedMessageSchema = new mongoose.Schema({
  message_id: {
    type: Number,
    required: true,
  },
  message_date: {
    type: Date,
    required: true,
  },
  deleted_at: {
    type: Date,
    default: Date.now,
    required: true,
  },
  deletion_time_minutes: {
    type: Number,
    required: true
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
    enum: ['pending', 'processing', 'completed', 'failed', 'expired', 'pending_prefilter', 'canceled_by_user'],
    default: 'pending_prefilter'
  }
}, {
  timestamps: true
});

// Add index for faster queries on deletion date
DeletedMessageSchema.index({ deleted_at: 1 });

// Schema for simple deletion statistics
const DeletedMessageStatsSchema = new mongoose.Schema({
  totalDeleted: {
    type: Number,
    default: 0
  },
  deletedToday: {
    type: Number,
    default: 0
  },
  lastResetDate: {
    type: Date,
    default: () => new Date()
  },
  avgDeletionTimeSeconds: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Schema for daily deletion tracking (for charts)
const DailyDeletionSchema = new mongoose.Schema({
  date: {
    type: Date,
    required: true,
    unique: true
  },
  count: {
    type: Number,
    default: 0
  }
}, {
  timestamps: true
});

// Create and export all models from this file
export const DeletedMessage = mongoose.model('DeletedMessage', DeletedMessageSchema);
export const DeletedMessageStats = mongoose.model('DeletedMessageStats', DeletedMessageStatsSchema);
export const DailyDeletion = mongoose.model('DailyDeletion', DailyDeletionSchema);
