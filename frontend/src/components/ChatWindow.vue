<template>
  <div class="flex flex-col h-full">
    <!-- Chat Header -->
    <div class="p-4 border-b border-gray-200 bg-white flex items-center justify-between">
      <div class="flex-1">
        <h2 class="text-lg font-semibold">{{ dialogDisplayName }}</h2>
        <p v-if="typingUsersText" class="text-sm text-primary-600 animate-pulse">
          {{ typingUsersText }}
        </p>
      </div>
      
      <div class="flex items-center gap-2">
        <!-- Mark All Read Button (desktop) -->
        <button
          @click="handleMarkDialogAsRead"
          :disabled="isMarkingRead"
          class="hidden sm:inline-flex items-center gap-2 px-3 py-2 rounded-lg border text-sm font-medium transition-colors"
          :class="isMarkingRead ? 'bg-gray-100 text-gray-400 cursor-not-allowed border-gray-100' : 'bg-white text-gray-600 hover:bg-gray-100 border-gray-200'"
          title="Отметить все сообщения прочитанными"
        >
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
          <span>Отметить прочитанным</span>
        </button>
        <!-- Compact button on mobile -->
        <button
          @click="handleMarkDialogAsRead"
          :disabled="isMarkingRead"
          class="sm:hidden p-2 rounded-lg border text-gray-600 hover:bg-gray-100 transition-colors"
          :class="isMarkingRead ? 'text-gray-300 cursor-not-allowed border-gray-100' : 'border-gray-200'"
          title="Отметить все сообщения прочитанными"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
          </svg>
        </button>
        <!-- Favorite Button -->
        <button
          @click="toggleFavorite"
          class="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          :class="{ 'text-yellow-500': isFavorite }"
          :title="isFavorite ? 'Убрать из избранного' : 'Добавить в избранное'"
        >
          <svg 
            v-if="isFavorite"
            class="w-6 h-6" 
            fill="currentColor" 
            viewBox="0 0 24 24"
          >
            <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
          </svg>
          <svg 
            v-else
            class="w-6 h-6" 
            fill="none" 
            stroke="currentColor" 
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
          </svg>
        </button>
        
        <!-- Info Button -->
        <button
          @click="openDialogInfo"
          class="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
          title="Информация о диалоге"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </button>
      </div>
    </div>

    <!-- Messages -->
    <div ref="messagesContainer" class="flex-1 overflow-y-auto p-4 space-y-4 bg-gray-50" @scroll="handleScroll">
      <!-- Loading More (at top) -->
      <div v-if="messagesStore.isLoadingMore" class="flex justify-center py-2">
        <div class="text-sm text-gray-400">Загрузка старых сообщений...</div>
      </div>
      
      <!-- Loading -->
      <div v-if="messagesStore.isLoading" class="flex justify-center">
        <div class="text-gray-400">Загрузка сообщений...</div>
      </div>

      <!-- Messages List -->
      <div
        v-for="message in messagesStore.sortedMessages"
        :key="`${message.messageId || message._id}-${JSON.stringify(message.statuses || [])}`"
      >
        <!-- System Notification Message -->
        <div
          v-if="isSystemNotification(message)"
          class="flex justify-center mb-3"
        >
          <div class="text-xs text-gray-400 italic px-4 py-2">
            {{ message.content }}
          </div>
        </div>

        <!-- Regular Message -->
        <div
          v-else
          class="flex mb-3 gap-2 group relative"
          :class="shouldAlignRight(message) ? 'justify-end' : 'justify-start'"
        >
          <!-- Avatar (for other user's messages - left side) -->
          <div v-if="!shouldAlignRight(message)" class="flex-shrink-0">
            <Avatar
              :avatar="getSenderAvatar(message)"
              :name="getSenderName(message)"
              :userId="message.senderId"
              size="sm"
              shape="circle"
            />
          </div>

          <div class="flex flex-col relative" :class="shouldAlignRight(message) ? 'items-end' : 'items-start'">
            <!-- Sender Name -->
            <div class="text-xs mb-1 px-1"
              :class="shouldAlignRight(message) ? 'text-primary-600 font-medium' : 'text-gray-500 font-medium'"
            >
              {{ getSenderName(message) }}<span v-if="isOwnMessage(message)"> (Вы)</span>
            </div>
          
          <!-- Message Bubble -->
          <div
            class="max-w-xs lg:max-w-md rounded-lg relative"
            :class="getMessageBubbleClasses(message)"
          >
            <!-- Quoted Message (show only the quoted message, not nested quotes) -->
            <div
              v-if="message.quotedMessage"
              class="mb-2 p-2 bg-gray-100 dark:bg-gray-700 rounded border-l-4 border-primary-500"
              :class="isOwnMessage(message) ? 'border-primary-400' : 'border-primary-600'"
            >
              <div class="text-xs font-medium text-gray-600 dark:text-gray-300 mb-1">
                {{ getQuotedMessageSenderName(message.quotedMessage) }}
              </div>
              <div class="text-sm text-gray-700 dark:text-gray-200 line-clamp-2">
                <template v-if="isQuotedMessageImage(message.quotedMessage)">
                  <div class="flex items-center gap-2">
                    <img
                      :src="getQuotedMessageImageUrl(message.quotedMessage)"
                      alt="Quoted image"
                      class="w-12 h-12 object-cover rounded"
                    />
                    <span class="text-xs text-gray-500">Изображение</span>
                  </div>
                </template>
                <template v-else>
                  {{ message.quotedMessage.content || 'Сообщение' }}
                </template>
              </div>
            </div>

            <!-- Message Content -->
            <template v-if="isImageMessage(message)">
              <a
                :href="getImageUrl(message)"
                target="_blank"
                rel="noopener noreferrer"
                class="block"
              >
                <img
                  :src="getImageUrl(message)"
                  :alt="getImageAlt(message)"
                  class="rounded-md max-h-64 w-full object-cover bg-gray-100"
                  loading="lazy"
                />
              </a>
              <p v-if="message.meta?.originalName" class="text-xs mt-2 text-gray-500 break-all">
                {{ message.meta.originalName }}
              </p>
            </template>
            <template v-else>
              <div class="break-words">
                {{ getTextContent(message) }}
              </div>
            </template>

            <!-- Message Time with Read Status -->
            <div
              class="text-xs mt-1 flex items-center gap-1"
              :class="getTimestampClasses(message)"
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
              :class="shouldAlignRight(message) 
                ? 'bg-primary-500 hover:bg-primary-400 text-white' 
                : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border border-blue-200'"
            >
              ✓ Отметить прочтенным
            </button>

            <!-- Reply Button -->
            <button
              v-if="!isSystemNotification(message)"
              @click.stop="handleQuoteMessage(message)"
              class="absolute opacity-0 group-hover:opacity-100 transition-opacity text-xs px-2 py-1 rounded bg-white shadow-md border border-gray-200 hover:bg-gray-50 z-10 whitespace-nowrap text-gray-700 hover:text-gray-900"
              :class="isOwnMessage(message) ? 'top-1 right-1' : 'top-1 left-1'"
              title="Ответить"
            >
              Ответить
            </button>
          </div>
        </div>

          <!-- Avatar (for own messages - right side) -->
          <div v-if="shouldAlignRight(message)" class="flex-shrink-0">
            <Avatar
              :avatar="getSenderAvatar(message)"
              :name="getSenderName(message)"
              :userId="message.senderId"
              size="sm"
              shape="circle"
            />
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
    <MessageInput
      :quoted-message="quotedMessage"
      @send="handleSendMessage"
      @send-image="handleSendImage"
      @cancel-quote="handleCancelQuote"
    />

    <!-- Dialog Info Modal (unified for all dialog types) -->
    <DialogInfoModal
      :is-open="isDialogInfoOpen"
      :dialog="dialog"
      @close="closeDialogInfo"
      @add-members="handleAddMembers"
      @left-group="handleLeftGroup"
    />

    <!-- Add Group Members Modal -->
    <AddGroupMembersModal
      v-if="isGroupChat || isBusinessContact"
      :is-open="isAddMembersOpen"
      :dialog-id="dialog.dialogId"
      :existing-member-ids="existingMemberIds"
      @close="closeAddMembers"
      @members-added="handleMembersAdded"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, watchEffect, nextTick, onMounted } from 'vue'
