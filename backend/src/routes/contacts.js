import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { createBusinessContact } from '../controllers/contactsController.js';

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /api/contacts:
 *   post:
 *     tags: [Contacts]
 *     summary: Create a business contact and associated dialog
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *                 pattern: '^79\d{9}$'
 *     responses:
 *       '200':
 *         description: Contact and dialog created successfully
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized
 */
router.post('/', createBusinessContact);

export default router;

