import express from 'express';
import { userStatsController } from '../controllers/userStatsController.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     UserStats:
 *       type: object
 *       required:
 *         - user_id
 *       properties:
 *         user_id:
 *           type: string
 *           description: Unique user identifier
 *         username:
 *           type: string
 *           description: Username
 *         button_clicks:
 *           type: object
 *           properties:
 *             find_player:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *                   default: 0
 *                 last_clicked_at:
 *                   type: string
 *                   format: date-time
 *             dont_want_to_play:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *                   default: 0
 *                 last_clicked_at:
 *                   type: string
 *                   format: date-time
 *             about_us:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *                   default: 0
 *                 last_clicked_at:
 *                   type: string
 *                   format: date-time
 *             channel_and_group:
 *               type: object
 *               properties:
 *                 count:
 *                   type: number
 *                   default: 0
 *                 last_clicked_at:
 *                   type: string
 *                   format: date-time
 *         total_clicks:
 *           type: number
 *           default: 0
 */

/**
 * @swagger
 * /api/user-stats:
 *   get:
 *     summary: Get all user stats
 *     tags: [User Stats]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: username
 *         schema:
 *           type: string
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
 *     responses:
 *       200:
 *         description: List of user stats with pagination
 */
router.get('/', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), userStatsController.getAll);

/**
 * @swagger
 * /api/user-stats/aggregated:
 *   get:
 *     summary: Get aggregated user stats (top users and summary)
 *     tags: [User Stats]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *     responses:
 *       200:
 *         description: Aggregated stats including top users and summary
 */
router.get('/aggregated', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), userStatsController.getAggregated);

/**
 * @swagger
 * /api/user-stats/{user_id}:
 *   get:
 *     summary: Get user stats by user_id
 *     tags: [User Stats]
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
 *         description: User stats details
 *       404:
 *         description: User stats not found
 */
router.get('/:user_id', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), userStatsController.getByUserId);

/**
 * @swagger
 * /api/user-stats/click:
 *   post:
 *     summary: Record a button click (can be called by bot without admin auth)
 *     tags: [User Stats]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - button_name
 *             properties:
 *               user_id:
 *                 type: string
 *                 description: User ID (optional if username is provided for existing users)
 *               username:
 *                 type: string
 *                 description: Username (required if user_id is not provided, or to update username)
 *               button_name:
 *                 type: string
 *                 enum: [find_player, dont_want_to_play, about_us, channel_and_group]
 *                 description: Name of the button that was clicked
 *           examples:
 *             byUsername:
 *               summary: Record click by username (for existing users)
 *               value:
 *                 username: "john_doe"
 *                 button_name: "find_player"
 *             byUserId:
 *               summary: Record click by user_id
 *               value:
 *                 user_id: "123456789"
 *                 username: "john_doe"
 *                 button_name: "find_player"
 *             newUser:
 *               summary: Create new user and record click (requires user_id)
 *               value:
 *                 user_id: "123456789"
 *                 username: "new_user"
 *                 button_name: "about_us"
 *     responses:
 *       200:
 *         description: Button click recorded successfully
 *       400:
 *         description: Invalid request (missing required fields or invalid button_name)
 *       409:
 *         description: Conflict (user_id already exists)
 */
router.post('/click', userStatsController.recordClick);

/**
 * @swagger
 * /api/user-stats:
 *   post:
 *     summary: Create new user stats (Admin only)
 *     tags: [User Stats]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserStats'
 *     responses:
 *       201:
 *         description: User stats created successfully
 */
router.post('/', authMiddleware, authorizeRole(['superadmin', 'admin']), userStatsController.create);

/**
 * @swagger
 * /api/user-stats/{user_id}:
 *   put:
 *     summary: Update user stats by user_id (Admin only)
 *     tags: [User Stats]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserStats'
 *     responses:
 *       200:
 *         description: User stats updated successfully
 */
router.put('/:user_id', authMiddleware, authorizeRole(['superadmin', 'admin']), userStatsController.updateByUserId);

/**
 * @swagger
 * /api/user-stats/{user_id}:
 *   patch:
 *     summary: Partially update user stats by user_id (Admin only)
 *     tags: [User Stats]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserStats'
 *     responses:
 *       200:
 *         description: User stats updated successfully
 */
router.patch('/:user_id', authMiddleware, authorizeRole(['superadmin', 'admin']), userStatsController.updateByUserId);

/**
 * @swagger
 * /api/user-stats/{user_id}:
 *   delete:
 *     summary: Delete user stats by user_id (Admin only)
 *     tags: [User Stats]
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
 *         description: User stats deleted successfully
 */
router.delete('/:user_id', authMiddleware, authorizeRole(['superadmin', 'admin']), userStatsController.deleteByUserId);

export default router;

