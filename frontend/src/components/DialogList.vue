<template>
  <div class="flex-1 flex flex-col bg-white min-h-0">
    <div class="p-3 border-b border-gray-200">
      <div class="relative">
        <input
          v-model="searchTerm"
          type="text"
          class="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
          placeholder="Поиск по диалогам..."
        />
        <svg class="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-4.35-4.35m0 0a7 7 0 10-9.9 0 7 7 0 009.9 0z" />
        </svg>
        <button
          v-if="searchTerm.trim().length > 0"
          class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
          @click="clearSearchTerm"
        >
          <span class="sr-only">Очистить поиск</span>
          <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
      <div class="mt-3 flex flex-wrap gap-2">
        <button
          v-for="option in filterOptions"
          :key="option.value"
          type="button"
          class="inline-flex items-center gap-1 rounded-full border px-3 py-1 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-primary-300"
          :class="isFilterSelected(option.value)
            ? 'bg-primary-100 text-primary-700 border-primary-200'
            : 'bg-gray-100 text-gray-600 border-transparent hover:bg-gray-200'"
          :aria-pressed="isFilterSelected(option.value)"
          @click="handleFilterClick(option.value)"
        >
          <span v-if="option.icon" aria-hidden="true">{{ option.icon }}</span>
          {{ option.label }}
        </button>
      </div>
    </div>

    <div
      ref="scrollContainer"
      class="flex-1 overflow-y-auto min-h-0"
      @scroll="handleScroll"
    >
      <!-- Search Mode -->
      <div v-if="isSearchActive" class="flex-1">
        <div v-if="isSearching" class="flex items-center justify-center p-8 text-gray-400">
          Идет поиск...
        </div>

        <div
          v-else-if="searchError"
          class="flex flex-col items-center justify-center p-8 text-red-500"
        >
          <svg class="w-14 h-14 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="mb-2 font-semibold">Ошибка поиска</p>
          <p class="text-sm text-gray-500 text-center">{{ searchError }}</p>
        </div>

        <div v-else-if="hasSearchResults" class="py-4">
          <div class="divide-y divide-gray-200 bg-white rounded-lg shadow-sm border border-gray-100">
            <button
              v-for="dialog in filteredSearchResults"
              :key="dialog.dialogId"
              @click="emitSelect(dialog.dialogId)"
              class="w-full p-4 text-left hover:bg-gray-50 transition-colors relative flex items-start gap-3"
              :class="{ 'bg-primary-50': isActive(dialog.dialogId) }"
            >
              <div class="flex-shrink-0">
                <Avatar
                  :avatar="getDialogAvatar(dialog)"
                  :name="dialog.name || dialog.dialogName || 'Диалог'"
                  :userId="dialog.dialogId"
                  :is-group="isGroupChat(dialog)"
                  size="md"
                  shape="circle"
                />
              </div>

              <div class="flex-1 min-w-0">
                <div class="flex items-start justify-between mb-1">
                  <h3 class="font-semibold text-gray-900 truncate flex-1 flex items-center gap-2">
                    <span
                      v-if="isGroupChat(dialog)"
                      class="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium flex-shrink-0"
                      :class="getGroupBadgeClasses(dialog)"
                      :title="getGroupBadgeLabel(dialog)"
                      aria-hidden="true"
                    >
                      {{ getGroupBadgeIcon(dialog) }}
                    </span>
                    <span class="truncate">
                      {{ getDialogDisplayName(dialog) }}
                    </span>
                  </h3>
                  <span v-if="dialog.lastMessageAt" class="text-xs text-gray-500 ml-2 flex-shrink-0">
                    {{ formatTime(dialog.lastMessageAt) }}
                  </span>
                </div>
                <p
                  v-if="getTypingPreview(dialog)"
                  class="text-sm text-primary-600 font-medium truncate"
                >
                  {{ getTypingPreview(dialog) }}
                </p>
                <p v-else-if="dialog.lastMessage" class="text-sm text-gray-600 truncate">
                  {{ dialog.lastMessage.content }}
                </p>
                <p
                  v-else-if="dialog.meta?.description"
                  class="text-xs text-gray-500 truncate"
                >
                  {{ dialog.meta.description }}
                </p>
              </div>

              <div
                v-if="dialog.unreadCount > 0"
                class="absolute top-4 right-4 bg-primary-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium"
              >
                {{ dialog.unreadCount > 9 ? '9+' : dialog.unreadCount }}
              </div>
            </button>
          </div>
          <div
            v-if="isLoadingMoreSearch"
            class="flex items-center justify-center p-4 text-gray-400 text-sm"
          >
            Загрузка...
          </div>
          <div
            v-else-if="!hasMoreSearchResults && hasSearchResults"
            class="p-4 text-center text-gray-300 text-xs"
          >
            Все результаты загружены
          </div>
        </div>

        <div v-else class="flex flex-col items-center justify-center p-8 text-gray-400">
          <svg class="w-14 h-14 mb-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 9.75l4.5 4.5m0-4.5l-4.5 4.5M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p>Ничего не найдено</p>
        </div>
      </div>

      <!-- Default Mode -->
      <div v-else class="flex-1">
        <div v-if="dialogsStore.isLoading" class="flex items-center justify-center p-8">
          <div class="text-gray-400">Загрузка...</div>
        </div>

        <div v-else-if="dialogsStore.error" class="flex flex-col items-center justify-center p-8 text-red-500">
          <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <p class="mb-2 font-semibold">Ошибка загрузки</p>
          <p class="text-sm text-gray-500 mb-4 text-center">{{ dialogsStore.error }}</p>
          <button 
            @click="retryLoadDialogs"
            class="px-4 py-2 bg-primary-600 text-white rounded-lg hover:bg-primary-700 transition-colors"
          >
            Повторить попытку
          </button>
        </div>

        <div v-else-if="dialogsStore.dialogs.length > 0" class="divide-y divide-gray-200">
          <button
            v-for="dialog in dialogsStore.dialogs"
            :key="dialog.dialogId"
            @click="emitSelect(dialog.dialogId)"
            class="w-full p-4 text-left hover:bg-gray-50 transition-colors relative flex items-start gap-3"
            :class="{ 'bg-primary-50': isActive(dialog.dialogId) }"
          >
            <div class="flex-shrink-0">
              <Avatar
                :avatar="getDialogAvatar(dialog)"
                :name="getDialogDisplayName(dialog)"
                :userId="dialog.dialogId"
                :is-group="isGroupChat(dialog)"
                size="md"
                shape="circle"
              />
            </div>

            <div class="flex-1 min-w-0">
              <div class="flex items-start justify-between mb-1">
                <h3 class="font-semibold text-gray-900 truncate flex-1 flex items-center gap-2">
                  <span
                    v-if="isGroupChat(dialog)"
                    class="inline-flex items-center justify-center w-5 h-5 rounded-full text-xs font-medium flex-shrink-0"
                    :class="getGroupBadgeClasses(dialog)"
                    :title="getGroupBadgeLabel(dialog)"
                    aria-hidden="true"
                  >
                    {{ getGroupBadgeIcon(dialog) }}
                  </span>
                  <span class="truncate">
                    {{ getDialogDisplayName(dialog) }}
                  </span>
                </h3>
                <span v-if="dialog.lastMessageAt" class="text-xs text-gray-500 ml-2 flex-shrink-0">
                  {{ formatTime(dialog.lastMessageAt) }}
                </span>
              </div>

              <p
                v-if="getTypingPreview(dialog)"
                class="text-sm text-primary-600 font-medium truncate"
              >
                {{ getTypingPreview(dialog) }}
              </p>
              <p v-else-if="dialog.lastMessage" class="text-sm text-gray-600 truncate">
                {{ dialog.lastMessage.content }}
              </p>
            </div>

            <div
              v-if="dialog.unreadCount > 0"
              class="absolute top-4 right-4 bg-primary-600 text-white text-xs rounded-full w-6 h-6 flex items-center justify-center font-medium"
            >
              {{ dialog.unreadCount > 9 ? '9+' : dialog.unreadCount }}
            </div>
          </button>
        </div>

        <div v-if="!isSearchActive && dialogsStore.dialogs.length > 0" class="py-2">
          <div v-if="isLoadingMore" class="p-4 text-center text-gray-400 text-sm">
            Загрузка ещё...
          </div>
          <div
            v-else-if="!dialogsStore.isLoading && !isLoadingMore && !hasMoreDialogs"
            class="p-4 text-center text-gray-300 text-xs"
          >
            Больше диалогов нет
          </div>
        </div>

        <div v-else class="flex flex-col items-center justify-center p-8 text-gray-400">
          <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
          <p>Нет диалогов</p>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted, nextTick } from 'vue'