import { useAuthStore } from '@/stores/auth'
import { useMessagesStore } from '@/stores/messages'
import { useDialogsStore } from '@/stores/dialogs'
import { formatTypingUsers } from '@/utils/typing'
import api from '@/services/api'
import MessageInput from './MessageInput.vue'
import DialogInfoModal from './DialogInfoModal.vue'
import AddGroupMembersModal from './AddGroupMembersModal.vue'
import Avatar from './Avatar.vue'
import type { Dialog, Message, SendMessageData } from '@/types'
import { normalizeMessageType } from '@/utils/messageType'

const props = defineProps<{
  dialog: Dialog
}>()

const emit = defineEmits<{
  'left-group': []
}>()

interface ImageMessagePayload {
  url: string
  fileId?: string | null
  originalName: string
  mimeType: string
  size: number
  width?: number
  height?: number
  caption?: string
}

const FAVORITE_META_KEY = 'favorite'
const LEGACY_FAVORITE_PREFIX = 'favoriteFor'
const P2P_NAME_META_KEY = 'p2pDialogName'
const P2P_AVATAR_META_KEY = 'p2pDialogAvatar'
const LEGACY_P2P_NAME_PREFIX = 'p2pDialogNameFor'
const LEGACY_P2P_AVATAR_PREFIX = 'p2pDialogAvatarFor'

