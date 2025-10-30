// services/requeueProcessing.js
import cron from 'node-cron';
import { Message } from '../models/Message.js';
import { config } from '../config/index.js';
import { createServiceLogger } from '../utils/logger.js';

const log = createServiceLogger('requeue-processing');
let task = null; // hold the cron task

function runOnce() {
    const timeoutMinutes = config.processingRecovery?.timeoutMinutes ?? 5;
    const cutoff = new Date(Date.now() - timeoutMinutes * 60 * 1000);

    return Message.updateMany(
        { ai_status: 'processing', updatedAt: { $lt: cutoff } },
        { $set: { ai_status: 'pending', reason: 'requeued_from_processing_timeout' } }
    ).then((res) => {
        if (res.modifiedCount > 0) {
            log.warn('Requeued stuck processing messages', { count: res.modifiedCount, cutoff: cutoff.toISOString() });
        } else {
            log.info('No stuck processing messages this cycle');
        }
    }).catch((err) => {
        log.error('Processing recovery cycle failed', { error: err?.message });
    });
}

export function startRequeueProcessingJob() {
    const enabled = config.processingRecovery?.enabled ?? true;
    if (!enabled) {
        log.info('Processing recovery job is disabled.');
        return;
    }
    if (task) return; // already running

    const everyMin = Math.max(
        1,
        Math.min(59, Number(config.processingRecovery?.intervalMinutes ?? 5))
    );
    const cronExpr = `*/${everyMin} * * * *`;

    task = cron.schedule(cronExpr, runOnce);
    log.info('Processing recovery job scheduled.', { cronExpr, everyMin });

    runOnce();
}

export function stopRequeueProcessingJob() {
    if (task) {
        task.stop();
        task = null;
        log.info('Processing recovery job stopped.');
    }
}
