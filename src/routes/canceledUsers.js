import express from 'express';
import { canceledUserController } from '../controllers/canceledUserController.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     CanceledUser:
 *       type: object
 *       required:
 *         - user_id
 *       properties:
 *         user_id:
 *           type: string
 *           description: Unique user identifier
 *         username:
 *           type: string
 *           description: Username of the canceled user
 */

/**
 * @swagger
 * /api/canceled-users:
 *   get:
 *     summary: Get all canceled users
 *     tags: [Canceled Users]
 *     security:
 *       - basicAuth: []
 *     parameters:
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
 *         description: List of canceled users with pagination
 */
router.get('/', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), canceledUserController.getAll);

/**
 * @swagger
 * /api/canceled-users/is-canceled:
 *   get:
 *     summary: Check if user is canceled
 *     tags: [Canceled Users]
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
 *     responses:
 *       200:
 *         description: Returns whether user is canceled
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 is_canceled:
 *                   type: boolean
 *                 user:
 *                   $ref: '#/components/schemas/CanceledUser'
 */
router.get('/is-canceled', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), canceledUserController.isCanceled);

/**
 * @swagger
 * /api/canceled-users/{id}:
 *   get:
 *     summary: Get canceled user by ID
 *     tags: [Canceled Users]
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
 *         description: Canceled user details
 *       404:
 *         description: Canceled user not found
 */
router.get('/:id', authMiddleware, authorizeRole(['superadmin', 'admin', 'viewer']), canceledUserController.getById);

/**
 * @swagger
 * /api/canceled-users:
 *   post:
 *     summary: Create new canceled user (Admin only)
 *     tags: [Canceled Users]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CanceledUser'
 *     responses:
 *       201:
 *         description: Canceled user created successfully
 */
router.post('/', authMiddleware, authorizeRole(['superadmin', 'admin']), canceledUserController.create);

/**
 * @swagger
 * /api/canceled-users/{id}:
 *   put:
 *     summary: Update canceled user (Admin only)
 *     tags: [Canceled Users]
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
 *             $ref: '#/components/schemas/CanceledUser'
 *     responses:
 *       200:
 *         description: Canceled user updated successfully
 */
router.put('/:id', authMiddleware, authorizeRole(['superadmin', 'admin']), canceledUserController.update);

/**
 * @swagger
 * /api/canceled-users/{id}:
 *   patch:
 *     summary: Partially update canceled user (Admin only)
 *     tags: [Canceled Users]
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
 *             $ref: '#/components/schemas/CanceledUser'
 *     responses:
 *       200:
 *         description: Canceled user updated successfully
 */
router.patch('/:id', authMiddleware, authorizeRole(['superadmin', 'admin']), canceledUserController.update);

/**
 * @swagger
 * /api/canceled-users/{user_id}:
 *   delete:
 *     summary: Delete canceled user (Admin only)
 *     tags: [Canceled Users]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: user_id
 *         required: true
 *         schema:
 *           type: string
 *         description: Unique identifier of the user to delete
 *     responses:
 *       200:
 *         description: Canceled user deleted successfully
 */
router.delete('/:user_id', authMiddleware, authorizeRole(['superadmin', 'admin']), canceledUserController.delete);

export default router;
