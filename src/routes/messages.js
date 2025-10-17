// routes/messages.js
import express from 'express';
import { messageController } from '../controllers/messageController.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Message:
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
 *         is_valid:
 *           type: boolean
 *           description: Whether the message is considered valid (e.g., a proper LFG message)
 *         is_lfg:
 *           type: boolean
 *           description: Whether this is a looking for group message
 *           default: false
 *         reason:
 *           type: string
 *           description: Reason for the AI classification
 *         ai_status:
 *           type: string
 *           enum: [pending, processing, completed, failed, expired]
 *           default: pending
 *           description: Current AI processing status
 */

/**
 * @swagger
 * /api/messages:
 *   get:
 *     summary: Get all messages
 *     tags: [Messages]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: group_username
 *         schema:
 *           type: string
 *       - in: query
 *         name: sender_username
 *         schema:
 *           type: string
 *       - in: query
 *         name: is_valid
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: is_lfg
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: ai_status
 *         schema:
 *           type: string
 *           enum: [pending, processing, completed, failed, expired]
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
 *         description: List of messages with pagination
 */
router.get('/', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), messageController.getAll);

/**
 * @swagger
 * /api/messages/valid-since:
 *   get:
 *     summary: Get valid messages since a given timestamp
 *     tags: [Messages]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: timestamp
 *         required: true
 *         schema:
 *           type: string
 *           format: date-time
 *         example: "2025-09-01T18:00:00.000Z"
 *         description: The ISO 8601 timestamp to fetch messages from.
 *     responses:
 *       200:
 *         description: A list of valid messages since the provided timestamp.
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *       400:
 *         description: Invalid or missing timestamp.
 */
router.get('/valid-since', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), messageController.getValidSince);

/**
 * @swagger
 * /api/messages/pending:
 *   get:
 *     summary: Get pending messages for AI processing (Admin only)
 *     tags: [Messages]
 *     security:
 *       - basicAuth: []
 *     description: Returns messages with pending AI status that are less than the configured expiry window old, sorted by creation date (oldest first). Automatically marks returned messages as 'processing'.
 *     parameters:
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *           maximum: 100
 *         description: Maximum number of messages to return
 *     responses:
 *       200:
 *         description: List of unprocessed messages marked as processing
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 data:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Message'
 *                 count:
 *                   type: integer
 *                   description: Number of messages returned
 */
router.get('/pending', authMiddleware, authorizeRole(['superadmin', 'admin']), messageController.getPending);

/**
 * @swagger
 * /api/messages/{id}:
 *   get:
 *     summary: Get message by ID
 *     tags: [Messages]
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
 *         description: Message details
 *       404:
 *         description: Message not found
 */
router.get('/:id', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), messageController.getById);

/**
 * @swagger
 * /api/messages:
 *   post:
 *     summary: Create new message (Admin only)
 *     tags: [Messages]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/Message'
 *     responses:
 *       201:
 *         description: Message created successfully
 */
router.post('/', authMiddleware, authorizeRole(['superadmin', 'admin']), messageController.create);

/**
 * @swagger
 * /api/messages/{id}:
 *   put:
 *     summary: Update message (Admin only)
 *     tags: [Messages]
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
 *             $ref: '#/components/schemas/Message'
 *     responses:
 *       200:
 *         description: Message updated successfully
 */
router.put('/:id', authMiddleware, authorizeRole(['superadmin', 'admin']), messageController.update);

/**
 * @swagger
 * /api/messages/{id}:
 *   patch:
 *     summary: Partially update message (Admin only)
 *     tags: [Messages]
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
 *             $ref: '#/components/schemas/Message'
 *     responses:
 *       200:
 *         description: Message updated successfully
 */
router.patch('/:id', authMiddleware, authorizeRole(['superadmin', 'admin']), messageController.update);

/**
 * @swagger
 * /api/messages/{id}:
 *   delete:
 *     summary: Delete message (Admin only)
 *     tags: [Messages]
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
 *         description: Message deleted successfully
 */
router.delete('/:id', authMiddleware, authorizeRole(['superadmin', 'admin']), messageController.delete);

export default router;