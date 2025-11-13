<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        @click.self="close"
      >
        <div class="bg-white rounded-lg shadow-xl w-full max-w-md mx-4">
          <div class="p-6">
            <div class="flex items-center justify-between mb-4">
              <h2 class="text-lg font-semibold text-gray-900">Создать бизнес-контакт</h2>
              <button
                @click="close"
                class="text-gray-400 hover:text-gray-600 transition-colors"
                aria-label="Закрыть"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form @submit.prevent="handleSubmit" class="space-y-4">
              <div>
                <label for="contact-name" class="block text-sm font-medium text-gray-700 mb-1">
                  Имя
                </label>
                <input
                  id="contact-name"
                  v-model="form.name"
                  type="text"
                  required
                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  placeholder="Введите имя контакта"
                />
              </div>

              <div>
                <label for="contact-phone" class="block text-sm font-medium text-gray-700 mb-1">
                  Телефон
                </label>
                <input
                  id="contact-phone"
                  v-model="form.phone"
                  type="tel"
                  required
                  pattern="^79\d{9}$"
                  class="w-full rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                  placeholder="79991234567"
                />
                <p class="mt-1 text-xs text-gray-500">
                  Формат: 79XXXXXXXXX (11 цифр, начинается с 79)
                </p>
              </div>

              <div v-if="error" class="p-3 bg-red-50 border border-red-200 rounded-lg">
                <p class="text-sm text-red-600">{{ error }}</p>
              </div>

              <div class="flex items-center justify-end gap-3 pt-2">
                <button
                  type="button"
                  @click="close"
                  class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  :disabled="isSubmitting || !form.name.trim() || !form.phone.trim()"
                  class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <span v-if="isSubmitting">Создание...</span>
                  <span v-else>Добавить</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import api from '@/services/api'
import { useDialogsStore } from '@/stores/dialogs'
import { useRouter } from 'vue-router'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
}>()

const dialogsStore = useDialogsStore()
const router = useRouter()

const form = ref({
  name: '',
  phone: '',
})

const error = ref<string | null>(null)
const isSubmitting = ref(false)

watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    // Reset form when modal opens
    form.value = { name: '', phone: '' }
    error.value = null
    isSubmitting.value = false
  }
})

function close() {
  if (!isSubmitting.value) {
    emit('close')
  }
}

async function handleSubmit() {
  if (!form.value.name.trim() || !form.value.phone.trim()) {
    error.value = 'Заполните все поля'
    return
  }

  // Normalize phone number (remove + if present)
  const normalizedPhone = form.value.phone.replace(/^\+/, '')

  // Validate phone format
  const phoneRegex = /^79\d{9}$/
  if (!phoneRegex.test(normalizedPhone)) {
    error.value = 'Неверный формат телефона. Ожидается: 79XXXXXXXXX'
    return
  }

  error.value = null
  isSubmitting.value = true

  try {
    const response = await api.createBusinessContact({
      name: form.value.name.trim(),
      phone: normalizedPhone,
    })

    if (response.success && response.data?.dialog) {
      // Add dialog to store
      await dialogsStore.fetchDialogs({ page: 1 })
      
      // Select the new dialog
      await dialogsStore.selectDialog(response.data.dialog.dialogId)
      
      // Close modal after a short delay to ensure state updates
      setTimeout(() => {
        close()
      }, 100)
    } else {
      error.value = response.error || 'Не удалось создать контакт'
    }
  } catch (err: any) {
    console.error('Error creating business contact:', err)
    const errorMessage = err.response?.data?.error || err.message || 'Не удалось создать контакт'
    error.value = errorMessage
    console.error('Full error response:', err.response?.data)
  } finally {
    isSubmitting.value = false
  }
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>

