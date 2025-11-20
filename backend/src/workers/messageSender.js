import Channel from '../models/Channel.js';
import Service from '../models/Service.js';
import Contact from '../models/Contact.js';

import Chat3Client from '../services/Chat3Client.js';
import { WhatsAppApiClient } from '../services/whatsapp-api-client.js';
import { normalizeChat3Update } from '../utils/updateNormalizer.js';

/**
 * Message Sender Worker
 * Processes outgoing messages to business contacts and sends them via channels
 */
class MessageSenderWorker {
  constructor() {
    this.isProcessing = false;
    this.processedMessages = new Set(); // Track processed messages to avoid duplicates
  }

  /**
   * Initialize worker - subscribe to message updates
   */
  async initialize(rabbitmqConsumer) {
    try {
      console.log('📤 Message Sender Worker: Initializing...');
      console.log('✅ Message Sender Worker: Initialized (will process messages from RabbitMQ queue)');
    } catch (error) {
      console.error('❌ Failed to initialize Message Sender Worker:', error);
      throw error;
    }
  }

  /**
   * Process message update
   * Called when a new message is created
   */
  async processMessage(update) {
    const normalizedUpdate = normalizeChat3Update(update);
    const envelope = normalizedUpdate?.data || {};
    const eventType = normalizedUpdate?.eventType;

    try {
      // Log received update data
      console.log('📥 Received update:', JSON.stringify({
        eventType,
        entityId: normalizedUpdate.entityId,
        userId: normalizedUpdate.userId,
        includedSections: envelope?.context?.includedSections,
        dialogId: normalizedUpdate.dialogId,
        hasDialog: !!envelope.dialog,
      }, null, 2));

      // Check if update is for a business contact (cnt_...)
      // Only process updates intended for business contacts, not for regular users (usr_...)
      if (!normalizedUpdate.userId || !normalizedUpdate.userId.startsWith('cnt_')) {
        console.log(`⏭️  Update is not for a business contact (userId: ${normalizedUpdate.userId || 'missing'})`);
        return;
      }

      // Only process message.create events
      if (eventType !== 'message.create') {
        console.log(`⏭️  Skipping event type: ${eventType}`);
        return;
      }

      const message = envelope.message;
      if (!message) {
        console.log('⏭️  No message data in update');
        return;
      }

      const messageId = message.messageId || message._id;
      if (!messageId) {
        console.log('⏭️  No messageId found in message');
        return;
      }

      // Avoid processing the same message twice
      if (this.processedMessages.has(messageId)) {
        console.log(`⏭️  Message ${messageId} already processed, skipping`);
        return;
      }

      // Check if this is an outgoing message from a user or bot (bot_classify)
      const senderId = message.senderId;
      const isFromUser = senderId && senderId.startsWith('usr_');
      const isFromClassifyBot = senderId === 'bot_classify';
      
      if (!isFromUser && !isFromClassifyBot) {
        // Not from a user or classify bot, skip
        console.log(`⏭️  Message ${messageId} is not from a user or classify bot (senderId: ${senderId})`);
        return;
      }

      // START: Begin processing
      console.log(`\n🚀 [START] Processing message ${messageId}`);
      console.log('📋 Message data:', JSON.stringify({
        messageId,
        senderId,
        dialogId: message.dialogId,
        type: message.type,
        content: message.content?.substring(0, 100) + (message.content?.length > 100 ? '...' : ''),
        meta: message.meta,
      }, null, 2));

      // Get dialog to verify it's a business contact dialog
      const dialogId =
        message.dialogId ||
        normalizedUpdate.dialogId ||
        envelope.context?.dialogId ||
        normalizedUpdate.entityId;
      if (!dialogId) {
        console.log(`⏭️  No dialogId found for message ${messageId}`);
        console.log(`🏁 [END] Processing message ${messageId} - SKIPPED (no dialogId)`);
        return;
      }

      console.log(`📂 Dialog ID: ${dialogId}`);

      // Try to get dialog data from the envelope first (if available)
      let dialogData = envelope.dialog || null;
      let dialogType = null;
      let contactId = null;

      // If dialog data is in update, use it (no API call needed)
      if (dialogData) {
        console.log('📂 Using dialog data from update');
        dialogType = dialogData?.meta?.type?.value || dialogData?.meta?.type || dialogData?.type;
        contactId = dialogData?.meta?.contactId?.value || dialogData?.meta?.contactId;
      } else {
        // Fallback: fetch dialog from API only if not in update
        console.log(`📂 Fetching dialog ${dialogId} from API...`);
        try {
          const dialog = await Chat3Client.getDialog(dialogId);
          dialogData = dialog?.data || dialog;
          dialogType = dialogData?.meta?.type?.value || dialogData?.meta?.type || dialogData?.type;
          contactId = dialogData?.meta?.contactId?.value || dialogData?.meta?.contactId;
          console.log(`📂 Dialog fetched: type=${dialogType}, contactId=${contactId}`);
        } catch (error) {
          console.error(`❌ Failed to fetch dialog ${dialogId}:`, error.message);
          console.log(`🏁 [END] Processing message ${messageId} - FAILED (dialog fetch error)`);
          return;
        }
      }

      // Verify dialog type and get contactId
      try {
        // Check if dialog is personal_contact type
        if (dialogType !== 'personal_contact') {
          // Not a business contact dialog
          console.log(`⏭️  Dialog type is ${dialogType}, not personal_contact`);
          console.log(`🏁 [END] Processing message ${messageId} - SKIPPED (not personal_contact)`);
          return;
        }

        if (!contactId) {
          console.warn(`⚠️ Dialog ${dialogId} is personal_contact but has no contactId`);
          console.log(`🏁 [END] Processing message ${messageId} - SKIPPED (no contactId)`);
          return;
        }


        // Check if message has channelId in meta
        const channelId = message.meta?.channelId?.value || message.meta?.channelId;
        if (!channelId) {
          // No channelId, cannot send message
          console.warn(`⚠️ Message ${messageId} has no channelId in meta`);
          console.log(`🏁 [END] Processing message ${messageId} - SKIPPED (no channelId)`);
          return;
        }

        console.log(`📊 Processing data:`, JSON.stringify({
          messageId,
          dialogId,
          dialogType,
          contactId,
          isBusinessContact: contactId.startsWith('cnt_'),
          channelId,
        }, null, 2));

        // Get contact information
        const contact = await Contact.findOne({ contactId });
        if (!contact) {
          console.warn(`⚠️ Contact ${contactId} not found in database`);
          console.log(`🏁 [END] Processing message ${messageId} - SKIPPED (contact not found)`);
          return;
        }

        console.log(`👤 Contact data:`, JSON.stringify({
          contactId: contact.contactId,
          name: contact.name,
          phone: contact.phone,
        }, null, 2));

        // Get channel information
        const channel = await Channel.findOne({ channelId });
        if (!channel) {
          console.warn(`⚠️ Channel ${channelId} not found in database`);
          console.log(`🏁 [END] Processing message ${messageId} - SKIPPED (channel not found)`);
          return;
        }

        if (!channel.isActive) {
          console.warn(`⚠️ Channel ${channelId} is not active`);
          console.log(`🏁 [END] Processing message ${messageId} - SKIPPED (channel inactive)`);
          return;
        }

        console.log(`📡 Channel data:`, JSON.stringify({
          channelId: channel.channelId,
          type: channel.type,
          instanceId: channel.instanceId,
          isActive: channel.isActive,
        }, null, 2));

        // Get service information for this channel type
        const service = await Service.findOne({
          type: channel.type,
          isActive: true,
        });

        if (!service) {
          console.warn(`⚠️ No active service found for type ${channel.type}`);
          console.log(`🏁 [END] Processing message ${messageId} - SKIPPED (service not found)`);
          return;
        }

        console.log(`🔧 Service data:`, JSON.stringify({
          serviceId: service.serviceId,
          type: service.type,
          apiUrl: service.apiUrl,
          isActive: service.isActive,
        }, null, 2));

        // Mark message as processed
        this.processedMessages.add(messageId);

        // Send message via channel
        await this.sendMessageViaChannel({
          message,
          contact,
          channel,
          service,
        });

        console.log(`✅ Message ${messageId} sent to contact ${contactId} via channel ${channelId}`);
        console.log(`🏁 [END] Processing message ${messageId} - SUCCESS\n`);
      } catch (error) {
        console.error(`❌ Error processing message ${messageId}:`, error.message);
        console.error('Error stack:', error.stack);
        console.log(`🏁 [END] Processing message ${messageId} - FAILED\n`);
        // Remove from processed set to allow retry
        this.processedMessages.delete(messageId);
      }
    } catch (error) {
      console.error('❌ Error in processMessage:', error);
    }
  }

