import express from 'express';
import { botUserStatController } from '../controllers/botUserStatController.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     BotUserStat:
 *       type: object
 *       properties:
 *         user_id:
 *           type: string
 *           description: Unique identifier of the Telegram user
 *         username:
 *           type: string
 *           description: Telegram username (if available)
 *         full_name:
 *           type: string
 *           description: Full name provided by Telegram
 *         first_interaction_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp when the user first interacted with the bot
 *         last_interaction_at:
 *           type: string
 *           format: date-time
 *           description: Timestamp of the most recent interaction
 *         last_button:
 *           type: string
 *           enum: [findplayer, cancelplayer, aboutus, ourchannel]
 *           description: The most recent button pressed by the user
 *         total_interactions:
 *           type: integer
 *           description: Total count of button interactions recorded for the user
 *         button_totals:
 *           type: object
 *           description: Aggregated interaction counts by button
 *           additionalProperties:
 *             type: object
 *             properties:
 *               count:
 *                 type: integer
 *                 description: Number of times the user pressed the button
 *               last_at:
 *                 type: string
 *                 format: date-time
 *                 description: Last time the button was pressed by the user
 *         history:
 *           type: array
 *           description: Recent interaction history (latest 100 events)
 *           items:
 *             type: object
 *             properties:
 *               button:
 *                 type: string
 *                 enum: [findplayer, cancelplayer, aboutus, ourchannel]
 *               at:
 *                 type: string
 *                 format: date-time
 */

/**
 * @swagger
 * /api/bot-user-stats:
 *   get:
 *     summary: List bot user statistics
 *     tags: [BotUserStats]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by user_id, username, or full name
 *       - in: query
 *         name: button
 *         schema:
 *           type: string
 *           enum: [findplayer, cancelplayer, aboutus, ourchannel]
 *         description: Filter users that have interacted with a specific button
 *     responses:
 *       200:
 *         description: Paginated list of bot user stats
 */
router.get(
  '/',
  authMiddleware,
  authorizeRole(['superadmin', 'admin', 'viewer']),
  botUserStatController.getAll
);

/**
 * @swagger
 * /api/bot-user-stats/summary:
 *   get:
 *     summary: Get overall button usage summary
 *     tags: [BotUserStats]
 *     security:
 *       - basicAuth: []
 *     responses:
 *       200:
 *         description: Aggregated button usage totals across all users
 */
router.get(
  '/summary',
  authMiddleware,
  authorizeRole(['superadmin', 'admin', 'viewer']),
  botUserStatController.getSummary
);

/**
 * @swagger
 * /api/bot-user-stats/{user_id}:
 *   get:
 *     summary: Get button usage statistics for a user
 *     tags: [BotUserStats]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Bot user statistics
 *       404:
 *         description: Stats not found for the specified user
 */
router.get(
  '/:user_id',
  authMiddleware,
  authorizeRole(['superadmin', 'admin', 'viewer']),
  botUserStatController.getByUserId
);

/**
 * @swagger
 * /api/bot-user-stats/interactions:
 *   post:
 *     summary: Record a button interaction event from the Telegram bot
 *     tags: [BotUserStats]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - user_id
 *               - button
 *             properties:
 *               user_id:
 *                 type: string
 *               username:
 *                 type: string
 *               full_name:
 *                 type: string
 *               button:
 *                 type: string
 *                 enum: [findplayer, cancelplayer, aboutus, ourchannel]
 *               occurred_at:
 *                 type: string
 *                 format: date-time
 *                 description: Timestamp of the interaction (defaults to now if omitted)
 *     responses:
 *       201:
 *         description: Interaction recorded successfully
 */
router.post(
  '/interactions',
  authMiddleware,
  authorizeRole(['superadmin', 'admin']),
  botUserStatController.recordInteraction
);

export default router;

