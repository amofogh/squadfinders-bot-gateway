import express from 'express';
import { prefilterResultController } from '../controllers/prefilterResultController.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     PrefilterResult:
 *       type: object
 *       required:
 *         - message_id
 *         - message
 *         - message_date
 *         - maybe_lfg
 *         - confidence
 *       properties:
 *         message_id:
 *           type: number
 *           description: Unique message identifier
 *         message:
 *           type: string
 *           description: The message content
 *         message_date:
 *           type: string
 *           format: date-time
 *           description: When the message was sent
 *         maybe_lfg:
 *           type: boolean
 *           description: Whether the message might be a looking for group message
 *         confidence:
 *           type: number
 *           minimum: -1
 *           maximum: 1.0
 *           description: Confidence score for the LFG classification (-1 for unknown, 0.0-1.0 for confidence)
 */

/**
 * @swagger
 * /api/prefilter-results:
 *   get:
 *     summary: Get all prefilter results
 *     tags: [Prefilter Results]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: maybe_lfg
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: min_confidence
 *         schema:
 *           type: number
 *           minimum: -1
 *           maximum: 1.0
 *       - in: query
 *         name: max_confidence
 *         schema:
 *           type: number
 *           minimum: -1
 *           maximum: 1.0
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
 *         description: List of prefilter results with pagination
 */
router.get('/', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), prefilterResultController.getAll);

/**
 * @swagger
 * /api/prefilter-results/{message_id}:
 *   get:
 *     summary: Get prefilter result by message_id
 *     tags: [Prefilter Results]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: message_id
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Prefilter result details
 *       404:
 *         description: Prefilter result not found
 */
router.get('/:message_id', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), prefilterResultController.getByMessageId);

/**
 * @swagger
 * /api/prefilter-results:
 *   post:
 *     summary: Create new prefilter result (Admin only)
 *     tags: [Prefilter Results]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PrefilterResult'
 *     responses:
 *       201:
 *         description: Prefilter result created successfully
 */
router.post('/', authMiddleware, authorizeRole(['superadmin', 'admin']), prefilterResultController.create);

/**
 * @swagger
 * /api/prefilter-results/{message_id}:
 *   put:
 *     summary: Update prefilter result by message_id (Admin only)
 *     tags: [Prefilter Results]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: message_id
 *         required: true
 *         schema:
 *           type: number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PrefilterResult'
 *     responses:
 *       200:
 *         description: Prefilter result updated successfully
 */
router.put('/:message_id', authMiddleware, authorizeRole(['superadmin', 'admin']), prefilterResultController.updateByMessageId);

/**
 * @swagger
 * /api/prefilter-results/{message_id}:
 *   patch:
 *     summary: Partially update prefilter result by message_id (Admin only)
 *     tags: [Prefilter Results]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: message_id
 *         required: true
 *         schema:
 *           type: number
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/PrefilterResult'
 *     responses:
 *       200:
 *         description: Prefilter result updated successfully
 */
router.patch('/:message_id', authMiddleware, authorizeRole(['superadmin', 'admin']), prefilterResultController.updateByMessageId);

/**
 * @swagger
 * /api/prefilter-results/{message_id}:
 *   delete:
 *     summary: Delete prefilter result by message_id (Admin only)
 *     tags: [Prefilter Results]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: message_id
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Prefilter result deleted successfully
 */
router.delete('/:message_id', authMiddleware, authorizeRole(['superadmin', 'admin']), prefilterResultController.deleteByMessageId);

export default router;