  /**
   * Send message via channel API
   */
  async sendMessageViaChannel({ message, contact, channel, service }) {
    try {
      console.log(`📤 [SEND START] Sending message via ${channel.type} channel`);
      
      const messageContent = message.content || '';
      const messageType = message.type || 'text';
      const mappedType = this.mapMessageType(messageType);

      console.log(`📝 Message details:`, JSON.stringify({
        type: messageType,
        mappedType,
        contentLength: messageContent.length,
        contentPreview: messageContent.substring(0, 100) + (messageContent.length > 100 ? '...' : ''),
      }, null, 2));

      // Create WhatsAppApiClient instance
      const client = new WhatsAppApiClient(channel.instanceId, channel.token);

      // Normalize phone number (remove + and spaces)
      const phone = contact.phone.replace(/[+\s]/g, '');
      console.log(`📱 Phone: ${contact.phone} -> ${phone}`);

      let result;

      // Send text message or file based on message type
      if (mappedType === 'text') {
        // Send text message
        console.log(`📤 Sending text message to ${phone}...`);
        result = await client.sendMessage(phone, messageContent);
      } else {
        // Send file/media message
        // Note: sendFile currently only accepts phone and text
        // filename and caption are hardcoded as empty strings in the client
        // If needed, the client should be updated to accept these parameters
        console.log(`📤 Sending file/media message to ${phone}...`);
        result = await client.sendFile(phone, messageContent);
      }

      console.log(`📤 [SEND END] Message sent via ${channel.type} channel:`, JSON.stringify({
        contactId: contact.contactId,
        channelId: channel.channelId,
        serviceUrl: service.apiUrl,
        messageType: mappedType,
        result,
      }, null, 2));

      return result;
    } catch (error) {
      console.error(`❌ [SEND END] Failed to send message via channel ${channel.channelId}:`, {
        error: error.message || error.error,
        response: error.response?.data || error.data,
        status: error.response?.status || error.status,
      });
      throw error;
    }
  }

