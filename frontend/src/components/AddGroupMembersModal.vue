<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="close"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Добавить участников</h2>
        <button
          @click="close"
          class="text-gray-400 hover:text-gray-600 transition-colors"
          :disabled="isAdding"
        >
          <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      <!-- Search -->
      <div class="p-4 border-b border-gray-200">
        <input
          v-model="searchQuery"
          type="text"
          placeholder="Поиск по имени или телефону..."
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          :disabled="isAdding"
          @input="debouncedSearch"
        />
      </div>

      <!-- Users List -->
      <div class="flex-1 overflow-y-auto">
        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center p-8">
          <div class="text-gray-400">Загрузка...</div>
        </div>

        <!-- Users -->
        <div v-else-if="filteredUsers.length > 0" class="divide-y divide-gray-200">
          <button
            v-for="user in filteredUsers"
            :key="user.userId"
            @click="toggleUser(user)"
            :disabled="isAdding"
            class="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3 disabled:opacity-50 disabled:cursor-not-allowed"
            :class="{ 'bg-blue-50': selectedUserIds.has(user.userId) }"
          >
            <!-- Avatar -->
            <Avatar
              :avatar="user.avatar"
              :name="user.name"
              :userId="user.userId"
              size="sm"
              shape="circle"
            />

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-900 truncate">
                {{ user.name }}
              </div>
              <div class="text-sm text-gray-500 truncate">
                {{ formatPhone(user.phone) }}
              </div>
            </div>

            <!-- Checkbox -->
            <div
              class="flex-shrink-0 w-5 h-5 border-2 rounded flex items-center justify-center transition-colors"
              :class="selectedUserIds.has(user.userId) 
                ? 'bg-blue-600 border-blue-600' 
                : 'border-gray-300'"
            >
              <svg
                v-if="selectedUserIds.has(user.userId)"
                class="w-3 h-3 text-white"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7" />
              </svg>
            </div>
          </button>
        </div>

        <!-- Empty State -->
        <div v-else class="flex flex-col items-center justify-center p-8 text-gray-400">
          <svg class="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p>{{ searchQuery ? 'Пользователи не найдены' : 'Нет доступных пользователей' }}</p>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-gray-200 flex items-center justify-between">
        <div class="text-sm text-gray-600">
          Выбрано: {{ selectedUserIds.size }}
        </div>
        <div class="flex items-center space-x-3">
          <button
            @click="close"
            class="px-4 py-2 text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
            :disabled="isAdding"
          >
            Отмена
          </button>
          <button
            @click="addMembers"
            class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            :disabled="selectedUserIds.size === 0 || isAdding"
          >
            <span v-if="isAdding" class="flex items-center space-x-2">
              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Добавление...</span>
            </span>
            <span v-else>Добавить</span>
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import api from '@/services/api'
import Avatar from '@/components/Avatar.vue'

interface User {
  userId: string
  name: string
  phone: string
  avatar?: string | null
}

const props = defineProps<{
  isOpen: boolean
  dialogId: string | null
  existingMemberIds?: string[]
}>()

const emit = defineEmits<{
  close: []
  'members-added': []
}>()

const searchQuery = ref('')
const users = ref<User[]>([])
const selectedUserIds = ref<Set<string>>(new Set())
const isLoading = ref(false)
const isAdding = ref(false)

// Debounce timer
let searchTimeout: ReturnType<typeof setTimeout>

// Filter users to exclude existing members
const filteredUsers = computed(() => {
  const existingIds = props.existingMemberIds || []
  return users.value.filter(user => !existingIds.includes(user.userId))
})

// Load users on open
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    loadUsers()
    selectedUserIds.value.clear()
  } else {
    // Reset on close
    searchQuery.value = ''
    users.value = []
    selectedUserIds.value.clear()
  }
})

async function loadUsers(search?: string) {
  isLoading.value = true
  try {
    const response = await api.getUsers({ search, limit: 100 })
    users.value = response.data || []
  } catch (error: any) {
    console.error('Failed to load users:', error)
  } finally {
    isLoading.value = false
  }
}

function debouncedSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    loadUsers(searchQuery.value)
  }, 300)
}

function toggleUser(user: User) {
  if (isAdding.value) return
  
  if (selectedUserIds.value.has(user.userId)) {
    selectedUserIds.value.delete(user.userId)
  } else {
    selectedUserIds.value.add(user.userId)
  }
}

async function addMembers() {
  if (!props.dialogId || selectedUserIds.value.size === 0 || isAdding.value) {
    return
  }

  isAdding.value = true

  try {
    // Add all selected members
    const addPromises = Array.from(selectedUserIds.value).map(userId =>
      api.addDialogMember(props.dialogId!, userId)
    )

    await Promise.all(addPromises)

    emit('members-added')
    close()
  } catch (error: any) {
    console.error('Failed to add members:', error)
    alert('Ошибка при добавлении участников')
  } finally {
    isAdding.value = false
  }
}

function close() {
  if (!isAdding.value) {
    emit('close')
  }
}

function formatPhone(phone: string): string {
  if (!phone) return ''
  
  // Format: 79123456789 -> +7 912 345-67-89
  if (phone.startsWith('7') && phone.length === 11) {
    return `+7 ${phone.substring(1, 4)} ${phone.substring(4, 7)}-${phone.substring(7, 9)}-${phone.substring(9)}`
  }
  
  return phone
}
</script>

