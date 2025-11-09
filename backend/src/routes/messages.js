import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getDialogMessages,
  sendDialogMessage,
  getMessageById,
  updateMessageStatus,
  getMessageReactions,
  addReaction,
  removeReaction,
} from '../controllers/messagesController.js';

const router = express.Router();

// All message routes require authentication
router.use(authenticate);

/**
 * @openapi
 * /api/messages/dialog/{dialogId}:
 *   get:
 *     tags: [Messages]
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
router.get('/dialog/:dialogId', getDialogMessages);

/**
 * @openapi
 * /api/messages/dialog/{dialogId}:
 *   post:
 *     tags: [Messages]
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
router.post('/dialog/:dialogId', sendDialogMessage);

/**
 * @openapi
 * /api/messages/{messageId}:
 *   get:
 *     tags: [Messages]
 *     summary: Get message by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Message data
 *       '404':
 *         description: Message not found
 */
router.get('/:messageId', getMessageById);

/**
 * @openapi
 * /api/messages/{messageId}/status/{status}:
 *   post:
 *     tags: [Messages]
 *     summary: Update message status
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: status
 *         required: true
 *         schema:
 *           type: string
 *           enum: [read, delivered]
 *     responses:
 *       '200':
 *         description: Status updated
 */
router.post('/:messageId/status/:status', updateMessageStatus);

/**
 * @openapi
 * /api/messages/{messageId}/reactions:
 *   get:
 *     tags: [Messages]
 *     summary: Get reactions for message
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Reactions list
 */
router.get('/:messageId/reactions', getMessageReactions);

/**
 * @openapi
 * /api/messages/{messageId}/reactions:
 *   post:
 *     tags: [Messages]
 *     summary: Add reaction to message
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - reaction
 *             properties:
 *               reaction:
 *                 type: string
 *                 example: "👍"
 *     responses:
 *       '200':
 *         description: Reaction added
 */
router.post('/:messageId/reactions', addReaction);

/**
 * @openapi
 * /api/messages/{messageId}/reactions/{reaction}:
 *   delete:
 *     tags: [Messages]
 *     summary: Remove reaction from message
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: reaction
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Reaction removed
 */
router.delete('/:messageId/reactions/:reaction', removeReaction);

export default router;

