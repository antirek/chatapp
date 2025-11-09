import express from 'express';
import {
  requestCode,
  verifyCode,
  getCurrentUser,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/request-code
 * Request verification code
 * Body: { phone: "79XXXXXXXXX", name?: "User Name" }
 */
router.post('/request-code', requestCode);

/**
 * POST /api/auth/verify-code
 * Verify code and get JWT token
 * Body: { phone: "79XXXXXXXXX", code: "1234" }
 */
router.post('/verify-code', verifyCode);

/**
 * GET /api/auth/me
 * Get current user info
 * Requires authentication
 */
router.get('/me', authenticate, getCurrentUser);

export default router;

