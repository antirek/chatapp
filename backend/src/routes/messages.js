import express from 'express';
import Chat3Client from '../services/Chat3Client.js';
import { authenticate } from '../middleware/auth.js';
import { mapOutgoingMessageType } from '../utils/messageType.js';

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
router.get('/dialog/:dialogId', async (req, res) => {
  try {
    const { dialogId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const currentUserId = req.user.userId;

    // Use user context endpoint for better performance and user-specific data
    // This returns messages with user-specific context
    let result;
    try {
      result = await Chat3Client.getUserDialogMessages(currentUserId, dialogId, {
        page,
        limit,
      });
      
      // Check if statuses for all participants are present (needed for ✓✓ indicators)
      // If not, fall back to standard endpoint which returns all statuses
      if (result.data && result.data.length > 0 && !result.data[0].statuses) {
        console.log(`⚠️ User context endpoint doesn't return statuses, falling back to standard endpoint`);
        result = await Chat3Client.getDialogMessages(dialogId, {
          page,
          limit,
        });
      }
    } catch (error) {
      // Fall back to standard endpoint if user context endpoint fails
      console.warn(`⚠️ User context endpoint failed, falling back to standard endpoint:`, error.message);
      result = await Chat3Client.getDialogMessages(dialogId, {
        page,
        limit,
      });
    }

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
    const mappedType = mapOutgoingMessageType(type);
    const trimmedContent = typeof content === 'string' ? content.trim() : '';

    const requiresContent = !mappedType || mappedType === 'internal.text' || mappedType.startsWith('system.');
    const mediaTypesRequiringUrl = new Set([
      'internal.image',
      'internal.file',
      'internal.video',
      'internal.audio'
    ]);

    let effectiveContent = trimmedContent;

    if (!effectiveContent && mediaTypesRequiringUrl.has(mappedType)) {
      effectiveContent = meta?.originalName || `[${mappedType.split('.').pop() || 'attachment'}]`;
    }

    if (requiresContent && !effectiveContent) {
      return res.status(400).json({
        success: false,
        error: 'Message content is required',
      });
    }

    if (mediaTypesRequiringUrl.has(mappedType) && !meta?.url) {
      return res.status(400).json({
        success: false,
        error: 'Media messages require meta.url',
      });
    }

    const messagePayload = {
      senderId: req.user.userId,
      type: mappedType,
      meta,
    };

    if (effectiveContent) {
      messagePayload.content = effectiveContent;
    }

    const result = await Chat3Client.createMessage(dialogId, messagePayload);

    // ✅ Updates come ONLY through RabbitMQ from Chat3 Update Worker
    // No fallback - pure RabbitMQ architecture

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
      data: result.data, // Consistent with other routes
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

    const result = await Chat3Client.updateMessageStatus(messageId, req.user.userId, status);

    res.json({
      success: true,
      data: result.data, // Return status data (messageId, userId, status, etc.)
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