const authStore = useAuthStore()
const messagesStore = useMessagesStore()
const dialogsStore = useDialogsStore()
const messagesContainer = ref<HTMLElement>()

const isDialogInfoOpen = ref(false)
const isAddMembersOpen = ref(false)
const isMarkingRead = ref(false)
const otherUser = ref<any>(null)
const userAvatars = ref<Record<string, string | null>>({})
const userNamesCache = ref<Record<string, string>>({})
const fetchingUserNames = new Set<string>()
const existingMemberIds = ref<string[]>([])
const quotedMessage = ref<Message | null>(null)
const currentUserId = computed(() => authStore.user?.userId || '')
const legacyFavoriteKey = computed(() =>
  currentUserId.value ? `${LEGACY_FAVORITE_PREFIX}${currentUserId.value}` : null
)

function unwrapMetaValue(entry: any) {
  if (entry == null) return undefined
  if (typeof entry === 'object' && 'value' in entry) {
    return entry.value
  }
  return entry
}

function getDialogMetaValue(key: string, legacyPrefix?: string): any {
  if (!props.dialog?.meta) return undefined
  const scopedValue = unwrapMetaValue(props.dialog.meta[key])
  if (scopedValue !== undefined) {
    return scopedValue
  }

  if (legacyPrefix && currentUserId.value) {
    return unwrapMetaValue(props.dialog.meta[`${legacyPrefix}${currentUserId.value}`])
  }

  return undefined
}

// Check if dialog is favorite based on meta tag
const isFavorite = computed(() => {
  const favoriteValue = getDialogMetaValue(FAVORITE_META_KEY, LEGACY_FAVORITE_PREFIX)
  return !!favoriteValue
})
const isP2PDialog = computed(() => {
  const chatType = props.dialog.chatType || props.dialog.meta?.type
  return chatType === 'p2p'
})
const p2pNameForCurrent = computed(() => {
  if (!isP2PDialog.value || !currentUserId.value) return undefined
  return (
    getDialogMetaValue(P2P_NAME_META_KEY, LEGACY_P2P_NAME_PREFIX) ||
    props.dialog.name ||
    props.dialog.dialogName
  )
})
const p2pAvatarForCurrent = computed(() => {
  if (!isP2PDialog.value || !currentUserId.value) return undefined
  return (
    getDialogMetaValue(P2P_AVATAR_META_KEY, LEGACY_P2P_AVATAR_PREFIX) ||
    props.dialog.avatar ||
    null
  )
})

