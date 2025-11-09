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
 * GET /api/messages/dialog/:dialogId
 * Get messages for a dialog
 * Returns messages with statuses for all participants (needed for read indicators)
 * 
 * Note: Using getUserDialogMessages for user-specific context (better performance),
 * but we still need statuses for all participants to show ✓✓ indicators.
 * The user context endpoint provides user-specific data but may not include all statuses.
 */
router.get('/dialog/:dialogId', getDialogMessages);

/**
 * POST /api/messages/dialog/:dialogId
 * Send message to dialog
 * Body: { content: "message text", type?: "text", meta?: {} }
 */
router.post('/dialog/:dialogId', sendDialogMessage);

/**
 * GET /api/messages/:messageId
 * Get message by ID
 */
router.get('/:messageId', getMessageById);

/**
 * POST /api/messages/:messageId/status/:status
 * Update message status (read/delivered)
 */
router.post('/:messageId/status/:status', updateMessageStatus);

/**
 * GET /api/messages/:messageId/reactions
 * Get reactions for a message
 */
router.get('/:messageId/reactions', getMessageReactions);

/**
 * POST /api/messages/:messageId/reactions
 * Add reaction to message
 * Body: { reaction: "👍", userId: "userId" }
 */
router.post('/:messageId/reactions', addReaction);

/**
 * DELETE /api/messages/:messageId/reactions/:reaction
 * Remove reaction from message
 */
router.delete('/:messageId/reactions/:reaction', removeReaction);

export default router;

