<template>
  <div class="p-4 bg-white border-t border-gray-200">
    <!-- Quoted Message Preview -->
    <div
      v-if="quotedMessage"
      class="mb-2 p-2 bg-gray-100 rounded border-l-4 border-primary-500 flex items-start justify-between gap-2"
    >
      <div class="flex-1 min-w-0">
        <div class="text-xs font-medium text-gray-600 mb-1">
          {{ getQuotedMessageSenderName(quotedMessage) }}
        </div>
        <div class="text-sm text-gray-700 line-clamp-2">
          <template v-if="isQuotedMessageImage(quotedMessage)">
            <div class="flex items-center gap-2">
              <img
                :src="getQuotedMessageImageUrl(quotedMessage)"
                alt="Quoted image"
                class="w-12 h-12 object-cover rounded"
              />
              <span class="text-xs text-gray-500">Изображение</span>
            </div>
          </template>
          <template v-else>
            {{ quotedMessage.content || 'Сообщение' }}
          </template>
        </div>
      </div>
      <button
        @click="handleCancelQuote"
        class="flex-shrink-0 p-1 text-gray-400 hover:text-gray-600 transition-colors"
        title="Отменить цитирование"
      >
        <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
        </svg>
      </button>
    </div>

    <form @submit.prevent="sendMessage" class="flex flex-col gap-2">
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleFileChange"
      />

      <div class="flex gap-2">
        <button
          type="button"
          class="p-2 rounded-lg border border-gray-200 text-gray-600 hover:bg-gray-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          title="Прикрепить изображение"
          @click="triggerImagePicker"
          :disabled="isUploading"
        >
          <svg
            v-if="!isUploading"
            class="w-6 h-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 7a4 4 0 014-4h10a4 4 0 014 4v10a4 4 0 01-4 4H7a4 4 0 01-4-4V7z" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 16l5-5a2 2 0 012.828 0L18 18" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M14 14l1-1a2 2 0 012.828 0L21 16" />
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 8a1 1 0 100-2 1 1 0 000 2z" />
          </svg>
          <svg
            v-else
            class="w-6 h-6 animate-spin"
            xmlns="http://www.w3.org/2000/svg"
            fill="none"
            viewBox="0 0 24 24"
          >
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"></path>
          </svg>
        </button>

        <input
          v-model="messageText"
          type="text"
          placeholder="Напишите сообщение..."
          class="input flex-1"
          @focus="handleFocus"
          @blur="handleBlur"
          @input="handleInput"
          :disabled="isUploading"
        />
        <button
          type="submit"
          class="btn-primary"
          :disabled="!messageText.trim() || isUploading"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
          </svg>
        </button>
      </div>

      <p v-if="uploadError" class="text-xs text-red-500">{{ uploadError }}</p>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref, computed } from 'vue'
import { useDialogsStore } from '@/stores/dialogs'
import { useMessagesStore } from '@/stores/messages'
import { uploadImageToFilebump } from '@/services/filebump'
import type { Message } from '@/types'

interface ImageMessagePayload {
  url: string
  fileId?: string | null
  originalName: string
  mimeType: string
  size: number
  width?: number
  height?: number
}

const props = defineProps<{
  quotedMessage?: Message | null
}>()

const emit = defineEmits<{
  send: [content: string]
  'send-image': [payload: ImageMessagePayload]
  'cancel-quote': []
}>()

const dialogsStore = useDialogsStore()
const messagesStore = useMessagesStore()

const messageText = ref('')
const isTyping = ref(false)
const isUploading = ref(false)
const uploadError = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
let typingTimeout: ReturnType<typeof setTimeout> | null = null

function sendMessage() {
  const text = messageText.value.trim()
  if (!text) return

  emit('send', text)
  messageText.value = ''

  // Stop typing indicator
  if (isTyping.value) {
    stopTyping()
  }
}

function handleCancelQuote() {
  emit('cancel-quote')
}

function getQuotedMessageSenderName(quotedMessage: Message): string {
  // First try sender from message
  if (quotedMessage.sender?.name) {
    return quotedMessage.sender.name
  }
  // Then try to get from messagesStore (if message is in current dialog)
  const messagesStore = useMessagesStore()
  const originalMessage = messagesStore.messages.find(
    (m) => (m.messageId || m._id) === (quotedMessage.messageId || quotedMessage._id)
  )
  if (originalMessage?.sender?.name) {
    return originalMessage.sender.name
  }
  return quotedMessage.senderId || 'Пользователь'
}

function isQuotedMessageImage(quotedMessage: Message): boolean {
  const type = quotedMessage.type || ''
  return type.includes('image') || !!quotedMessage.meta?.url
}

function getQuotedMessageImageUrl(quotedMessage: Message): string {
  return quotedMessage.meta?.url || ''
}

function handleFocus() {
  // User focused on input
}

function handleBlur() {
  // User left input
  if (isTyping.value) {
    stopTyping()
  }
}

function handleInput() {
  if (!dialogsStore.currentDialog) return

  // Start typing indicator
  if (messageText.value.length > 0) {
    if (!isTyping.value) {
      isTyping.value = true
    }
    void messagesStore.sendTypingSignal(dialogsStore.currentDialog.dialogId)
  }

  // Reset timeout
  if (typingTimeout) {
    clearTimeout(typingTimeout)
  }

  // Stop typing after 3 seconds of inactivity
  typingTimeout = setTimeout(() => {
    if (isTyping.value) {
      stopTyping()
    }
  }, 3000)
}

function stopTyping() {
  if (!dialogsStore.currentDialog) return

  isTyping.value = false

  if (typingTimeout) {
    clearTimeout(typingTimeout)
    typingTimeout = null
  }
}

function triggerImagePicker() {
  fileInput.value?.click()
}

async function handleFileChange(event: Event) {
  const input = event.target as HTMLInputElement
  if (!input.files || input.files.length === 0) {
    return
  }

  const file = input.files[0]

  if (!file.type.startsWith('image/')) {
    uploadError.value = 'Можно загружать только изображения'
    input.value = ''
    return
  }

  uploadError.value = null
  isUploading.value = true

  try {
    const result = await uploadImageToFilebump(file)
    const dimensions = await readImageDimensions(file)

    emit('send-image', {
      url: result.url,
      fileId: result.fileId,
      originalName: result.originalName,
      mimeType: result.mimeType,
      size: file.size,
      width: dimensions?.width,
      height: dimensions?.height
    })
  } catch (error: any) {
    console.error('Failed to upload image:', error)
    uploadError.value = error?.response?.data?.error || error?.message || 'Не удалось загрузить изображение'
  } finally {
    isUploading.value = false
    if (input) {
      input.value = ''
    }
  }
}

function readImageDimensions(file: File): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(file)
    const image = new Image()

    image.onload = () => {
      resolve({ width: image.width, height: image.height })
      URL.revokeObjectURL(url)
    }

    image.onerror = () => {
      resolve(null)
      URL.revokeObjectURL(url)
    }

    image.src = url
  })
}
</script>