// Check if current dialog is a group chat
const isGroupChat = computed(() => {
  const chatType = props.dialog.chatType || props.dialog.meta?.type
  return chatType === 'group'
})
const isBusinessContact = computed(() => {
  const chatType = props.dialog.chatType || props.dialog.meta?.type
  return chatType === 'personal_contact'
})
const businessContactId = computed(() => (
  props.dialog.meta?.contactId?.value ||
  props.dialog.meta?.contactId ||
  props.dialog.dialogId
))
const businessContactDisplayName = computed(() => {
  if (!isBusinessContact.value) {
    return null
  }

  return (
    props.dialog.meta?.contactName?.value ||
    props.dialog.meta?.contactName ||
    props.dialog.name ||
    props.dialog.dialogName ||
    'Бизнес-контакт'
  )
})
const dialogDisplayName = computed(() => {
  if (isBusinessContact.value) {
    return businessContactDisplayName.value || 'Бизнес-контакт'
  }

  return props.dialog.name || props.dialog.dialogName || 'Диалог'
})

const typingUsers = computed(() => messagesStore.getTypingUsers(props.dialog.dialogId))

const typingUsersText = computed(() => {
  const entries = typingUsers.value
  if (entries.length === 0) {
    return ''
  }

  if (!isGroupChat.value) {
    return 'печатает...'
  }

  const names = entries.map((entry) => entry.name?.trim() || `Пользователь ${entry.userId}`)
  const formatted = formatTypingUsers(names)
  return formatted || 'печатают...'
})

// Scroll management for infinite scroll (declare before watch)
let previousScrollHeight = 0
let isUserNearBottom = true
let isInitialLoad = true

// Load messages when dialog changes
watch(() => props.dialog?.dialogId, async (dialogId) => {
  if (dialogId) {
    isInitialLoad = true
    isUserNearBottom = true
    previousScrollHeight = 0
    await messagesStore.fetchMessages(dialogId)
    await nextTick()
    scrollToBottom()
    // Initialize scroll height after first load
    if (messagesContainer.value) {
      previousScrollHeight = messagesContainer.value.scrollHeight
    }
  }
}, { immediate: true })

watch(
  () => authStore.user,
  (user) => {
    if (user?.userId && user.name) {
      userNamesCache.value[user.userId] = user.name
    }
  },
  { immediate: true }
)

watchEffect(() => {
  const contactId =
    props.dialog.meta?.contactId?.value ||
    props.dialog.meta?.contactId ||
    props.dialog.dialogId
  const name = businessContactDisplayName.value
  if (contactId && name) {
    userNamesCache.value[contactId] = name
  }
})

// Load other user info and current user avatar on mount
onMounted(async () => {
  syncOtherUserFromMeta()
  await Promise.all([
    // Only load other user info for P2P chats
    isGroupChat.value ? Promise.resolve() : loadOtherUserInfo(),
    loadCurrentUserAvatar()
  ])
})

async function loadCurrentUserAvatar() {
  if (!authStore.user?.userId) return
  
  try {
    const response = await api.getMyProfile()
    if (response.success && response.data) {
      const avatar = response.data.avatar || null
      // Always update cache (in case avatar was changed)
      userAvatars.value[authStore.user.userId] = avatar
      console.log('✅ Current user avatar loaded:', avatar ? 'has avatar' : 'no avatar')
    }
  } catch (error) {
    // Cache null on error
    userAvatars.value[authStore.user.userId] = null
    console.error('Failed to load current user avatar:', error)
  }
}

async function fetchUserName(userId: string) {
  if (!userId || userId.startsWith('cnt_')) {
    return
  }

  if (userNamesCache.value[userId] || fetchingUserNames.has(userId)) {
    return
  }

  fetchingUserNames.add(userId)
  try {
    const response = await api.getUser(userId)
    if (response.success && response.data?.name) {
      userNamesCache.value[userId] = response.data.name
    }
  } catch (error) {
    console.warn('Failed to fetch user name:', error)
  } finally {
    fetchingUserNames.delete(userId)
  }
}

async function handleMarkDialogAsRead() {
  if (!props.dialog?.dialogId || isMarkingRead.value) {
    return
  }

  isMarkingRead.value = true
  try {
    await api.markDialogAsRead(props.dialog.dialogId)
    dialogsStore.updateDialogUnreadCount(props.dialog.dialogId, 0)
  } catch (error) {
    console.error('Failed to mark dialog as read:', error)
  } finally {
    isMarkingRead.value = false
  }
}

