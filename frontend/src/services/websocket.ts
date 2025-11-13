import { io, type Socket } from 'socket.io-client'
import type { Chat3Update, TypingEvent, UserPresenceEvent, Message } from '@/types'

type EventCallback = (...args: any[]) => void

class WebSocketService {
  private socket: Socket | null = null
  private listeners: Map<string, Set<EventCallback>> = new Map()

  connect(token: string) {
    if (this.socket?.connected) {
      console.warn('WebSocket already connected')
      return
    }

    const wsUrl = import.meta.env.VITE_WS_URL || 'http://localhost:3010'

    this.socket = io(wsUrl, {
      auth: { token }
    })

    this.setupEventListeners()

    if (import.meta.env.DEV) {
      // @ts-expect-error debug helper
      window.__chatWebSocket = this.socket
    }
  }

  private setupEventListeners() {
    if (!this.socket) return

    this.socket.on('connect', () => {
      console.log('✅ WebSocket connected')
      this.emit('connected')
    })

    this.socket.on('disconnect', () => {
      console.log('❌ WebSocket disconnected')
      this.emit('disconnected')
    })

    this.socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error)
      this.emit('error', error)
    })

    // ✅ Chat3 Updates from RabbitMQ
    this.socket.on('chat3:update', (update: Chat3Update) => {
      console.log('📬 Received Chat3 Update:', update.eventType, update.data)
      this.emit('chat3:update', update)
    })

    this.socket.on('message:new', (message: Message) => {
      this.emit('message:new', message)
    })

    this.socket.on('message:update', (update: Chat3Update) => {
      this.emit('message:update', update)
    })

    this.socket.on('dialog:update', (update: Chat3Update) => {
      this.emit('dialog:update', update)
    })

    // User presence
    this.socket.on('user:online', (data: UserPresenceEvent) => {
      this.emit('user:online', data)
    })

    this.socket.on('user:offline', (data: UserPresenceEvent) => {
      this.emit('user:offline', data)
    })

    // Typing indicators via Chat3 updates
    this.socket.on('typing:update', (data: TypingEvent) => {
      this.emit('typing:update', data)
    })
  }

  // ✅ Pure RabbitMQ architecture - no Socket.io room management needed
  // Updates now come through RabbitMQ, no need to join Socket.io rooms

  // Event subscription
  on(event: string, callback: EventCallback) {
    if (!this.listeners.has(event)) {
      this.listeners.set(event, new Set())
    }
    this.listeners.get(event)!.add(callback)
  }

  // Event unsubscription
  off(event: string, callback: EventCallback) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.delete(callback)
    }
  }

  // Emit event to listeners
  private emit(event: string, ...args: any[]) {
    const callbacks = this.listeners.get(event)
    if (callbacks) {
      callbacks.forEach(callback => callback(...args))
    }
  }

  // Disconnect
  disconnect() {
    if (this.socket) {
      this.socket.disconnect()
      this.socket = null
      this.listeners.clear()
    }
  }

  // Check connection status
  get isConnected(): boolean {
    return this.socket?.connected || false
  }
}

export default new WebSocketService()

