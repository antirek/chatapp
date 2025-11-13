import Channel from '../models/Channel.js';
import Service from '../models/Service.js';
import Contact from '../models/Contact.js';
import Chat3Client from '../services/Chat3Client.js';
import WhatsappClient from '../services/WhatsappClient.js';

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
    try {
      // Only process message.create events
      if (update.eventType !== 'message.create') {
        return;
      }

      const message = update.data;
      if (!message) {
        return;
      }

      const messageId = message.messageId || message._id;
      if (!messageId) {
        return;
      }

      // Avoid processing the same message twice
      if (this.processedMessages.has(messageId)) {
        return;
      }

      // Check if this is an outgoing message from a user
      const senderId = message.senderId;
      if (!senderId || !senderId.startsWith('usr_')) {
        // Not from a user, skip
        return;
      }

      // Get dialog to verify it's a business contact dialog
      const dialogId = message.dialogId || update.dialogId || update.entityId;
      if (!dialogId) {
        return;
      }

      // Try to get dialog data from update first (if available)
      // Chat3 may include dialog data in update.dialog or update.data.dialog
      let dialogData = update.dialog || update.data?.dialog || null;
      let dialogType = null;
      let contactId = null;

      // If dialog data is in update, use it (no API call needed)
      if (dialogData) {
        dialogType = dialogData?.meta?.type?.value || dialogData?.meta?.type || dialogData?.type;
        contactId = dialogData?.meta?.contactId?.value || dialogData?.meta?.contactId;
      } else {
        // Fallback: fetch dialog from API only if not in update
        try {
          const dialog = await Chat3Client.getDialog(dialogId);
          dialogData = dialog?.data || dialog;
          dialogType = dialogData?.meta?.type?.value || dialogData?.meta?.type || dialogData?.type;
          contactId = dialogData?.meta?.contactId?.value || dialogData?.meta?.contactId;
        } catch (error) {
          console.error(`❌ Failed to fetch dialog ${dialogId}:`, error.message);
          return;
        }
      }

      // Verify dialog type and get contactId
      try {
        // Check if dialog is personal_contact type
        if (dialogType !== 'personal_contact') {
          // Not a business contact dialog
          return;
        }

        if (!contactId) {
          console.warn(`⚠️ Dialog ${dialogId} is personal_contact but has no contactId`);
          return;
        }

        // Check if message has channelId in meta
        const channelId = message.meta?.channelId?.value || message.meta?.channelId;
        if (!channelId) {
          // No channelId, cannot send message
          console.warn(`⚠️ Message ${messageId} has no channelId in meta`);
          return;
        }

        // Get contact information
        const contact = await Contact.findOne({ contactId });
        if (!contact) {
          console.warn(`⚠️ Contact ${contactId} not found in database`);
          return;
        }

        // Get channel information
        const channel = await Channel.findOne({ channelId });
        if (!channel) {
          console.warn(`⚠️ Channel ${channelId} not found in database`);
          return;
        }

        if (!channel.isActive) {
          console.warn(`⚠️ Channel ${channelId} is not active`);
          return;
        }

        // Get service information for this channel type
        const service = await Service.findOne({
          type: channel.type,
          isActive: true,
        });

        if (!service) {
          console.warn(`⚠️ No active service found for type ${channel.type}`);
          return;
        }

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
      } catch (error) {
        console.error(`❌ Error processing message ${messageId}:`, error.message);
        console.error('Error stack:', error.stack);
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
      const messageContent = message.content || '';
      const messageType = message.type || 'text';

      // Create WhatsappClient instance
      const client = new WhatsappClient({
        url: service.apiUrl,
        instanceId: channel.instanceId,
        token: channel.token,
      });

      // Prepare message parameters
      const messageParams = {
        phone: contact.phone,
        message: messageContent,
        type: this.mapMessageType(messageType),
        messageId: message.messageId || message._id, // For tracking
      };

      // Add media URL if present
      if (message.meta?.url) {
        messageParams.mediaUrl = message.meta.url;
      }

      // Add filename for file messages (extract from URL or use default)
      if (messageParams.mediaUrl && messageType !== 'text') {
        // Try to extract filename from URL
        try {
          const url = new URL(messageParams.mediaUrl);
          const pathname = url.pathname;
          const filenameFromUrl = pathname.split('/').pop();
          if (filenameFromUrl && filenameFromUrl.includes('.')) {
            messageParams.filename = filenameFromUrl;
          } else {
            // Default filename based on message type
            const extension = this.getFileExtension(messageType);
            messageParams.filename = `file.${extension}`;
          }
        } catch (e) {
          // If URL parsing fails, use default filename
          const extension = this.getFileExtension(messageType);
          messageParams.filename = `file.${extension}`;
        }
      }

      // Add caption if message has content and is a media message
      if (messageParams.mediaUrl && messageContent) {
        messageParams.caption = messageContent;
      }

      // Send message via client
      const result = await client.sendMessage(messageParams);

      console.log(`📤 Message sent via ${channel.type} channel:`, {
        contactId: contact.contactId,
        channelId: channel.channelId,
        serviceUrl: service.apiUrl,
        success: result.success,
        status: result.status,
      });

      return result;
    } catch (error) {
      console.error(`❌ Failed to send message via channel ${channel.channelId}:`, {
        error: error.message || error.error,
        response: error.data,
        status: error.status,
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