watch(() => messagesStore.messages.length, async () => {
  await nextTick()
  if (messagesContainer.value) {
    const container = messagesContainer.value
    const wasNearBottom = isUserNearBottom
    const wasLoadingMore = messagesStore.isLoadingMore
    
    // Check if user was near bottom before new messages
    const scrollThreshold = 100
    isUserNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < scrollThreshold
    
    if (isInitialLoad || messagesStore.isLoading || (wasNearBottom && !wasLoadingMore)) {
      // Auto-scroll to bottom on initial load or if user was near bottom (and not loading older messages)
      scrollToBottom()
      isInitialLoad = false
    } else if (wasLoadingMore) {
      // Preserve scroll position when loading older messages
      const scrollDiff = container.scrollHeight - previousScrollHeight
      if (scrollDiff > 0) {
        container.scrollTop += scrollDiff
      }
    }
    previousScrollHeight = container.scrollHeight
  }
})

function scrollToBottom() {
  if (messagesContainer.value) {
    messagesContainer.value.scrollTop = messagesContainer.value.scrollHeight
  }
}

// Handle scroll for preemptive loading
const SCROLL_LOAD_THRESHOLD = 300 // Load more when 300px from top

function handleScroll(event: Event) {
  const container = event.target as HTMLElement
  if (!container || !props.dialog) return

  const scrollTop = container.scrollTop
  const isNearTop = scrollTop < SCROLL_LOAD_THRESHOLD

  // Check if user is near bottom
  const scrollBottom = container.scrollHeight - scrollTop - container.clientHeight
  isUserNearBottom = scrollBottom < 100

  // Load more messages if near top and has more
  if (isNearTop && messagesStore.hasMore && !messagesStore.isLoadingMore && !messagesStore.isLoading) {
    void messagesStore.loadMoreMessages(props.dialog.dialogId)
  }
}

function isOwnMessage(message: Message): boolean {
  return message.senderId === authStore.user?.userId
}

function isBusinessMessage(message: Message): boolean {
  const contactId = businessContactId.value
  return (
    isBusinessContact.value &&
    !!contactId &&
    message.senderId === contactId
  )
}

function shouldAlignRight(message: Message): boolean {
  if (isBusinessMessage(message)) {
    return false
  }
  return true
}

function getNormalizedType(message: Message): string {
  return message.normalizedType || normalizeMessageType(message.type, message.meta)
}

function isSystemNotification(message: Message): boolean {
  return getNormalizedType(message) === 'system'
}

function isImageMessage(message: Message): boolean {
  return getNormalizedType(message) === 'image'
}

function getImageUrl(message: Message): string {
  if (message.meta?.url && typeof message.meta.url === 'string') {
    return message.meta.url
  }
  if (typeof message.content === 'string') {
    return message.content
  }
  return ''
}

function getImageAlt(message: Message): string {
  if (message.meta?.originalName) {
    return message.meta.originalName
  }
  return 'Изображение'
}

function getTextContent(message: Message): string {
  const normalizedType = getNormalizedType(message)
  const rawContent = typeof message.content === 'string' ? message.content.trim() : ''
  const placeholderTokens = new Set(['[image]', '[file]', '[audio]', '[video]', '[attachment]'])

  if (rawContent && !placeholderTokens.has(rawContent.toLowerCase())) {
    return rawContent
  }

  if (isImageMessage(message)) {
    return message.meta?.originalName || '[Изображение]'
  }

  if (message.meta?.originalName) {
    return message.meta.originalName
  }

  if (message.meta?.url) {
    return message.meta.url
  }

  if (normalizedType && normalizedType !== 'text') {
    return `[${normalizedType}]`
  }

  return '[Вложение]'
}

function getMessageBubbleClasses(message: Message): string {
  if (isImageMessage(message)) {
    const base = ['p-2', 'bg-white', 'text-gray-900', 'border', 'border-gray-200']
    base.push(isOwnMessage(message) ? 'rounded-br-none' : 'rounded-bl-none')
    return base.join(' ')
  }

  if (isOwnMessage(message)) {
    return 'px-4 py-2 bg-primary-600 text-white rounded-br-none'
  }

  return 'px-4 py-2 bg-white text-gray-900 rounded-bl-none shadow-sm border border-gray-200'
}

