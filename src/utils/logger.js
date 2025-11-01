import winston from 'winston';


winston.addColors({
    error: 'bold red',
    warn: 'red',     // per your request (non-standard)
    info: 'green',
    http: 'magenta',
    verbose: 'blue',
    debug: 'cyan',
    silly: 'grey'
});

const normalizeLevel = (level) => {
    const normalized = level && typeof level.toLowerCase === 'function' ? level.toLowerCase() : '';
    return normalized && normalized.trim().length > 0 ? normalized : 'info';
};

const serializeMeta = (meta) =>
    Object.entries(meta)
        .flatMap(([key, value]) => {
            if (value === undefined || value === null || value === '') return [];
            if (typeof value === 'object') {
                try {
                    return [`${key}=${JSON.stringify(value)}`];
                } catch {
                    return [`${key}=${String(value)}`];
                }
            }
            return [`${key}=${value}`];
        })
        .join(' ');

const humanReadableFormat = winston.format.printf(
    ({ timestamp, level, message, service, scope, stack, ...meta }) => {
        // level is colorized by colorize({ level: true })
        const origin = [service, scope].filter(Boolean).join(' :: ');
        const metaString = serializeMeta(meta);
        const baseLine = `${timestamp} - [${level}]${origin ? ` - ${origin}` : ''} - ${message}`;
        if (stack) return `${baseLine}${metaString ? ` | ${metaString}` : ''}\n${stack}`;
        return `${baseLine}${metaString ? ` | ${metaString}` : ''}`;
    }
);

const baseFormat = winston.format.combine(
    winston.format.timestamp({ format: 'YYYY-MM-DD HH:mm:ss.SSS' }),
    winston.format.errors({ stack: true }),
    winston.format.splat(),
    humanReadableFormat
);

const consoleFormat = winston.format.combine(
    winston.format.colorize({ level: true, message: false }),
    baseFormat
);

// ---- console-only logger (no file transports) ----
const logger = winston.createLogger({
    level: normalizeLevel(process.env.LOG_LEVEL),
    defaultMeta: { service: 'squadfinders-api' },
    transports: [new winston.transports.Console({ format: consoleFormat })]
});

export const createServiceLogger = (scope) => logger.child({ scope });

export default logger;

export const logApiRequest = (req, res, next) => {
    const start = process.hrtime.bigint();

    res.on('finish', () => {
        const elapsed = Number(process.hrtime.bigint() - start) / 1_000_000;
        const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';

        logger.log({
            level,
            message: `🌐 ${req.method} ${req.originalUrl} → ${res.statusCode}`,
            durationMs: elapsed.toFixed(1),
            userAgent: req.get('User-Agent'),
            ip: req.ip
        });
    });

    next();
};

export const logError = (error, context = {}) => {
    logger.error('💥 Application error encountered', {
        error: error && error.message ? error.message : String(error),
        stack: error && error.stack ? error.stack : undefined,
        ...context
    });
};

export const logMessageProcessing = (action, messageData = {}, additionalInfo = {}) => {
    logger.debug(`🤖 ${action}`, {
        messageId: messageData.message_id ?? messageData._id,
        messageDate: messageData.message_date,
        aiStatus: messageData.ai_status,
        ...additionalInfo
    });
};

export const logAutoExpiry = (action, data = {}) => {
    const autoExpiryLogger = createServiceLogger('auto-expiry');
    autoExpiryLogger.debug(`⏰ ${action}`, data);
};

export const logCleanup = (action, data = {}) => {
    const cleanupLogger = createServiceLogger('cleanup');
    cleanupLogger.debug(`🧹 ${action}`, data);
};


