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
      <div class="p-4 border-b border-gray-200">
        <div class="flex items-center justify-between mb-2">
          <h1 class="text-xl font-bold text-gray-900">Чаты</h1>
          <div class="relative">
            <button
              @click="toggleContextMenu"
              class="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors"
              title="Меню действий"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z" />
              </svg>
            </button>
            
            <!-- Context Menu -->
            <Transition name="menu">
              <div
                v-if="isContextMenuOpen"
                @click.stop
                class="absolute right-0 top-full mt-2 w-56 bg-white rounded-lg shadow-lg border border-gray-200 py-1 z-50"
              >
                <button
                  @click="handleMenuAction('create-dialog')"
                  class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
                  </svg>
                  Создать чат
                </button>
                <button
                  @click="handleMenuAction('create-group')"
                  class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
                  </svg>
                  Создать группу
                </button>
                <button
                  @click="handleMenuAction('public-groups')"
                  class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0zM10 7v3m0 0v3m0-3h3m-3 0H7" />
                  </svg>
                  Публичные группы
                </button>
                <div class="border-t border-gray-200 my-1"></div>
                <button
                  @click="handleMenuAction('select-business-contact')"
                  class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 10-9.9 0 7 7 0 009.9 0z" />
                  </svg>
                  Выбор бизнес-контакта
                </button>
                <button
                  @click="handleMenuAction('create-business-contact')"
                  class="w-full px-4 py-2 text-left text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-2"
                >
                  <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M18 9v3m0 0v3m0-3h3m-3 0h-3m-2-5a4 4 0 11-8 0 4 4 0 018 0zM3 20a6 6 0 0112 0v1H3v-1z" />
                  </svg>
                  Создать бизнес-контакт
                </button>
              </div>
            </Transition>
          </div>
        </div>
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
        @left-group="handleLeftGroup"
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

    <!-- Create Group Modal -->
    <CreateGroupModal
      :is-open="isCreateGroupOpen"
      @close="closeCreateGroup"
      @group-created="handleGroupCreated"
    />

    <!-- Add Group Members Modal -->
    <AddGroupMembersModal
      :is-open="isAddMembersOpen"
      :dialog-id="currentGroupDialogId"
      :existing-member-ids="currentGroupMemberIds"
      @close="closeAddMembers"
      @members-added="handleMembersAdded"
    />

    <!-- Public Groups Modal -->
    <PublicGroupsModal
      :is-open="isPublicGroupsOpen"
      @close="closePublicGroups"
      @group-joined="handleGroupJoined"
    />

    <!-- Create Business Contact Modal -->
    <CreateBusinessContactModal
      :is-open="isCreateBusinessContactOpen"
      @close="closeCreateBusinessContact"
    />

    <!-- Select Business Contact Modal -->
    <SelectBusinessContactModal
      :is-open="isSelectBusinessContactOpen"
      @close="closeSelectBusinessContact"
      @contact-selected="handleContactSelected"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, onBeforeUnmount } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'
import { useDialogsStore } from '@/stores/dialogs'
import { useMessagesStore } from '@/stores/messages'
import websocket from '@/services/websocket'
import api from '@/services/api'
import DialogList from '@/components/DialogList.vue'
import ChatWindow from '@/components/ChatWindow.vue'
import CreateDialogModal from '@/components/CreateDialogModal.vue'
import CreateGroupModal from '@/components/CreateGroupModal.vue'
import AddGroupMembersModal from '@/components/AddGroupMembersModal.vue'
import PublicGroupsModal from '@/components/PublicGroupsModal.vue'
import CreateBusinessContactModal from '@/components/CreateBusinessContactModal.vue'
import SelectBusinessContactModal from '@/components/SelectBusinessContactModal.vue'
import UserProfile from '@/components/UserProfile.vue'
import Avatar from '@/components/Avatar.vue'
import { useNotificationSound } from '@/composables/useNotificationSound'
import { normalizeMessageType } from '@/utils/messageType'

const router = useRouter()
const authStore = useAuthStore()
const dialogsStore = useDialogsStore()
const messagesStore = useMessagesStore()

const isCreateDialogOpen = ref(false)
const isCreateGroupOpen = ref(false)
const isAddMembersOpen = ref(false)
const isPublicGroupsOpen = ref(false)
const isCreateBusinessContactOpen = ref(false)
const isSelectBusinessContactOpen = ref(false)
const isUserProfileOpen = ref(false)
const isContextMenuOpen = ref(false)
const currentUserAvatar = ref<string | null>(null)
const currentGroupDialogId = ref<string | null>(null)
const currentGroupMemberIds = ref<string[]>([])

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

  // Setup click outside handler for context menu
  document.addEventListener('click', handleClickOutside)
})

