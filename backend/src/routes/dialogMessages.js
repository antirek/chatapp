import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { getDialogMessages, sendDialogMessage } from '../controllers/messagesController.js';

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /api/dialog/{dialogId}/messages:
 *   get:
 *     tags: [Dialog Messages]
 *     summary: Get messages for dialog
 *     description: Returns messages with statuses for all participants.
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
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
 *           default: 50
 *     responses:
 *       '200':
 *         description: List of messages
 */
router.get('/:dialogId/messages', getDialogMessages);

/**
 * @openapi
 * /api/dialog/{dialogId}/messages:
 *   post:
 *     tags: [Dialog Messages]
 *     summary: Send message to dialog
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *               type:
 *                 type: string
 *               meta:
 *                 type: object
 *     responses:
 *       '201':
 *         description: Message created
 */
router.post('/:dialogId/messages', sendDialogMessage);

export default router;

