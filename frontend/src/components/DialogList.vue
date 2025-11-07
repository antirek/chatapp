<template>
  <div class="flex-1 overflow-y-auto">
    <!-- Loading State -->
    <div v-if="dialogsStore.isLoading" class="flex items-center justify-center p-8">
      <div class="text-gray-400">Загрузка...</div>
    </div>

    <!-- Error State -->
    <div v-else-if="dialogsStore.error" class="flex flex-col items-center justify-center p-8 text-red-500">
      <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p class="mb-2 font-semibold">Ошибка загрузки</p>
      <p class="text-sm text-gray-500 mb-4 text-center">{{ dialogsStore.error }}</p>
      <button 
        @click="retryLoadDialogs"
        class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
      >
        Повторить попытку
      </button>
    </div>

    <!-- Dialogs -->
    <div v-else-if="dialogsStore.dialogs.length > 0" class="divide-y divide-gray-200">
      <button
        v-for="dialog in dialogsStore.dialogs"
        :key="dialog.dialogId"
        @click="$emit('select', dialog.dialogId)"
        class="w-full p-4 text-left hover:bg-gray-50 transition-colors relative flex items-start gap-3"
        :class="{ 'bg-primary-50': isActive(dialog.dialogId) }"
      >
        <!-- Avatar -->
        <div class="flex-shrink-0">
          <Avatar
            :avatar="getDialogAvatar(dialog)"
            :name="dialog.name || dialog.dialogName || 'Диалог'"
            :userId="getDialogOtherUserId(dialog)"
            :is-group="isGroupChat(dialog)"
            size="md"
            shape="circle"
          />
        </div>

        <!-- Dialog Content -->
        <div class="flex-1 min-w-0">
          <!-- Dialog Name -->
          <div class="flex items-start justify-between mb-1">
            <h3 class="font-semibold text-gray-900 truncate flex-1">
              {{ dialog.name || dialog.dialogName || 'Диалог' }}
            </h3>
            
            <!-- Time -->
            <span v-if="dialog.lastMessageAt" class="text-xs text-gray-500 ml-2 flex-shrink-0">
              {{ formatTime(dialog.lastMessageAt) }}
            </span>
          </div>

          <!-- Last Message -->
          <p v-if="dialog.lastMessage" class="text-sm text-gray-600 truncate">
            {{ dialog.lastMessage.content }}
          </p>
        </div>

        <!-- Unread Badge -->
        <div
          v-if="dialog.unreadCount > 0"
          class="absolute top-4 right-4 bg-primary-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium"
        >
          {{ dialog.unreadCount > 9 ? '9+' : dialog.unreadCount }}
        </div>
      </button>
    </div>

    <!-- Empty State -->
    <div v-else class="flex flex-col items-center justify-center p-8 text-gray-400">
      <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
      </svg>
      <p>Нет диалогов</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDialogsStore } from '@/stores/dialogs'
import { useAuthStore } from '@/stores/auth'
import api from '@/services/api'
import Avatar from './Avatar.vue'
import type { Dialog } from '@/types'

defineEmits<{
  select: [dialogId: string]
}>()

const dialogsStore = useDialogsStore()
const authStore = useAuthStore()
const dialogAvatars = ref<Record<string, string | null>>({})
const dialogOtherUsers = ref<Record<string, { userId: string; name: string }>>({})

function isActive(dialogId: string): boolean {
  return dialogsStore.currentDialog?.dialogId === dialogId
}

async function retryLoadDialogs() {
  try {
    await dialogsStore.fetchDialogs()
  } catch (error) {
    console.error('Failed to retry loading dialogs:', error)
  }
}

function getDialogOtherUserId(dialog: Dialog): string {
  // Try to get other user ID from cache
  if (dialogOtherUsers.value[dialog.dialogId]) {
    return dialogOtherUsers.value[dialog.dialogId].userId
  }
  
  // Try to get from last message sender
  if (dialog.lastMessage?.senderId && dialog.lastMessage.senderId !== authStore.user?.userId) {
    return dialog.lastMessage.senderId
  }
  
  // Load dialog members to find other user
  loadDialogOtherUser(dialog.dialogId)
  
  return ''
}

function getDialogAvatar(dialog: Dialog): string | null {
  // For group chats, return null to show default group icon
  if (isGroupChat(dialog)) {
    return null
  }
  
  const otherUserId = getDialogOtherUserId(dialog)
  if (!otherUserId) return null
  
  // Check cache
  if (dialogAvatars.value[otherUserId] !== undefined) {
    return dialogAvatars.value[otherUserId]
  }
  
  // Load avatar
  loadUserAvatar(otherUserId)
  
  return null
}

function isGroupChat(dialog: Dialog): boolean {
  const chatType = dialog.chatType || dialog.meta?.type
  return chatType === 'group'
}

async function loadDialogOtherUser(dialogId: string) {
  // Skip if already loading
  if (dialogOtherUsers.value[dialogId]) {
    return
  }
  
  try {
    const response = await api.getDialogMembers(dialogId)
    if (response.success && response.data) {
      const members = response.data
      const otherMember = members.find((m: any) => m.userId !== authStore.user?.userId)
      
      if (otherMember && otherMember.userId) {
        dialogOtherUsers.value[dialogId] = {
          userId: otherMember.userId,
          name: otherMember.name || ''
        }
        
        // Load avatar for this user
        loadUserAvatar(otherMember.userId)
      }
    }
  } catch (error) {
    console.error('Failed to load dialog other user:', dialogId, error)
  }
}

async function loadUserAvatar(userId: string) {
  // Skip if already loading or cached
  if (dialogAvatars.value[userId] !== undefined) {
    return
  }
  
  try {
    const response = await api.getUser(userId)
    if (response.success && response.data) {
      const avatar = response.data.avatar || null
      dialogAvatars.value[userId] = avatar
    }
  } catch (error) {
    // If user not found or error, cache null
    dialogAvatars.value[userId] = null
    console.error('Failed to load user avatar:', userId, error)
  }
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
  
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))

  if (hours < 24) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  } else if (hours < 48) {
    return 'вчера'
  } else {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }
}
</script>

