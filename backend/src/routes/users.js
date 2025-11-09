import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  listUsers,
  getCurrentUserProfile,
  updateCurrentUserAvatar,
  deleteCurrentUserAvatar,
  getUserById,
} from '../controllers/usersController.js';

const router = express.Router();

/**
 * @openapi
 * /api/users:
 *   get:
 *     tags: [Users]
 *     summary: List users
 *     description: Returns list of users excluding current user.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       '200':
 *         description: List of users
 */
router.get('/', authenticate, listUsers);

/**
 * @openapi
 * /api/users/me:
 *   get:
 *     tags: [Users]
 *     summary: Get current user profile
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Current user data
 */
router.get('/me', authenticate, getCurrentUserProfile);

/**
 * @openapi
 * /api/users/me/avatar:
 *   put:
 *     tags: [Users]
 *     summary: Update current user's avatar
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - avatar
 *             properties:
 *               avatar:
 *                 type: string
 *                 description: Base64 data URL or HTTP(S) link
 *     responses:
 *       '200':
 *         description: Avatar updated
 */
router.put('/me/avatar', authenticate, updateCurrentUserAvatar);

/**
 * @openapi
 * /api/users/me/avatar:
 *   delete:
 *     tags: [Users]
 *     summary: Delete current user's avatar
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Avatar removed
 */
router.delete('/me/avatar', authenticate, deleteCurrentUserAvatar);

/**
 * @openapi
 * /api/users/{userId}:
 *   get:
 *     tags: [Users]
 *     summary: Get user by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: User data
 *       '404':
 *         description: User not found
 */
router.get('/:userId', authenticate, getUserById);

export default router;

