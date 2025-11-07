<template>
  <div class="flex flex-col h-full">
    <!-- Chat Header -->
    <div class="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
      <div class="flex-1">
        <h2 class="text-lg font-semibold">{{ dialog.name || dialog.dialogName || 'Диалог' }}</h2>
        <p v-if="typingUsersText" class="text-sm text-primary-600 animate-pulse">
          {{ typingUsersText }}
        </p>
      </div>
      
      <!-- Info Button -->
      <button
        @click="openUserInfo"
        class="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
        title="Информация о собеседнике"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
      </button>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50">
      <!-- Loading -->
      <div v-if="messagesStore.isLoading" class="flex justify-center">
        <div class="text-gray-400">Загрузка сообщений...</div>
      </div>

      <!-- Messages List -->
      <div
        v-for="message in messagesStore.sortedMessages"
        :key="`${message.messageId || message._id}-${JSON.stringify(message.statuses || [])}`"
        class="flex mb-3"
        :class="isOwnMessage(message) ? 'justify-end' : 'justify-start'"
      >
        <div class="flex flex-col" :class="isOwnMessage(message) ? 'items-end' : 'items-start'">
          <!-- Sender Name -->
          <div class="text-xs mb-1 px-1"
            :class="isOwnMessage(message) ? 'text-primary-600 font-medium' : 'text-gray-500 font-medium'"
          >
            {{ getSenderName(message) }}{{ isOwnMessage(message) ? ' (Вы)' : '' }}
          </div>
          
          <!-- Message Bubble -->
          <div
            class="max-w-xs lg:max-w-md px-4 py-2 rounded-lg"
            :class="isOwnMessage(message)
              ? 'bg-primary-600 text-white rounded-br-none'
              : 'bg-white text-gray-900 rounded-bl-none shadow-sm border border-gray-200'
            "
          >
            <!-- Message Content -->
            <div class="break-words">{{ message.content }}</div>

            <!-- Message Time with Read Status -->
            <div
              class="text-xs mt-1 flex items-center gap-1"
              :class="isOwnMessage(message) ? 'text-primary-100' : 'text-gray-400'"
            >
              <span>{{ formatTime(message.createdAt) }}</span>
              
              <!-- Read indicator for own messages -->
              <span v-if="isOwnMessage(message) && isMessageReadByRecipient(message)" class="text-blue-400" title="Прочитано">
                ✓✓
              </span>
              <span v-else-if="isOwnMessage(message)" class="text-primary-200 opacity-50" title="Отправлено">
                ✓
              </span>
            </div>

            <!-- Reactions -->
            <div v-if="message.reactionCounts && Object.keys(message.reactionCounts).length > 0" class="flex gap-1 mt-2">
              <span
                v-for="(count, emoji) in message.reactionCounts"
                :key="emoji"
                class="text-xs px-2 py-1 bg-gray-100 rounded-full"
              >
                {{ emoji }} {{ count }}
              </span>
            </div>
            
            <!-- Mark as Read Button (for incoming messages only) -->
            <button
              v-if="!isOwnMessage(message) && !isMessageRead(message)"
              @click="markMessageAsRead(message)"
              class="text-xs mt-2 px-3 py-1 rounded-md transition-colors"
              :class="isOwnMessage(message) 
                ? 'bg-primary-500 hover:bg-primary-400 text-white' 
                : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200'"
            >
              ✓ Отметить прочтенным
            </button>
          </div>
        </div>
      </div>

      <!-- Empty State -->
      <div v-if="!messagesStore.isLoading && messagesStore.messages.length === 0" class="flex flex-col items-center justify-center h-full text-gray-400">
        <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
        </svg>
        <p>Нет сообщений</p>
        <p class="text-sm mt-1">Начните диалог</p>
      </div>
    </div>

    <!-- Message Input -->
    <MessageInput @send="handleSendMessage" />

    <!-- User Info Modal -->
    <UserInfoModal
      :is-open="isUserInfoOpen"
      :user="otherUser"
      @close="closeUserInfo"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMessagesStore } from '@/stores/messages'
import api from '@/services/api'
import MessageInput from './MessageInput.vue'
import UserInfoModal from './UserInfoModal.vue'
import type { Dialog, Message } from '@/types'

const props = defineProps<{
  dialog: Dialog
}>()

const authStore = useAuthStore()
const messagesStore = useMessagesStore()
const messagesContainer = ref<HTMLElement>()

const isUserInfoOpen = ref(false)
const otherUser = ref<any>(null)

const typingUsersText = computed(() => {
  if (messagesStore.typingUsers.size === 0) return ''
  if (messagesStore.typingUsers.size === 1) return 'печатает...'
  return 'печатают...'
})

// Load other user info on mount
onMounted(async () => {
  await loadOtherUserInfo()
})

// Scroll to bottom when new messages arrive
watch(() => messagesStore.messages.length, async () => {
  await nextTick()
  scrollToBottom()
})

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

