<template>
  <div class="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary-500 to-primary-700 p-4">
    <div class="card max-w-md w-full">
      <div class="text-center mb-8">
        <h1 class="text-3xl font-bold text-gray-900 mb-2">ChatApp</h1>
        <p class="text-gray-600">Мессенджер для общения</p>
      </div>

      <!-- Tabs -->
      <div class="flex mb-6 bg-gray-100 rounded-lg p-1" v-if="step === 'phone' || step === 'register'">
        <button
          type="button"
          @click="activeTab = 'login'"
          class="flex-1 py-2 px-4 rounded-md font-medium transition-colors"
          :class="activeTab === 'login' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
        >
          Вход
        </button>
        <button
          type="button"
          @click="activeTab = 'register'"
          class="flex-1 py-2 px-4 rounded-md font-medium transition-colors"
          :class="activeTab === 'register' ? 'bg-white text-primary-600 shadow-sm' : 'text-gray-600 hover:text-gray-900'"
        >
          Регистрация
        </button>
      </div>

      <!-- Login Form (Existing Users) -->
      <form v-if="activeTab === 'login' && step === 'phone'" @submit.prevent="handleLogin" class="space-y-4">
        <div>
          <label for="phone-login" class="block text-sm font-medium text-gray-700 mb-2">
            Номер телефона
          </label>
          <input
            id="phone-login"
            v-model="phone"
            type="tel"
            placeholder="79123456789"
            class="input"
            :disabled="authStore.isLoading"
            required
          />
          <p class="text-xs text-gray-500 mt-1">
            Формат: 79XXXXXXXXX
          </p>
        </div>

        <button
          type="submit"
          class="btn-primary w-full"
          :disabled="authStore.isLoading"
        >
          <span v-if="authStore.isLoading">Отправка...</span>
          <span v-else>Получить код</span>
        </button>
      </form>

      <!-- Register Form (New Users) -->
      <form v-if="activeTab === 'register' && (step === 'phone' || step === 'register')" @submit.prevent="handleRegister" class="space-y-4">
        <div>
          <label for="phone-register" class="block text-sm font-medium text-gray-700 mb-2">
            Номер телефона
          </label>
          <input
            id="phone-register"
            v-model="phone"
            type="tel"
            placeholder="79123456789"
            class="input"
            :disabled="authStore.isLoading"
            required
          />
          <p class="text-xs text-gray-500 mt-1">
            Формат: 79XXXXXXXXX
          </p>
        </div>

        <div>
          <label for="name" class="block text-sm font-medium text-gray-700 mb-2">
            Ваше имя
          </label>
          <input
            id="name"
            v-model="name"
            type="text"
            placeholder="Иван Иванов"
            class="input"
            :disabled="authStore.isLoading"
            required
          />
          <p class="text-xs text-gray-500 mt-1">
            Как вас будут видеть другие пользователи
          </p>
        </div>

        <button
          type="submit"
          class="btn-primary w-full"
          :disabled="authStore.isLoading || !name.trim()"
        >
          <span v-if="authStore.isLoading">Отправка...</span>
          <span v-else>Зарегистрироваться</span>
        </button>
      </form>

      <!-- Verify Code Form (Both Login and Register) -->
      <form v-if="step === 'code'" @submit.prevent="handleVerifyCode" class="space-y-4">
        <div>
          <label for="code" class="block text-sm font-medium text-gray-700 mb-2">
            Код подтверждения
          </label>
          <input
            id="code"
            v-model="code"
            type="text"
            placeholder="1234"
            class="input text-center text-2xl tracking-widest"
            maxlength="4"
            :disabled="authStore.isLoading"
            required
            autofocus
          />
          <p class="text-xs text-gray-500 mt-1">
            Код отправлен на {{ phone }}
          </p>
        </div>

        <button
          type="submit"
          class="btn-primary w-full"
          :disabled="authStore.isLoading || code.length !== 4"
        >
          <span v-if="authStore.isLoading">Проверка...</span>
          <span v-else>Войти</span>
        </button>

        <button
          type="button"
          class="btn-secondary w-full"
          @click="backToPhone"
          :disabled="authStore.isLoading"
        >
          Изменить номер
        </button>
      </form>

      <!-- Error Message -->
      <div v-if="authStore.error" class="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg">
        <p class="text-sm text-red-600">{{ authStore.error }}</p>
      </div>

      <!-- Dev Mode: Show code in console -->
      <div v-if="codeSent" class="mt-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
        <p class="text-xs text-yellow-700">
          🔐 В dev-режиме код выводится в консоль бэкенда
        </p>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { useAuthStore } from '@/stores/auth'

const router = useRouter()
const authStore = useAuthStore()

const activeTab = ref<'login' | 'register'>('login')
const step = ref<'phone' | 'register' | 'code'>('phone')
const phone = ref('')
const name = ref('')
const code = ref('')
const codeSent = ref(false)

// Login (existing users) - only phone
async function handleLogin() {
  try {
    await authStore.requestCode(phone.value) // No name for login
    codeSent.value = true
    step.value = 'code'
  } catch (error) {
    console.error('Login code request failed:', error)
  }
}

// Register (new users) - phone + name
async function handleRegister() {
  try {
    await authStore.requestCode(phone.value, name.value)
    codeSent.value = true
    step.value = 'code'
  } catch (error) {
    console.error('Register code request failed:', error)
  }
}

// Verify code (both scenarios)
async function handleVerifyCode() {
  try {
    await authStore.verifyCode(phone.value, code.value)
    router.push({ name: 'home' })
  } catch (error) {
    console.error('Verify code failed:', error)
    code.value = ''
  }
}

function backToPhone() {
  step.value = activeTab.value === 'register' ? 'register' : 'phone'
  code.value = ''
  codeSent.value = false
}
</script>

