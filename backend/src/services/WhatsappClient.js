import axios from 'axios';

/**
 * WhatsApp Client for sending messages via external API

 */
class WhatsappClient {
  constructor({ url, instanceId, token }) {
    if (!url || !instanceId || !token) {
      throw new Error('WhatsappClient requires url, instanceId, and token');
    }

    this.url = url;
    this.instanceId = instanceId;
    this.token = token;

    // Create axios instance with base configuration
    // API expects token in header, not Bearer
    this.client = axios.create({
      baseURL: url,
      timeout: 15000,
      headers: {
        'Content-Type': 'application/json',
        'X-Token': token, // WhatsApp API uses X-Token header
      },
    });
  }

  /**
   * Normalize phone number for WhatsApp API
   * WhatsApp API expects phone number starting with country code (7 for Russia)
   * Removes + and ensures format is correct
   * @param {string} phone - Phone number
   * @returns {string} - Normalized phone number
   */
  normalizePhone(phone) {
    if (!phone) {
      throw new Error('Phone number is required');
    }

    // Remove all non-digit characters except leading +
    let normalized = phone.replace(/[^\d+]/g, '');

    // Remove leading +
    if (normalized.startsWith('+')) {
      normalized = normalized.substring(1);
    }

    // For Russia/Kazakhstan: ensure starts with 7
    if (normalized.startsWith('8') && normalized.length === 11) {
      normalized = '7' + normalized.substring(1);
    }

    // Ensure starts with country code
    if (!normalized.startsWith('7') && normalized.length === 10) {
      normalized = '7' + normalized;
    }

    return normalized;
  }

  /**
   * Send message to contact
   * Based on WhatsApp API: /instance{id}/sendMessage
   * 
   * @param {Object} params - Message parameters
   * @param {string} params.phone - Contact phone number (required if chatId not provided)
   * @param {string} [params.chatId] - Chat ID (required if phone not provided)
   * @param {string} params.message - Message content (body)
   * @param {string} [params.type='text'] - Message type (text, image, file, video, audio)
   * @param {string} [params.mediaUrl] - URL for media messages (for sendFile/sendMedia)
   * @param {string} [params.filename] - Filename for file messages
   * @param {string} [params.caption] - Caption for media messages
   * @param {string} [params.messageId] - Original message ID for tracking
   * @returns {Promise<Object>} - API response
   */
  async sendMessage({ phone, chatId, message, type = 'text', mediaUrl, filename, caption, messageId }) {
    try {
      // Normalize phone number if provided
      const normalizedPhone = phone ? this.normalizePhone(phone) : null;

      // Determine endpoint and payload based on message type
      let endpoint;
      let payload;

      if (type === 'text' || (!mediaUrl && type === 'text')) {
        // Text message: /instance{id}/sendMessage
        endpoint = `/instance${this.instanceId}/sendMessage`;
        payload = {
          body: message,
        };

        // Add phone or chatId (one is required)
        if (chatId) {
          payload.chatId = chatId;
        } else if (normalizedPhone) {
          payload.phone = normalizedPhone;
        } else {
          throw new Error('Either phone or chatId is required');
        }
      } else if (mediaUrl || filename) {
        // File/Media message: /instance{id}/sendFile
        endpoint = `/instance${this.instanceId}/sendFile`;
        payload = {
          body: mediaUrl || message, // URL or base64 data
          filename: filename || 'file', // Required for sendFile
        };

        // Add caption if provided
        if (caption || (type === 'text' && message)) {
          payload.caption = caption || message;
        }

        // Add phone or chatId (one is required)
        if (chatId) {
          payload.chatId = chatId;
        } else if (normalizedPhone) {
          payload.phone = normalizedPhone;
        } else {
          throw new Error('Either phone or chatId is required');
        }
      } else {
        // Fallback to text message
        endpoint = `/instance${this.instanceId}/sendMessage`;
        payload = {
          body: message,
        };

        if (chatId) {
          payload.chatId = chatId;
        } else if (normalizedPhone) {
          payload.phone = normalizedPhone;
        } else {
          throw new Error('Either phone or chatId is required');
        }
      }

      const response = await this.client.post(endpoint, payload);

      return {
        success: true,
        data: response.data,
        status: response.status,
      };
    } catch (error) {
      console.error('WhatsappClient sendMessage error:', {
        url: this.url,
        instanceId: this.instanceId,
        phone,
        chatId,
        type,
        error: error.message,
        response: error.response?.data,
        status: error.response?.status,
      });

      return {
        success: false,
        error: error.response?.data?.error || error.message,
        status: error.response?.status,
        data: error.response?.data,
      };
    }
  }

  /**
   * Get client status/health
   * @returns {Promise<Object>} - Status response
   */
  async getStatus() {
    try {
      const response = await this.client.get('/status');
      return {
        success: true,
        data: response.data,
      };
    } catch (error) {
      return {
        success: false,
        error: error.message,
      };
    }
  }
}

export default WhatsappClient;