onBeforeUnmount(() => {
  document.removeEventListener('click', handleClickOutside)
})

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

const handleTypingUpdate = (event: any) => {
  console.log('✍️ Typing update received:', event)
  const dialogId =
    event.dialogId ??
    event.data?.dialogId ??
    event?.update?.dialogId

  if (!dialogId || dialogId !== dialogsStore.currentDialog?.dialogId) {
    return
  }

  const userId =
    event.userId ??
    event.data?.userId ??
    event.data?.typing?.userId

  if (!userId) {
    return
  }

  const expiresInMs =
    event.expiresInMs ??
    event.data?.expiresInMs ??
    event.data?.expiresIn ??
    event.data?.typing?.expiresInMs ??
    5000

  const userName =
    event.userName ??
    event.userInfo?.name ??
    event.data?.typing?.userInfo?.name ??
    event.data?.userName ??
    event.data?.name

  messagesStore.addTypingUser(dialogId, userId, expiresInMs, userName)
}

onUnmounted(() => {
  // Clean up WebSocket listeners
  websocket.off('chat3:update', handleChat3Update)
  websocket.off('message:update', handleMessageUpdate)
  websocket.off('dialog:update', handleDialogUpdate)
  websocket.off('typing:update', handleTypingUpdate)
  websocket.off('connected', handleReconnect)
  
  // Clean up audio
  cleanupAudio()
})

