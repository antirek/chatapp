import Chat3Client from '../services/Chat3Client.js';
import { mapOutgoingMessageType } from '../utils/messageType.js';
import Channel from '../models/Channel.js';

export async function getDialogMessages(req, res) {
  try {
    const { dialogId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const currentUserId = req.user.userId;
    console.log(`📥 [getDialogMessages] Request for dialog ${dialogId}, user ${currentUserId}, page ${page}, limit ${limit}`);

    let result;
    try {
      result = await Chat3Client.getUserDialogMessages(currentUserId, dialogId, {
        page,
        limit,
      });

      // Check if statuses exist in context or top-level (for fallback check)
      const hasStatuses = result.data && result.data.length > 0 && (
        result.data[0].context?.statuses || 
        result.data[0].statuses
      );
      
      if (result.data && result.data.length > 0 && !hasStatuses) {
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

    // Temporarily replace context.statuses with statusMatrix
    // TODO: Remove this when Chat3 API properly supports statuses
    let processedData = [];
    console.log(`📊 [getDialogMessages] Processing ${Array.isArray(result.data) ? result.data.length : 0} messages`);
    try {
      processedData = Array.isArray(result.data) ? result.data.map(message => {
        // Extract statuses from context or top-level message
        const contextStatuses = message.context?.statuses;
        const topLevelStatuses = message.statuses;
        const statusesToUse = contextStatuses || topLevelStatuses;
        
        // Remove statuses from both context and top-level
        const { statuses: _, ...restMessage } = message;
        const processedMessage = { ...restMessage };
        
        if (processedMessage.context) {
          const { statuses: __, ...restContext } = processedMessage.context;
          processedMessage.context = {
            ...restContext,
            // statuses, // Original code - temporarily disabled
            statusMatrix: statusesToUse || null, // Use statusMatrix instead of statuses
          };
        } else {
          // If no context, create one with statusMatrix
          processedMessage.context = {
            statusMatrix: statusesToUse || null,
          };
        }
        
        return processedMessage;
      }) : [];
    } catch (error) {
      console.error('❌ Error processing messages:', error.message);
      console.error('❌ Error stack:', error.stack);
      // Return original data if processing fails
      processedData = Array.isArray(result.data) ? result.data : [];
    }

    console.log(`✅ [getDialogMessages] Returning ${processedData.length} processed messages for dialog ${dialogId}`);
    return res.json({
      success: true,
      ...result,
      data: processedData,
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

    // Get channelId for business contact dialogs
    try {
      const accountId = req.user.accountId;
      if (accountId) {
        // Check if this is a business contact dialog
        const dialog = await Chat3Client.getDialog(dialogId);
        const dialogData = dialog?.data || dialog;
        const dialogType = dialogData?.meta?.type?.value || dialogData?.meta?.type || dialogData?.type;
        
        if (dialogType === 'personal_contact') {
          // Get active channel for this account
          const channel = await Channel.findOne({
            accountId,
            isActive: true,
          }).sort({ createdAt: 1 }); // Get first active channel
          
          if (channel && channel.channelId) {
            // Add channelId to message meta
            if (!messagePayload.meta) {
              messagePayload.meta = {};
            }
            messagePayload.meta.channelId = { value: channel.channelId };
            console.log(`✅ Added channelId ${channel.channelId} to message meta for dialog ${dialogId}`);
          } else {
            console.warn(`⚠️ No active channel found for account ${accountId}`);
          }
        }
      }
    } catch (channelError) {
      // Don't fail message sending if channel lookup fails
      console.warn('Failed to get channelId for message:', channelError.message);
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
    const currentUserId = req.user.userId;

    if (!['read', 'delivered'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid status. Must be "read" or "delivered"',
      });
    }

    // Get message to retrieve dialogId
    const messageResponse = await Chat3Client.getMessage(messageId);
    const message = messageResponse?.data || messageResponse;
    
    if (!message || !message.dialogId) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      });
    }

    // Use new method with user context
    const result = await Chat3Client.updateMessageStatusInContext(
      currentUserId,
      message.dialogId,
      messageId,
      status
    );

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
    const currentUserId = req.user.userId;

    // Get message to retrieve dialogId
    const messageResponse = await Chat3Client.getMessage(messageId);
    const message = messageResponse?.data || messageResponse;
    
    if (!message || !message.dialogId) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      });
    }

    // Use new method with user context
    const result = await Chat3Client.getMessageReactionsInContext(
      currentUserId,
      message.dialogId,
      messageId
    );

    return res.json({
      success: true,
      reactions: result.data || result,
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
    const currentUserId = req.user.userId;

    if (!reaction) {
      return res.status(400).json({
        success: false,
        error: 'Reaction is required',
      });
    }

    // Get message to retrieve dialogId
    const messageResponse = await Chat3Client.getMessage(messageId);
    const message = messageResponse?.data || messageResponse;
    
    if (!message || !message.dialogId) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      });
    }

    // Use new method with user context (setReaction toggles reaction)
    await Chat3Client.setReaction(
      currentUserId,
      message.dialogId,
      messageId,
      reaction
    );

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
    const currentUserId = req.user.userId;

    // Get message to retrieve dialogId
    const messageResponse = await Chat3Client.getMessage(messageId);
    const message = messageResponse?.data || messageResponse;
    
    if (!message || !message.dialogId) {
      return res.status(404).json({
        success: false,
        error: 'Message not found',
      });
    }

    // Use new method with user context (setReaction toggles reaction, so calling it again removes it)
    await Chat3Client.setReaction(
      currentUserId,
      message.dialogId,
      messageId,
      reaction
    );

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