import { storeToRefs } from 'pinia'
import { useDialogsStore } from '@/stores/dialogs'
import { useMessagesStore } from '@/stores/messages'
import { useAuthStore } from '@/stores/auth'
import Avatar from './Avatar.vue'
import type { Dialog } from '@/types'
import { formatTypingUsers } from '@/utils/typing'

const P2P_AVATAR_META_KEY = 'p2pDialogAvatar'
const LEGACY_P2P_AVATAR_PREFIX = 'p2pDialogAvatarFor'

const emit = defineEmits<{
  select: [dialogId: string]
}>()

const dialogsStore = useDialogsStore()
const messagesStore = useMessagesStore()
const authStore = useAuthStore()
const { isSearching, isLoadingMoreSearch, searchError, searchResults, lastSearchTerm, isLoadingMore, hasMoreDialogs, hasMoreSearchResults, currentFilter } = storeToRefs(dialogsStore)

const searchTerm = ref(lastSearchTerm.value || '')
const MIN_SEARCH_LENGTH = 2
type FilterOptionValue = 'all' | 'p2p' | 'group:private' | 'group:public' | 'favorites' | 'business-contacts' | 'unread'

const filterOptions: Array<{ label: string; value: FilterOptionValue; icon?: string }> = [
  { label: 'Все', value: 'all' },
  { label: 'Личные', value: 'p2p', icon: '👥' },
  { label: 'Бизнес контакты', value: 'business-contacts', icon: '💼' },
  { label: 'Приватные группы', value: 'group:private', icon: '🔒' },
  { label: 'Публичные группы', value: 'group:public', icon: '🌐' },
  { label: 'Мои избранные', value: 'favorites', icon: '⭐' },
  { label: 'Непрочитанные', value: 'unread', icon: '🔔' }
]
let searchTimer: ReturnType<typeof setTimeout> | null = null
const scrollContainer = ref<HTMLElement | null>(null)
const LOAD_MORE_THRESHOLD_PX = 200

