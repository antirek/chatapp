import axios from 'axios';
import axiosLogger from 'axios-logger';
import config from '../config/index.js';

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
  async getDialog(dialogId) {
    const response = await this.client.get(`/dialogs/${dialogId}`);
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
   * Returns messages with user-specific data (e.g., read status)
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
   * Get all messages with filtering
   */
  async getMessages(params = {}) {
    const response = await this.client.get('/messages', { params });
    return response.data;
  }

  // ==================== DIALOG MEMBERS ====================

  /**
   * Add member to dialog
   */
  async addDialogMember(dialogId, userId) {
    const response = await this.client.post(`/dialogs/${dialogId}/members/${userId}/add`);
    return response.data;
  }

  /**
   * Remove member from dialog
   */
  async removeDialogMember(dialogId, userId) {
    const response = await this.client.post(`/dialogs/${dialogId}/members/${userId}/remove`);
    return response.data;
  }

  // ==================== MESSAGE STATUS ====================

  /**
   * Update message status (read/delivered)
   */
  async updateMessageStatus(messageId, userId, status) {
    const response = await this.client.post(`/messages/${messageId}/status/${userId}/${status}`);
    return response.data;
  }

  // ==================== REACTIONS ====================

  /**
   * Get reactions for a message
   */
  async getMessageReactions(messageId) {
    const response = await this.client.get(`/messages/${messageId}/reactions`);
    return response.data;
  }

  /**
   * Add or update reaction
   */
  async addReaction(messageId, data) {
    const response = await this.client.post(`/messages/${messageId}/reactions`, data);
    return response.data;
  }

  /**
   * Remove reaction
   */
  async removeReaction(messageId, reaction) {
    const response = await this.client.delete(`/messages/${messageId}/reactions/${reaction}`);
    return response.data;
  }

  // ==================== USERS ====================

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
   * Set user meta key
   * Note: Use getUser() to get user with meta tags (if included in response)
   */
  async setUserMeta(userId, key, data) {
    const response = await this.client.put(`/users/${userId}/meta/${key}`, data);
    return response.data;
  }

  /**
   * Delete user meta key
   */
  async deleteUserMeta(userId, key) {
    const response = await this.client.delete(`/users/${userId}/meta/${key}`);
    return response.data;
  }

  // ==================== META ====================

  /**
   * Get meta for entity
   */
  async getMeta(entityType, entityId) {
    const response = await this.client.get(`/meta/${entityType}/${entityId}`);
    return response.data;
  }

  /**
   * Set meta for entity
   */
  async setMeta(entityType, entityId, key, data) {
    const response = await this.client.put(`/meta/${entityType}/${entityId}/${key}`, data);
    return response.data;
  }

  /**
   * Delete meta key
   */
  async deleteMeta(entityType, entityId, key) {
    const response = await this.client.delete(`/meta/${entityType}/${entityId}/${key}`);
    return response.data;
  }
}

export default new Chat3Client();