function setupWebSocketListeners() {
  // ✅ RabbitMQ Chat3 Updates
  websocket.on('chat3:update', handleChat3Update)
  websocket.on('message:update', handleMessageUpdate)
  websocket.on('dialog:update', handleDialogUpdate)
  websocket.on('typing:update', handleTypingUpdate)
  websocket.on('connected', handleReconnect)
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

    case 'dialog.typing':
      {
        const typingPayload = update.data?.typing || {}
        handleTypingUpdate({
          dialogId: update.dialogId || update.data?.dialogId,
          userId: typingPayload.userId || update.data?.userId,
          userName: typingPayload.userInfo?.name || update.data?.userName,
          userInfo: typingPayload.userInfo,
          expiresInMs:
            typingPayload.expiresInMs ||
            update.data?.expiresInMs ||
            update.data?.expiresIn
        })
      }
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
  const normalizedType = normalizeMessageType(message.type, message.meta)
  const isSystemMessage = normalizedType === 'system'

  if (isFromOtherUser && !isSystemMessage) {
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
  if (!update?.data) {
    return
  }

  const payload = update.data
  const payloadMessage = payload.message || payload
  const messageId = payload.messageId || payload._id || payloadMessage?.messageId || payloadMessage?._id

  if (!messageId) {
    console.warn('⚠️ handleMessageUpdate: messageId is missing in payload', update)
    return
  }

  const existingMessage = messagesStore.messages.find(
    (m) => m.messageId === messageId || m._id === messageId
  )

  if (update.eventType === 'message.status.update') {
    const normalizedMessage = payloadMessage
    if (!normalizedMessage) {
      console.warn('⚠️ handleMessageUpdate: message payload is empty for status update', update)
      return
    }

    messagesStore.updateMessage(messageId, normalizedMessage)

    const currentUserId = authStore.user?.userId
    const updatedDialogId = normalizedMessage.dialogId

    if (currentUserId && updatedDialogId) {
      const previousStatus = existingMessage?.statuses?.find((s: any) => s.userId === currentUserId)?.status
      const updatedStatus = normalizedMessage.statuses?.find((s: any) => s.userId === currentUserId)?.status

      if (previousStatus !== 'read' && updatedStatus === 'read') {
        if (updatedDialogId !== dialogsStore.currentDialog?.dialogId) {
          const dialog = dialogsStore.dialogs.find((d) => d.dialogId === updatedDialogId)
          if (dialog && dialog.unreadCount > 0) {
            dialogsStore.updateDialogUnreadCount(updatedDialogId, dialog.unreadCount - 1)
          }
        }
      }
    }
  } else {
    console.log('📝 Updating message with payload:', payloadMessage)
    messagesStore.updateMessage(messageId, payloadMessage)
  }
}

function handleDialogUpdate(update: any) {
  // Refresh dialogs on dialog updates
  dialogsStore.fetchDialogs()
}

async function selectDialog(dialogId: string) {
  console.log('➡️ Selecting dialog:', dialogId)
  await dialogsStore.selectDialog(dialogId)
  
  if (dialogsStore.currentDialog) {
    console.log('✅ Current dialog set:', dialogsStore.currentDialog.dialogId)
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

function handleLeftGroup() {
  // Clear current dialog when user leaves group
  dialogsStore.currentDialog = null
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

// Create Group Modal functions
function openCreateGroup() {
  isCreateGroupOpen.value = true
}

function closeCreateGroup() {
  isCreateGroupOpen.value = false
}

async function handleGroupCreated(dialogId: string) {
  try {
    // Close create group modal
    closeCreateGroup()
    
    // Reload dialogs to get the new group
    await dialogsStore.fetchDialogs()
    
    // Get dialog members to exclude them from add members modal
    const dialogResponse = await api.getDialogMembers(dialogId)
    if (dialogResponse.success && dialogResponse.data) {
      currentGroupMemberIds.value = dialogResponse.data.map((member: any) => member.userId)
    }
    
    // Open add members modal
    currentGroupDialogId.value = dialogId
    isAddMembersOpen.value = true
  } catch (error: any) {
    console.error('Failed to open add members modal:', error)
    alert('Группа создана, но не удалось открыть окно добавления участников')
  }
}

// Add Group Members Modal functions
function closeAddMembers() {
  isAddMembersOpen.value = false
  currentGroupDialogId.value = null
  currentGroupMemberIds.value = []
}

async function handleMembersAdded() {
  try {
    // Close add members modal
    closeAddMembers()
    
    // Reload dialogs to update member count
    await dialogsStore.fetchDialogs()
    
    // If current dialog is the group, reload it
    if (currentGroupDialogId.value && dialogsStore.currentDialog?.dialogId === currentGroupDialogId.value) {
      await selectDialog(currentGroupDialogId.value)
    }
  } catch (error: any) {
    console.error('Failed to reload dialogs after adding members:', error)
  }
}

// Public Groups Modal functions
function openPublicGroups() {
  isPublicGroupsOpen.value = true
}

function closePublicGroups() {
  isPublicGroupsOpen.value = false
}

function openCreateBusinessContact() {
  isCreateBusinessContactOpen.value = true
}

function closeCreateBusinessContact() {
  isCreateBusinessContactOpen.value = false
}

function openSelectBusinessContact() {
  isSelectBusinessContactOpen.value = true
}

function closeSelectBusinessContact() {
  isSelectBusinessContactOpen.value = false
}

async function handleContactSelected(contactId: string) {
  try {
    // Get or create dialog for this contact
    const response = await api.getOrCreateContactDialog(contactId)
    
    if (response.success && response.data) {
      const dialog = response.data.dialog
      
      // Refresh dialogs list to include the new/updated dialog
      await dialogsStore.fetchDialogs({ page: 1 })
      
      // Set the dialog as current
      dialogsStore.setCurrentDialog(dialog)
      
      // Load messages for the dialog
      await messagesStore.fetchMessages(dialog.dialogId)
    } else {
      console.error('Failed to get or create dialog:', response.error)
    }
  } catch (error) {
    console.error('Error handling contact selection:', error)
  }
}

function toggleContextMenu() {
  isContextMenuOpen.value = !isContextMenuOpen.value
}

function closeContextMenu() {
  isContextMenuOpen.value = false
}

function handleMenuAction(action: string) {
  closeContextMenu()
  
  switch (action) {
    case 'create-dialog':
      openCreateDialog()
      break
    case 'create-group':
      openCreateGroup()
      break
    case 'public-groups':
      openPublicGroups()
      break
    case 'select-business-contact':
      openSelectBusinessContact()
      break
    case 'create-business-contact':
      openCreateBusinessContact()
      break
  }
}

function handleClickOutside(event: MouseEvent) {
  const target = event.target as HTMLElement
  const menuButton = target.closest('[title="Меню действий"]')
  const menu = target.closest('.absolute.right-0.top-full')
  
  if (!menuButton && !menu && isContextMenuOpen.value) {
    closeContextMenu()
  }
}

async function handleGroupJoined(dialogId: string) {
  try {
    // Close public groups modal
    closePublicGroups()
    
    // Reload dialogs to get the new group
    await dialogsStore.fetchDialogs()
    
    // Open the joined group
    await selectDialog(dialogId)
  } catch (error: any) {
    console.error('Failed to open joined group:', error)
  }
}
</script>

<style scoped>
.menu-enter-active,
.menu-leave-active {
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.menu-enter-from,
.menu-leave-to {
  opacity: 0;
  transform: translateY(-4px);
}
</style>

