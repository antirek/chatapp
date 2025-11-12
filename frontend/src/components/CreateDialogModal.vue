<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="close"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Создать чат</h2>
        <button
          @click="close"
          class="text-gray-400 hover:text-gray-600 transition-colors"
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
          @input="debouncedSearch"
        />
      </div>

      <!-- Users List -->
      <div ref="usersListContainer" class="max-h-96 overflow-y-auto" @scroll="handleUsersScroll">
        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center p-8">
          <div class="text-gray-400">Загрузка...</div>
        </div>

        <!-- Loading More -->
        <div v-if="isLoadingMore" class="flex items-center justify-center py-2">
          <div class="text-sm text-gray-400">Загрузка пользователей...</div>
        </div>

        <!-- Users -->
        <div v-else-if="users.length > 0" class="divide-y divide-gray-200">
          <button
            v-for="user in users"
            :key="user.userId"
            @click="selectUser(user)"
            class="w-full p-4 text-left hover:bg-gray-50 transition-colors flex items-center space-x-3"
          >
            <!-- Avatar -->
            <div class="w-10 h-10 rounded-full bg-gradient-to-br from-purple-500 to-pink-500 flex items-center justify-center text-white font-semibold flex-shrink-0">
              {{ getUserInitials(user.name) }}
            </div>

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-900 truncate">
                {{ user.name }}
              </div>
              <div class="text-sm text-gray-500 truncate">
                {{ formatPhone(user.phone) }}
              </div>
            </div>

            <!-- Arrow -->
            <svg class="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7" />
            </svg>
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

      <!-- Creating indicator -->
      <div v-if="isCreating" class="p-4 border-t border-gray-200 bg-blue-50">
        <div class="flex items-center space-x-2 text-blue-600">
          <svg class="animate-spin h-5 w-5" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span>Создание диалога...</span>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import api from '@/services/api'

interface User {
  userId: string
  name: string
  phone: string
  avatar?: string | null
}

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
  'user-selected': [user: User]
}>()

const searchQuery = ref('')
const users = ref<User[]>([])
const isLoading = ref(false)
const isLoadingMore = ref(false)
const isCreating = ref(false)
const currentPage = ref(1)
const hasMore = ref(true)
const usersListContainer = ref<HTMLElement | null>(null)

// Debounce timer
let searchTimeout: ReturnType<typeof setTimeout>

// Load users on open
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    resetUsers()
    loadUsers()
  } else {
    // Reset on close
    searchQuery.value = ''
    resetUsers()
  }
})

function resetUsers() {
  users.value = []
  currentPage.value = 1
  hasMore.value = true
  isLoadingMore.value = false
}

async function loadUsers(search?: string, append = false) {
  const page = append ? currentPage.value + 1 : 1
  const limit = 50

  if (append) {
    if (isLoadingMore.value || isLoading.value || !hasMore.value) {
      return
    }
    isLoadingMore.value = true
  } else {
    isLoading.value = true
    currentPage.value = 1
    hasMore.value = true
  }

  try {
    const response = await api.getUsers({ search, limit, page })
    const newUsers = response.data || []
    const pagination = response.pagination

    if (append) {
      // Add new users to existing list
      const existingIds = new Set(users.value.map(u => u.userId))
      const uniqueNewUsers = newUsers.filter(u => !existingIds.has(u.userId))
      users.value = [...users.value, ...uniqueNewUsers]
      currentPage.value = page
      hasMore.value = pagination ? page < pagination.pages : false
    } else {
      // Replace users
      users.value = newUsers
      currentPage.value = page
      hasMore.value = pagination ? page < pagination.pages : newUsers.length === limit
    }
  } catch (error: any) {
    console.error('Failed to load users:', error)
  } finally {
    if (append) {
      isLoadingMore.value = false
    } else {
      isLoading.value = false
    }
  }
}

async function loadMoreUsers() {
  if (!hasMore.value || isLoadingMore.value || isLoading.value) {
    return
  }
  await loadUsers(searchQuery.value, true)
}

// Handle scroll for infinite loading
const SCROLL_LOAD_THRESHOLD = 200 // Load more when 200px from bottom

function handleUsersScroll(event: Event) {
  const container = event.target as HTMLElement
  if (!container) return

  const scrollBottom = container.scrollHeight - container.scrollTop - container.clientHeight

  if (scrollBottom < SCROLL_LOAD_THRESHOLD && hasMore.value && !isLoadingMore.value && !isLoading.value) {
    void loadMoreUsers()
  }
}

function debouncedSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    resetUsers()
    loadUsers(searchQuery.value)
  }, 300)
}

function selectUser(user: User) {
  if (isCreating.value) return // Prevent double click
  isCreating.value = true
  emit('user-selected', user)
}

// Reset isCreating when dialog is closed
watch(() => props.isOpen, (newValue) => {
  if (!newValue) {
    isCreating.value = false
  }
})

function close() {
  if (!isCreating.value) {
    emit('close')
  }
}

function getUserInitials(name: string): string {
  if (!name) return '?'
  
  const parts = name.trim().split(' ')
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

function formatPhone(phone: string): string {
  if (!phone) return ''
  
  // Format: 79123456789 -> +7 912 345-67-89
  if (phone.startsWith('7') && phone.length === 11) {
    return `+7 ${phone.substring(1, 4)} ${phone.substring(4, 7)}-${phone.substring(7, 9)}-${phone.substring(9)}`
  }
  
  return phone
}

// Expose isCreating for parent component
defineExpose({
  isCreating
})
</script>

