import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'
import websocket from '@/services/websocket'
import type { User } from '@/types'

export const useAuthStore = defineStore('auth', () => {
  const user = ref<User | null>(null)
  const token = ref<string | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => !!token.value && !!user.value)

  // Initialize from sessionStorage (isolated per tab)
  function init() {
    const savedToken = sessionStorage.getItem('token')
    const savedUser = sessionStorage.getItem('user')

    if (savedToken && savedUser) {
      token.value = savedToken
      user.value = JSON.parse(savedUser)
      
      // Connect WebSocket
      websocket.connect(savedToken)
    }
  }

  async function requestCode(phone: string, name?: string) {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.requestCode(phone, name)
      return response
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function verifyCode(phone: string, code: string) {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.verifyCode(phone, code)
      
      // Save to store and sessionStorage (isolated per tab)
      token.value = response.token
      user.value = response.user
      
      sessionStorage.setItem('token', response.token)
      sessionStorage.setItem('user', JSON.stringify(response.user))

      // Connect WebSocket
      websocket.connect(response.token)

      return response
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  function logout() {
    user.value = null
    token.value = null
    error.value = null

    sessionStorage.removeItem('token')
    sessionStorage.removeItem('user')

    websocket.disconnect()
  }

  return {
    user,
    token,
    isLoading,
    error,
    isAuthenticated,
    init,
    requestCode,
    verifyCode,
    logout
  }
})

