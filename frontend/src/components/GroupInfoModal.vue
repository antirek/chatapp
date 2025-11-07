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

      <!-- Members List -->
      <div class="flex-1 overflow-y-auto border-t border-gray-200">
        <div class="p-4 border-b border-gray-200 bg-gray-50">
          <h3 class="text-sm font-semibold text-gray-700">Участники ({{ totalMembers }})</h3>
        </div>

        <!-- Loading -->
        <div v-if="isLoading" class="flex items-center justify-center p-8">
          <div class="text-gray-400">Загрузка участников...</div>
        </div>

        <!-- Members -->
        <div v-else-if="members.length > 0" class="divide-y divide-gray-200">
          <div
            v-for="member in members"
            :key="member.userId"
            class="p-4 flex items-center space-x-3 hover:bg-gray-50 transition-colors"
          >
            <!-- Avatar -->
            <Avatar
              :avatar="member.avatar"
              :name="member.name || member.userId"
              :userId="member.userId"
              size="md"
              shape="circle"
            />

            <!-- Info -->
            <div class="flex-1 min-w-0">
              <div class="flex items-center space-x-2">
                <div class="font-medium text-gray-900 truncate">
                  {{ member.name || member.userId }}
                </div>
                <span
                  v-if="member.role === 'owner'"
                  class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-purple-100 text-purple-800"
                  title="Владелец группы"
                >
                  Owner
                </span>
              </div>
              <div v-if="member.phone" class="text-sm text-gray-500 truncate">
                {{ formatPhone(member.phone) }}
              </div>
            </div>
          </div>
        </div>

        <!-- Empty State -->
        <div v-else class="flex flex-col items-center justify-center p-8 text-gray-400">
          <svg class="w-16 h-16 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
          </svg>
          <p>Нет участников</p>
        </div>

        <!-- Pagination -->
        <div v-if="hasMorePages" class="p-4 border-t border-gray-200 bg-gray-50">
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

      <!-- Actions -->
      <div class="p-4 border-t border-gray-200 bg-gray-50">
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
import Avatar from '@/components/Avatar.vue'
import type { Dialog } from '@/types'

interface Member {
  userId: string
  name?: string
  phone?: string
  avatar?: string | null
  role?: string | null
  [key: string]: any
}

const props = defineProps<{
  isOpen: boolean
  dialog: Dialog | null
}>()

const emit = defineEmits<{
  close: []
}>()

const members = ref<Member[]>([])
const isLoading = ref(false)
const isLoadingMore = ref(false)
const currentPage = ref(1)
const totalMembers = ref(0)
const hasMorePages = ref(false)
const limit = 20

// Load members on open
watch(() => props.isOpen, (newValue) => {
  if (newValue && props.dialog) {
    loadMembers(true)
  } else {
    // Reset on close
    members.value = []
    currentPage.value = 1
    totalMembers.value = 0
    hasMorePages.value = false
  }
})

async function loadMembers(reset = false) {
  if (!props.dialog) return

  if (reset) {
    currentPage.value = 1
    members.value = []
    isLoading.value = true
  } else {
    isLoadingMore.value = true
  }

  try {
    const response = await api.getDialogMembers(props.dialog.dialogId)
    
    if (response.success && response.data) {
      const allMembers = response.data as Member[]
      
      // Calculate pagination
      const startIndex = (currentPage.value - 1) * limit
      const endIndex = startIndex + limit
      const pageMembers = allMembers.slice(startIndex, endIndex)
      
      // Get full user info for each member (with avatars) - only for current page
      const membersWithInfo = await Promise.all(
        pageMembers.map(async (member) => {
          try {
            const userResponse = await api.getUser(member.userId)
            if (userResponse.success && userResponse.data) {
              return {
                userId: member.userId,
                name: userResponse.data.name || member.name,
                phone: userResponse.data.phone || member.phone,
                avatar: userResponse.data.avatar || member.avatar || null,
                role: member.role || null, // Preserve role from API response
              }
            }
          } catch (error) {
            console.warn(`Failed to get user info for ${member.userId}:`, error)
          }
          
          return {
            userId: member.userId,
            name: member.name,
            phone: member.phone,
            avatar: member.avatar || null,
            role: member.role || null, // Preserve role from API response
          }
        })
      )

      if (reset) {
        members.value = membersWithInfo
      } else {
        members.value.push(...membersWithInfo)
      }

      totalMembers.value = allMembers.length
      hasMorePages.value = endIndex < allMembers.length
    }
  } catch (error: any) {
    console.error('Failed to load members:', error)
  } finally {
    isLoading.value = false
    isLoadingMore.value = false
  }
}

async function loadMore() {
  if (hasMorePages.value && !isLoadingMore.value) {
    currentPage.value++
    await loadMembers(false)
  }
}

function close() {
  emit('close')
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

