import Chat3Client from '../services/Chat3Client.js';
import { mapOutgoingMessageType } from '../utils/messageType.js';

export async function getDialogMessages(req, res) {
  try {
    const { dialogId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const currentUserId = req.user.userId;

    let result;
    try {
      result = await Chat3Client.getUserDialogMessages(currentUserId, dialogId, {
        page,
        limit,
      });

      if (result.data && result.data.length > 0 && !result.data[0].statuses) {
        console.log('⚠️ User context endpoint doesn\'t return statuses, falling back to standard endpoint');
        result = await Chat3Client.getDialogMessages(dialogId, {
          page,
          limit,
        });
      }
    } catch (error) {
      console.warn('⚠️ User context endpoint failed, falling back to standard endpoint:', error.message);
      result = await Chat3Client.getDialogMessages(dialogId, {
        page,
        limit,
      });
    }

    return res.json({
      success: true,
      ...result,
      data: Array.isArray(result.data) ? result.data : [],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function sendDialogMessage(req, res) {
  try {
    const { dialogId } = req.params;
    const { content, type = 'text', meta = {}, quotedMessageId } = req.body;
    const mappedType = mapOutgoingMessageType(type);
    const trimmedContent = typeof content === 'string' ? content.trim() : '';

    const requiresContent = !mappedType || mappedType === 'internal.text' || mappedType.startsWith('system.');
    const mediaTypesRequiringUrl = new Set([
      'internal.image',
      'internal.file',
      'internal.video',
      'internal.audio',
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

    if (quotedMessageId) {
      messagePayload.quotedMessageId = quotedMessageId;
    }

    const result = await Chat3Client.createMessage(dialogId, messagePayload);

    return res.status(201).json({
      success: true,
      data: result?.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function getMessageById(req, res) {
  try {
    const { messageId } = req.params;
    const result = await Chat3Client.getMessage(messageId);

    const messageData = result?.data ? await enrichMessages([result.data], req.user) : [result.data];

    return res.json({
      success: true,
      data: messageData[0],
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function updateMessageStatus(req, res) {
  try {
    const { messageId, status } = req.params;

    if (!['read', 'delivered'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be "read" or "delivered"',
      });
    }

    const result = await Chat3Client.updateMessageStatus(messageId, req.user.userId, status);

    return res.json({
      success: true,
      data: result.data,
      message: 'Status updated',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function getMessageReactions(req, res) {
  try {
    const { messageId } = req.params;
    const result = await Chat3Client.getMessageReactions(messageId);

    return res.json({
      success: true,
      reactions: result.data,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function addReaction(req, res) {
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

    return res.json({
      success: true,
      message: 'Reaction added',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function removeReaction(req, res) {
  try {
    const { messageId, reaction } = req.params;
    await Chat3Client.removeReaction(messageId, reaction);

    return res.json({
      success: true,
      message: 'Reaction removed',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

