<template>
  <div class="flex-1 overflow-y-auto">
    <!-- Loading State -->
    <div v-if="dialogsStore.isLoading" class="flex items-center justify-center p-8">
      <div class="text-gray-400">Загрузка...</div>
    </div>

    <!-- Dialogs -->
    <div v-else-if="dialogsStore.dialogs.length > 0" class="divide-y divide-gray-200">
      <button
        v-for="dialog in dialogsStore.dialogs"
        :key="dialog.dialogId"
        @click="$emit('select', dialog.dialogId)"
        class="w-full p-4 text-left hover:bg-gray-50 transition-colors relative"
        :class="{ 'bg-primary-50': isActive(dialog.dialogId) }"
      >
        <!-- Dialog Name -->
        <div class="flex items-start justify-between mb-1">
          <h3 class="font-semibold text-gray-900 truncate flex-1">
            {{ dialog.dialogName }}
          </h3>
          
          <!-- Time -->
          <span v-if="dialog.lastMessageAt" class="text-xs text-gray-500 ml-2">
            {{ formatTime(dialog.lastMessageAt) }}
          </span>
        </div>

        <!-- Last Message -->
        <p v-if="dialog.lastMessage" class="text-sm text-gray-600 truncate">
          {{ dialog.lastMessage.content }}
        </p>

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
import { useDialogsStore } from '@/stores/dialogs'

defineEmits<{
  select: [dialogId: string]
}>()

const dialogsStore = useDialogsStore()

function isActive(dialogId: string): boolean {
  return dialogsStore.currentDialog?.dialogId === dialogId
}

function formatTime(timestamp: string): string {
  const date = new Date(timestamp)
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

