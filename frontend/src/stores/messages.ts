import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'
import type { Message, SendMessageData } from '@/types'
import websocket from '@/services/websocket'
import { useAuthStore } from './auth'
import { ensureNormalizedMessage, mapOutgoingMessageType } from '@/utils/messageType'
import { useDialogsStore } from './dialogs'

let typingListenerRegistered = false

interface TypingUserEntry {
  userId: string
  name?: string
  expiresAt: number
}

export const useMessagesStore = defineStore('messages', () => {
  const messages = ref<Message[]>([])
  const typingUsersByDialog = ref<Map<string, Map<string, TypingUserEntry>>>(new Map())
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const typingTimeouts = new Map<string, Map<string, ReturnType<typeof setTimeout>>>()
  const lastTypingSignalAt = new Map<string, number>()
  const TYPING_THROTTLE_MS = 800
  const dialogsStore = useDialogsStore()

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

      const normalizedMessages = response.data.map((message) => ensureNormalizedMessage(message))
      messages.value = normalizedMessages
      response.data = normalizedMessages
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
      const payload: SendMessageData = {
        ...messageData,
        type: mapOutgoingMessageType(messageData.type)
      }

      const response = await api.sendMessage(dialogId, payload)
      
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
      messages.value.push(ensureNormalizedMessage(message))
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
      const updatedMessage = ensureNormalizedMessage({
        ...message,
        statuses: newStatuses
      })
      
      // Replace entire array to trigger reactivity
      messages.value = [
        ...messages.value.slice(0, index),
        updatedMessage,
        ...messages.value.slice(index + 1)
      ]
      
      console.log('✅ Message updated with new statuses:', { messageId, statuses: newStatuses })
    } else {
      // Regular update - replace message object
      const updatedMessage = ensureNormalizedMessage({
        ...message,
        ...updates
      })
      
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

  async function sendTypingSignal(dialogId: string) {
    const now = Date.now()
    const lastSignal = lastTypingSignalAt.get(dialogId) || 0

    if (now - lastSignal < TYPING_THROTTLE_MS) {
      return
    }

    lastTypingSignalAt.set(dialogId, now)

    try {
      console.log('📝 Sending typing signal for dialog:', dialogId)
      await api.sendTyping(dialogId)
    } catch (err: any) {
      console.warn('Failed to send typing signal:', err?.response?.data?.error || err?.message)
    }
  }

  function updateTypingMap(dialogId: string, updater: (map: Map<string, TypingUserEntry>) => void) {
    const currentMap = typingUsersByDialog.value
    const nextMap = new Map(currentMap)
    const currentEntries = new Map(currentMap.get(dialogId) ?? [])

    updater(currentEntries)

    if (currentEntries.size === 0) {
      nextMap.delete(dialogId)
    } else {
      nextMap.set(dialogId, currentEntries)
    }

    typingUsersByDialog.value = nextMap
  }

  function ensureTimeoutMap(dialogId: string) {
    if (!typingTimeouts.has(dialogId)) {
      typingTimeouts.set(dialogId, new Map())
    }
    return typingTimeouts.get(dialogId)!
  }

  function addTypingUser(dialogId: string, userId: string, expiresInMs: number = 5000, userName?: string) {
    const authStore = useAuthStore()
    if (userId === authStore.user?.userId) {
      return
    }

    const expiresAt = Date.now() + expiresInMs
    const existingName = typingUsersByDialog.value.get(dialogId)?.get(userId)?.name
    const resolvedName = userName?.trim() || existingName

    updateTypingMap(dialogId, (entryMap) => {
      entryMap.set(userId, {
        userId,
        name: resolvedName,
        expiresAt
      })
    })

    const dialogTimeouts = ensureTimeoutMap(dialogId)
    if (dialogTimeouts.has(userId)) {
      clearTimeout(dialogTimeouts.get(userId)!)
    }
    dialogTimeouts.set(
      userId,
      setTimeout(() => {
        removeTypingUser(dialogId, userId)
      }, expiresInMs)
    )
  }

  function removeTypingUser(dialogId: string, userId: string) {
    updateTypingMap(dialogId, (entryMap) => {
      entryMap.delete(userId)
    })

    const dialogTimeouts = typingTimeouts.get(dialogId)
    if (dialogTimeouts?.has(userId)) {
      clearTimeout(dialogTimeouts.get(userId)!)
      dialogTimeouts.delete(userId)
      if (dialogTimeouts.size === 0) {
        typingTimeouts.delete(dialogId)
      }
    }
  }

  function clearMessages() {
    messages.value = []
    typingUsersByDialog.value = new Map()
    typingTimeouts.forEach((timeoutMap) => {
      timeoutMap.forEach((timeout) => clearTimeout(timeout))
    })
    typingTimeouts.clear()
    lastTypingSignalAt.clear()
  }

  if (!typingListenerRegistered) {
    typingListenerRegistered = true
    websocket.on('typing:update', (event: TypingEvent) => {
      const currentDialogId = dialogsStore.currentDialog?.dialogId
      const eventDialogId = event.dialogId
      if (!eventDialogId || eventDialogId !== currentDialogId) {
        return
      }
      if (!event.userId) {
        return
      }
      const expiresInMs = event.expiresInMs ?? 5000
      if (import.meta.env.DEV) {
        console.log('[messagesStore] typing:update', event)
      }
      addTypingUser(
        eventDialogId,
        event.userId,
        expiresInMs,
        event.userName || event.userInfo?.name
      )
    })
  }

  function getTypingUsers(dialogId: string): Array<{ userId: string; name?: string }> {
    const dialogEntries = typingUsersByDialog.value.get(dialogId)
    if (!dialogEntries) {
      return []
    }
    return Array.from(dialogEntries.values()).map(({ userId, name }) => ({
      userId,
      name
    }))
  }

  function clearTypingForDialog(dialogId: string) {
    updateTypingMap(dialogId, (entryMap) => entryMap.clear())
    const dialogTimeouts = typingTimeouts.get(dialogId)
    if (dialogTimeouts) {
      dialogTimeouts.forEach((timeout) => clearTimeout(timeout))
      typingTimeouts.delete(dialogId)
    }
  }

  const storeApi = {
    messages,
    sortedMessages,
    typingUsersByDialog,
    isLoading,
    error,
    fetchMessages,
    sendMessage,
    addMessage,
    updateMessage,
    markAsRead,
    addReaction,
    sendTypingSignal,
    addTypingUser,
    removeTypingUser,
    getTypingUsers,
    clearTypingForDialog,
    clearMessages
  }

  if (import.meta.env.DEV) {
    const globalStores = (window as any).__piniaStores || ((window as any).__piniaStores = {})
    globalStores.messages = storeApi
  }

  return storeApi
})

if (import.meta.env.DEV) {
  // @ts-expect-error expose for debugging
  window.__typingStore = {
    get typingUsers() {
      const store = useMessagesStore() as any
      const map: Map<string, Map<string, TypingUserEntry>> = store.typingUsersByDialog
      return Array.from(map.entries()).reduce<Record<string, Array<{ userId: string; name?: string; expiresAt: number }>>>(
        (acc, [dialogId, entries]) => {
          acc[dialogId] = Array.from(entries.values()).map((entry) => ({
            userId: entry.userId,
            name: entry.name,
            expiresAt: entry.expiresAt
          }))
        return acc
      }, {})
    },
    addTypingUser: (dialogId: string, userId: string, expiresInMs?: number, userName?: string) => {
      ;(useMessagesStore() as any).addTypingUser(dialogId, userId, expiresInMs, userName)
    },
    removeTypingUser: (dialogId: string, userId: string) => {
      ;(useMessagesStore() as any).removeTypingUser(dialogId, userId)
    }
  }
}