function getTimestampClasses(message: Message): string {
  if (isOwnMessage(message)) {
    return isImageMessage(message) ? 'text-gray-500' : 'text-primary-100'
  }
  return 'text-gray-400'
}

function isMessageRead(message: Message): boolean {
  // Check if current user has read this message
  const currentUserId = authStore.user?.userId
  if (!currentUserId) {
    return false
  }
  
  // Check statuses array for current user's status
  if (!message.statuses || !Array.isArray(message.statuses)) {
    return false
  }
  
  const userStatus = message.statuses.find((s: any) => s.userId === currentUserId)
  return userStatus?.status === 'read'
}

function isMessageReadByRecipient(message: Message): boolean {
  // Check if message is read by ALL recipients (excluding sender)
  
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
  const contactId =
    props.dialog.meta?.contactId?.value ||
    props.dialog.meta?.contactId ||
    props.dialog.dialogId

  if (isBusinessContact.value && message.senderId?.startsWith('cnt_')) {
    return props.dialog.name || props.dialog.dialogName || 'Бизнес-контакт'
  }

  const isOwn = isOwnMessage(message)

  if (isOwn) {
    if (message.sender?.name) {
      return message.sender.name
    }

    if (authStore.user?.name) {
      return authStore.user.name
    }

    return message.senderId
  }

  if (message.sender?.name) {
    return message.sender.name
  }

  if (userNamesCache.value[message.senderId]) {
    return userNamesCache.value[message.senderId]
  }

  if (isBusinessContact.value && message.senderId && !message.senderId.startsWith('cnt_')) {
    return resolveUserNameFromMessage(message)
  }

  if (userNamesCache.value[message.senderId]) {
    return userNamesCache.value[message.senderId]
  }

  if (message.senderId === otherUser.value?.userId && otherUser.value?.name) {
    return otherUser.value.name
  }

  if (isP2PDialog.value && p2pNameForCurrent.value) {
    return p2pNameForCurrent.value
  }

  return message.senderId
}

function resolveUserNameFromMessage(message: Message): string {
  if (message.sender?.name) {
    return message.sender.name
  }

  if (userNamesCache.value[message.senderId]) {
    return userNamesCache.value[message.senderId]
  }

  void fetchUserName(message.senderId)

  return `Пользователь ${message.senderId}`
}

function getSenderAvatar(message: Message): string | null {
  const isOwn = isOwnMessage(message)
  
  // Check cache first
  if (userAvatars.value[message.senderId] !== undefined) {
    return userAvatars.value[message.senderId]
  }
  
  // For own messages, try to get current user's avatar
  if (isOwn) {
    // Priority 1: Check cache (loaded on mount)
    if (userAvatars.value[message.senderId] !== undefined) {
      return userAvatars.value[message.senderId]
    }
    
    // Priority 2: Check if message has sender object with avatar (from Chat3 API)
    if (message.sender?.avatar) {
      userAvatars.value[message.senderId] = message.sender.avatar
      return message.sender.avatar
    }
    
    return null
  }
  
  // For other user's messages
  // Priority 1: Check if message has sender object with avatar (from Chat3 API)
  if (message.sender?.avatar) {
    userAvatars.value[message.senderId] = message.sender.avatar
    return message.sender.avatar
  }
  
  // Priority 2: Use otherUser avatar if senderId matches
  if (message.senderId === otherUser.value?.userId && otherUser.value?.avatar) {
    userAvatars.value[message.senderId] = otherUser.value.avatar
    return otherUser.value.avatar
  }
  
  if (isP2PDialog.value) {
    const avatar = p2pAvatarForCurrent.value ?? null
    userAvatars.value[message.senderId] = avatar
    return avatar ?? null
  }
  
  return null
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
    const messageData: SendMessageData = {
      content,
      type: 'text'
    }

    if (quotedMessage.value) {
      const messageId = quotedMessage.value.messageId || quotedMessage.value._id
      if (messageId) {
        messageData.quotedMessageId = messageId
      }
    }

    await messagesStore.sendMessage(props.dialog.dialogId, messageData)
    quotedMessage.value = null
  } catch (error) {
    console.error('Failed to send message:', error)
  }
}

