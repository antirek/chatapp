<template>
  <div class="p-4 bg-white border-t border-gray-200 relative">
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

    <!-- Command Autocomplete Menu -->
    <div
      v-if="showCommandMenu && filteredCommands.length > 0"
      class="absolute bottom-full left-4 right-4 mb-2 bg-white border border-gray-200 rounded-lg shadow-lg max-h-64 overflow-y-auto z-50"
    >
      <div
        v-for="(command, index) in filteredCommands"
        :key="`${command.botId}-${command.command.name}-${index}`"
        @mousedown.prevent="selectCommand(command)"
        class="px-4 py-2 hover:bg-gray-100 cursor-pointer transition-colors"
        :class="{ 'bg-primary-50': index === selectedCommandIndex }"
      >
        <div class="flex items-center justify-between">
          <div class="flex-1">
            <div class="text-sm font-medium text-gray-900">
              /{{ command.command.name }}@{{ command.botId }}
            </div>
            <div v-if="command.command.description" class="text-xs text-gray-500 mt-0.5">
              {{ command.command.description }}
            </div>
            <div v-if="command.command.usage" class="text-xs text-gray-400 mt-0.5 font-mono">
              {{ command.command.usage }}
            </div>
          </div>
          <div class="text-xs text-gray-400 ml-2">
            {{ command.botName }}
          </div>
        </div>
      </div>
    </div>

    <form @submit.prevent="sendMessage" class="flex flex-col gap-2">
      <input
        ref="fileInput"
        type="file"
        accept="image/*"
        class="hidden"
        @change="handleFileChange"
      />

      <div class="flex gap-2 relative">
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
          ref="messageInput"
          v-model="messageText"
          type="text"
          placeholder="Напишите сообщение..."
          class="input flex-1"
          @focus="handleFocus"
          @blur="handleBlur"
          @input="handleInput"
          @keydown="handleKeyDown"
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
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useDialogsStore } from '@/stores/dialogs'
import { useMessagesStore } from '@/stores/messages'
import { uploadImageToFilebump } from '@/services/filebump'
import api from '@/services/api'
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

interface BotCommand {
  botId: string
  name: string
  commands: Array<{
    name: string
    description?: string
    usage?: string
  }>
}

interface CommandItem {
  botId: string
  botName: string
  command: {
    name: string
    description?: string
    usage?: string
  }
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
const messageInput = ref<HTMLInputElement | null>(null)
let typingTimeout: ReturnType<typeof setTimeout> | null = null

// Command autocomplete
const botCommands = ref<BotCommand[]>([])
const showCommandMenu = ref(false)
const selectedCommandIndex = ref(0)
const commandPrefix = ref('')

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
  // Reload bot commands in case they changed
  void loadBotCommands()
}

function handleBlur() {
  // User left input
  if (isTyping.value) {
    stopTyping()
  }
  
  // Hide command menu with small delay to allow clicking on command
  setTimeout(() => {
    showCommandMenu.value = false
  }, 200)
}

function handleInput() {
  if (!dialogsStore.currentDialog) return

  // Check for command prefix "/"
  const text = messageText.value
  const lastSlashIndex = text.lastIndexOf('/')
  
  if (lastSlashIndex >= 0) {
    // Check if there's a space after the slash (command already entered)
    const afterSlash = text.substring(lastSlashIndex + 1)
    const hasSpace = afterSlash.includes(' ')
    
    if (!hasSpace) {
      // Show command menu
      commandPrefix.value = afterSlash.toLowerCase()
      console.log('🔍 Command prefix:', commandPrefix.value, 'All commands:', allCommands.value, 'Filtered:', filteredCommands.value)
      showCommandMenu.value = filteredCommands.value.length > 0
      selectedCommandIndex.value = 0
    } else {
      // Command already entered, hide menu
      showCommandMenu.value = false
    }
  } else {
    // No slash, hide menu
    showCommandMenu.value = false
  }

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

function handleKeyDown(event: KeyboardEvent) {
  if (!showCommandMenu.value || filteredCommands.value.length === 0) {
    return
  }

  if (event.key === 'ArrowDown') {
    event.preventDefault()
    selectedCommandIndex.value = Math.min(
      selectedCommandIndex.value + 1,
      filteredCommands.value.length - 1
    )
  } else if (event.key === 'ArrowUp') {
    event.preventDefault()
    selectedCommandIndex.value = Math.max(selectedCommandIndex.value - 1, 0)
  } else if (event.key === 'Enter' && filteredCommands.value.length > 0) {
    event.preventDefault()
    const command = filteredCommands.value[selectedCommandIndex.value]
    if (command) {
      selectCommand(command)
    }
  } else if (event.key === 'Escape') {
    event.preventDefault()
    showCommandMenu.value = false
  }
}

// Flatten commands from all bots into a single list
const allCommands = computed<CommandItem[]>(() => {
  const commands: CommandItem[] = []
  for (const bot of botCommands.value) {
    for (const command of bot.commands) {
      commands.push({
        botId: bot.botId,
        botName: bot.name,
        command,
      })
    }
  }
  return commands
})

// Filter commands based on prefix
const filteredCommands = computed<CommandItem[]>(() => {
  if (!commandPrefix.value) {
    return allCommands.value
  }
  
  const prefix = commandPrefix.value.toLowerCase()
  return allCommands.value.filter(item => {
    const commandName = item.command.name.toLowerCase()
    const botId = item.botId.toLowerCase()
    return commandName.startsWith(prefix) || botId.includes(prefix)
  })
})

function selectCommand(command: CommandItem) {
  const text = messageText.value
  const lastSlashIndex = text.lastIndexOf('/')
  
  if (lastSlashIndex >= 0) {
    // Replace text from "/" to cursor with command
    const beforeSlash = text.substring(0, lastSlashIndex)
    const commandText = `/${command.command.name}@${command.botId}`
    messageText.value = beforeSlash + commandText + ' '
  } else {
    messageText.value = `/${command.command.name}@${command.botId} `
  }
  
  showCommandMenu.value = false
  messageInput.value?.focus()
}

async function loadBotCommands() {
  if (!dialogsStore.currentDialog) {
    botCommands.value = []
    return
  }

  try {
    const response = await api.getDialogBotCommands(dialogsStore.currentDialog.dialogId)
    console.log('📋 Bot commands response:', response)
    if (response.success && response.data) {
      botCommands.value = response.data
      console.log('✅ Loaded bot commands:', botCommands.value)
    } else {
      botCommands.value = []
      console.log('⚠️ No bot commands in response')
    }
  } catch (error) {
    console.error('❌ Failed to load bot commands:', error)
    botCommands.value = []
  }
}

// Watch for dialog changes
watch(() => dialogsStore.currentDialog?.dialogId, () => {
  void loadBotCommands()
})

// Load commands on mount
onMounted(() => {
  void loadBotCommands()
})

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

