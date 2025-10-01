import { UserAnalytics } from '../models/UserAnalytics.js';
import { dayKeyUTC } from '../utils/analytics.js';
import { createServiceLogger } from '../utils/logger.js';

const analyticsLogger = createServiceLogger('analytics');

/**
 * Record user cancellation
 * @param {string} user_id 
 * @param {object} meta 
 */
export const recordCancel = async (user_id, meta = {}) => {
  try {
    const now = new Date();
    const dayKey = dayKeyUTC(now);
    
    await UserAnalytics.updateOne(
      { user_id },
      {
        $set: {
          is_canceled: true,
          last_canceled_at: now,
          username: meta.username || null,
          user_id: user_id
        },
        $push: {
          status_history: {
            event: 'cancel',
            at: now,
            by: meta.by || 'system',
            reason: meta.reason || null
          }
        }
      },
      { upsert: true }
    );
    
    analyticsLogger.info('Recorded cancel', { user_id, dayKey });
  } catch (error) {
    analyticsLogger.error('Failed to record cancel', { user_id, error: error.message });
  }
};

/**
 * Record user resume
 * @param {string} user_id 
 * @param {object} meta 
 */
export const recordResume = async (user_id, meta = {}) => {
  try {
    const now = new Date();
    const dayKey = dayKeyUTC(now);
    
    await UserAnalytics.updateOne(
      { user_id },
      {
        $set: {
          is_canceled: false,
          last_resumed_at: now,
          username: meta.username || null,
          user_id: user_id
        },
        $push: {
          status_history: {
            event: 'resume',
            at: now,
            by: meta.by || 'system',
            reason: meta.reason || null
          }
        }
      },
      { upsert: true }
    );
    
    analyticsLogger.info('Recorded resume', { user_id, dayKey });
  } catch (error) {
    analyticsLogger.error('Failed to record resume', { user_id, error: error.message });
  }
};

/**
 * Record DM attempt
 * @param {string} user_id 
 */
export const recordDmAttempt = async (user_id) => {
  try {
    await UserAnalytics.updateOne(
      { user_id },
      {
        $inc: { 'dm.total_attempts': 1 },
        $set: { user_id: user_id }
      },
      { upsert: true }
    );
    
    analyticsLogger.info('Recorded DM attempt', { user_id });
  } catch (error) {
    analyticsLogger.error('Failed to record DM attempt', { user_id, error: error.message });
  }
};

/**
 * Record DM sent successfully
 * @param {string} user_id 
 * @param {Date} ts 
 */
export const recordDmSent = async (user_id, ts = new Date()) => {
  try {
    const dayKey = dayKeyUTC(ts);
    
    await UserAnalytics.updateOne(
      { user_id },
      {
        $inc: { 'dm.total_sent': 1 },
        $set: { 
          'dm.last_sent_at': ts,
          user_id: user_id
        }
      },
      { upsert: true }
    );
    
    // Update daily bucket
    await UserAnalytics.updateOne(
      { user_id, 'daily.date': dayKey },
      {
        $inc: { 'daily.$.dms_sent': 1 }
      }
    );
    
    // If daily bucket doesn't exist, create it
    await UserAnalytics.updateOne(
      { user_id, 'daily.date': { $ne: dayKey } },
      {
        $push: {
          daily: {
            $each: [{ date: dayKey, dms_sent: 1 }],
            $slice: -90
          }
        }
      }
    );
    
    analyticsLogger.info('Recorded DM sent', { user_id, dayKey });
  } catch (error) {
    analyticsLogger.error('Failed to record DM sent', { user_id, error: error.message });
  }
};

/**
 * Record DM skipped because user is canceled
 * @param {string} user_id 
 */
export const recordDmSkippedCanceled = async (user_id) => {
  try {
    const dayKey = dayKeyUTC();
    
    await UserAnalytics.updateOne(
      { user_id },
      {
        $inc: { 'dm.total_skipped_canceled': 1 },
        $set: { user_id: user_id }
      },
      { upsert: true }
    );
    
    // Update daily bucket
    await UserAnalytics.updateOne(
      { user_id, 'daily.date': dayKey },
      {
        $inc: { 'daily.$.dms_skipped_canceled': 1 }
      }
    );
    
    // If daily bucket doesn't exist, create it
    await UserAnalytics.updateOne(
      { user_id, 'daily.date': { $ne: dayKey } },
      {
        $push: {
          daily: {
            $each: [{ date: dayKey, dms_skipped_canceled: 1 }],
            $slice: -90
          }
        }
      }
    );
    
    analyticsLogger.info('Recorded DM skipped (canceled)', { user_id, dayKey });
  } catch (error) {
    analyticsLogger.error('Failed to record DM skipped', { user_id, error: error.message });
  }
};

