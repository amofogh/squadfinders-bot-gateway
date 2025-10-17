import 'dotenv/config';

const parseNumber = (value, defaultValue) => {
  if (value === undefined || value === null || value === '') {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  return Number.isNaN(parsed) ? defaultValue : parsed;
};

export const config = {
  mongodb: {
    uri: process.env.MONGO_URI || 'mongodb://admin:password@host:27017/players?authSource=admin',
  },
  adminAuth: {
    user: process.env.ADMIN_USER || 'squadfinders',
    pass: process.env.ADMIN_PASS || 'some-secure-password',
  },
  cookie: {
    name: 'squadfinders-session',
    secret: process.env.COOKIE_SECRET || 'change-this-cookie-secret',
  },
  server: {
    proxypass: process.env.PROXY_PASS === 'true',
    url: process.env.SERVER_URL || 'http://localhost',
    port: parseNumber(process.env.PORT, 3000),
  },
  swagger: {
    title: 'SquadFinders Bot Gateway API',
    version: '1.0.0',
    description: 'API for managing player records and messages',
  },
  admin: {
    listPerPage: parseNumber(process.env.ADMIN_LIST_PER_PAGE, 50),
  },
  autoExpiry: {
    enabled: process.env.AUTO_EXPIRY_ENABLED !== 'false', // Default true
    expiryMinutes: parseNumber(process.env.EXPIRY_MINUTES, 5), // Default 5 minutes
    intervalMinutes: parseNumber(process.env.EXPIRY_INTERVAL_MINUTES, 1), // Default 1 minute
  },
  userSeenCleanup: {
    enabled: process.env.USER_SEEN_CLEANUP_ENABLED !== 'false', // Default true
    disableAfterHours: parseNumber(process.env.USER_SEEN_DISABLE_AFTER_HOURS, 2), // Default 2 hours
    intervalHours: parseNumber(process.env.USER_SEEN_CLEANUP_INTERVAL_HOURS, 12), // Default 12 hours
  },
  playerCleanup: {
    enabled: process.env.PLAYER_CLEANUP_ENABLED !== 'false', // Default true
    disableAfterHours: parseNumber(process.env.PLAYER_DISABLE_AFTER_HOURS, 6), // Default 6 hours
    intervalHours: parseNumber(process.env.PLAYER_CLEANUP_INTERVAL_HOURS, 12), // Default 12 hours
  },
  messageSpam: {
    windowMinutes: parseNumber(process.env.MESSAGE_SPAM_WINDOW_MINUTES, 60), // Default 60 minutes
  }
};
