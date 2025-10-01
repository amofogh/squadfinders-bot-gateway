import mongoose from 'mongoose';

const StatusHistorySchema = new mongoose.Schema({
  event: {
    type: String,
    enum: ['cancel', 'resume'],
    required: true
  },
  at: {
    type: Date,
    required: true
  },
  by: {
    type: String,
    enum: ['system', 'user', 'admin'],
    default: 'system'
  },
  reason: {
    type: String,
    default: null
  }
}, { _id: false });

const DailyBucketSchema = new mongoose.Schema({
  date: {
    type: String,
    required: true
  },
  msgs: {
    type: Number,
    default: 0
  },
  reacts: {
    type: Number,
    default: 0
  },
  dms_sent: {
    type: Number,
    default: 0
  },
  dms_skipped_canceled: {
    type: Number,
    default: 0
  },
  became_player: {
    type: Number,
    default: 0
  }
}, { _id: false });

const UserAnalyticsSchema = new mongoose.Schema({
  user_id: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  username: {
    type: String,
    default: null
  },
  // Cancellation state
  is_canceled: {
    type: Boolean,
    default: false
  },
  last_canceled_at: {
    type: Date,
    default: null
  },
  last_resumed_at: {
    type: Date,
    default: null
  },
  status_history: [StatusHistorySchema],
  
  // DM stats
  dm: {
    total_attempts: {
      type: Number,
      default: 0
    },
    total_sent: {
      type: Number,
      default: 0
    },
    total_skipped_canceled: {
      type: Number,
      default: 0
    },
    last_sent_at: {
      type: Date,
      default: null
    }
  },
  
  // Message stats
  messages: {
    total: {
      type: Number,
      default: 0
    },
    first_at: {
      type: Date,
      default: null
    },
    last_at: {
      type: Date,
      default: null
    }
  },
  
  // Reaction stats
  reactions: {
    total: {
      type: Number,
      default: 0
    },
    by_emoji: {
      type: Map,
      of: Number,
      default: new Map()
    },
    last_at: {
      type: Date,
      default: null
    }
  },
  
  // Player stats
  player: {
    count: {
      type: Number,
      default: 0
    },
    last_at: {
      type: Date,
      default: null
    }
  },
  
  // Seen stats
  seen: {
    total: {
      type: Number,
      default: 0
    },
    last_at: {
      type: Date,
      default: null
    }
  },
  
  // Daily buckets (last 90 days)
  daily: [DailyBucketSchema]
}, {
  timestamps: true
});

// Helper indexes
UserAnalyticsSchema.index({ 'reactions.total': 1 });
UserAnalyticsSchema.index({ 'messages.total': 1 });
UserAnalyticsSchema.index({ 'player.count': 1 });
UserAnalyticsSchema.index({ is_canceled: 1 });

export const UserAnalytics = mongoose.model('UserAnalytics', UserAnalyticsSchema);