<template>
  <div class="h-screen flex relative">
    <!-- Audio Permission Hint -->
    <Transition
      enter-active-class="transition ease-out duration-300"
      enter-from-class="opacity-0 -translate-y-2"
      enter-to-class="opacity-100 translate-y-0"
      leave-active-class="transition ease-in duration-200"
      leave-from-class="opacity-100 translate-y-0"
      leave-to-class="opacity-0 -translate-y-2"
    >
      <div
        v-if="showAudioPermissionHint"
        class="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-yellow-50 border border-yellow-200 rounded-lg shadow-lg p-4 max-w-md"
      >
        <div class="flex items-start space-x-3">
          <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-yellow-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.536 8.464a5 5 0 010 7.072m2.828-9.9a9 9 0 010 12.728M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
            </svg>
          </div>
          <div class="flex-1">
            <p class="text-sm font-medium text-yellow-800">Звуковые уведомления заблокированы</p>
            <p class="text-xs text-yellow-700 mt-1">Кликните в любом месте страницы, чтобы включить звук</p>
          </div>
          <button
            @click="showAudioPermissionHint = false"
            class="flex-shrink-0 text-yellow-600 hover:text-yellow-800"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    </Transition>
    
    <!-- Sidebar with dialogs -->
    <div class="w-80 bg-white border-r border-gray-200 flex flex-col">
      <!-- Current User Info -->
      <div v-if="authStore.user" class="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div class="flex items-center space-x-3">
          <!-- Avatar -->
          <button
            @click="openUserProfile"
            class="flex-shrink-0 cursor-pointer hover:opacity-80 transition-opacity"
            title="Мой профиль"
          >
            <Avatar
              :avatar="currentUserAvatar"
              :name="authStore.user.name"
              :userId="authStore.user.userId"
              size="md"
              shape="circle"
            />
          </button>
          
          <!-- User info -->
          <button
            @click="openUserProfile"
            class="flex-1 min-w-0 text-left hover:opacity-80 transition-opacity"
            title="Мой профиль"
          >
            <div class="font-semibold text-gray-900 text-sm truncate">
              {{ authStore.user.name }}
            </div>
            <div class="text-xs text-gray-600">
              {{ formatPhone(authStore.user.phone) }}
            </div>
          </button>

          <!-- Logout button -->
          <button
            @click="logout"
            class="flex-shrink-0 text-gray-500 hover:text-gray-900 transition-colors"
            title="Выйти"
          >
            <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Header -->
      <div class="p-4 border-b border-gray-200 flex items-center justify-between">
        <h1 class="text-xl font-bold text-gray-900">Чаты</h1>
        <button
          @click="openCreateDialog"
          class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
          title="Создать чат"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      <!-- Dialogs List -->
      <DialogList @select="selectDialog" />
    </div>

    <!-- Chat Window -->
    <div class="flex-1 flex flex-col">
      <ChatWindow 
        v-if="dialogsStore.currentDialog" 
        :dialog="dialogsStore.currentDialog"
        :key="`chat-${dialogsStore.currentDialog.dialogId}-${currentUserAvatar ? 'has-avatar' : 'no-avatar'}`"
      />
      
      <!-- Empty State -->
      <div v-else class="flex-1 flex items-center justify-center text-gray-400">
        <div class="text-center">
          <svg class="w-24 h-24 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p class="text-lg">Выберите диалог для начала общения</p>
        </div>
      </div>
    </div>

    <!-- User Profile Modal -->
    <UserProfile
      :is-open="isUserProfileOpen"
      @close="closeUserProfile"
      @avatar-updated="handleAvatarUpdated"
    />

    <!-- Create Dialog Modal (outside main layout) -->
    <CreateDialogModal
      :is-open="isCreateDialogOpen"
      @close="closeCreateDialog"
      @user-selected="handleUserSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDialogsStore } from '@/stores/dialogs'
import { useMessagesStore } from '@/stores/messages'
import websocket from '@/services/websocket'
import api from '@/services/api'
import DialogList from '@/components/DialogList.vue'
import ChatWindow from '@/components/ChatWindow.vue'
import CreateDialogModal from '@/components/CreateDialogModal.vue'
import UserProfile from '@/components/UserProfile.vue'
import Avatar from '@/components/Avatar.vue'
import { useNotificationSound } from '@/composables/useNotificationSound'

const router = useRouter()
const authStore = useAuthStore()
const dialogsStore = useDialogsStore()
const messagesStore = useMessagesStore()

const isCreateDialogOpen = ref(false)
const isUserProfileOpen = ref(false)
const currentUserAvatar = ref<string | null>(null)

