<template>
  <div class="flex flex-col h-full">
    <!-- Chat Header -->
    <div class="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
      <div class="flex-1">
        <h2 class="text-lg font-semibold">{{ dialog.dialogName }}</h2>
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
        :key="message._id"
        class="flex mb-3"
        :class="isOwnMessage(message) ? 'justify-end' : 'justify-start'"
      >
        <div class="flex flex-col" :class="isOwnMessage(message) ? 'items-end' : 'items-start'">
          <!-- Sender Name -->
          <div class="text-xs mb-1 px-1"
            :class="isOwnMessage(message) ? 'text-primary-600 font-medium' : 'text-gray-500 font-medium'"
          >
            {{ isOwnMessage(message) ? 'Вы' : getSenderName(message.senderId) }}
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

            <!-- Message Time -->
            <div
              class="text-xs mt-1"
              :class="isOwnMessage(message) ? 'text-primary-100' : 'text-gray-400'"
            >
              {{ formatTime(message.createdAt) }}
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

function getSenderName(senderId: string): string {
  // TODO: Можно добавить кеш имен пользователей
  // Пока показываем userId
  return senderId
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
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


