import express from 'express';
import {
  requestCode,
  verifyCode,
  getCurrentUser,
} from '../controllers/authController.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

/**
 * @openapi
 * /api/auth/request-code:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Request a verification code
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *             properties:
 *               phone:
 *                 type: string
 *                 example: 79990001122
 *               name:
 *                 type: string
 *                 example: Иван Иванов
 *     responses:
 *       '200':
 *         description: Verification code generated
 *       '400':
 *         description: Validation error
 */
router.post('/request-code', requestCode);

/**
 * @openapi
 * /api/auth/verify-code:
 *   post:
 *     tags:
 *       - Auth
 *     summary: Verify code and obtain JWT token
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - code
 *             properties:
 *               phone:
 *                 type: string
 *                 example: 79990001122
 *               code:
 *                 type: string
 *                 example: '1234'
 *     responses:
 *       '200':
 *         description: JWT token issued
 *       '400':
 *         description: Invalid request
 */
router.post('/verify-code', verifyCode);

/**
 * @openapi
 * /api/auth/me:
 *   get:
 *     tags:
 *       - Auth
 *     summary: Get current authenticated user
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Current user data
 *       '401':
 *         description: Unauthorized
 */
router.get('/me', authenticate, getCurrentUser);

export default router;

