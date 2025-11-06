// User types
export interface User {
  userId: string
  phone: string
  name: string
}

// Auth types
export interface AuthResponse {
  success: boolean
  token: string
  user: User
}

export interface RequestCodeResponse {
  success: boolean
  message: string
  isNewUser: boolean
}

// Dialog types
export interface Dialog {
  dialogId: string
  name?: string // Chat3 format
  dialogName?: string // Legacy format
  unreadCount: number
  lastSeenAt?: string | number
  lastMessageAt?: string | number
  isActive: boolean
  joinedAt: string | number
  lastInteractionAt: string | number
  lastMessage?: LastMessage
}

export interface LastMessage {
  content: string
  senderId: string
  type: string
  createdAt: string
}

// Message types
export interface Message {
  _id?: string
  messageId?: string
  tenantId?: string
  dialogId: string
  senderId: string
  content: string
  type: string
  reactionCounts?: Record<string, number>
  createdAt: string | number
  updatedAt?: string | number
  meta?: Record<string, any>
  statuses?: Array<{
    userId: string
    status: 'read' | 'unread' | 'delivered'
    createdAt?: string | number
  }>
}

export interface SendMessageData {
  content: string
  type?: string
  meta?: Record<string, any>
}

// Chat3 Update types
export interface Chat3Update {
  _id: string
  tenantId: string
  userId: string
  dialogId: string
  entityId: string
  eventId: string
  eventType: string
  data: any
  published: boolean
  publishedAt?: string
  createdAt: string
}

// WebSocket events
export interface TypingEvent {
  userId: string
  userName?: string
  dialogId: string
}

export interface UserPresenceEvent {
  userId: string
  userName?: string
}

// API Response
export interface ApiResponse<T = any> {
  success: boolean
  data?: T
  error?: string
  message?: string
}

export interface PaginatedResponse<T> {
  success: boolean
  data: T[]
  pagination: {
    page: number
    limit: number
    total: number
    pages: number
  }
}