// Audio notification system
const { 
  audioInitialized, 
  showAudioPermissionHint, 
  initializeAudio, 
  playNotificationSound,
  cleanupAudio 
} = useNotificationSound()

onMounted(async () => {
  // Setup WebSocket listeners FIRST (before fetching data)
  setupWebSocketListeners()

  // Load dialogs (don't block on error)
  try {
    await dialogsStore.fetchDialogs()
  } catch (error) {
    console.error('Failed to load dialogs on mount:', error)
    // WebSocket listeners are still set up, so real-time updates will work
  }

  // Load current user avatar
  await loadCurrentUserAvatar()
})

onUnmounted(() => {
  // Clean up WebSocket listeners
  websocket.off('chat3:update', handleChat3Update)
  websocket.off('message:new', handleNewMessage)
  websocket.off('message:update', handleMessageUpdate)
  websocket.off('dialog:update', handleDialogUpdate)
  websocket.off('typing:start', handleTypingStart)
  websocket.off('typing:stop', handleTypingStop)
  websocket.off('connected', handleReconnect)
  
  // Clean up audio
  cleanupAudio()
})

function setupWebSocketListeners() {
  // ✅ RabbitMQ Chat3 Updates
  websocket.on('chat3:update', handleChat3Update)
  
  websocket.on('message:new', handleNewMessage)
  websocket.on('message:update', handleMessageUpdate)
  websocket.on('dialog:update', handleDialogUpdate)
  websocket.on('typing:start', handleTypingStart)
  websocket.on('typing:stop', handleTypingStop)
  websocket.on('connected', handleReconnect)
}

async function handleReconnect() {
  // ✅ Pure RabbitMQ - queue resumes automatically on reconnect
  console.log('🔄 WebSocket reconnected, reloading dialogs...')
  
  // Reload dialogs after reconnect to get any updates we missed
  try {
    await dialogsStore.fetchDialogs()
    console.log('✅ Dialogs reloaded after reconnect')
  } catch (error) {
    console.error('❌ Failed to reload dialogs after reconnect:', error)
  }
}

function handleChat3Update(update: any) {
  console.log('🔄 Processing Chat3 Update:', update.eventType, update.data)
  
  // Handle different update types from RabbitMQ
  switch (update.eventType) {
    case 'message.create':
      // New message - add to store
      handleNewMessage(update.data)
      break
    
    case 'message.update':
    case 'message.status.update':
      // Message updated (status, reactions, etc.)
      handleMessageUpdate(update)
      break
    
    case 'dialog.create':
    case 'dialog.update':
    case 'dialog.member.add':
    case 'dialog.member.remove':
      // Dialog created, updated, or members changed - refresh dialogs list
      handleDialogUpdate(update)
      break
    
    default:
      console.log('⚠️  Unknown update type:', update.eventType)
  }
}

function handleNewMessage(message: any) {
  // Extract dialogId (can be string or object with _id/id)
  const messageDialogId = typeof message.dialogId === 'object' 
    ? (message.dialogId._id || message.dialogId.id) 
    : message.dialogId
  
  const currentDialogId = dialogsStore.currentDialog?.dialogId
  
  // Check if message is from another user
  const isFromOtherUser = message.senderId !== authStore.user?.userId
  
  console.log('📩 handleNewMessage:', {
    messageDialogId,
    currentDialogId,
    senderId: message.senderId,
    currentUserId: authStore.user?.userId,
    isFromOtherUser,
    isCurrentDialog: messageDialogId === currentDialogId
  })
  
  // Play notification sound for messages from other users
  if (isFromOtherUser) {
    playNotificationSound()
  }
  
  // Add to messages store if in current dialog
  if (messageDialogId === currentDialogId) {
    messagesStore.addMessage(message)
  } else if (isFromOtherUser) {
    // Increment unread count if message is from another user and not in current dialog
    console.log('🔢 Incrementing unread count for dialog:', messageDialogId)
    dialogsStore.incrementUnreadCount(messageDialogId)
  }

  // Update dialog last message
  dialogsStore.updateLastMessage(messageDialogId, message)
}

