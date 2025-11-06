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
    return [...messages.value].sort((a, b) => {
      // Parse timestamps correctly - can be Unix timestamp (number/string) or ISO string
      const timeA = typeof a.createdAt === 'string' 
        ? (parseFloat(a.createdAt) || new Date(a.createdAt).getTime())
        : a.createdAt
      const timeB = typeof b.createdAt === 'string'
        ? (parseFloat(b.createdAt) || new Date(b.createdAt).getTime())
        : b.createdAt
      
      // Sort ascending (oldest first, newest last)
      return timeA - timeB
    })
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
    // Check if message already exists by messageId (primary) or _id (fallback)
    const exists = messages.value.some(m => 
      (message.messageId && m.messageId === message.messageId) || 
      (m._id && m._id === message._id)
    )
    if (!exists) {
      messages.value.push(message)
    }
  }

  function updateMessage(messageId: string, updates: any) {
    console.log('🛠️ updateMessage called with messageId:', messageId, 'updates:', updates)
    
    // Find message by messageId (primary) or _id (fallback)
    const index = messages.value.findIndex(m => 
      m.messageId === messageId || m._id === messageId
    )
    if (index === -1) {
      console.log('❌ Message not found for update:', messageId)
      return
    }
    
    const message = messages.value[index]
    console.log('🛠️ Found message:', message)
    console.log('🛠️ Checking if status update:', { has_status: !!updates.status, has_userId: !!updates.userId })
    
    // Special handling for status updates
    if (updates.status && updates.userId) {
      // This is a status update: { messageId, userId, status, ... }
      console.log('🔄 Status update:', { messageId, userId: updates.userId, status: updates.status })
      
      // Create new statuses array to trigger reactivity
      const currentStatuses = message.statuses || []
      const statusIndex = currentStatuses.findIndex((s: any) => s.userId === updates.userId)
      
      let newStatuses
      if (statusIndex >= 0) {
        // Update existing status - create new array
        newStatuses = [...currentStatuses]
        newStatuses[statusIndex] = {
          ...newStatuses[statusIndex],
          status: updates.status,
          createdAt: updates.updatedAt || newStatuses[statusIndex].createdAt
        }
      } else {
        // Add new status
        newStatuses = [...currentStatuses, {
          userId: updates.userId,
          status: updates.status,
          createdAt: updates.createdAt || updates.updatedAt
        }]
      }
      
      // Create new message object and new array to trigger reactivity
      const updatedMessage = {
        ...message,
        statuses: newStatuses
      }
      
      // Replace entire array to trigger reactivity
      messages.value = [
        ...messages.value.slice(0, index),
        updatedMessage,
        ...messages.value.slice(index + 1)
      ]
      
      console.log('✅ Message updated with new statuses:', { messageId, statuses: newStatuses })
    } else {
      // Regular update - replace message object
      const updatedMessage = {
        ...message,
        ...updates
      }
      
      // Replace entire array to trigger reactivity
      messages.value = [
        ...messages.value.slice(0, index),
        updatedMessage,
        ...messages.value.slice(index + 1)
      ]
    }
  }

  async function markAsRead(messageId: string) {
    try {
      const response = await api.updateMessageStatus(messageId, 'read')
      
      // Immediately update local state with response data (don't wait for WebSocket)
      if (response.data) {
        console.log('📥 Updating message status from API response:', response.data)
        updateMessage(messageId, response.data)
      }
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

