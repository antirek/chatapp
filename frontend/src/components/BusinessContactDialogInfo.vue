<template>
  <div class="p-6">
    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <div class="text-gray-400">Загрузка информации...</div>
    </div>

    <!-- Contact Info -->
    <div v-else-if="contact" class="space-y-6">
      <!-- Avatar and Name -->
      <div class="flex flex-col items-center">
        <div class="w-24 h-24 rounded-full bg-gradient-to-br from-green-500 to-emerald-600 flex items-center justify-center text-white font-bold text-3xl shadow-lg mb-3">
          {{ getContactInitials(contact.name) }}
        </div>
        <h3 class="text-xl font-semibold text-gray-900">{{ contact.name }}</h3>
        <p class="text-sm text-gray-500 mt-1">Бизнес-контакт</p>
      </div>

      <!-- Details -->
      <div class="space-y-3">
        <!-- Phone -->
        <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs text-gray-500 mb-1">Телефон</div>
            <div class="text-sm font-medium text-gray-900">
              {{ formatPhone(contact.phone) }}
            </div>
          </div>
        </div>

        <!-- Contact ID -->
        <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs text-gray-500 mb-1">ID контакта</div>
            <div class="text-sm font-mono text-gray-700 truncate">
              {{ contact.contactId }}
            </div>
          </div>
        </div>

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

        <!-- Created Date -->
        <div v-if="contact.createdAt" class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs text-gray-500 mb-1">Создан</div>
            <div class="text-sm font-medium text-gray-900">
              {{ formatDate(contact.createdAt) }}
            </div>
          </div>
        </div>
      </div>
      <div class="border-t border-gray-200 pt-4">
        <button
          @click="emit('add-members')"
          class="w-full inline-flex items-center justify-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
          </svg>
          <span>Добавить пользователя</span>
        </button>
      </div>
    </div>

    <!-- Error -->
    <div v-else class="flex flex-col items-center justify-center py-8 text-gray-500">
      <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p>Не удалось загрузить информацию о контакте</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Dialog } from '@/types'
import api from '@/services/api'

const props = defineProps<{
  dialog: Dialog
}>()

const emit = defineEmits<{
  close: []
  'add-members': []
}>()

const contact = ref<{
  contactId: string
  name: string
  phone: string
  createdAt?: string
} | null>(null)
const isLoading = ref(true)

onMounted(async () => {
  await loadContactInfo()
})

async function loadContactInfo() {
  try {
    isLoading.value = true
    
    // Получаем contactId из мета-тегов диалога
    const contactId = props.dialog.meta?.contactId?.value || props.dialog.meta?.contactId
    
    if (!contactId) {
      console.warn('Contact ID not found in dialog meta')
      isLoading.value = false
      return
    }

    // Загружаем информацию о контакте через API
    try {
      const response = await api.getContact(contactId)
      if (response.success && response.data) {
        contact.value = response.data
      } else {
        // Если API не доступен, используем данные из диалога
        contact.value = {
          contactId,
          name: props.dialog.name || props.dialog.dialogName || 'Контакт',
          phone: '', // Телефон не доступен в диалоге
        }
      }
    } catch (apiError) {
      // Если API недоступен, используем данные из диалога (имя контакта уже сохранено в dialog.name)
      contact.value = {
        contactId,
        name: props.dialog.name || props.dialog.dialogName || 'Контакт',
        phone: '', // Телефон не доступен в диалоге
      }
    }
  } catch (error) {
    console.error('Error loading contact info:', error)
    // Fallback: используем данные из диалога (имя контакта уже сохранено в dialog.name)
    const contactId = props.dialog.meta?.contactId?.value || props.dialog.meta?.contactId
    if (contactId) {
      contact.value = {
        contactId,
        name: props.dialog.name || props.dialog.dialogName || 'Контакт',
        phone: '',
      }
    } else {
      // Если contactId нет, но это personal_contact диалог, используем имя из диалога
      contact.value = {
        contactId: props.dialog.dialogId,
        name: props.dialog.name || props.dialog.dialogName || 'Контакт',
        phone: '',
      }
    }
  } finally {
    isLoading.value = false
  }
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
  if (!phone) return 'Не указан'
  
  // Format: 79123456789 -> +7 912 345-67-89
  if (phone.startsWith('7') && phone.length === 11) {
    return `+7 ${phone.substring(1, 4)} ${phone.substring(4, 7)}-${phone.substring(7, 9)}-${phone.substring(9)}`
  }
  
  return phone
}

function formatDate(date: string | number): string {
  if (!date) return ''
  
  const dateObj = typeof date === 'string' ? new Date(date) : new Date(date)
  return dateObj.toLocaleDateString('ru-RU', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}
</script>

