// routes/adminUsers.js
import express from 'express';
import { adminUserController } from '../controllers/adminUserController.js';
import { authMiddleware, authorizeRole } from '../middleware/auth.js';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     AdminUser:
 *       type: object
 *       required:
 *         - email
 *         - password
 *         - role
 *       properties:
 *         email:
 *           type: string
 *           format: email
 *         password:
 *           type: string
 *           minLength: 6
 *         role:
 *           type: string
*           enum: [superadmin, admin, viewer]
 */

/**
 * @swagger
 * /api/admin-users:
 *   get:
 *     summary: Get all admin users
 *     tags: [Admin Users]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: query
 *         name: role
 *         schema:
 *           type: string
 *           enum: [admin, viewer]
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
 *         description: List of admin users with pagination
 */
router.get('/', authMiddleware, authorizeRole(['superadmin']), adminUserController.getAll);

/**
 * @swagger
 * /api/admin-users/{email}:
 *   get:
 *     summary: Get admin user by email (SuperAdmin only)
 *     tags: [Admin Users]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *     responses:
 *       200:
 *         description: Admin user details
 *       404:
 *         description: Admin user not found
 */
router.get('/:email', authMiddleware, authorizeRole(['superadmin']), adminUserController.getByEmail);

/**
 * @swagger
 * /api/admin-users:
 *   post:
*     summary: Create new admin user (SuperAdmin only)
 *     tags: [Admin Users]
 *     security:
 *       - basicAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminUser'
 *     responses:
 *       201:
 *         description: Admin user created successfully
 */
router.post('/', authMiddleware, authorizeRole(['superadmin']), adminUserController.create);

/**
 * @swagger
 * /api/admin-users/{email}:
 *   put:
 *     summary: Update admin user by email (SuperAdmin only)
 *     tags: [Admin Users]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminUser'
 *     responses:
 *       200:
 *         description: Admin user updated successfully
 */
router.put('/:email', authMiddleware, authorizeRole(['superadmin']), adminUserController.updateByEmail);

/**
 * @swagger
 * /api/admin-users/{email}:
 *   patch:
 *     summary: Partially update admin user by email (SuperAdmin only)
 *     tags: [Admin Users]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AdminUser'
 *     responses:
 *       200:
 *         description: Admin user updated successfully
 */
router.patch('/:email', authMiddleware, authorizeRole(['superadmin']), adminUserController.updateByEmail);

/**
 * @swagger
 * /api/admin-users/{email}:
 *   delete:
 *     summary: Delete admin user by email (SuperAdmin only)
 *     tags: [Admin Users]
 *     security:
 *       - basicAuth: []
 *     parameters:
 *       - in: path
 *         name: email
 *         required: true
 *         schema:
 *           type: string
 *           format: email
 *     responses:
 *       200:
 *         description: Admin user deleted successfully
 */
router.delete('/:email', authMiddleware, authorizeRole(['superadmin']), adminUserController.deleteByEmail);

export default router;
