import {Message} from '../models/index.js';
import {config} from '../config/index.js';
import {logAutoExpiry, logError} from '../utils/logger.js';

function createAutoExpiryService() {
    let intervalId = null;
    let isRunning = false;
    let enabled = config.autoExpiry.enabled;
    let expiryMinutes = config.autoExpiry.expiryMinutes;
    const intervalMinutes = config.autoExpiry.intervalMinutes;

    // Decide the appropriate expire reason for each document
    function determineExpireReason(message) {
        const prevReason = message.reason || '';
        const status = message.ai_status;

        if (status === 'processing') {
            return 'expired_processing_timeout';
        }

        if (status === 'pending') {
            if (prevReason && prevReason.includes('requeue')) {
                return 'expired_after_pending';
            }
            return 'expired_pending_timeout';
        }

        return 'expired_timeout';
    }

    function stop() {
        if (intervalId) {
            clearInterval(intervalId);
            logAutoExpiry('Service stopped', {intervalId});
            intervalId = null;
            isRunning = false;
        }
    }

    function setEnabled(value) {
        enabled = value;
        if (!value && isRunning) {
            stop();
        }
    }

    function setExpiryMinutes(minutes) {
        expiryMinutes = minutes;
        logAutoExpiry('Expiry minutes updated', {minutes});
    }

    async function expireOldMessages() {
        if (!enabled) return;

        try {
            const expiryTime = new Date(Date.now() - expiryMinutes * 60 * 1000);

            logAutoExpiry('Starting expiry check', {
                expiryMinutes,
                cutoffTime: expiryTime.toISOString(),
            });

            const statusFilter = {$in: ['pending', 'processing']};

            // Removed static reason constraint; we want to expire any stale pending/processing
            const messagesToExpireCount = await Message.countDocuments({
                ai_status: statusFilter,
                message_date: {$lt: expiryTime},
            });

            if (messagesToExpireCount > 0) {
                const sampleMessages = await Message.find({
                    ai_status: statusFilter,
                    message_date: {$lt: expiryTime},
                })
                    .select('message_id message_date ai_status reason')
                    .limit(10)
                    .lean();

                logAutoExpiry('Found messages to expire', {
                    totalCount: messagesToExpireCount,
                    expiryTime: expiryTime.toISOString(),
                    sampleMessages: sampleMessages.map((message) => ({
                        messageId: message.message_id,
                        messageDate: message.message_date.toISOString(),
                        aiStatus: message.ai_status,
                        prevReason: message.reason || null,
                        ageMinutes: Math.round((Date.now() - message.message_date.getTime()) / (1000 * 60)),
                    })),
                });
            }

            const batchSize = 1000;
            let totalExpired = 0;

            // Batch: find → bulkWrite (so we can set per-doc reason)
            while (true) {
                const batch = await Message.find({
                    ai_status: statusFilter,
                    message_date: {$lt: expiryTime},
                })
                    .select('_id ai_status reason message_date')
                    .sort({message_date: 1})
                    .limit(batchSize)
                    .lean();

                if (batch.length === 0) break;

                const now = new Date();
                const ops = batch.map((doc) => ({
                    updateOne: {
                        filter: {_id: doc._id},
                        update: {
                            $set: {
                                ai_status: 'expired',
                                reason: determineExpireReason(doc),
                                expired_at: now,
                            },
                        },
                    },
                }));

                const result = await Message.bulkWrite(ops, {ordered: false});

                const modified =
                    typeof result.modifiedCount === 'number'
                        ? result.modifiedCount
                        : typeof result.nModified === 'number'
                            ? result.nModified
                            : 0;

                totalExpired += modified;

                if (modified > 0) {
                    logAutoExpiry('Batch expired', {
                        batchExpired: modified,
                        totalExpiredSoFar: totalExpired,
                        batchSize,
                    });
                }

                if (batch.length < batchSize) break;
            }

            if (totalExpired > 0) {
                logAutoExpiry('Expiry completed', {
                    totalExpired,
                    expiryMinutes,
                    expiryTime: expiryTime.toISOString(),
                });
            } else {
                logAutoExpiry('No messages to expire', {
                    expiryTime: expiryTime.toISOString(),
                    expiryMinutes,
                });
            }
        } catch (error) {
            logError(error, {
                service: 'auto-expiry',
                action: 'expireOldMessages',
                config: {
                    enabled,
                    expiryMinutes,
                },
            });
        }
    }

    function start(customIntervalMinutes = null) {
        if (!enabled) {
            logAutoExpiry('Service disabled', {
                reason: 'AUTO_EXPIRY_ENABLED is false',
                config: {enabled},
            });
            return;
        }

        if (isRunning) {
            logAutoExpiry('Service already running', {intervalId});
            return;
        }

        const interval = customIntervalMinutes || intervalMinutes;

        logAutoExpiry('Service starting', {
            intervalMinutes: interval,
            expiryMinutes,
            enabled,
        });

        intervalId = setInterval(async () => {
            try {
                await expireOldMessages();
            } catch (error) {
                logError(error, {
                    service: 'auto-expiry',
                    action: 'interval-expireOldMessages',
                });
            }
        }, interval * 60 * 1000);

        isRunning = true;

        // Run once immediately
        expireOldMessages();
    }

    function getStatus() {
        return {
            isRunning,
            enabled,
            expiryMinutes,
            intervalMinutes,
            intervalId,
        };
    }

    return {
        start,
        stop,
        setEnabled,
        setExpiryMinutes,
        expireOldMessages,
        getStatus,
    };
}

export const autoExpiryService = createAutoExpiryService();