async function handleSendImage(payload: ImageMessagePayload) {
  if (!props.dialog) return

  try {
    const messagePayload: SendMessageData = {
      type: 'image',
      meta: {
        url: payload.url,
        fileId: payload.fileId,
        originalName: payload.originalName,
        mimeType: payload.mimeType,
        size: payload.size,
        ...(payload.width ? { width: payload.width } : {}),
        ...(payload.height ? { height: payload.height } : {})
      }
    }

    const caption = payload.caption?.trim()
    if (caption) {
      messagePayload.content = caption
    }

    if (quotedMessage.value) {
      const messageId = quotedMessage.value.messageId || quotedMessage.value._id
      if (messageId) {
        messagePayload.quotedMessageId = messageId
      }
    }

    await messagesStore.sendMessage(props.dialog.dialogId, messagePayload)
    quotedMessage.value = null
  } catch (error) {
    console.error('Failed to send image message:', error)
  }
}

// Quote message functions
function handleQuoteMessage(message: Message) {
  // Create a clean message object without nested quotes for preview
  const cleanMessage: Message = {
    ...message,
    quotedMessage: undefined // Remove nested quotes to prevent multi-level nesting
  }
  quotedMessage.value = cleanMessage
  // Scroll to input (will be handled by MessageInput focus)
}

function handleCancelQuote() {
  quotedMessage.value = null
}

function getQuotedMessageSenderName(quotedMessage: any): string {
  if (quotedMessage.senderInfo?.name) {
    return quotedMessage.senderInfo.name
  }
  if (quotedMessage.sender?.name) {
    return quotedMessage.sender.name
  }
  // Try to get from current messages
  const originalMessage = messagesStore.messages.find(
    (m) => (m.messageId || m._id) === quotedMessage.messageId
  )
  if (originalMessage) {
    return getSenderName(originalMessage)
  }
  return quotedMessage.senderId || 'Пользователь'
}

function isQuotedMessageImage(quotedMessage: any): boolean {
  const type = quotedMessage.type || ''
  return type.includes('image') || quotedMessage.meta?.url
}

function getQuotedMessageImageUrl(quotedMessage: any): string {
  return quotedMessage.meta?.url || ''
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
        syncOtherUserFromMeta({ userId: otherMember.userId })

        if (!otherUser.value) {
          otherUser.value = {
            userId: otherMember.userId,
            name: otherMember.name || p2pNameForCurrent.value || otherMember.userId,
            phone: otherMember.phone || '',
            avatar: otherMember.avatar || p2pAvatarForCurrent.value || null
          }
        } else {
          otherUser.value = {
            userId: otherMember.userId,
            name: otherUser.value.name || otherMember.name || otherMember.userId,
            phone: otherUser.value.phone || otherMember.phone || '',
            avatar: otherUser.value.avatar || otherMember.avatar || null
          }
        }

        if (otherUser.value.avatar !== undefined) {
          userAvatars.value[otherMember.userId] = otherUser.value.avatar
        }

        // Skip API request for business contacts (cnt_...) - they are not users
        // Business contacts are loaded from Contact model, not User model
        if (otherMember.userId && otherMember.userId.startsWith('cnt_')) {
          // This is a business contact, not a user - skip getUser request
          return
        }

        // Skip API request for bots (bot_...) - they are handled separately
        if (otherMember.userId && otherMember.userId.startsWith('bot_')) {
          // This is a bot - use basic info from member data or botId
          otherUser.value = {
            userId: otherMember.userId,
            name: otherMember.name || otherMember.userName || otherMember.userId.replace('bot_', ''),
            phone: null,
            avatar: otherMember.avatar || null,
            isBot: true
          }
          if (otherUser.value.name) {
            userNamesCache.value[otherMember.userId] = otherUser.value.name
          }
          return
        }

        try {
          const userResponse = await api.getUser(otherMember.userId)
          if (userResponse.success && userResponse.data) {
            otherUser.value = {
              userId: userResponse.data.userId || otherMember.userId,
              name: userResponse.data.name || otherUser.value.name || otherMember.userId,
              phone: userResponse.data.phone || otherUser.value.phone || '',
              avatar: userResponse.data.avatar || otherUser.value.avatar || null
            }
            userAvatars.value[otherMember.userId] = otherUser.value.avatar
            if (otherUser.value.name) {
              userNamesCache.value[otherMember.userId] = otherUser.value.name
            }
          }
        } catch (error) {
          console.warn('Failed to load detailed user info:', error)
        }
      }
    }
  } catch (error) {
    console.error('Failed to load other user info:', error)
  }
}

