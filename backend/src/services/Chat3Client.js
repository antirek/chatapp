import axios from 'axios';
import axiosLogger from 'axios-logger';
import config from '../config/index.js';

/**
 * Chat3 API Client
 * 
 * This client implements methods based on Chat3 OpenAPI specification.
 * Some legacy methods are marked as @deprecated but kept for backward compatibility.
 * New methods follow the user-context pattern: /api/users/{userId}/dialogs/{dialogId}/...
 * 
 * API Documentation: http://localhost:3000/api-docs/
 */
class Chat3Client {
  constructor() {
    this.client = axios.create({
      baseURL: config.chat3.apiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Add API key if provided
    if (config.chat3.apiKey) {
      this.client.defaults.headers.common['X-API-Key'] = config.chat3.apiKey;
      console.log('🔑 [Chat3Client] API Key configured:', config.chat3.apiKey.substring(0, 20) + '...');
    } else {
      console.warn('⚠️  [Chat3Client] No API key provided!');
    }

    // Add logging in development
    if (config.nodeEnv === 'development') {
      this.client.interceptors.request.use(
        axiosLogger.requestLogger,
        axiosLogger.errorLogger
      );
      this.client.interceptors.response.use(
        axiosLogger.responseLogger,
        axiosLogger.errorLogger
      );
    }
  }

  // ==================== DIALOGS ====================

  /**
   * Get all dialogs with filtering
   */
  async getDialogs(params = {}) {
    const response = await this.client.get('/dialogs', { params });
    return response.data;
  }

  /**
   * Create new dialog
   */
  async createDialog(data) {
    const response = await this.client.post('/dialogs', data);
    return response.data;
  }

  /**
   * Get dialog by ID
   */
  async getDialog(dialogId, params = {}) {
    const response = await this.client.get(`/dialogs/${dialogId}`, { params });
    return response.data;
  }

  /**
   * Get dialog members list
   */
  async getDialogMembers(dialogId, params = {}) {
    const response = await this.client.get(`/dialogs/${dialogId}/members`, { params });
    return response.data;
  }

  /**
   * Delete dialog
   */
  async deleteDialog(dialogId) {
    const response = await this.client.delete(`/dialogs/${dialogId}`);
    return response.data;
  }

  /**
   * Get user's dialogs with pagination
   */
  async getUserDialogs(userId, params = {}) {
    const response = await this.client.get(`/users/${userId}/dialogs`, { params });
    return response.data;
  }

  // ==================== MESSAGES ====================

  /**
   * Get messages for a dialog
   */
  async getDialogMessages(dialogId, params = {}) {
    const response = await this.client.get(`/dialogs/${dialogId}/messages`, { params });
    return response.data;
  }

  /**
   * Get messages for a dialog in user context
   * Returns messages with user-specific context data
   * Note: Messages include statuses array with all participants' statuses
   */
  async getUserDialogMessages(userId, dialogId, params = {}) {
    const response = await this.client.get(`/users/${userId}/dialogs/${dialogId}/messages`, { params });
    return response.data;
  }

  /**
   * Create new message in dialog
   */
  async createMessage(dialogId, data) {
    const response = await this.client.post(`/dialogs/${dialogId}/messages`, data);
    return response.data;
  }

  /**
   * Get message by ID
   */
  async getMessage(messageId) {
    const response = await this.client.get(`/messages/${messageId}`);
    return response.data;
  }

  /**
   * Get single message in context of specific user
   * GET /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}
   */
  async getUserMessage(userId, dialogId, messageId) {
    const response = await this.client.get(`/users/${userId}/dialogs/${dialogId}/messages/${messageId}`);
    return response.data;
  }

  /**
   * Update message content
   * PUT /api/messages/{messageId}
   */
  async updateMessage(messageId, data) {
    const response = await this.client.put(`/messages/${messageId}`, data);
    return response.data;
  }

  /**
   * Get all messages with filtering
   */
  async getMessages(params = {}) {
    const response = await this.client.get('/messages', { params });
    return response.data;
  }

  // ==================== DIALOG MEMBERS ====================

  /**
   * Add member to dialog
   * @param {string} dialogId - Dialog ID
   * @param {string} userId - User ID
   * @param {object} options - Optional: type, name
   */
  async addDialogMember(dialogId, userId, options = {}) {
    const payload = {
      userId,
      ...(options.type && { type: options.type }),
      ...(options.name && { name: options.name }),
    };
    const response = await this.client.post(`/dialogs/${dialogId}/members/add`, payload);
    return response.data;
  }

  /**
   * Remove member from dialog
   */
  async removeDialogMember(dialogId, userId) {
    const response = await this.client.post(`/dialogs/${dialogId}/members/${userId}/remove`);
    return response.data;
  }

  /**
   * Update unread counter for dialog member
   */
  async updateDialogMemberUnread(dialogId, userId, data = {}) {
    const response = await this.client.patch(
      `/dialogs/${dialogId}/members/${userId}/unread`,
      data,
    );
    return response.data;
  }

  // ==================== MESSAGE STATUS ====================

  /**
   * Update message status (read/delivered)
   * Legacy method - uses old endpoint format
   * @deprecated Use updateMessageStatusInContext instead
   */
  async updateMessageStatus(messageId, userId, status) {
    const response = await this.client.post(`/messages/${messageId}/status/${userId}/${status}`);
    return response.data;
  }

  /**
   * Create new message status entry (add to history)
   * POST /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/status/{status}
   */
  async updateMessageStatusInContext(userId, dialogId, messageId, status) {
    const response = await this.client.post(
      `/users/${userId}/dialogs/${dialogId}/messages/${messageId}/status/${status}`
    );
    return response.data;
  }

  /**
   * Get paginated list of all message statuses (history)
   * GET /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/statuses
   */
  async getMessageStatuses(userId, dialogId, messageId, params = {}) {
    const response = await this.client.get(
      `/users/${userId}/dialogs/${dialogId}/messages/${messageId}/statuses`,
      { params }
    );
    return response.data;
  }

  // ==================== REACTIONS ====================

  /**
   * Get reactions for a message
   * Legacy method - uses old endpoint format
   * @deprecated Use getMessageReactionsInContext instead
   */
  async getMessageReactions(messageId) {
    const response = await this.client.get(`/messages/${messageId}/reactions`);
    return response.data;
  }

  /**
   * Get all reactions for a message
   * GET /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/reactions
   */
  async getMessageReactionsInContext(userId, dialogId, messageId) {
    const response = await this.client.get(
      `/users/${userId}/dialogs/${dialogId}/messages/${messageId}/reactions`
    );
    return response.data;
  }

  /**
   * Add or update reaction
   * Legacy method - uses old endpoint format
   * @deprecated Use setReaction instead
   */
  async addReaction(messageId, data) {
    const response = await this.client.post(`/messages/${messageId}/reactions`, data);
    return response.data;
  }

  /**
   * Set or unset reaction for a message
   * POST /api/users/{userId}/dialogs/{dialogId}/messages/{messageId}/reactions/{action}
   * @param {string} userId - User ID
   * @param {string} dialogId - Dialog ID
   * @param {string} messageId - Message ID
   * @param {string} action - Reaction emoji/action (e.g., '👍', '❤️')
   */
  async setReaction(userId, dialogId, messageId, action) {
    const response = await this.client.post(
      `/users/${userId}/dialogs/${dialogId}/messages/${messageId}/reactions/${action}`
    );
    return response.data;
  }

  /**
   * Send typing indicator for user in dialog
   */
  async sendTypingSignal(dialogId, userId) {
    const response = await this.client.post(`/dialogs/${dialogId}/member/${userId}/typing`);
    return {
      status: response.status,
      data: response.data,
    };
  }

  /**
   * Remove reaction
   * Legacy method - reactions are now toggled via setReaction
   * @deprecated Use setReaction to toggle reaction off
   */
  async removeReaction(messageId, reaction) {
    const response = await this.client.delete(`/messages/${messageId}/reactions/${reaction}`);
    return response.data;
  }

  // ==================== USERS ====================

  /**
   * Get all users
   * GET /api/users
   */
  async getUsers(params = {}) {
    const response = await this.client.get('/users', { params });
    return response.data;
  }

  /**
   * Create user in Chat3
   */
  async createUser(userId, data) {
    const response = await this.client.post(`/users`, {
      userId,
      ...data
    });
    return response.data;
  }

  /**
   * Get user by ID
   */
  async getUser(userId) {
    const response = await this.client.get(`/users/${userId}`);
    return response.data;
  }

  /**
   * Update user
   */
  async updateUser(userId, data) {
    const response = await this.client.put(`/users/${userId}`, data);
    return response.data;
  }

  /**
   * Delete user
   * DELETE /api/users/{userId}
   */
  async deleteUser(userId) {
    const response = await this.client.delete(`/users/${userId}`);
    return response.data;
  }

  /**
   * Update user activity
   * POST /api/users/{userId}/activity
   */
  async updateUserActivity(userId, data = {}) {
    const response = await this.client.post(`/users/${userId}/activity`, data);
    return response.data;
  }

  /**
   * Set user meta key
   * Note: Use getUser() to get user with meta tags (if included in response)
   * @deprecated Use setMeta('user', userId, key, data) instead
   */
  async setUserMeta(userId, key, data) {
    const response = await this.client.put(`/users/${userId}/meta/${key}`, data);
    return response.data;
  }

  /**
   * Delete user meta key
   * @deprecated Use deleteMeta('user', userId, key) instead
   */
  async deleteUserMeta(userId, key) {
    const response = await this.client.delete(`/users/${userId}/meta/${key}`);
    return response.data;
  }

  // ==================== META ====================

  /**
   * Get meta for entity
   */
  async getMeta(entityType, entityId, key = null, params = {}) {
    // Use entityId as-is - Axios will handle URL encoding automatically
    // For dialogMember, entityId should be in format: dialogId:userId
    const path = key
      ? `/meta/${entityType}/${entityId}/${key}`
      : `/meta/${entityType}/${entityId}`;
    const response = await this.client.get(path, { params });
    return response.data;
  }

  /**
   * Set meta for entity
   */
  async setMeta(entityType, entityId, key, data = {}, options = {}) {
    // Use entityId as-is - Axios will handle URL encoding automatically
    // For dialogMember, entityId should be in format: dialogId:userId
    const payload = {
      ...data,
    };

    if (options.scope) {
      payload.scope = options.scope;
    }

    const response = await this.client.put(
      `/meta/${entityType}/${entityId}/${key}`,
      payload,
    );
    return response.data;
  }

  /**
   * Delete meta key
   */
  async deleteMeta(entityType, entityId, key, params = {}) {
    // Use entityId as-is - Axios will handle URL encoding automatically
    // For dialogMember, entityId should be in format: dialogId:userId
    const response = await this.client.delete(
      `/meta/${entityType}/${entityId}/${key}`,
      { params },
    );
    return response.data;
  }
}

export default new Chat3Client();

