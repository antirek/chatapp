<template>
  <div v-if="isOpen" class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50" @click.self="close">
    <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] overflow-y-auto">
      <!-- Header -->
      <div class="p-6 border-b border-gray-200">
        <div class="flex items-center justify-between">
          <h2 class="text-xl font-semibold">Мой профиль</h2>
          <button
            @click="close"
            class="p-2 text-gray-400 hover:text-gray-600 rounded-lg transition-colors"
          >
            <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>

      <!-- Content -->
      <div class="p-6">
        <!-- Avatar Section -->
        <div class="flex flex-col items-center mb-6">
          <div class="relative mb-4">
            <Avatar
              :avatar="profile?.avatar"
              :name="profile?.name"
              :userId="profile?.userId"
              size="xl"
              shape="circle"
            />
            <button
              @click="triggerFileInput"
              class="absolute bottom-0 right-0 p-2 bg-primary-600 text-white rounded-full hover:bg-primary-700 transition-colors shadow-lg"
              title="Изменить аватар"
            >
              <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
              </svg>
            </button>
          </div>
          
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            @change="handleFileSelect"
            class="hidden"
          />

          <button
            v-if="profile?.avatar"
            @click="handleDeleteAvatar"
            class="text-sm text-red-600 hover:text-red-700 transition-colors"
            :disabled="isDeleting"
          >
            {{ isDeleting ? 'Удаление...' : 'Удалить аватар' }}
          </button>
        </div>

        <!-- User Info -->
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Имя</label>
            <div class="text-gray-900 font-medium">{{ profile?.name || 'Не указано' }}</div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">Телефон</label>
            <div class="text-gray-900">{{ profile?.phone || 'Не указано' }}</div>
          </div>

          <div>
            <label class="block text-sm font-medium text-gray-700 mb-1">ID пользователя</label>
            <div class="text-gray-500 text-sm font-mono">{{ profile?.userId || 'Не указано' }}</div>
          </div>
        </div>

        <!-- Loading State -->
        <div v-if="isLoading" class="flex justify-center py-4">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-primary-600"></div>
        </div>

        <!-- Success Message -->
        <div v-if="successMessage" class="mt-4 p-3 bg-green-50 border border-green-200 rounded-lg text-green-700 text-sm">
          {{ successMessage }}
        </div>

        <!-- Error Message -->
        <div v-if="error" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-700 text-sm">
          {{ error }}
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted } from 'vue'
import api from '@/services/api'
import Avatar from './Avatar.vue'

interface Props {
  isOpen: boolean
}

interface Profile {
  userId: string
  name: string
  phone: string
  avatar?: string | null
  createdAt?: string
  lastActiveAt?: string
}

const props = defineProps<Props>()

const emit = defineEmits<{
  close: []
  avatarUpdated: [avatar: string | null]
}>()

const profile = ref<Profile | null>(null)
const isLoading = ref(false)
const isDeleting = ref(false)
const error = ref<string | null>(null)
const successMessage = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)

// Load profile when modal opens
watch(() => props.isOpen, async (isOpen) => {
  if (isOpen) {
    await loadProfile()
  }
})

async function loadProfile() {
  isLoading.value = true
  error.value = null
  successMessage.value = null

  try {
    const response = await api.getMyProfile()
    if (response.success && response.data) {
      profile.value = response.data
    } else {
      error.value = response.error || 'Не удалось загрузить профиль'
    }
  } catch (err: any) {
    const errorMessage = err.response?.data?.error || err.message || 'Не удалось загрузить профиль'
    error.value = errorMessage
    console.error('Failed to load profile:', err)
    
    // If user not found, try to use data from authStore as fallback
    const { useAuthStore } = await import('@/stores/auth')
    const authStore = useAuthStore()
    if (authStore.user) {
      profile.value = {
        userId: authStore.user.userId,
        name: authStore.user.name || null,
        phone: authStore.user.phone || null,
        avatar: null
      }
      error.value = null // Clear error if we have fallback data
    }
  } finally {
    isLoading.value = false
  }
}

function triggerFileInput() {
  if (fileInput.value) {
    fileInput.value.click()
  } else {
    console.error('❌ fileInput ref is null')
    error.value = 'Ошибка: не удалось открыть диалог выбора файла'
  }
}

async function handleFileSelect(event: Event) {
  const target = event.target as HTMLInputElement
  const file = target.files?.[0]
  
  if (!file) {
    return
  }

  // Validate file type
  if (!file.type.startsWith('image/')) {
    error.value = 'Пожалуйста, выберите изображение'
    return
  }

  // Validate file size (max 5MB)
  if (file.size > 5 * 1024 * 1024) {
    error.value = 'Размер файла не должен превышать 5MB'
    return
  }

  isLoading.value = true
  error.value = null
  successMessage.value = null

  try {
    // Convert file to base64
    const base64 = await fileToBase64(file)
    
    // Update avatar
    const response = await api.updateAvatar(base64)
    
    if (response.success) {
      // Update local profile
      if (profile.value) {
        profile.value.avatar = response.data?.avatar || base64
      }
      
      // Emit event to update avatar in parent components
      emit('avatarUpdated', profile.value?.avatar || null)
      
      // Reset file input
      if (fileInput.value) {
        fileInput.value.value = ''
      }
      
      // Show success message
      successMessage.value = 'Аватар успешно обновлен!'
      error.value = null
      
      // Clear success message after 3 seconds
      setTimeout(() => {
        successMessage.value = null
      }, 3000)
    } else {
      error.value = response.error || 'Не удалось обновить аватар'
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || 'Не удалось обновить аватар'
    console.error('❌ Failed to update avatar:', err)
  } finally {
    isLoading.value = false
  }
}

async function handleDeleteAvatar() {
  if (!confirm('Вы уверены, что хотите удалить аватар?')) {
    return
  }

  isDeleting.value = true
  error.value = null

  try {
    const response = await api.deleteAvatar()
    
    if (response.success) {
      // Update local profile
      if (profile.value) {
        profile.value.avatar = null
      }
      
      // Emit event
      emit('avatarUpdated', null)
    }
  } catch (err: any) {
    error.value = err.response?.data?.error || err.message || 'Не удалось удалить аватар'
    console.error('Failed to delete avatar:', err)
  } finally {
    isDeleting.value = false
  }
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result)
    }
    reader.onerror = reject
    reader.readAsDataURL(file)
  })
}

function close() {
  emit('close')
}
</script>

<style scoped>
/* Additional styles if needed */
</style>

