<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        @click.self="close"
      >
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[80vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
            <h2 class="text-lg font-semibold text-gray-900">Выбор бизнес-контакта</h2>
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

          <!-- Search -->
          <div class="p-4 border-b border-gray-200 flex-shrink-0">
            <div class="relative">
              <input
                v-model="searchTerm"
                type="text"
                class="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-3 text-sm text-gray-900 placeholder-gray-400 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-200"
                placeholder="Поиск по имени..."
                @input="handleSearch"
              />
              <svg class="absolute left-3 top-2.5 h-5 w-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 10-9.9 0 7 7 0 009.9 0z" />
              </svg>
              <button
                v-if="searchTerm.trim().length > 0"
                class="absolute right-3 top-2.5 text-gray-400 hover:text-gray-600"
                @click="clearSearch"
              >
                <svg class="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <!-- Contacts List -->
          <div class="flex-1 overflow-y-auto min-h-0">
            <!-- Loading -->
            <div v-if="isLoading" class="flex items-center justify-center py-8">
              <div class="text-gray-400">Загрузка контактов...</div>
            </div>

            <!-- Empty State -->
            <div v-else-if="contacts.length === 0" class="flex flex-col items-center justify-center py-12 text-gray-500">
              <svg class="w-16 h-16 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
              </svg>
              <p class="text-sm">{{ searchTerm ? 'Контакты не найдены' : 'Нет контактов' }}</p>
            </div>

            <!-- Contacts -->
            <div v-else class="divide-y divide-gray-200">
              <button
                v-for="contact in contacts"
                :key="contact.contactId"
                @click="selectContact(contact)"
                :disabled="isSelecting"
                class="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <div class="flex items-center space-x-3">
                  <div class="flex-shrink-0 w-10 h-10 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-semibold">
                    {{ getContactInitials(contact.name) }}
                  </div>
                  <div class="flex-1 min-w-0">
                    <div class="font-medium text-gray-900">{{ contact.name }}</div>
                    <div class="text-sm text-gray-500">{{ formatPhone(contact.phone) }}</div>
                  </div>
                  <svg
                    v-if="isSelecting && selectedContactId === contact.contactId"
                    class="w-5 h-5 text-primary-600 animate-spin"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
                    <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                </div>
              </button>
            </div>
          </div>

          <!-- Footer -->
          <div v-if="error" class="p-4 border-t border-gray-200 bg-red-50">
            <p class="text-sm text-red-600">{{ error }}</p>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { ref, onMounted, watch } from 'vue'
import api from '@/services/api'

const props = defineProps<{
  isOpen: boolean
}>()

const emit = defineEmits<{
  close: []
  'contact-selected': [contactId: string]
}>()

const contacts = ref<any[]>([])
const searchTerm = ref('')
const isLoading = ref(false)
const isSelecting = ref(false)
const selectedContactId = ref<string | null>(null)
const error = ref<string | null>(null)

// Debounce timer
let debounceTimer: ReturnType<typeof setTimeout> | null = null

function debouncedSearch() {
  if (debounceTimer) {
    clearTimeout(debounceTimer)
  }
  debounceTimer = setTimeout(async () => {
    await loadContacts()
  }, 300)
}

watch(() => props.isOpen, (newValue) => {
  if (newValue) {
    loadContacts()
  } else {
    // Reset state when modal closes
    searchTerm.value = ''
    contacts.value = []
    error.value = null
  }
})

onMounted(() => {
  if (props.isOpen) {
    loadContacts()
  }
})

async function loadContacts() {
  try {
    isLoading.value = true
    error.value = null

    const response = await api.listContacts({
      search: searchTerm.value.trim() || undefined,
      page: 1,
      limit: 50,
    })

    if (response.success && response.data) {
      contacts.value = response.data
    } else {
      contacts.value = []
      error.value = 'Не удалось загрузить контакты'
    }
  } catch (err: any) {
    console.error('Error loading contacts:', err)
    contacts.value = []
    error.value = err?.response?.data?.error || 'Ошибка при загрузке контактов'
  } finally {
    isLoading.value = false
  }
}

function handleSearch() {
  debouncedSearch()
}

function clearSearch() {
  searchTerm.value = ''
  loadContacts()
}

async function selectContact(contact: any) {
  if (isSelecting.value) return

  try {
    isSelecting.value = true
    selectedContactId.value = contact.contactId
    error.value = null

    // Get or create dialog for this contact
    const response = await api.getOrCreateContactDialog(contact.contactId)

    if (response.success && response.data) {
      emit('contact-selected', contact.contactId)
      close()
    } else {
      error.value = response.error || 'Не удалось открыть диалог'
    }
  } catch (err: any) {
    console.error('Error selecting contact:', err)
    error.value = err?.response?.data?.error || 'Ошибка при выборе контакта'
  } finally {
    isSelecting.value = false
    selectedContactId.value = null
  }
}

function close() {
  emit('close')
}

function getContactInitials(name: string): string {
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

