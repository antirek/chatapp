<template>
  <div class="p-6">
    <!-- Group Info -->
    <div class="flex flex-col items-center mb-6">
      <div class="w-24 h-24 rounded-full bg-gradient-to-br from-purple-500 to-pink-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-3">
        <svg class="w-12 h-12" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
        </svg>
      </div>
      <h3 class="text-xl font-semibold text-gray-900 text-center">{{ dialog.name || 'Группа' }}</h3>
    </div>

    <!-- Group Stats -->
    <div class="space-y-4">
      <!-- Dialog ID -->
      <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
        <div class="flex-shrink-0">
          <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
        </div>
        <div class="flex-1 min-w-0">
          <div class="text-xs text-gray-500 mb-1">ID диалога</div>
          <div class="text-sm font-mono text-gray-700 truncate">
            {{ dialog.dialogId }}
          </div>
        </div>
      </div>

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

      <div class="space-y-3">
        <div class="text-sm font-semibold text-gray-700">Владелец и администраторы</div>

        <div v-if="isLoadingInfo && !hasPrivilegedMembers" class="text-sm text-gray-500 flex items-center space-x-2">
          <svg class="animate-spin h-4 w-4 text-gray-400" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Загрузка...</span>
        </div>

        <div v-else-if="hasPrivilegedMembers" class="space-y-3">
          <div
            v-for="member in privilegedMembers"
            :key="member.userId"
            class="flex items-center space-x-3 rounded-lg border border-gray-200 bg-white/70 px-3 py-2"
          >
            <Avatar
              :avatar="member.avatar"
              :name="member.name"
              :userId="member.userId"
              size="sm"
              shape="circle"
            />
            <div class="flex-1">
              <div class="font-medium text-gray-900">{{ member.name }}</div>
              <div class="text-xs text-gray-500">{{ getRoleLabel(member.role) }}</div>
            </div>
          </div>
        </div>

        <div v-else class="text-sm text-gray-500">
          Владелец и администраторы не назначены.
        </div>
      </div>
    </div>

    <!-- Actions -->
    <div class="mt-6 pt-6 border-t border-gray-200 space-y-3">
      <button
        @click="handleAddMembers"
        :disabled="!isCurrentUserOwner"
        class="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        Добавить участников
      </button>
      <p v-if="!isCurrentUserOwner" class="text-xs text-gray-500 text-center">
        Добавлять новых участников может только владелец группы.
      </p>
      <button
        v-if="canLeaveGroup"
        @click="handleLeaveGroup"
        :disabled="isLeavingGroup"
        class="w-full px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <span v-if="isLeavingGroup">Выход...</span>
        <span v-else>Покинуть группу</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import type { Dialog } from '@/types'
import api from '@/services/api'
import { useAuthStore } from '@/stores/auth'
import Avatar from './Avatar.vue'

const props = defineProps<{
  dialog: Dialog
}>()

const emit = defineEmits<{
  close: []
  'add-members': []
  'left-group': []
}>()

const authStore = useAuthStore()
const isLoadingInfo = ref(true)
const members = ref<any[]>([])
const isLeavingGroup = ref(false)

const currentUserId = computed(() => authStore.user?.userId)

const totalMembersLabel = computed(() => {
  if (members.value.length === 0) return '0 участников'
  if (members.value.length === 1) return '1 участник'
  if (members.value.length < 5) return `${members.value.length} участника`
  return `${members.value.length} участников`
})

const privilegedMembers = computed(() => {
  return members.value
    .filter((m: any) => {
      const role = m.role || getMemberRole(m.userId)
      return role === 'owner' || role === 'admin'
    })
    .map((m: any) => ({
      userId: m.userId,
      name: m.name || m.userId,
      avatar: m.avatar || null,
      role: m.role || getMemberRole(m.userId),
    }))
})

const hasPrivilegedMembers = computed(() => privilegedMembers.value.length > 0)

const isCurrentUserOwner = computed(() => {
  if (!currentUserId.value) return false
  const member = members.value.find((m: any) => m.userId === currentUserId.value)
  const role = member?.role || getMemberRole(currentUserId.value)
  return role === 'owner'
})

const canLeaveGroup = computed(() => {
  // Можно покинуть группу, если не владелец или если владелец, но есть другие участники
  if (!currentUserId.value) return false
  const member = members.value.find((m: any) => m.userId === currentUserId.value)
  const role = member?.role || getMemberRole(currentUserId.value)
  if (role !== 'owner') return true
  // Владелец может покинуть, если есть другие участники
  return members.value.length > 1
})

onMounted(async () => {
  await loadMembers()
})

async function loadMembers() {
  try {
    isLoadingInfo.value = true
    const response = await api.getDialogMembers(props.dialog.dialogId, { limit: 100 })
    if (response.success && response.data && Array.isArray(response.data)) {
      // API уже возвращает роль для каждого участника
      members.value = response.data
    }
  } catch (error) {
    console.error('Error loading members:', error)
  } finally {
    isLoadingInfo.value = false
  }
}

function getMemberRole(userId: string): string | null {
  if (!userId) return null
  // Роль уже приходит из API в members
  const member = members.value.find((m: any) => m.userId === userId)
  return member?.role || null
}

function getRoleLabel(role: string | null): string {
  if (role === 'owner') return 'Владелец'
  if (role === 'admin') return 'Администратор'
  return 'Участник'
}

function handleAddMembers() {
  emit('add-members')
}

async function handleLeaveGroup() {
  if (!currentUserId.value) return
  
  try {
    isLeavingGroup.value = true
    await api.removeDialogMember(props.dialog.dialogId, currentUserId.value)
    emit('left-group')
    emit('close')
  } catch (error) {
    console.error('Error leaving group:', error)
    alert('Не удалось покинуть группу')
  } finally {
    isLeavingGroup.value = false
  }
}
</script>