function emitSelect(dialogId: string) {
  console.log('🖱️ DialogList emitting select:', dialogId)
  emit('select', dialogId)
}

const isSearchActive = computed(() => (searchTerm.value || '').trim().length >= MIN_SEARCH_LENGTH)
const filteredSearchResults = computed(() => {
  const base = searchResults.value || []
  return base
})
const hasSearchResults = computed(() => {
  return filteredSearchResults.value.length > 0
})

if (import.meta.env.DEV) {
  Object.assign(window, {
    __chatSearchDebug: {
      get term() {
        return searchTerm.value
      },
      get isActive() {
        return isSearchActive.value
      },
      get isSearching() {
        return isSearching.value
      },
      get hasResults() {
        return hasSearchResults.value
      },
      get results() {
        return searchResults.value
      },
      get filtered() {
        return filteredSearchResults.value
      },
      get error() {
        return searchError.value
      }
    }
  })
}

watch(
  () => searchTerm.value,
  (value) => {
    const trimmed = value.trim()

    if (searchTimer) {
      clearTimeout(searchTimer)
      searchTimer = null
    }

    if (trimmed.length < MIN_SEARCH_LENGTH) {
      dialogsStore.clearSearch()
      return
    }

    searchTimer = setTimeout(() => {
      void performSearch(trimmed)
    }, 300)
  }
)

