import express from 'express';
import AuthService from '../services/AuthService.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * POST /api/auth/request-code
 * Request verification code
 * Body: { phone: "79XXXXXXXXX", name?: "User Name" }
 */
router.post('/request-code', async (req, res) => {
  try {
    const { phone, name } = req.body;

    if (!phone) {
      return res.status(400).json({
        success: false,
        error: 'Phone number is required',
      });
    }

    const result = await AuthService.requestCode(phone, name);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/auth/verify-code
 * Verify code and get JWT token
 * Body: { phone: "79XXXXXXXXX", code: "1234" }
 */
router.post('/verify-code', async (req, res) => {
  try {
    const { phone, code } = req.body;

    if (!phone || !code) {
      return res.status(400).json({
        success: false,
        error: 'Phone and code are required',
      });
    }

    const result = await AuthService.verifyCode(phone, code);
    res.json(result);
  } catch (error) {
    res.status(400).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/auth/me
 * Get current user info
 * Requires authentication
 */
router.get('/me', authenticate, async (req, res) => {
  res.json({
    success: true,
    user: req.user,
  });
});

export default router;

