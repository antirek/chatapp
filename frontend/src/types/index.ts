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
  avatar?: string | null
  unreadCount: number
  lastSeenAt?: string | number
  lastMessageAt?: string | number
  isActive: boolean
  joinedAt: string | number
  lastInteractionAt: string | number
  lastMessage?: LastMessage
  chatType?: 'p2p' | 'group'
  meta?: {
    type?: 'p2p' | 'group'
    [key: string]: any
  }
  isPublic?: boolean
  members?: Array<{
    userId: string
    name?: string
    phone?: string
    avatar?: string | null
    [key: string]: any
  }>
}

export interface LastMessage {
  content?: string
  senderId: string
  type: string
  createdAt: string
  normalizedType?: string
}

// Message types
export interface QuotedMessage {
  messageId: string
  dialogId: string
  senderId: string
  content?: string
  type: string
  createdAt: string | number
  updatedAt?: string | number
  meta?: Record<string, any>
  senderInfo?: {
    userId: string
    name?: string
    phone?: string
    avatar?: string | null
    [key: string]: any
  }
}

export interface Message {
  _id?: string
  messageId?: string
  tenantId?: string
  dialogId: string
  senderId: string
  sender?: {
    userId: string
    name?: string
    phone?: string
    [key: string]: any
  }
  content?: string
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
  normalizedType?: string
  quotedMessage?: QuotedMessage
}

export interface SendMessageData {
  content?: string
  type?: string
  meta?: Record<string, any>
  quotedMessageId?: string
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
export interface TypingUserInfo {
  userId: string
  tenantId?: string
  name?: string
  avatar?: string | null
  [key: string]: any
}

export interface TypingEvent {
  userId: string
  userName?: string
  dialogId: string
  expiresInMs?: number
  userInfo?: TypingUserInfo
  data?: any
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

export interface DialogSearchResponse {
  success: boolean
  search: string
  personal: {
    data: Dialog[]
    pagination: PaginatedResponse<Dialog>['pagination']
  }
  groups: {
    data: Dialog[]
    pagination: PaginatedResponse<Dialog>['pagination']
  }
  publicGroups: {
    data: Dialog[]
    pagination: PaginatedResponse<Dialog>['pagination']
  }
}

