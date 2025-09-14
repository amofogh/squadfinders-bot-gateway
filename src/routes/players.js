// routes/players.js
import express from 'express';
import {playerController} from '../controllers/playerController.js';
import {authMiddleware, authorizeRole} from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Player:
 *       type: object
 *       required:
 *         - message_id
 *         - message_date
 *       properties:
 *         message_id:
 *           type: number
 *           description: Unique message identifier
 *         message_date:
 *           type: string
 *           format: date-time
 *         sender:
 *           type: object
 *           properties:
 *             id:
 *               type: string
 *             username:
 *               type: string
 *             name:
 *               type: string
 *         group:
 *           type: object
 *           properties:
 *             group_id:
 *               type: string
 *             group_title:
 *               type: string
 *             group_username:
 *               type: string
 *         message:
 *           type: string
 *         platform:
 *           type: string
 *           enum: [PC, Console, unknown]
 *         rank:
 *           type: string
 *         players_count:
 *           type: number
 *         game_mode:
 *           type: string
 *         active:
 *           type: boolean
 */

/**
 * @swagger
 * /api/players:
 *   get:
 *     summary: Get all players
 *     tags: [Players]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: active
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: platform
 *         schema:
 *           type: string
 *           enum: [PC, Console, unknown]
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
 *         description: List of players with pagination
 */
router.get('/', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), playerController.getAll);
/**
 /**
 * @swagger
 * /api/players/squad:
 *   get:
 *     summary: Get active players for squad (excluding seen ones)
 *     tags: [Players]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: User ID to exclude seen players for
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: Maximum number of players to return
 *     responses:
 *       200:
 *         description: List of active players excluding those seen by the user
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Player'
 *                 count:
 *                   type: integer
 *                   description: Number of players returned
 *                 excluded_seen_count:
 *                   type: integer
 *                   description: Number of players excluded because they were seen
 *                 user_id:
 *                   type: string
 *                   description: The user ID used for filtering
 *       400:
 *         description: Missing user_id parameter
 */
router.get('/squad', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), playerController.getPlayersForSquad);
/**
 * @swagger
 * /api/players/{id}:
 *   get:
 *     summary: Get player by ID
 *     tags: [Players]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Player details
 *       404:
 *         description: Player not found
 */
router.get('/:id', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), playerController.getById);

/**
 * @swagger
 * /api/players:
 *   post:
 *     summary: Create new player (Admin only)
 *     tags: [Players]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Player'
 *     responses:
 *       201:
 *         description: Player created successfully
 */
router.post('/', authMiddleware, authorizeRole(['superadmin', 'admin']), playerController.create);

/**
 * @swagger
 * /api/players/{id}:
 *   put:
 *     summary: Update player (Admin only)
 *     tags: [Players]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Player'
 *     responses:
 *       200:
 *         description: Player updated successfully
 */
router.put('/:id', authMiddleware, authorizeRole(['superadmin', 'admin']), playerController.update);

/**
 * @swagger
 * /api/players/{id}:
 *   patch:
 *     summary: Partially update player (Admin only)
 *     tags: [Players]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Player'
 *     responses:
 *       200:
 *         description: Player updated successfully
 */
router.patch('/:id', authMiddleware, authorizeRole(['superadmin', 'admin']), playerController.update);

/**
 * @swagger
 * /api/players/{id}:
 *   delete:
 *     summary: Delete player (Admin only)
 *     tags: [Players]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Player deleted successfully
 */
router.delete('/:id', authMiddleware, authorizeRole(['superadmin', 'admin']), playerController.delete);

export default router;