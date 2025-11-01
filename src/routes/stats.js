import express from 'express';
import { statsController } from '../controllers/statsController.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     UserAnalytics:
 *       type: object
 *       properties:
 *         user_id:
 *           type: string
 *           description: Unique user identifier
 *         username:
 *           type: string
 *         is_canceled:
 *           type: boolean
 *         dm:
 *           type: object
 *           properties:
 *             total_attempts:
 *               type: number
 *             total_sent:
 *               type: number
 *             total_skipped_canceled:
 *               type: number
 *         messages:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *             first_at:
 *               type: string
 *               format: date-time
 *             last_at:
 *               type: string
 *               format: date-time
 *         reactions:
 *           type: object
 *           properties:
 *             total:
 *               type: number
 *             by_emoji:
 *               type: object
 *             last_at:
 *               type: string
 *               format: date-time
 *         player:
 *           type: object
 *           properties:
 *             count:
 *               type: number
 *             last_at:
 *               type: string
 *               format: date-time
 */

/**
 * @swagger
 * /api/stats/user/{id}:
 *   get:
 *     summary: Get user analytics by ID
 *     tags: [Stats]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID
 *     responses:
 *       200:
 *         description: User analytics data
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/UserAnalytics'
 *       404:
 *         description: User analytics not found
 */
router.get('/user/:id', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), statsController.getUserStats);

/**
 * @swagger
 * /api/stats/insights:
 *   get:
 *     summary: Get global analytics insights
 *     tags: [Stats]
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: Global analytics insights
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 total_users:
 *                   type: number
 *                 avg_dm_sent:
 *                   type: number
 *                 avg_lost_due_cancel:
 *                   type: number
 *                 avg_msgs:
 *                   type: number
 *                 avg_reacts:
 *                   type: number
 *                 avg_player:
 *                   type: number
 *                 cancel_rate:
 *                   type: number
 *                 canceled_users:
 *                   type: number
 */
router.get('/insights', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), statsController.getInsights);

/**
 * @swagger
 * /api/stats/daily:
 *   get:
 *     summary: Get daily aggregated stats
 *     tags: [Stats]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 30
 *         description: Number of days to retrieve
 *     responses:
 *       200:
 *         description: Daily aggregated statistics
 */
router.get('/daily', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), statsController.getDailyStats);

export default router;