function isOwnMessage(message: Message): boolean {
  const result = message.senderId === authStore.user?.userId
  console.log('isOwnMessage:', message.senderId, '===', authStore.user?.userId, '=', result)
  return result
}

function isMessageRead(message: Message): boolean {
  // Check if current user has read this message
  const currentUserId = authStore.user?.userId
  if (!currentUserId) {
    return false
  }
  
  // Use context if available (from Chat3 user context API)
  if (message.context) {
    return message.context.myStatus === 'read'
  }
  
  // Fallback to statuses array (for backward compatibility and WebSocket updates)
  if (!message.statuses || !Array.isArray(message.statuses)) {
    return false
  }
  
  const userStatus = message.statuses.find((s: any) => s.userId === currentUserId)
  return userStatus?.status === 'read'
}

function isMessageReadByRecipient(message: Message): boolean {
  // Check if message is read by ALL recipients (excluding sender)
  
  // Use context if available (for incoming messages, check if we've read it)
  if (message.context && !message.context.isMine) {
    // For incoming messages, we can't determine recipient status from our context
    // Fall through to statuses check
  }
  
  // Check statuses array
  if (!message.statuses || !Array.isArray(message.statuses)) {
    return false
  }
  
  const currentUserId = authStore.user?.userId
  if (!currentUserId) return false
  
  // Get all recipient statuses (excluding sender)
  const recipientStatuses = message.statuses.filter((s: any) => s.userId !== currentUserId)
  
  // If no recipients, return false
  if (recipientStatuses.length === 0) {
    return false
  }
  
  // Check if ALL recipients have read the message
  return recipientStatuses.every((s: any) => s.status === 'read')
}

async function markMessageAsRead(message: Message) {
  if (!message.messageId && !message._id) {
    console.error('Cannot mark message as read: no ID')
    return
  }
  
  try {
    const messageId = message.messageId || message._id!
    await messagesStore.markAsRead(messageId)
    
    // Status will be updated via WebSocket update (message.status.update)
    console.log('✅ Marked as read, waiting for WebSocket update...')
  } catch (error) {
    console.error('Failed to mark message as read:', error)
  }
}

function getSenderName(message: Message): string {
  const isOwn = isOwnMessage(message)
  
  // For own messages, try to get current user's name
  if (isOwn) {
    // Priority 1: Check if message has sender object with name (from Chat3 API)
    if (message.sender?.name) {
      return message.sender.name
    }
    
    // Priority 2: Use current user's name from authStore
    if (authStore.user?.name) {
      return authStore.user.name
    }
    
    // Fallback: Show senderId
    return message.senderId
  }
  
  // For other user's messages
  // Priority 1: Check if message has sender object with name (from Chat3 API)
  if (message.sender?.name) {
    return message.sender.name
  }
  
  // Priority 2: Use otherUser name if senderId matches (loaded from dialog members)
  if (message.senderId === otherUser.value?.userId && otherUser.value?.name) {
    return otherUser.value.name
  }
  
  // Fallback: Show senderId if name is not available
  return message.senderId
}

function formatTime(timestamp: string | number): string {
  // Parse timestamp - can be:
  // 1. Unix timestamp in milliseconds (number or string): 1762419282731 or "1762419282731.615234"
  // 2. ISO date string: "2025-11-06T08:54:42.732Z"
  let date: Date
  
  if (typeof timestamp === 'string') {
    // Try parsing as number first (Unix timestamp with microseconds)
    const numericTimestamp = parseFloat(timestamp)
    if (!isNaN(numericTimestamp)) {
      // Unix timestamp in milliseconds (Chat3 format)
      date = new Date(Math.floor(numericTimestamp))
    } else {
      // ISO date string
      date = new Date(timestamp)
    }
  } else {
    // Number timestamp
    date = new Date(timestamp)
  }
  
  // Validate date
  if (isNaN(date.getTime())) {
    return ''
  }
  
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

async function handleSendMessage(content: string) {
  if (!props.dialog) return

  try {
    await messagesStore.sendMessage(props.dialog.dialogId, {
      content,
      type: 'text'
    })
  } catch (error) {
    console.error('Failed to send message:', error)
  }
}

// User Info Modal functions
async function loadOtherUserInfo() {
  try {
    // Get dialog members
    const membersResponse = await api.getDialogMembers(props.dialog.dialogId)
    
    if (membersResponse.success && membersResponse.data) {
      const members = membersResponse.data
      
      // Find other user (not current user)
      const otherMember = members.find((m: any) => m.userId !== authStore.user?.userId)
      
      if (otherMember && otherMember.userId) {
        // Get full user info
        const userResponse = await api.getUser(otherMember.userId)
        if (userResponse.success && userResponse.data) {
          otherUser.value = userResponse.data
        }
      }
    }
  } catch (error) {
    console.error('Failed to load other user info:', error)
  }
}

async function openUserInfo() {
  // Load fresh user info
  if (!otherUser.value) {
    await loadOtherUserInfo()
  }
  isUserInfoOpen.value = true
}

function closeUserInfo() {
  isUserInfoOpen.value = false
}
</script>


