<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="close"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Создать группу</h2>
        <button
          @click="close"
          class="text-gray-400 hover:text-gray-600 transition-colors"
          :disabled="isCreating"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Form -->
      <div class="p-4">
        <div class="mb-4">
          <label for="group-name" class="block text-sm font-medium text-gray-700 mb-2">
            Название группы
          </label>
          <input
            id="group-name"
            v-model="groupName"
            type="text"
            placeholder="Введите название группы..."
            class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
            :disabled="isCreating"
            @keyup.enter="createGroup"
          />
        </div>

        <div class="mb-4">
          <label class="block text-sm font-medium text-gray-700 mb-2">
            Тип группы
          </label>
          <div class="space-y-2">
            <label class="flex items-center space-x-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" :class="{ 'border-blue-500 bg-blue-50': groupType === 'private' }">
              <input
                type="radio"
                v-model="groupType"
                value="private"
                class="w-4 h-4 text-blue-600 focus:ring-blue-500"
                :disabled="isCreating"
              />
              <div class="flex-1">
                <div class="font-medium text-gray-900">Приватная</div>
                <div class="text-sm text-gray-500">Только участники могут видеть группу</div>
              </div>
            </label>
            <label class="flex items-center space-x-3 p-3 border border-gray-300 rounded-lg cursor-pointer hover:bg-gray-50 transition-colors" :class="{ 'border-blue-500 bg-blue-50': groupType === 'public' }">
              <input
                type="radio"
                v-model="groupType"
                value="public"
                class="w-4 h-4 text-blue-600 focus:ring-blue-500"
                :disabled="isCreating"
              />
              <div class="flex-1">
                <div class="font-medium text-gray-900">Публичная</div>
                <div class="text-sm text-gray-500">Группа видна всем пользователям</div>
              </div>
            </label>
          </div>
        </div>

        <!-- Error message -->
        <div v-if="error" class="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg">
          <p class="text-sm text-red-600">{{ error }}</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-gray-200 flex items-center justify-end space-x-3">
        <button
          @click="close"
          class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
          :disabled="isCreating"
        >
          Отмена
        </button>
        <button
          @click="createGroup"
          class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          :disabled="!groupName.trim() || isCreating"
        >
          <span v-if="isCreating" class="flex items-center space-x-2">
            <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
            </svg>
            <span>Создание...</span>
          </span>
          <span v-else>Создать</span>
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import api from '@/services/api'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
  'group-created': [dialogId: string]
}>()

const groupName = ref('')
const groupType = ref<'private' | 'public'>('private')
const isCreating = ref(false)
const error = ref('')

// Reset form on open/close
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    groupName.value = ''
    groupType.value = 'private'
    error.value = ''
    isCreating.value = false
  }
})

async function createGroup() {
  if (!groupName.value.trim() || isCreating.value) {
    return
  }

  isCreating.value = true
  error.value = ''

  try {
    const response = await api.createDialog({
      name: groupName.value.trim(),
      memberIds: [],
      chatType: 'group',
      groupType: groupType.value
    })

    if (response.success && response.data) {
      emit('group-created', response.data.dialogId)
      close()
    } else {
      error.value = 'Не удалось создать группу'
    }
  } catch (err: any) {
    console.error('Failed to create group:', err)
    error.value = err.response?.data?.error || 'Ошибка при создании группы'
  } finally {
    isCreating.value = false
  }
}

function close() {
  if (!isCreating.value) {
    emit('close')
  }
}
</script>

