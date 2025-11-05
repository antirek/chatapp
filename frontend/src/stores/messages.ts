import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'
import websocket from '@/services/websocket'
import type { Message, SendMessageData } from '@/types'
import { useAuthStore } from './auth'

export const useMessagesStore = defineStore('messages', () => {
  const messages = ref<Message[]>([])
  const typingUsers = ref<Set<string>>(new Set())
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const sortedMessages = computed(() => {
    return [...messages.value].sort((a, b) => 
      new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )
  })

  async function fetchMessages(dialogId: string, params?: {
    page?: number
    limit?: number
  }) {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.getMessages(dialogId, {
        page: params?.page || 1,
        limit: params?.limit || 50
      })

      messages.value = response.data
      return response
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function sendMessage(dialogId: string, messageData: SendMessageData) {
    error.value = null

    try {
      const response = await api.sendMessage(dialogId, messageData)
      
      // Add message immediately (optimistic update)
      if (response.success && response.data) {
        addMessage(response.data)
      }
      
      // Message will also be confirmed via WebSocket event
      return response
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message
      throw err
    }
  }

  function addMessage(message: Message) {
    // Check if message already exists
    const exists = messages.value.some(m => m._id === message._id)
    if (!exists) {
      messages.value.push(message)
    }
  }

  function updateMessage(messageId: string, updates: Partial<Message>) {
    const message = messages.value.find(m => m._id === messageId)
    if (message) {
      Object.assign(message, updates)
    }
  }

  async function markAsRead(messageId: string) {
    try {
      await api.updateMessageStatus(messageId, 'read')
    } catch (err) {
      console.error('Failed to mark message as read:', err)
    }
  }

  async function addReaction(messageId: string, reaction: string) {
    try {
      await api.addReaction(messageId, reaction)
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message
      throw err
    }
  }

  function startTyping(dialogId: string) {
    websocket.startTyping(dialogId)
  }

  function stopTyping(dialogId: string) {
    websocket.stopTyping(dialogId)
  }

  function addTypingUser(userId: string) {
    const authStore = useAuthStore()
    
    // Don't add current user
    if (userId !== authStore.user?.userId) {
      typingUsers.value.add(userId)
    }
  }

  function removeTypingUser(userId: string) {
    typingUsers.value.delete(userId)
  }

  function clearMessages() {
    messages.value = []
  }

  return {
    messages,
    sortedMessages,
    typingUsers,
    isLoading,
    error,
    fetchMessages,
    sendMessage,
    addMessage,
    updateMessage,
    markAsRead,
    addReaction,
    startTyping,
    stopTyping,
    addTypingUser,
    removeTypingUser,
    clearMessages
  }
})

