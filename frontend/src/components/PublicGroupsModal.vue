<template>
  <div
    v-if="isOpen"
    class="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
    @click.self="close"
  >
    <div class="bg-white rounded-lg shadow-xl max-w-2xl w-full mx-4 max-h-[90vh] flex flex-col">
      <!-- Header -->
      <div class="flex items-center justify-between p-4 border-b border-gray-200">
        <h2 class="text-lg font-semibold text-gray-900">Публичные группы</h2>
        <button
          @click="close"
          class="text-gray-400 hover:text-gray-600 transition-colors"
          :disabled="isJoining"
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
          placeholder="Поиск по названию группы..."
          class="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none"
          :disabled="isLoading"
          @input="debouncedSearch"
        />
      </div>

      <!-- Groups List -->
      <div class="flex-1 overflow-y-auto">
        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center p-8">
          <div class="text-gray-400">Загрузка групп...</div>
        </div>

        <!-- Groups -->
        <div v-else-if="filteredGroups.length > 0" class="divide-y divide-gray-200">
          <div
            v-for="group in filteredGroups"
            :key="group.dialogId"
            class="p-4 flex items-center space-x-3 hover:bg-gray-50 transition-colors"
          >
            <!-- Avatar -->
            <Avatar
              :avatar="group.avatar"
              :name="group.name"
              :userId="group.dialogId"
              :is-group="true"
              size="md"
              shape="circle"
            />

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="font-medium text-gray-900 truncate">
                {{ group.name || 'Группа' }}
              </div>
              <div v-if="group.membersCount" class="text-sm text-gray-500">
                Участников: {{ group.membersCount }}
              </div>
            </div>

            <!-- Join Button -->
            <button
              @click="joinGroup(group.dialogId)"
              :disabled="isJoining || joiningGroups.has(group.dialogId)"
              class="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <span v-if="joiningGroups.has(group.dialogId)" class="flex items-center space-x-2">
                <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                  <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                  <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Присоединение...</span>
              </span>
              <span v-else>Присоединиться</span>
            </button>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex flex-col items-center justify-center p-8 text-gray-400">
          <svg class="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p>{{ searchQuery ? 'Группы не найдены' : 'Нет доступных публичных групп' }}</p>
        </div>

        <!-- Pagination -->
        <div v-if="hasMorePages && !isLoading" class="p-4 border-t border-gray-200 bg-gray-50">
          <button
            @click="loadMore"
            :disabled="isLoadingMore"
            class="w-full px-4 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <span v-if="isLoadingMore" class="flex items-center justify-center space-x-2">
              <svg class="animate-spin h-4 w-4" fill="none" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              <span>Загрузка...</span>
            </span>
            <span v-else>Загрузить еще</span>
          </button>
        </div>
      </div>

      <!-- Footer -->
      <div class="p-4 border-t border-gray-200 bg-gray-50">
        <button
          @click="close"
          class="w-full btn-secondary"
          :disabled="isJoining"
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
import Avatar from '@/components/Avatar.vue'
import type { Dialog } from '@/types'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
  'group-joined': [dialogId: string]
}>()

const groups = ref<Dialog[]>([])
const searchQuery = ref('')
const isLoading = ref(false)
const isLoadingMore = ref(false)
const isJoining = ref(false)
const joiningGroups = ref<Set<string>>(new Set())
const currentPage = ref(1)
const hasMorePages = ref(false)
const limit = 20

// Debounce timer
let searchTimeout: ReturnType<typeof setTimeout>

// Load groups on open
watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    loadGroups(true)
  } else {
    // Reset on close
    groups.value = []
    searchQuery.value = ''
    currentPage.value = 1
    hasMorePages.value = false
    joiningGroups.value.clear()
  }
})

async function loadGroups(reset = false) {
  if (reset) {
    currentPage.value = 1
    groups.value = []
    isLoading.value = true
  } else {
    isLoadingMore.value = true
  }

  try {
    const response = await api.getPublicGroups({
      page: currentPage.value,
      limit,
    })

    if (response.success && response.data) {
      const newGroups = response.data as Dialog[]

      if (reset) {
        groups.value = newGroups
      } else {
        groups.value.push(...newGroups)
      }

      // Check if there are more pages
      hasMorePages.value = response.pagination
        ? currentPage.value < response.pagination.pages
        : false
    }
  } catch (error: any) {
    console.error('Failed to load public groups:', error)
  } finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

function debouncedSearch() {
  clearTimeout(searchTimeout)
  searchTimeout = setTimeout(() => {
    // Reset page and reload groups when searching
    currentPage.value = 1
    loadGroups(true)
  }, 300)
}

// Filter groups by search query (client-side filtering)
const filteredGroups = computed(() => {
  if (!searchQuery.value.trim()) {
    return groups.value
  }

  const query = searchQuery.value.toLowerCase().trim()
  return groups.value.filter(group =>
    group.name?.toLowerCase().includes(query)
  )
})

async function loadMore() {
  if (hasMorePages.value && !isLoadingMore.value) {
    currentPage.value++
    await loadGroups(false)
  }
}

async function joinGroup(dialogId: string) {
  if (isJoining.value || joiningGroups.value.has(dialogId)) {
    return
  }

  joiningGroups.value.add(dialogId)
  isJoining.value = true

  try {
    const response = await api.joinGroup(dialogId)

    if (response.success && response.data) {
      emit('group-joined', dialogId)
      close()
    } else {
      alert('Не удалось присоединиться к группе')
    }
  } catch (error: any) {
    console.error('Failed to join group:', error)
    alert(error.response?.data?.error || 'Ошибка при присоединении к группе')
  } finally {
    joiningGroups.value.delete(dialogId)
    isJoining.value = false
  }
}

function close() {
  if (!isJoining.value) {
    emit('close')
  }
}
</script>

