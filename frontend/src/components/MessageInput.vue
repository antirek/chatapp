<template>
  <div class="p-4 bg-white border-t border-gray-200">
    <form @submit.prevent="sendMessage" class="flex gap-2">
      <input
        v-model="messageText"
        type="text"
        placeholder="Напишите сообщение..."
        class="input flex-1"
        @focus="handleFocus"
        @blur="handleBlur"
        @input="handleInput"
      />
      <button
        type="submit"
        class="btn-primary"
        :disabled="!messageText.trim()"
      >
        <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
        </svg>
      </button>
    </form>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useDialogsStore } from '@/stores/dialogs'
import { useMessagesStore } from '@/stores/messages'

const emit = defineEmits<{
  send: [content: string]
}>()

const dialogsStore = useDialogsStore()
const messagesStore = useMessagesStore()

const messageText = ref('')
const isTyping = ref(false)
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
  if (!isTyping.value && messageText.value.length > 0) {
    isTyping.value = true
    messagesStore.startTyping(dialogsStore.currentDialog.dialogId)
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
  messagesStore.stopTyping(dialogsStore.currentDialog.dialogId)

  if (typingTimeout) {
    clearTimeout(typingTimeout)
    typingTimeout = null
  }
}
</script>

