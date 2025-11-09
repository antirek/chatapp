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
 * GET /api/users
 * Get list of all users (for creating dialogs)
 * Requires authentication
 */
router.get('/', authenticate, listUsers);

/**
 * GET /api/users/me
 * Get current user profile with avatar from Chat3
 * Requires authentication
 */
router.get('/me', authenticate, getCurrentUserProfile);

/**
 * PUT /api/users/me/avatar
 * Update current user avatar
 * Body: { avatar: "data:image/png;base64,..." or "https://..." }
 * Requires authentication
 */
router.put('/me/avatar', authenticate, updateCurrentUserAvatar);

/**
 * DELETE /api/users/me/avatar
 * Delete current user avatar
 * Requires authentication
 */
router.delete('/me/avatar', authenticate, deleteCurrentUserAvatar);

/**
 * GET /api/users/:userId
 * Get user by userId (with avatar from Chat3)
 * Requires authentication
 */
router.get('/:userId', authenticate, getUserById);

export default router;

