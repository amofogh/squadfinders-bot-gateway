import express from 'express';
import AdminJSExpress from '@adminjs/express';
import swaggerUi from 'swagger-ui-express';
import session from 'express-session';
import fs from 'fs';
import path from 'path';

import { connectDatabase } from './config/database.js';
import { config } from './config/index.js';
import { swaggerSpec } from './config/swagger.js';
import { adminJS } from './config/adminjs.js';
import { errorHandler } from './middleware/errorHandler.js';
import { authMiddleware } from './middleware/auth.js';
import apiRoutes from './routes/index.js';
import { AdminUser } from './models/index.js';
import { autoExpiryService } from './services/autoExpiry.js';
import { cleanupService } from './services/cleanupService.js';
import logger, { logApiRequest } from './utils/logger.js';

// Initialize Express app
const app = express();

// Create logs directory if it doesn't exist
const logsDir = path.join(process.cwd(), 'logs');
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Connect to database
await connectDatabase();

// Add request logging middleware (before other middleware)
app.use(logApiRequest);

// Session configuration for AdminJS
const sessionOptions = {
  secret: config.cookie.secret,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production', // Set to true in production with HTTPS
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
  },
};

// We need to tell Express to use sessions
app.use(session(sessionOptions));

// AdminJS Router
const adminRouter = AdminJSExpress.buildAuthenticatedRouter(
  adminJS,
  {
    authenticate: async (email, password) => {
      try {
        const user = await AdminUser.findOne({ email: email.toLowerCase() });
        if (user && (await user.comparePassword(password))) {
          return user;
        }
        return false;
      } catch (error) {
        console.error('Authentication error:', error);
        return false;
      }
    },
    cookieName: config.cookie.name,
    cookiePassword: config.cookie.secret,
  },
  null, // We are using the session middleware above
  // Add session options here if not using app.use(session(...)) before
  {
    resave: false,
    saveUninitialized: true,
    secret: config.cookie.secret,
    cookie: {
        secure: process.env.NODE_ENV === 'production', // Set to true in production with HTTPS
    },
  }
);


// Mount AdminJS
app.use(adminJS.options.rootPath, adminRouter);

// Middleware (MUST come after AdminJS)
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// API Routes
app.use('/api', apiRoutes);

// Swagger Documentation
app.use(
  '/docs',
  authMiddleware,
  swaggerUi.serve,
  swaggerUi.setup(swaggerSpec, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'SquadFinders API Documentation',
  })
);

// Public health check
app.get('/', (req, res) => {
  res.type('text/plain').send('healthy');
});

// Error handling middleware (must be last)
app.use(errorHandler);

// Start server
const PORT = config.server.port;
const URL = config.server.url;
const isProxyPass = config.server.proxypass;

app.listen(PORT, () => {
  const baseUrl = isProxyPass ? URL : `${URL}:${PORT}`;
  
  logger.info('Server started successfully', {
    port: PORT,
    baseUrl: baseUrl,
    adminPanel: `${baseUrl}/admin`,
    apiDocs: `${baseUrl}/docs`,
    apiBase: `${baseUrl}/api`,
    environment: process.env.NODE_ENV || 'development',
    autoExpiryEnabled: config.autoExpiry.enabled,
    userSeenCleanupEnabled: config.userSeenCleanup.enabled,
    playerCleanupEnabled: config.playerCleanup.enabled
  });
  
  // Start auto-expiry service
  if (config.autoExpiry.enabled) {
    autoExpiryService.start(); // Use configured interval
  }
  
  // Start cleanup services
  cleanupService.startAll();
});

// Graceful shutdown
process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down gracefully');
  autoExpiryService.stop();
  cleanupService.stopAll();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down gracefully');
  autoExpiryService.stop();
  cleanupService.stopAll();
  process.exit(0);
});