async function openDialogInfo() {
  // For group chats, load existing member IDs for AddGroupMembersModal
  if (isGroupChat.value || isBusinessContact.value) {
    await loadExistingMemberIds()
  }
  isDialogInfoOpen.value = true
}

function closeDialogInfo() {
  isDialogInfoOpen.value = false
}

async function loadExistingMemberIds() {
  try {
    const response = await api.getDialogMembers(props.dialog.dialogId)
    if (response.success && response.data) {
      existingMemberIds.value = response.data.map((member: any) => member.userId)
      response.data.forEach((member: any) => {
        if (member.userId && member.name) {
          userNamesCache.value[member.userId] = member.name
        }
      })
    }
  } catch (error) {
    console.error('Failed to load existing member IDs:', error)
  }
}

async function handleAddMembers() {
  // Close DialogInfoModal
  closeDialogInfo()
  
  // Load existing member IDs
  await loadExistingMemberIds()
  
  // Open AddGroupMembersModal
  isAddMembersOpen.value = true
}

function closeAddMembers() {
  isAddMembersOpen.value = false
}

async function toggleFavorite() {
  if (!props.dialog?.dialogId || !currentUserId.value) return
  
  try {
    const response = await api.toggleDialogFavorite(props.dialog.dialogId)
    if (response.success) {
      const applyFavoriteMeta = (dialog: Dialog | null) => {
        if (!dialog) return
        if (!dialog.meta) {
          dialog.meta = {}
        }
        if (response.isFavorite) {
          dialog.meta[FAVORITE_META_KEY] = { value: true }
          if (legacyFavoriteKey.value) {
            dialog.meta[legacyFavoriteKey.value] = { value: true }
          }
        } else {
          delete dialog.meta[FAVORITE_META_KEY]
          if (legacyFavoriteKey.value) {
            delete dialog.meta[legacyFavoriteKey.value]
          }
        }
      }

      applyFavoriteMeta(dialogsStore.currentDialog || null)
      const dialogInList = dialogsStore.dialogs.find(d => d.dialogId === props.dialog.dialogId) || null
      applyFavoriteMeta(dialogInList)
    }
  } catch (error) {
    console.error('Failed to toggle favorite:', error)
  }
}

async function handleMembersAdded() {
  // Close AddGroupMembersModal
  closeAddMembers()
  
  // Reload existing member IDs for next time
  await loadExistingMemberIds()
  
  // Reload messages to get any updates
  await messagesStore.fetchMessages(props.dialog.dialogId)
}

function handleLeftGroup() {
  // Emit event to parent (ChatView) to clear current dialog
  emit('left-group')
}

function syncOtherUserFromMeta(partial?: { userId?: string }) {
  if (!isP2PDialog.value) {
    return
  }

  const nameFromMeta = p2pNameForCurrent.value
  const avatarFromMeta = p2pAvatarForCurrent.value ?? null

  if (!nameFromMeta && avatarFromMeta === undefined) {
    return
  }

  const userId = partial?.userId || otherUser.value?.userId || ''

  otherUser.value = {
    userId,
    name: nameFromMeta || otherUser.value?.name || userId,
    phone: otherUser.value?.phone || '',
    avatar: avatarFromMeta
  }

  if (userId) {
    userAvatars.value[userId] = avatarFromMeta
  }
}

watch(
  () => [props.dialog.dialogId, p2pNameForCurrent.value, p2pAvatarForCurrent.value],
  () => {
    syncOtherUserFromMeta()
  }
)
</script>