async function handleMessageUpdate(update: any) {
  // Handle message updates (reactions, status, etc.)
  console.log('📝 handleMessageUpdate called:', update)
  if (update.data) {
    console.log('📝 update.data:', update.data)
    const messageId = update.data.messageId || update.data._id
    if (messageId) {
      // For status updates, fetch full message to get updated statuses array
      if (update.eventType === 'message.status.update') {
        try {
          console.log('🔄 Fetching full message for status update:', messageId)
          const response = await api.getMessage(messageId)
          if (response.success && response.data) {
            console.log('✅ Got full message with statuses:', response.data.statuses)
            messagesStore.updateMessage(messageId, response.data)
            
            // Decrement unread count if current user marked message as read
            if (update.data.userId === authStore.user?.userId && update.data.status === 'read' && response.data.dialogId) {
              // Check if it's not the current dialog (already at 0 unread)
              if (response.data.dialogId !== dialogsStore.currentDialog?.dialogId) {
                const dialog = dialogsStore.dialogs.find(d => d.dialogId === response.data.dialogId)
                if (dialog && dialog.unreadCount > 0) {
                  dialogsStore.updateDialogUnreadCount(response.data.dialogId, dialog.unreadCount - 1)
                }
              }
            }
          }
        } catch (error) {
          console.error('Failed to fetch message for status update:', error)
          // Fallback to partial update
          messagesStore.updateMessage(messageId, update.data)
        }
      } else {
        console.log('📝 Calling updateMessage with messageId:', messageId, 'updates:', update.data)
        messagesStore.updateMessage(messageId, update.data)
      }
    }
  }
}

function handleDialogUpdate(update: any) {
  // Refresh dialogs on dialog updates
  dialogsStore.fetchDialogs()
}

function handleTypingStart(event: any) {
  if (event.dialogId === dialogsStore.currentDialog?.dialogId) {
    messagesStore.addTypingUser(event.userId)
  }
}

function handleTypingStop(event: any) {
  messagesStore.removeTypingUser(event.userId)
}

async function selectDialog(dialogId: string) {
  await dialogsStore.selectDialog(dialogId)
  
  if (dialogsStore.currentDialog) {
    // ✅ Pure RabbitMQ - updates come through user queue automatically
    
    // Load messages
    await messagesStore.fetchMessages(dialogId)
    
    // Auto-mark unread messages as read after opening dialog
    const currentUserId = authStore.user?.userId
    if (currentUserId) {
      // Find unread messages from other users
      const unreadMessages = messagesStore.messages.filter(msg => {
        // Skip own messages
        if (msg.senderId === currentUserId) return false
        
        // Check if current user hasn't read this message
        if (!msg.statuses || !Array.isArray(msg.statuses)) return false
        
        const userStatus = msg.statuses.find((s: any) => s.userId === currentUserId)
        return !userStatus || userStatus.status !== 'read'
      })
      
      // Mark all unread messages as read
      for (const msg of unreadMessages) {
        const messageId = msg.messageId || msg._id
        if (messageId) {
          // Don't await - mark in background
          messagesStore.markAsRead(messageId).catch(err => {
            console.error('Failed to auto-mark message as read:', messageId, err)
          })
        }
      }
    }
  }
}

function logout() {
  authStore.logout()
  router.push({ name: 'login' })
}

async function loadCurrentUserAvatar() {
  if (!authStore.user?.userId) return
  
  try {
    const response = await api.getMyProfile()
    if (response.success && response.data) {
      currentUserAvatar.value = response.data.avatar || null
    }
  } catch (error) {
    console.error('Failed to load current user avatar:', error)
  }
}

function openUserProfile() {
  isUserProfileOpen.value = true
}

function closeUserProfile() {
  isUserProfileOpen.value = false
}

function handleAvatarUpdated(avatar: string | null) {
  currentUserAvatar.value = avatar
  console.log('✅ Avatar updated in ChatView:', avatar ? 'has avatar' : 'no avatar')
  
  // Reload dialogs to update avatars in dialog list
  dialogsStore.fetchDialogs().catch(err => {
    console.error('Failed to reload dialogs after avatar update:', err)
  })
}

function formatPhone(phone: string): string {
  if (!phone) return ''
  
  // Format: 79123456789 -> +7 912 345-67-89
  if (phone.startsWith('7') && phone.length === 11) {
    return `+7 ${phone.substring(1, 4)} ${phone.substring(4, 7)}-${phone.substring(7, 9)}-${phone.substring(9)}`
  }
  
  return phone
}

// Create Dialog Modal functions
function openCreateDialog() {
  isCreateDialogOpen.value = true
}

function closeCreateDialog() {
  isCreateDialogOpen.value = false
}

async function handleUserSelected(user: any) {
  try {
    // Create dialog with selected user using store method
    const response = await dialogsStore.createDialog(
      `Диалог с ${user.name}`,
      [user.userId]
    )

    if (response.success && response.data) {
      // Close modal first
      closeCreateDialog()
      
      // Dialog already added to list by store.createDialog()
      // Just open it
      await selectDialog(response.data.dialogId)
    } else {
      closeCreateDialog()
      alert('Не удалось создать диалог')
    }
  } catch (error: any) {
    console.error('Failed to create dialog:', error)
    closeCreateDialog()
    alert('Не удалось создать диалог: ' + (error.response?.data?.error || error.message))
  }
}
</script>