/**
 * Record user message
 * @param {string} user_id 
 * @param {Date} ts 
 */
export const recordUserMessage = async (user_id, ts = new Date()) => {
  try {
    const dayKey = dayKeyUTC(ts);
    
    // Check if this is the first message
    const existing = await UserAnalytics.findOne({ user_id });
    const isFirstMessage = !existing || existing.messages.total === 0;
    
    const updateDoc = {
      $inc: { 'messages.total': 1 },
      $set: { 
        'messages.last_at': ts,
        user_id: user_id
      }
    };
    
    if (isFirstMessage) {
      updateDoc.$set['messages.first_at'] = ts;
    }
    
    await UserAnalytics.updateOne(
      { user_id },
      updateDoc,
      { upsert: true }
    );
    
    // Update daily bucket
    await UserAnalytics.updateOne(
      { user_id, 'daily.date': dayKey },
      {
        $inc: { 'daily.$.msgs': 1 }
      }
    );
    
    // If daily bucket doesn't exist, create it
    await UserAnalytics.updateOne(
      { user_id, 'daily.date': { $ne: dayKey } },
      {
        $push: {
          daily: {
            $each: [{ date: dayKey, msgs: 1 }],
            $slice: -90
          }
        }
      }
    );
    
    analyticsLogger.info('Recorded user message', { user_id, dayKey, isFirstMessage });
  } catch (error) {
    analyticsLogger.error('Failed to record user message', { user_id, error: error.message });
  }
};

/**
 * Record reaction
 * @param {string} user_id 
 * @param {string} emoji 
 * @param {Date} ts 
 */
export const recordReaction = async (user_id, emoji, ts = new Date()) => {
  try {
    const dayKey = dayKeyUTC(ts);
    
    await UserAnalytics.updateOne(
      { user_id },
      {
        $inc: { 
          'reactions.total': 1,
          [`reactions.by_emoji.${emoji}`]: 1
        },
        $set: { 
          'reactions.last_at': ts,
          user_id: user_id
        }
      },
      { upsert: true }
    );
    
    // Update daily bucket
    await UserAnalytics.updateOne(
      { user_id, 'daily.date': dayKey },
      {
        $inc: { 'daily.$.reacts': 1 }
      }
    );
    
    // If daily bucket doesn't exist, create it
    await UserAnalytics.updateOne(
      { user_id, 'daily.date': { $ne: dayKey } },
      {
        $push: {
          daily: {
            $each: [{ date: dayKey, reacts: 1 }],
            $slice: -90
          }
        }
      }
    );
    
    analyticsLogger.info('Recorded reaction', { user_id, emoji, dayKey });
  } catch (error) {
    analyticsLogger.error('Failed to record reaction', { user_id, emoji, error: error.message });
  }
};

/**
 * Record player event
 * @param {string} user_id 
 * @param {Date} ts 
 */
export const recordPlayer = async (user_id, ts = new Date()) => {
  try {
    const dayKey = dayKeyUTC(ts);
    
    await UserAnalytics.updateOne(
      { user_id },
      {
        $inc: { 'player.count': 1 },
        $set: { 
          'player.last_at': ts,
          user_id: user_id
        }
      },
      { upsert: true }
    );
    
    // Update daily bucket
    await UserAnalytics.updateOne(
      { user_id, 'daily.date': dayKey },
      {
        $inc: { 'daily.$.became_player': 1 }
      }
    );
    
    // If daily bucket doesn't exist, create it
    await UserAnalytics.updateOne(
      { user_id, 'daily.date': { $ne: dayKey } },
      {
        $push: {
          daily: {
            $each: [{ date: dayKey, became_player: 1 }],
            $slice: -90
          }
        }
      }
    );
    
    analyticsLogger.info('Recorded player event', { user_id, dayKey });
  } catch (error) {
    analyticsLogger.error('Failed to record player event', { user_id, error: error.message });
  }
};

/**
 * Record seen event
 * @param {string} user_id 
 * @param {Date} ts 
 */
export const recordSeen = async (user_id, ts = new Date()) => {
  try {
    await UserAnalytics.updateOne(
      { user_id },
      {
        $inc: { 'seen.total': 1 },
        $set: { 
          'seen.last_at': ts,
          user_id: user_id
        }
      },
      { upsert: true }
    );
    
    analyticsLogger.info('Recorded seen event', { user_id });
  } catch (error) {
    analyticsLogger.error('Failed to record seen event', { user_id, error: error.message });
  }
};