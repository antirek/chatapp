<template>
  <div class="h-screen flex">
    <!-- Sidebar with dialogs -->
    <div class="w-80 bg-white border-r border-gray-200 flex flex-col">
      <!-- Current User Info -->
      <div v-if="authStore.user" class="p-3 bg-gradient-to-r from-blue-50 to-indigo-50 border-b border-gray-200">
        <div class="flex items-center space-x-3">
          <!-- Avatar with initials -->
          <div class="w-10 h-10 rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 flex items-center justify-center text-white font-semibold shadow-md">
            {{ getUserInitials(authStore.user.name) }}
          </div>
          
          <!-- User info -->
          <div class="flex-1 min-w-0">
            <div class="font-semibold text-gray-900 text-sm truncate">
              {{ authStore.user.name }}
            </div>
            <div class="text-xs text-gray-600">
              {{ formatPhone(authStore.user.phone) }}
            </div>
          </div>

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
      <ChatWindow v-if="dialogsStore.currentDialog" :dialog="dialogsStore.currentDialog" />
      
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

const router = useRouter()
const authStore = useAuthStore()
const dialogsStore = useDialogsStore()
const messagesStore = useMessagesStore()

const isCreateDialogOpen = ref(false)

onMounted(async () => {
  // Load dialogs
  await dialogsStore.fetchDialogs()

  // Setup WebSocket listeners
  setupWebSocketListeners()
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

function handleReconnect() {
  // ✅ Pure RabbitMQ - queue resumes automatically on reconnect
  console.log('🔄 WebSocket reconnected, updates will come through RabbitMQ')
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
      // Message updated (status, reactions, etc.)
      handleMessageUpdate(update)
      break
    
    case 'dialog.update':
      // Dialog updated
      handleDialogUpdate(update)
      break
    
    default:
      console.log('⚠️  Unknown update type:', update.eventType)
  }
}

function handleNewMessage(message: any) {
  // Add to messages store if in current dialog
  if (message.dialogId === dialogsStore.currentDialog?.dialogId) {
    messagesStore.addMessage(message)
  }

  // Update dialog last message
  dialogsStore.updateLastMessage(message.dialogId, message)

  // Increment unread count if not current dialog
  if (message.dialogId !== dialogsStore.currentDialog?.dialogId) {
    dialogsStore.incrementUnreadCount(message.dialogId)
  }
}

function handleMessageUpdate(update: any) {
  // Handle message updates (reactions, status, etc.)
  if (update.data && update.data._id) {
    messagesStore.updateMessage(update.data._id, update.data)
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
  }
}

function logout() {
  authStore.logout()
  router.push({ name: 'login' })
}

function getUserInitials(name: string): string {
  if (!name) return '?'
  
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
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

