import express from 'express';
import { dashboardController } from '../controllers/dashboardController.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * /api/dashboard/stats:
 *   get:
 *     summary: Get dashboard statistics
 *     tags: [Dashboard]
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: Dashboard statistics including counts for all models
 */
router.get('/stats', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), dashboardController.getStats);

/**
 * @swagger
 * /api/dashboard/messages-chart:
 *   get:
 *     summary: Get messages chart data
 *     tags: [Dashboard]
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: Messages count by day
 */
router.get('/messages-chart', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), dashboardController.getMessagesChartData);

/**
 * @swagger
 * /api/dashboard/ai-status-distribution:
 *   get:
 *     summary: Get AI status distribution
 *     tags: [Dashboard]
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: Message count by AI status
 */
router.get('/ai-status-distribution', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), dashboardController.getAIStatusDistribution);


export default router;