  /**
   * Map internal message type to channel API message type
   */
  mapMessageType(internalType) {
    // Map Chat3 message types to channel API types
    if (internalType === 'internal.image' || internalType?.includes('image')) {
      return 'image';
    }
    if (internalType === 'internal.file' || internalType?.includes('file')) {
      return 'file';
    }
    if (internalType === 'internal.video' || internalType?.includes('video')) {
      return 'video';
    }
    if (internalType === 'internal.audio' || internalType?.includes('audio')) {
      return 'audio';
    }
    return 'text';
  }

  /**
   * Get file extension based on message type
   * @param {string} messageType - Message type
   * @returns {string} - File extension
   */
  getFileExtension(messageType) {
    const typeMap = {
      'image': 'jpg',
      'video': 'mp4',
      'audio': 'mp3',
      'file': 'bin',
    };
    return typeMap[messageType] || 'bin';
  }

  /**
   * Clean up processed messages cache (periodic cleanup)
   */
  cleanupProcessedCache() {
    // Keep only last 1000 processed message IDs
    if (this.processedMessages.size > 1000) {
      const array = Array.from(this.processedMessages);
      this.processedMessages = new Set(array.slice(-1000));
    }
  }
}

// Create singleton instance
const messageSenderWorker = new MessageSenderWorker();

export default messageSenderWorker;

