import axios, { type AxiosInstance } from 'axios'
import type {
  AuthResponse,
  RequestCodeResponse,
  Dialog,
  Message,
  SendMessageData,
  PaginatedResponse,
  ApiResponse
} from '@/types'

class ApiService {
  private api: AxiosInstance

  constructor() {
    this.api = axios.create({
      baseURL: import.meta.env.VITE_API_URL || 'http://localhost:3010/api',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json'
      }
    })

    // Add token to requests from sessionStorage (isolated per tab)
    this.api.interceptors.request.use((config) => {
      const token = sessionStorage.getItem('token')
      if (token) {
        config.headers.Authorization = `Bearer ${token}`
      }
      return config
    })

    // Handle errors
    this.api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          // Token expired or invalid
          sessionStorage.removeItem('token')
          sessionStorage.removeItem('user')
          window.location.href = '/login'
        }
        return Promise.reject(error)
      }
    )
  }

  // ==================== AUTH ====================

  async requestCode(phone: string, name?: string): Promise<RequestCodeResponse> {
    const { data } = await this.api.post('/auth/request-code', { phone, name })
    return data
  }

  async verifyCode(phone: string, code: string): Promise<AuthResponse> {
    const { data } = await this.api.post('/auth/verify-code', { phone, code })
    return data
  }

  async getMe(): Promise<ApiResponse> {
    const { data } = await this.api.get('/auth/me')
    return data
  }

  // ==================== DIALOGS ====================

  async getDialogs(params?: {
    page?: number
    limit?: number
    includeLastMessage?: boolean
    type?: 'p2p' | 'group:private' | 'group:public' | 'all' | 'favorites' | 'business-contacts' | 'unread'
    search?: string
  }): Promise<PaginatedResponse<Dialog>> {
    const queryParams = { ...params }
    if (queryParams?.type === 'all') {
      delete (queryParams as any).type
    }
    const { data } = await this.api.get('/dialogs', { params: queryParams })
    return data
  }

  async createDialog(dialogData: {
    name: string
    memberIds?: string[]
    chatType?: 'p2p' | 'group'
    groupType?: 'private' | 'public'
  }): Promise<ApiResponse<Dialog>> {
    const { data } = await this.api.post('/dialogs', dialogData)
    return data
  }

  async createBusinessContact(contactData: {
    name: string
    phone: string
  }): Promise<ApiResponse<{ contact: any; dialog: Dialog }>> {
    const { data } = await this.api.post('/contacts', contactData)
    return data
  }

  async getContact(contactId: string): Promise<ApiResponse<any>> {
    const { data } = await this.api.get(`/contacts/${contactId}`)
    return data
  }

  async listContacts(params?: {
    search?: string
    page?: number
    limit?: number
  }): Promise<PaginatedResponse<any>> {
    const { data } = await this.api.get('/contacts/list', { params })
    return data
  }

  async getOrCreateContactDialog(contactId: string): Promise<ApiResponse<{ dialog: Dialog; isNew: boolean }>> {
    const { data } = await this.api.get(`/contacts/${contactId}/dialog`)
    return data
  }

  async getDialog(dialogId: string): Promise<ApiResponse<Dialog>> {
    const { data } = await this.api.get(`/dialogs/${dialogId}`)
    return data
  }

  async getPublicGroups(params?: {
    page?: number
    limit?: number
  }): Promise<PaginatedResponse<Dialog>> {
    const { data } = await this.api.get('/dialogs/public', { params })
    return data
  }

  async joinGroup(dialogId: string): Promise<ApiResponse<Dialog>> {
    const { data } = await this.api.post(`/dialogs/${dialogId}/join`)
    return data
  }

  async sendTyping(dialogId: string): Promise<ApiResponse<{ expiresInMs: number }>> {
    const { data } = await this.api.post(`/dialogs/${dialogId}/typing`)
    return data
  }

  async deleteDialog(dialogId: string): Promise<ApiResponse> {
    const { data} = await this.api.delete(`/dialogs/${dialogId}`)
    return data
  }

  async addDialogMember(dialogId: string, userId: string): Promise<ApiResponse> {
    const { data } = await this.api.post(`/dialogs/${dialogId}/members`, { userId })
    return data
  }

  async removeDialogMember(dialogId: string, userId: string): Promise<ApiResponse> {
    const { data } = await this.api.delete(`/dialogs/${dialogId}/members/${userId}`)
    return data
  }

  async getDialogMembers(dialogId: string, params?: { limit?: number }): Promise<ApiResponse> {
    const { data } = await this.api.get(`/dialogs/${dialogId}/members`, { params })
    return data
  }

  async toggleDialogFavorite(dialogId: string): Promise<ApiResponse<{ isFavorite: boolean }>> {
    const { data } = await this.api.post(`/dialogs/${dialogId}/favorite`)
    return data
  }

  // ==================== MESSAGES ====================

  async getMessages(dialogId: string, params?: {
    page?: number
    limit?: number
  }): Promise<PaginatedResponse<Message>> {
    const { data } = await this.api.get(`/dialog/${dialogId}/messages`, { params })
    return data
  }

  async sendMessage(dialogId: string, messageData: SendMessageData): Promise<ApiResponse<Message>> {
    const { data } = await this.api.post(`/dialog/${dialogId}/messages`, messageData)
    return data
  }

  async getMessage(messageId: string): Promise<ApiResponse<Message>> {
    const { data } = await this.api.get(`/messages/${messageId}`)
    return data
  }

  async updateMessageStatus(messageId: string, status: 'read' | 'delivered'): Promise<ApiResponse> {
    const { data } = await this.api.post(`/messages/${messageId}/status/${status}`)
    return data
  }

  async addReaction(messageId: string, reaction: string): Promise<ApiResponse> {
    const { data } = await this.api.post(`/messages/${messageId}/reactions`, { reaction })
    return data
  }

  async removeReaction(messageId: string, reaction: string): Promise<ApiResponse> {
    const { data } = await this.api.delete(`/messages/${messageId}/reactions/${reaction}`)
    return data
  }

  async getReactions(messageId: string): Promise<ApiResponse> {
    const { data } = await this.api.get(`/messages/${messageId}/reactions`)
    return data
  }

  // ==================== USERS ====================

  async getUsers(params?: {
    search?: string
    limit?: number
    page?: number
  }): Promise<ApiResponse> {
    const { data } = await this.api.get('/users', { params })
    return data
  }

  async getUser(userId: string): Promise<ApiResponse> {
    const { data } = await this.api.get(`/users/${userId}`)
    return data
  }

  async getMyProfile(): Promise<ApiResponse> {
    const { data } = await this.api.get('/users/me')
    return data
  }

  async updateAvatar(avatar: string): Promise<ApiResponse<{ avatar: string }>> {
    const { data } = await this.api.put('/users/me/avatar', { avatar })
    return data
  }

  async deleteAvatar(): Promise<ApiResponse> {
    const { data } = await this.api.delete('/users/me/avatar')
    return data
  }
}

export default new ApiService()

