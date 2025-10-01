import express from 'express';
import { reactionController } from '../controllers/reactionController.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     MessageReaction:
 *       type: object
 *       required:
 *         - message_id
 *         - user_id
 *         - reaction
 *       properties:
 *         message_id:
 *           type: integer
 *           description: Telegram message identifier
 *         user_id:
 *           type: string
 *           description: Telegram user identifier
 *         username:
 *           type: string
 *         reaction:
 *           type: string
 *           enum: ['👍', '❤️', '👎']
 *         reacted_at:
 *           type: string
 *           format: date-time
 *           description: When the reaction was recorded
 *         source:
 *           type: string
 *           description: Source system that emitted the reaction event
 *         metadata:
 *           type: object
 *           additionalProperties: true
 *           description: Optional payload for debugging/tracing the event
 *
 *     ReactionSummary:
 *       type: object
 *       properties:
 *         range:
 *           type: object
 *           properties:
 *             start:
 *               type: string
 *               format: date-time
 *             end:
 *               type: string
 *               format: date-time
 *         totals:
 *           type: object
 *           properties:
 *             messagesAnalyzed:
 *               type: integer
 *             messagesWithReactions:
 *               type: integer
 *             uniqueRecipients:
 *               type: integer
 *             totalDeliveries:
 *               type: integer
 *             totalReactions:
 *               type: integer
 *             uniqueReactors:
 *               type: integer
 *             positiveReactions:
 *               type: integer
 *             negativeReactions:
 *               type: integer
 *             neutralReactions:
 *               type: integer
 *             netScore:
 *               type: integer
 *         rates:
 *           type: object
 *           properties:
 *             reactionPerDelivery:
 *               type: number
 *             reactionPerMessage:
 *               type: number
 *             uniqueEngagementRate:
 *               type: number
 *             positivityRate:
 *               type: number
 *             coverageRate:
 *               type: number
 *         breakdown:
 *           type: array
 *           items:
 *             type: object
 *             properties:
 *               reaction:
 *                 type: string
 *               count:
 *                 type: integer
 */

/**
 * @swagger
 * /api/reactions:
 *   get:
 *     summary: List recorded reactions
 *     tags: [Reactions]
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
 *           default: 100
 *       - in: query
 *         name: message_id
 *         schema:
 *           type: integer
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: reaction
 *         schema:
 *           type: string
 *           enum: ['👍', '❤️', '👎']
 *       - in: query
 *         name: source
 *         schema:
 *           type: string
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *       - in: query
 *         name: until
 *         schema:
 *           type: string
 *           format: date-time
 *     responses:
 *       200:
 *         description: Paginated list of reactions
 */
router.get('/', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), reactionController.list);

/**
 * @swagger
 * /api/reactions:
 *   post:
 *     summary: Record a reaction event
 *     tags: [Reactions]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MessageReaction'
 *     responses:
 *       201:
 *         description: Reaction recorded
 */
router.post('/', authMiddleware, authorizeRole(['superadmin', 'admin']), reactionController.create);

/**
 * @swagger
 * /api/reactions/summary:
 *   get:
 *     summary: Get engagement summary for a timeframe
 *     tags: [Reactions]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: timeframe
 *         schema:
 *           type: string
 *           example: 30d
 *         description: Relative timeframe (e.g. 24h, 7d, 1y)
 *       - in: query
 *         name: since
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Absolute start date (overrides timeframe)
 *       - in: query
 *         name: until
 *         schema:
 *           type: string
 *           format: date-time
 *         description: Absolute end date (overrides timeframe)
 *     responses:
 *       200:
 *         description: Engagement summary
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/ReactionSummary'
 */
router.get('/summary', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), reactionController.getSummary);

/**
 * @swagger
 * /api/reactions/messages/{messageId}:
 *   get:
 *     summary: Get engagement metrics for a specific message
 *     tags: [Reactions]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: integer
 *     responses:
 *       200:
 *         description: Message engagement details
 */
router.get('/messages/:messageId', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), reactionController.getMessageSummary);

/**
 * @swagger
 * /api/reactions/users/{userId}:
 *   get:
 *     summary: Get engagement profile for a specific user
 *     tags: [Reactions]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: User engagement profile
 */
router.get('/users/:userId', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), reactionController.getUserSummary);

export default router;
