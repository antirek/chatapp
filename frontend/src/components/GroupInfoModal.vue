<template>
  <div
    v-if="isOpen && dialog"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="close"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Информация о группе</h2>
        <button
          @click="close"
          class="text-gray-400 hover:text-gray-600 transition-colors"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Group Info -->
      <div class="p-6 flex-shrink-0">
        <!-- Group Name -->
        <div class="flex flex-col items-center mb-6">
          <div class="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-3">
            <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
            </svg>
          </div>
          <h3 class="text-xl font-semibold text-gray-900 text-center">{{ dialog.name || 'Группа' }}</h3>
        </div>
      </div>

      <!-- Group Stats -->
      <div class="flex-1 overflow-y-auto border-t border-gray-200">
        <div class="p-6 space-y-4">
          <div class="flex items-center justify-between">
            <div class="text-sm font-semibold text-gray-700">Участники</div>
            <div class="text-sm text-gray-600 flex items-center space-x-2">
              <svg
                v-if="isLoadingInfo"
                class="animate-spin h-4 w-4 text-gray-400"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span v-else>{{ totalMembersLabel }}</span>
            </div>
          </div>

          <div class="rounded-lg border border-dashed border-gray-200 bg-gray-50 p-4 text-sm text-gray-600">
            Управляйте участниками через кнопку ниже. Используйте поиск в форме добавления, чтобы найти нужных людей.
          </div>
        </div>
      </div>

      <!-- Actions -->
      <div class="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
        <button
          @click="openAddMembers"
          class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Добавить участников
        </button>
        <button
          v-if="canLeaveGroup"
          @click="leaveGroup"
          :disabled="isLeavingGroup"
          class="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <span v-if="isLeavingGroup">Выход...</span>
          <span v-else>Покинуть группу</span>
        </button>
        <button
          @click="close"
          class="w-full btn-secondary"
        >
          Закрыть
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import { useDialogsStore } from '@/stores/dialogs'
import type { Dialog } from '@/types'

const props = defineProps<{
  isOpen: boolean
  dialog: Dialog | null
}>()

const emit = defineEmits<{
  close: []
  'add-members': []
  'left-group': []
}>()

const authStore = useAuthStore()
const dialogsStore = useDialogsStore()

const totalMembers = ref<number | null>(null)
const isLoadingInfo = ref(false)
const isLeavingGroup = ref(false)
const currentUserRole = ref<string | null>(null)

const currentUserMember = computed(() => {
  if (!authStore.user?.userId || !currentUserRole.value) {
    return null
  }

  return {
    userId: authStore.user.userId,
    role: currentUserRole.value
  }
})

const isCurrentUserOwner = computed(() => currentUserMember.value?.role === 'owner')

const canLeaveGroup = computed(() => currentUserMember.value !== null && !isCurrentUserOwner.value)

const totalMembersLabel = computed(() => {
  if (isLoadingInfo.value) {
    return '—'
  }

  if (typeof totalMembers.value === 'number') {
    return totalMembers.value
  }

  return '—'
})

watch(() => props.isOpen, (newValue) => {
  if (newValue && props.dialog) {
    loadMembersInfo()
  } else {
    totalMembers.value = null
    currentUserRole.value = null
  }
})

async function loadMembersInfo() {
  if (!props.dialog) return

  isLoadingInfo.value = true

  try {
    const response = await api.getDialogMembers(props.dialog.dialogId)

    if (response.success && Array.isArray(response.data)) {
      const members = response.data as Array<{ userId: string; role?: string | null }>
      totalMembers.value = members.length

      const currentUserId = authStore.user?.userId
      if (currentUserId) {
        const currentMember = members.find(member => member.userId === currentUserId)
        currentUserRole.value = currentMember?.role || null
      } else {
        currentUserRole.value = null
      }
    } else {
      totalMembers.value = null
      currentUserRole.value = null
    }
  } catch (error) {
    console.error('Failed to load members info:', error)
    totalMembers.value = null
    currentUserRole.value = null
  } finally {
    isLoadingInfo.value = false
  }
}

function close() {
  emit('close')
}

function openAddMembers() {
  emit('add-members')
}

async function leaveGroup() {
  if (!props.dialog || !authStore.user?.userId || !canLeaveGroup.value) return

  if (!confirm('Вы уверены, что хотите покинуть группу?')) {
    return
  }

  isLeavingGroup.value = true

  try {
    await api.removeDialogMember(props.dialog.dialogId, authStore.user.userId)

    await dialogsStore.fetchDialogs()

    emit('left-group')
    emit('close')
  } catch (error: any) {
    console.error('Failed to leave group:', error)
    alert('Не удалось покинуть группу: ' + (error?.response?.data?.error || error?.message || 'Неизвестная ошибка'))
  } finally {
    isLeavingGroup.value = false
  }
}
</script>