onMounted(() => {
  if (searchTerm.value.trim().length >= MIN_SEARCH_LENGTH) {
    void performSearch(searchTerm.value.trim())
  }
  void nextTick(() => {
    if (!isSearchActive.value) {
      handleScroll()
    }
  })
})

onUnmounted(() => {
  if (searchTimer) {
    clearTimeout(searchTimer)
    searchTimer = null
  }
})

watch(
  () => dialogsStore.dialogs.length,
  async () => {
    await nextTick()
    if (!isSearchActive.value) {
      handleScroll()
    }
  }
)

watch(
  isSearchActive,
  async (active) => {
    if (!active) {
      await nextTick()
      if (scrollContainer.value) {
        scrollContainer.value.scrollTop = 0
      }
      handleScroll()
    }
  }
)

function clearSearchTerm() {
  searchTerm.value = ''
  dialogsStore.clearSearch()
}

function isFilterSelected(filter: FilterOptionValue): boolean {
  return currentFilter.value === filter
}

async function handleFilterClick(filter: FilterOptionValue) {
  const trimmedSearch = searchTerm.value.trim()
  let nextFilter: FilterOptionValue

  if (filter === 'all') {
    nextFilter = 'all'
  } else if (isFilterSelected(filter)) {
    nextFilter = 'all'
  } else {
    nextFilter = filter
  }

  try {
    await dialogsStore.fetchDialogs({
      page: 1,
      includeLastMessage: true,
      type: nextFilter,
      append: false
    })
    if (trimmedSearch.length >= MIN_SEARCH_LENGTH) {
      await dialogsStore.searchDialogs(trimmedSearch, {
        page: 1,
        type: nextFilter === 'all' ? undefined : nextFilter
      })
    }
  } catch (error) {
    console.error('Failed to apply dialog filter:', error)
  }
}

function isActive(dialogId: string): boolean {
  return dialogsStore.currentDialog?.dialogId === dialogId
}

async function retryLoadDialogs() {
  try {
    await dialogsStore.fetchDialogs()
  } catch (error) {
    console.error('Failed to retry loading dialogs:', error)
  }
}

async function performSearch(term: string) {
  const trimmed = term.trim()
  if (trimmed.length < MIN_SEARCH_LENGTH) {
    dialogsStore.clearSearch()
    return
  }

  try {
    await dialogsStore.searchDialogs(trimmed)
  } catch (error) {
    console.error('Failed to search dialogs:', error)
  }
}

function getTypingPreview(dialog: Dialog): string | null {
  const typingEntries = messagesStore.getTypingUsers(dialog.dialogId)
  if (typingEntries.length === 0) {
    return null
  }

  if (!isGroupChat(dialog)) {
    return 'печатает...'
  }

  const names = typingEntries.map((entry) => entry.name?.trim() || `Пользователь ${entry.userId}`)
  const formatted = formatTypingUsers(names)
  return formatted || 'печатают...'
}

function unwrapMetaValue(entry: any) {
  if (entry == null) return undefined
  if (typeof entry === 'object' && 'value' in entry) {
    return entry.value
  }
  return entry
}

function getP2PAvatar(dialog: Dialog): string | undefined {
  if (!dialog.meta) {
    return undefined
  }

  const direct = unwrapMetaValue(dialog.meta[P2P_AVATAR_META_KEY])
  if (direct !== undefined) {
    return direct
  }

  if (authStore.user?.userId) {
    return unwrapMetaValue(dialog.meta[`${LEGACY_P2P_AVATAR_PREFIX}${authStore.user.userId}`])
  }

  return undefined
}

