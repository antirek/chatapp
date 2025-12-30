<template>
  <Transition name="modal">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-50 overflow-y-auto"
      @click.self="close"
    >
      <div class="flex items-center justify-center min-h-screen px-4 pt-4 pb-20 text-center sm:block sm:p-0">
        <div class="fixed inset-0 transition-opacity bg-gray-500 bg-opacity-75" @click="close"></div>

        <div class="inline-block align-bottom bg-white rounded-lg text-left overflow-hidden shadow-xl transform transition-all sm:my-8 sm:align-middle sm:max-w-lg sm:w-full">
          <div class="bg-white px-4 pt-5 pb-4 sm:p-6 sm:pb-4">
            <div class="flex items-center justify-between mb-4">
              <h3 class="text-lg font-medium text-gray-900">Создать топик</h3>
              <button
                @click="close"
                class="text-gray-400 hover:text-gray-500"
              >
                <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            <form @submit.prevent="handleSubmit">
              <div class="space-y-4">
                <!-- Topic Name -->
                <div>
                  <label for="topic-name" class="block text-sm font-medium text-gray-700 mb-1">
                    Название топика <span class="text-red-500">*</span>
                  </label>
                  <input
                    id="topic-name"
                    v-model="form.name"
                    type="text"
                    required
                    maxlength="100"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Например: Важная тема"
                  />
                </div>

                <!-- Topic Color -->
                <div>
                  <label for="topic-color" class="block text-sm font-medium text-gray-700 mb-1">
                    Цвет (опционально)
                  </label>
                  <div class="flex items-center gap-3">
                    <input
                      id="topic-color"
                      v-model="form.color"
                      type="color"
                      class="w-16 h-10 border border-gray-300 rounded cursor-pointer"
                    />
                    <input
                      v-model="form.color"
                      type="text"
                      pattern="^#[0-9A-Fa-f]{6}$"
                      maxlength="7"
                      class="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                      placeholder="#FF5733"
                    />
                  </div>
                </div>

                <!-- Topic Description -->
                <div>
                  <label for="topic-description" class="block text-sm font-medium text-gray-700 mb-1">
                    Описание (опционально)
                  </label>
                  <textarea
                    id="topic-description"
                    v-model="form.description"
                    rows="3"
                    maxlength="500"
                    class="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-primary-500 focus:border-transparent"
                    placeholder="Краткое описание топика"
                  ></textarea>
                </div>
              </div>

              <!-- Error Message -->
              <div v-if="error" class="mt-4 text-sm text-red-600">
                {{ error }}
              </div>

              <!-- Actions -->
              <div class="mt-6 flex justify-end gap-3">
                <button
                  type="button"
                  @click="close"
                  class="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500"
                >
                  Отмена
                </button>
                <button
                  type="submit"
                  :disabled="isSubmitting || !form.name.trim()"
                  class="px-4 py-2 text-sm font-medium text-white bg-primary-600 rounded-lg hover:bg-primary-700 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-primary-500 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {{ isSubmitting ? 'Создание...' : 'Создать' }}
                </button>
              </div>
            </form>
          </div>
        </div>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { useTopicsStore } from '@/stores/topics'

interface Props {
  isOpen: boolean
  dialogId: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'close': []
  'created': [topic: any]
}>()

const topicsStore = useTopicsStore()

const form = ref({
  name: '',
  color: '#3B82F6', // Default blue
  description: '',
})

const error = ref('')
const isSubmitting = ref(false)

watch(() => props.isOpen, (newVal) => {
  if (newVal) {
    // Reset form when opening
    form.value = {
      name: '',
      color: '#3B82F6',
      description: '',
    }
    error.value = ''
  }
})

async function handleSubmit() {
  if (!form.value.name.trim()) {
    error.value = 'Название топика обязательно'
    return
  }

  isSubmitting.value = true
  error.value = ''

  try {
    const topic = await topicsStore.createTopic(props.dialogId, {
      meta: {
        name: form.value.name.trim(),
        ...(form.value.color && { color: form.value.color }),
        ...(form.value.description.trim() && { description: form.value.description.trim() }),
      },
    })

    emit('created', topic)
    close()
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || 'Ошибка при создании топика'
  } finally {
    isSubmitting.value = false
  }
}

function close() {
  emit('close')
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.3s;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>
