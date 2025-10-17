import express from 'express';
import { reactionController } from '../controllers/reactionController.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Reaction:
 *       type: object
 *       required:
 *         - user_id
 *         - chat_id
 *         - message_id
 *         - emoji
 *       properties:
 *         user_id:
 *           type: string
 *           description: User identifier
 *         username:
 *           type: string
 *           description: Username
 *         chat_id:
 *           type: string
 *           description: Chat identifier
 *         message_id:
 *           type: number
 *           description: Message identifier
 *         emoji:
 *           type: string
 *           description: Reaction emoji
 *         type:
 *           type: string
 *           enum: [add, remove]
 *           default: add
 *         message_date:
 *           type: string
 *           format: date-time
 *         meta:
 *           type: object
 *           description: Additional metadata
 */

/**
 * @swagger
 * /api/reactions:
 *   get:
 *     summary: Get all reactions
 *     tags: [Reactions]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: user_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: chat_id
 *         schema:
 *           type: string
 *       - in: query
 *         name: message_id
 *         schema:
 *           type: number
 *       - in: query
 *         name: emoji
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
 *         description: List of reactions with pagination
 */
router.get('/', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), reactionController.getAll);

/**
 * @swagger
 * /api/reactions/{id}:
 *   get:
 *     summary: Get reaction by ID
 *     tags: [Reactions]
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
 *         description: Reaction details
 *       404:
 *         description: Reaction not found
 */
router.get('/:id', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), reactionController.getById);

/**
 * @swagger
 * /api/reactions:
 *   post:
 *     summary: Create new reaction (Admin only)
 *     tags: [Reactions]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Reaction'
 *     responses:
 *       201:
 *         description: Reaction created successfully
 */
router.post('/', authMiddleware, authorizeRole(['superadmin', 'admin']), reactionController.create);

/**
 * @swagger
 * /api/reactions/{id}:
 *   put:
 *     summary: Update reaction (Admin only)
 *     tags: [Reactions]
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
 *             $ref: '#/components/schemas/Reaction'
 *     responses:
 *       200:
 *         description: Reaction updated successfully
 */
router.put('/:id', authMiddleware, authorizeRole(['superadmin', 'admin']), reactionController.update);

/**
 * @swagger
 * /api/reactions/{id}:
 *   patch:
 *     summary: Partially update reaction (Admin only)
 *     tags: [Reactions]
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
 *             $ref: '#/components/schemas/Reaction'
 *     responses:
 *       200:
 *         description: Reaction updated successfully
 */
router.patch('/:id', authMiddleware, authorizeRole(['superadmin', 'admin']), reactionController.update);

/**
 * @swagger
 * /api/reactions/{id}:
 *   delete:
 *     summary: Delete reaction (Admin only)
 *     tags: [Reactions]
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
 *         description: Reaction deleted successfully
 */
router.delete('/:id', authMiddleware, authorizeRole(['superadmin', 'admin']), reactionController.delete);

export default router;