function getDialogAvatar(dialog: Dialog): string | null {
  // For group chats, return null to show default group icon
  if (isGroupChat(dialog)) {
    return null
  }
  
  return dialog.avatar || getP2PAvatar(dialog) || null
}

function isGroupChat(dialog: Dialog): boolean {
  const chatType = dialog.chatType || dialog.meta?.type
  return chatType === 'group'
}

function isBusinessContact(dialog: Dialog): boolean {
  const chatType = dialog.chatType || dialog.meta?.type
  return chatType === 'personal_contact'
}

function getDialogDisplayName(dialog: Dialog): string {
  if (isBusinessContact(dialog)) {
    return (
      dialog.meta?.contactName?.value ||
      dialog.meta?.contactName ||
      dialog.name ||
      dialog.dialogName ||
      dialog.dialogId
    )
  }

  return dialog.name || dialog.dialogName || dialog.dialogId
}

function getGroupBadgeLabel(dialog: Dialog): string {
  const groupType = dialog.meta?.groupType || dialog.meta?.visibility || 'private'
  if (groupType === 'public') {
    return 'Публичная группа'
  }
  if (groupType === 'private') {
    return 'Приватная группа'
  }
  return 'Группа'
}

function getGroupBadgeIcon(dialog: Dialog): string {
  const groupType = dialog.meta?.groupType || dialog.meta?.visibility || 'private'
  return groupType === 'public' ? '🌐' : '🔒'
}

function getGroupBadgeClasses(dialog: Dialog): string {
  const groupType = dialog.meta?.groupType || dialog.meta?.visibility || 'private'
  if (groupType === 'public') {
    return 'bg-emerald-50 text-emerald-700 border border-emerald-200'
  }
  if (groupType === 'private') {
    return 'bg-blue-50 text-blue-700 border border-blue-200'
  }
  return 'bg-gray-100 text-gray-600 border border-gray-200'
}

function formatTime(timestamp: string | number): string {
  // Parse timestamp - can be:
  // 1. Unix timestamp in milliseconds (number or string): 1762419282731 or "1762419282731.615234"
  // 2. ISO date string: "2025-11-06T08:54:42.732Z"
  let date: Date
  
  if (typeof timestamp === 'string') {
    // Try parsing as number first (Unix timestamp with microseconds)
    const numericTimestamp = parseFloat(timestamp)
    if (!isNaN(numericTimestamp)) {
      // Unix timestamp in milliseconds (Chat3 format)
      date = new Date(Math.floor(numericTimestamp))
    } else {
      // ISO date string
      date = new Date(timestamp)
    }
  } else {
    // Number timestamp
    date = new Date(timestamp)
  }
  
  // Validate date
  if (isNaN(date.getTime())) {
    return ''
  }
  
  const now = new Date()
  const diff = now.getTime() - date.getTime()
  const hours = Math.floor(diff / (1000 * 60 * 60))

  if (hours < 24) {
    return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
  } else if (hours < 48) {
    return 'вчера'
  } else {
    return date.toLocaleDateString('ru-RU', { day: 'numeric', month: 'short' })
  }
}

function handleScroll() {
  const container = scrollContainer.value
  if (!container) {
    return
  }

  const distanceToBottom = container.scrollHeight - container.scrollTop - container.clientHeight

  if (isSearchActive.value) {
    // Handle scroll for search results
    if (
      distanceToBottom <= LOAD_MORE_THRESHOLD_PX &&
      !isSearching.value &&
      !isLoadingMoreSearch.value &&
      hasMoreSearchResults.value
    ) {
      void dialogsStore.loadMoreSearchResults()
    }
  } else {
    // Handle scroll for regular dialog list
    if (
      distanceToBottom <= LOAD_MORE_THRESHOLD_PX &&
      !dialogsStore.isLoading &&
      !isLoadingMore.value &&
      hasMoreDialogs.value
    ) {
      void dialogsStore.loadMoreDialogs()
    }
  }
}
</script>

