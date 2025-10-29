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
 *     parameters:
 *       - in: query
 *         name: timeRange
 *         required: false
 *         schema:
 *           type: string
 *           enum: [24h, 7d, 30d, thisMonth, lastMonth, all]
 *           default: 24h
 *         description: >
 *           Time window for aggregations based on message_date (>= startDate).
 *           Supported values:
 *           - 24h (last 24 hours)
 *           - 7d  (last 7 days)
 *           - 30d (last 30 days)
 *           - thisMonth (from the 1st of current month)
 *           - lastMonth (from the 1st of previous month)
 *           - all (no lower bound; epoch)
 *     responses:
 *       200:
 *         description: Dashboard stats
 */
router.get(
    '/stats',
    authMiddleware,
    authorizeRole(['superadmin', 'admin', 'viewer']),
    // (optional) validator below
    dashboardController.getStats
);


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