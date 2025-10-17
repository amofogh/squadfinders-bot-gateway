import winston from 'winston';

const normalizeLevel = (level) => {
  const normalized = level?.toLowerCase?.();
  if (normalized && normalized.trim().length > 0) {
    return normalized;
  }
  return 'info';
};

const serializeMeta = (meta) => {
  return Object.entries(meta)
    .flatMap(([key, value]) => {
      if (value === undefined || value === null || value === '') {
        return [];
      }

      if (typeof value === 'object') {
        try {
          return [`${key}=${JSON.stringify(value)}`];
        } catch (error) {
          return [`${key}=${String(value)}`];
        }
      }

      return [`${key}=${value}`];
    })
    .join(' ');
};

const humanReadableFormat = winston.format.printf(({ timestamp, level, message, service, scope, stack, ...meta }) => {
  const levelLabel = level.toUpperCase();
  const origin = [service, scope].filter(Boolean).join(' :: ');
  const metaString = serializeMeta(meta);
  const baseLine = `${timestamp} - ${levelLabel}${origin ? ` - ${origin}` : ''} - ${message}`;

  if (stack) {
    return `${baseLine}${metaString ? ` | ${metaString}` : ''}\n${stack}`;
  }

  return `${baseLine}${metaString ? ` | ${metaString}` : ''}`;
});

const baseFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss.SSS'
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  humanReadableFormat
);

const consoleFormat = winston.format.combine(
  winston.format.colorize({ all: false }),
  baseFormat
);

const logger = winston.createLogger({
  level: normalizeLevel(process.env.LOG_LEVEL),
  defaultMeta: { service: 'squadfinders-api' },
  transports: [
    new winston.transports.Console({
      format: consoleFormat
    }),
    new winston.transports.File({
      filename: 'logs/error.log',
      level: 'error',
      maxsize: 5242880,
      maxFiles: 5,
      format: baseFormat
    }),
    new winston.transports.File({
      filename: 'logs/combined.log',
      maxsize: 5242880,
      maxFiles: 5,
      format: baseFormat
    })
  ]
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
    error: error.message,
    stack: error.stack,
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
