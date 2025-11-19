<template>
  <div class="p-6">
    <!-- Loading -->
    <div v-if="isLoading" class="flex items-center justify-center py-8">
      <div class="text-gray-400">Загрузка информации...</div>
    </div>

    <!-- User Info -->
    <div v-else-if="user" class="space-y-6">
      <!-- Avatar -->
      <div class="flex flex-col items-center">
        <Avatar
          :avatar="user.avatar"
          :name="user.name"
          :userId="user.userId"
          size="xl"
          shape="circle"
        />
        <h3 class="mt-4 text-xl font-semibold text-gray-900">{{ user.name }}</h3>
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
              {{ formatPhone(user.phone) }}
            </div>
          </div>
        </div>

        <!-- User ID -->
        <div class="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg">
          <div class="flex-shrink-0">
            <svg class="w-6 h-6 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 6H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V8a2 2 0 00-2-2h-5m-4 0V5a2 2 0 114 0v1m-4 0a2 2 0 104 0m-5 8a2 2 0 100-4 2 2 0 000 4zm0 0c1.306 0 2.417.835 2.83 2M9 14a3.001 3.001 0 00-2.83 2M15 11h3m-3 4h2" />
            </svg>
          </div>
          <div class="flex-1 min-w-0">
            <div class="text-xs text-gray-500 mb-1">ID пользователя</div>
            <div class="text-sm font-mono text-gray-700 truncate">
              {{ user.userId }}
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
      </div>
    </div>

    <!-- Error -->
    <div v-else class="flex flex-col items-center justify-center py-8 text-gray-500">
      <svg class="w-12 h-12 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
      <p>Не удалось загрузить информацию о пользователе</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import type { Dialog } from '@/types'
import api from '@/services/api'
import Avatar from './Avatar.vue'
import { useAuthStore } from '@/stores/auth'

const P2P_NAME_META_KEY = 'p2pDialogName'
const P2P_AVATAR_META_KEY = 'p2pDialogAvatar'
const LEGACY_P2P_NAME_PREFIX = 'p2pDialogNameFor'
const LEGACY_P2P_AVATAR_PREFIX = 'p2pDialogAvatarFor'

const props = defineProps<{
  dialog: Dialog
}>()

const emit = defineEmits<{
  close: []
}>()

const authStore = useAuthStore()
const user = ref<{
  userId: string
  name: string
  phone: string
  avatar?: string | null
} | null>(null)
const isLoading = ref(true)

onMounted(async () => {
  await loadUserInfo()
})

async function loadUserInfo() {
  try {
    isLoading.value = true
    
    // Получаем ID собеседника из участников диалога
    const currentUserId = authStore.user?.userId
    if (!currentUserId) {
      isLoading.value = false
      return
    }

    // Загружаем участников диалога
    try {
      const membersResponse = await api.getDialogMembers(props.dialog.dialogId, { limit: 10 })
      if (membersResponse.success && membersResponse.data && Array.isArray(membersResponse.data)) {
        const otherMember = membersResponse.data.find((m: any) => m.userId !== currentUserId)
        if (otherMember) {
          // Skip API request for bots and business contacts
          if (otherMember.userId?.startsWith('bot_') || otherMember.userId?.startsWith('cnt_')) {
            user.value = {
              userId: otherMember.userId,
              name: otherMember.name || otherMember.userName || otherMember.userId,
              phone: otherMember.userId.startsWith('cnt_') ? otherMember.phone : null,
              avatar: otherMember.avatar || null,
            }
            isLoading.value = false
            return
          }

          // Загружаем полную информацию о пользователе
          try {
            const userResponse = await api.getUser(otherMember.userId)
            if (userResponse.success && userResponse.data) {
              user.value = {
                userId: userResponse.data.userId || otherMember.userId,
                name: userResponse.data.name || otherMember.name || otherMember.userId,
                phone: userResponse.data.phone || '',
                avatar: userResponse.data.avatar ?? otherMember.avatar ?? null,
              }
              isLoading.value = false
              return
            }
          } catch (userError) {
            console.warn('Failed to load user details:', userError)
          }
          
          // Fallback: используем данные из участников
          user.value = {
            userId: otherMember.userId,
            name: otherMember.name || otherMember.userId,
            phone: otherMember.phone || '',
            avatar: otherMember.avatar || null,
          }
          isLoading.value = false
          return
        }
      }
    } catch (membersError) {
      console.warn('Failed to load members:', membersError)
    }

    // Если участников нет, используем данные из мета-тегов
    const nameFromMeta = getScopedMetaValue(
      props.dialog.meta,
      P2P_NAME_META_KEY,
      LEGACY_P2P_NAME_PREFIX,
      currentUserId
    )
    const avatarFromMeta = getScopedMetaValue(
      props.dialog.meta,
      P2P_AVATAR_META_KEY,
      LEGACY_P2P_AVATAR_PREFIX,
      currentUserId
    ) ?? props.dialog.avatar

    if (nameFromMeta) {
      user.value = {
        userId: props.dialog.dialogId, // Временное значение
        name: nameFromMeta,
        phone: '',
        avatar: avatarFromMeta || null,
      }
    } else {
      // Последний fallback
      user.value = {
        userId: props.dialog.dialogId,
        name: props.dialog.name || props.dialog.dialogName || 'Пользователь',
        phone: '',
        avatar: props.dialog.avatar || null,
      }
    }
  } catch (error) {
    console.error('Error loading user info:', error)
  } finally {
    isLoading.value = false
  }
}

function formatPhone(phone: string): string {
  if (!phone) return 'Не указан'
  
  // Format: 79123456789 -> +7 912 345-67-89
  if (phone.startsWith('7') && phone.length === 11) {
    return `+7 ${phone.substring(1, 4)} ${phone.substring(4, 7)}-${phone.substring(7, 9)}-${phone.substring(9)}`
  }
  
  return phone
}

function unwrapMetaValue(entry: any) {
  if (entry == null) return undefined
  if (typeof entry === 'object' && 'value' in entry) {
    return entry.value
  }
  return entry
}

function getScopedMetaValue(
  meta: Record<string, any> | undefined,
  key: string,
  legacyPrefix: string,
  currentUserId: string
) {
  if (!meta) return undefined
  const scoped = unwrapMetaValue(meta[key])
  if (scoped !== undefined) {
    return scoped
  }
  return unwrapMetaValue(meta[`${legacyPrefix}${currentUserId}`])
}
</script>

