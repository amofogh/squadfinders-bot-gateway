import express from 'express';
import { userMessageController } from '../controllers/userMessageController.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     UserMessage:
 *       type: object
 *       required:
 *         - user_id
 *         - message_date
 *         - message
 *       properties:
 *         user_id:
 *           type: string
 *           description: User identifier
 *         username:
 *           type: string
 *           description: Username
 *         message_date:
 *           type: string
 *           format: date-time
 *           description: When the message was sent
 *         message:
 *           type: string
 *           description: The message content
 */

/**
 * @swagger
 * /api/user-messages:
 *   get:
 *     summary: Get all user messages
 *     tags: [User Messages]
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
 *         description: List of user messages with pagination
 */
router.get('/', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), userMessageController.getAll);

/**
 * @swagger
 * /api/user-messages/{user_id}:
 *   get:
 *     summary: Get user message by user_id
 *     tags: [User Messages]
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
 *         description: User message details
 *       404:
 *         description: User message not found
 */
router.get('/:user_id', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), userMessageController.getByUserId);

/**
 * @swagger
 * /api/user-messages:
 *   post:
 *     summary: Create new user message (Admin only)
 *     tags: [User Messages]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/UserMessage'
 *     responses:
 *       201:
 *         description: User message created successfully
 */
router.post('/', authMiddleware, authorizeRole(['superadmin', 'admin']), userMessageController.create);

/**
 * @swagger
 * /api/user-messages/{user_id}:
 *   put:
 *     summary: Update user message by user_id (Admin only)
 *     tags: [User Messages]
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
 *             $ref: '#/components/schemas/UserMessage'
 *     responses:
 *       200:
 *         description: User message updated successfully
 */
router.put('/:user_id', authMiddleware, authorizeRole(['superadmin', 'admin']), userMessageController.updateByUserId);

/**
 * @swagger
 * /api/user-messages/{user_id}:
 *   patch:
 *     summary: Partially update user message by user_id (Admin only)
 *     tags: [User Messages]
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
 *             $ref: '#/components/schemas/UserMessage'
 *     responses:
 *       200:
 *         description: User message updated successfully
 */
router.patch('/:user_id', authMiddleware, authorizeRole(['superadmin', 'admin']), userMessageController.updateByUserId);

/**
 * @swagger
 * /api/user-messages/{user_id}:
 *   delete:
 *     summary: Delete user message by user_id (Admin only)
 *     tags: [User Messages]
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
 *         description: User message deleted successfully
 */
router.delete('/:user_id', authMiddleware, authorizeRole(['superadmin', 'admin']), userMessageController.deleteByUserId);

export default router;