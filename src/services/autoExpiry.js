import {Message} from '../models/index.js';
import {config} from '../config/index.js';
import {logAutoExpiry, logError} from '../utils/logger.js';

export class AutoExpiryService {
    constructor() {
        this.intervalId = null;
        this.isRunning = false;
        this.enabled = config.autoExpiry.enabled;
        this.expiryMinutes = config.autoExpiry.expiryMinutes;
        this.intervalMinutes = config.autoExpiry.intervalMinutes;
    }

    // Start the auto-expiry job
    start(intervalMinutes = null) {
        if (!this.enabled) {
            logAutoExpiry('Service disabled', {
                reason: 'AUTO_EXPIRY_ENABLED is false',
                config: {enabled: this.enabled}
            });
            return;
        }

        if (this.isRunning) {
            logAutoExpiry('Service already running', {intervalId: this.intervalId});
            return;
        }

  // Enable/disable the service
  setEnabled(enabled) {
    this.enabled = enabled;
    if (!enabled && this.isRunning) {
      this.stop();
    }
  }

  // Update expiry time
  setExpiryMinutes(minutes) {
    this.expiryMinutes = minutes;
    logAutoExpiry('Expiry minutes updated', { minutes });
  }

  // Expire messages older than configured minutes that are still pending
  async expireOldMessages() {
    if (!this.enabled) return;

    try {
      logAutoExpiry('Starting expiry check', {
        expiryMinutes: this.expiryMinutes,
        cutoffTime: new Date(Date.now() - this.expiryMinutes * 60 * 1000).toISOString()
      });

      const expiryTime = new Date(Date.now() - this.expiryMinutes * 60 * 1000);
      
      // First, count messages that will be expired
      const messagesToExpireCount = await Message.countDocuments({
        ai_status: { $in: ['pending', 'pending_prefilter', 'processing'] },
        message_date: { $lt: expiryTime }
      });

      if (messagesToExpireCount > 0) {
        // Get sample of messages for logging
        const sampleMessages = await Message.find({
          ai_status: { $in: ['pending', 'pending_prefilter', 'processing'] },
          message_date: { $lt: expiryTime }
        })
        .select('message_id message_date ai_status')
        .limit(10)
        .lean();

        logAutoExpiry('Found messages to expire', {
          totalCount: messagesToExpireCount,
          expiryTime: expiryTime.toISOString(),
          sampleMessages: sampleMessages.map(m => ({
            messageId: m.message_id,
            messageDate: m.message_date.toISOString(),
            aiStatus: m.ai_status,
            ageMinutes: Math.round((Date.now() - m.message_date.getTime()) / (1000 * 60))
          }))
          
        const interval = intervalMinutes || this.intervalMinutes;
        logAutoExpiry('Service starting', {
            intervalMinutes: interval,
            expiryMinutes: this.expiryMinutes,
            enabled: this.enabled
        });

        this.intervalId = setInterval(async () => {
            await this.expireOldMessages();
        }, interval * 60 * 1000);

        this.isRunning = true;

        // Run immediately on start
        this.expireOldMessages();
    }

    // Stop the auto-expiry job
    stop() {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            logAutoExpiry('Service stopped', {intervalId: this.intervalId});
            this.intervalId = null;
            this.isRunning = false;
        }
    }

    // Enable/disable the service
    setEnabled(enabled) {
        this.enabled = enabled;
        if (!enabled && this.isRunning) {
            this.stop();
        }
    }

    // Update expiry time
    setExpiryMinutes(minutes) {
        this.expiryMinutes = minutes;
        console.log(`⏰ Auto-expiry time updated to ${minutes} minutes`);
    }

    // Expire messages older than configured minutes that are still pending
    async expireOldMessages() {
        if (!this.enabled) return;

        try {
            logAutoExpiry('Starting expiry check', {
                expiryMinutes: this.expiryMinutes,
                cutoffTime: new Date(Date.now() - this.expiryMinutes * 60 * 1000).toISOString()
            });

            const expiryTime = new Date(Date.now() - this.expiryMinutes * 60 * 1000);

            // First, count messages that will be expired
            const messagesToExpireCount = await Message.countDocuments({
                ai_status: {$in: ['pending', 'pending_prefilter', 'processing']},
                message_date: {$lt: expiryTime}
            });

            if (messagesToExpireCount > 0) {
                // Get sample of messages for logging
                const sampleMessages = await Message.find({
                    ai_status: {$in: ['pending', 'pending_prefilter', 'processing']},
                    message_date: {$lt: expiryTime}
                })
                    .select('message_id message_date ai_status')
                    .limit(10)
                    .lean();

                logAutoExpiry('Found messages to expire', {
                    totalCount: messagesToExpireCount,
                    expiryTime: expiryTime.toISOString(),
                    sampleMessages: sampleMessages.map(m => ({
                        messageId: m.message_id,
                        messageDate: m.message_date.toISOString(),
                        aiStatus: m.ai_status,
                        ageMinutes: Math.round((Date.now() - m.message_date.getTime()) / (1000 * 60))
                    }))
                });
            }

            // Process in batches to handle large datasets efficiently
            const batchSize = 1000;
            let totalExpired = 0;

            while (true) {
                const result = await Message.updateMany(
                    {
                        ai_status: {$in: ['pending', 'pending_prefilter', 'processing']},
                        message_date: {$lt: expiryTime} // Use message_date instead of createdAt
                    },
                    {
                        $set: {ai_status: 'expired'}
                    },
                    {limit: batchSize}
                );

                totalExpired += result.modifiedCount;

                if (result.modifiedCount > 0) {
                    logAutoExpiry('Batch expired', {
                        batchExpired: result.modifiedCount,
                        totalExpiredSoFar: totalExpired,
                        batchSize: batchSize
                    });
                }

                // If we processed fewer than the batch size, we're done
                if (result.modifiedCount < batchSize) {
                    break;
                }
            }

            if (totalExpired > 0) {
                logAutoExpiry('Expiry completed', {
                    totalExpired: totalExpired,
                    expiryMinutes: this.expiryMinutes,
                    expiryTime: expiryTime.toISOString()
                });
            } else {
                logAutoExpiry('No messages to expire', {
                    expiryTime: expiryTime.toISOString(),
                    expiryMinutes: this.expiryMinutes
                });
            }
        } catch (error) {
            logError(error, {
                service: 'auto-expiry',
                action: 'expireOldMessages',
                config: {
                    enabled: this.enabled,
                    expiryMinutes: this.expiryMinutes
                }
            });
        }
    }

    // Get service status
    getStatus() {
        return {
            isRunning: this.isRunning,
            enabled: this.enabled,
            expiryMinutes: this.expiryMinutes,
            intervalMinutes: this.intervalMinutes,
            intervalId: this.intervalId
        };
    }
}

// Create singleton instance
export const autoExpiryService = new AutoExpiryService();