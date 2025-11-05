import express from 'express';
import Chat3Client from '../services/Chat3Client.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All message routes require authentication
router.use(authenticate);

/**
 * GET /api/messages/dialog/:dialogId
 * Get messages for a dialog
 */
router.get('/dialog/:dialogId', async (req, res) => {
  try {
    const { dialogId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const result = await Chat3Client.getDialogMessages(dialogId, {
      page,
      limit,
    });

    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/messages/dialog/:dialogId
 * Send message to dialog
 * Body: { content: "message text", type?: "text", meta?: {} }
 */
router.post('/dialog/:dialogId', async (req, res) => {
  try {
    const { dialogId } = req.params;
    const { content, type = 'text', meta = {} } = req.body;

    if (!content) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required',
      });
    }

    const result = await Chat3Client.createMessage(dialogId, {
      content,
      senderId: req.user.userId,
      type,
      meta,
    });

    res.status(201).json({
      success: true,
      data: result.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/messages/:messageId
 * Get message by ID
 */
router.get('/:messageId', async (req, res) => {
  try {
    const { messageId } = req.params;
    const result = await Chat3Client.getMessage(messageId);

    res.json({
      success: true,
      message: result.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/messages/:messageId/status/:status
 * Update message status (read/delivered)
 */
router.post('/:messageId/status/:status', async (req, res) => {
  try {
    const { messageId, status } = req.params;

    if (!['read', 'delivered'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be "read" or "delivered"',
      });
    }

    await Chat3Client.updateMessageStatus(messageId, req.user.userId, status);

    res.json({
      success: true,
      message: 'Status updated',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/messages/:messageId/reactions
 * Get reactions for a message
 */
router.get('/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;
    const result = await Chat3Client.getMessageReactions(messageId);

    res.json({
      success: true,
      reactions: result.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/messages/:messageId/reactions
 * Add reaction to message
 * Body: { reaction: "👍", userId: "userId" }
 */
router.post('/:messageId/reactions', async (req, res) => {
  try {
    const { messageId } = req.params;
    const { reaction } = req.body;

    if (!reaction) {
      return res.status(400).json({
        success: false,
        error: 'Reaction is required',
      });
    }

    await Chat3Client.addReaction(messageId, {
      reaction,
      userId: req.user.userId,
    });

    res.json({
      success: true,
      message: 'Reaction added',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/messages/:messageId/reactions/:reaction
 * Remove reaction from message
 */
router.delete('/:messageId/reactions/:reaction', async (req, res) => {
  try {
    const { messageId, reaction } = req.params;
    await Chat3Client.removeReaction(messageId, reaction);

    res.json({
      success: true,
      message: 'Reaction removed',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

