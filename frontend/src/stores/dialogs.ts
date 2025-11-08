import { defineStore } from 'pinia'
import { ref } from 'vue'
import api from '@/services/api'
import { normalizeMessageType } from '@/utils/messageType'
import type { Dialog, DialogSearchResponse } from '@/types'

export const useDialogsStore = defineStore('dialogs', () => {
  const dialogs = ref<Dialog[]>([])
  const currentDialog = ref<Dialog | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)
  const isSearching = ref(false)
  const searchError = ref<string | null>(null)
  const lastSearchTerm = ref('')
  const searchResults = ref<{
    personal: Dialog[]
    groups: Dialog[]
    publicGroups: Dialog[]
  }>({
    personal: [],
    groups: [],
    publicGroups: []
  })
  const searchPagination = ref<{
    personal?: DialogSearchResponse['personal']['pagination']
    groups?: DialogSearchResponse['groups']['pagination']
    publicGroups?: DialogSearchResponse['publicGroups']['pagination']
  }>({})
  const searchSequence = ref(0)

  async function fetchDialogs(params?: {
    page?: number
    limit?: number
    includeLastMessage?: boolean
    retries?: number
  }) {
    isLoading.value = true
    error.value = null

    const maxRetries = params?.retries ?? 3
    let lastError: any = null

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await api.getDialogs({
          page: params?.page || 1,
          limit: params?.limit || 50,
          includeLastMessage: params?.includeLastMessage ?? true
        })

        const normalizedDialogs = response.data.map(dialog => normalizeDialog(dialog))
        dialogs.value = normalizedDialogs
        response.data = normalizedDialogs
        error.value = null // Clear error on success
        isLoading.value = false // Clear loading state on success
        return response
      } catch (err: any) {
        lastError = err
        const isNetworkError = err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED'
        
        // Retry only on network errors and if we have retries left
        if (isNetworkError && attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000) // Exponential backoff: 1s, 2s, 4s, max 5s
          console.log(`⏳ Failed to load dialogs (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }
        
        // Don't retry on auth errors or after max retries
        break
      }
    }

    // If we got here, all retries failed
    error.value = lastError?.response?.data?.error || lastError?.message || 'Failed to load dialogs'
    isLoading.value = false
    throw lastError
  }

  async function createDialog(name: string, memberIds?: string[]) {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.createDialog({ name, memberIds })
      
      // Check if dialog already exists in list (for P2P dialogs that already exist)
      if (response.data) {
        const dialogId = response.data.dialogId
        const existingIndex = dialogs.value.findIndex(d => d.dialogId === dialogId)
        
        if (existingIndex !== -1) {
          // Dialog already exists - update it instead of adding duplicate
          dialogs.value[existingIndex] = response.data as Dialog
          console.log(`✅ Updated existing dialog ${dialogId} in list`)
        } else {
          // New dialog - add to list
          dialogs.value.unshift(response.data as Dialog)
          console.log(`✅ Added new dialog ${dialogId} to list`)
        }
      }

      return response
    } catch (err: any) {
      error.value = err.response?.data?.error || err.message
      throw err
    } finally {
      isLoading.value = false
    }
  }

  async function selectDialog(dialogId: string) {
    const dialog = dialogs.value.find(d => d.dialogId === dialogId)
    
    if (dialog) {
      currentDialog.value = dialog
      
      // Don't reset unread count here - it should only be reset when messages are actually read
      // The unread count will be updated by WebSocket when user reads messages
    } else {
      // Fetch dialog if not in list
      try {
        const response = await api.getDialog(dialogId)
        if (response.data) {
          currentDialog.value = normalizeDialog(response.data as Dialog)
        }
      } catch (err) {
        console.error('Failed to fetch dialog:', err)
      }
    }
  }

  function updateDialogUnreadCount(dialogId: string, count: number) {
    const dialog = dialogs.value.find(d => d.dialogId === dialogId)
    if (dialog) {
      dialog.unreadCount = count
    }
  }

  function incrementUnreadCount(dialogId: string) {
    const dialog = dialogs.value.find(d => d.dialogId === dialogId)
    if (dialog) {
      dialog.unreadCount = (dialog.unreadCount || 0) + 1
    }
  }

  function updateLastMessage(dialogId: string, message: any) {
    const dialog = dialogs.value.find(d => d.dialogId === dialogId)
    if (dialog) {
      const normalizedType = normalizeMessageType(message.type, message.meta)
      const rawContent = typeof message.content === 'string' ? message.content.trim() : ''
      let adjustedContent = rawContent

      if (normalizedType === 'image' && (!adjustedContent || adjustedContent === '[image]')) {
        adjustedContent = message.meta?.originalName || '[Изображение]'
      } else if (normalizedType !== 'text' && adjustedContent === `[${normalizedType}]`) {
        adjustedContent = message.meta?.originalName || '[Вложение]'
      }

      const fallbackContent =
        adjustedContent ||
        message.meta?.originalName ||
        (normalizedType === 'image' ? '[Изображение]' : '[Вложение]')

      dialog.lastMessage = {
        content: fallbackContent,
        senderId: message.senderId,
        type: message.type,
        createdAt: message.createdAt,
        normalizedType
      }
      dialog.lastMessageAt = message.createdAt
      dialog.lastInteractionAt = message.createdAt

      // Move to top
      const index = dialogs.value.indexOf(dialog)
      if (index > 0) {
        dialogs.value.splice(index, 1)
        dialogs.value.unshift(dialog)
      }
    }
  }

  function normalizeDialog(dialog: Dialog): Dialog {
    if (!dialog.lastMessage) {
      return dialog
    }

    return {
      ...dialog,
      lastMessage: {
        ...dialog.lastMessage,
        normalizedType: normalizeMessageType(dialog.lastMessage.type)
      }
    }
  }

  async function searchDialogs(search: string, options?: {
    p2pPage?: number
    p2pLimit?: number
    groupPage?: number
    groupLimit?: number
    publicPage?: number
    publicLimit?: number
  }) {
    const trimmed = search?.trim() || ''

    if (trimmed.length < 2) {
      clearSearch()
      return {
        search: trimmed,
        personal: { data: [], pagination: { page: 1, limit: 0, total: 0, pages: 0 } },
        groups: { data: [], pagination: { page: 1, limit: 0, total: 0, pages: 0 } },
        publicGroups: { data: [], pagination: { page: 1, limit: 0, total: 0, pages: 0 } }
      }
    }

    isSearching.value = true
    searchError.value = null
    const sequenceId = ++searchSequence.value

    try {
      const response = await api.searchDialogs({
        search: trimmed,
        ...options
      })

      if (sequenceId === searchSequence.value) {
        searchResults.value = {
          personal: response.personal?.data || [],
          groups: response.groups?.data || [],
          publicGroups: response.publicGroups?.data || []
        }

        searchPagination.value = {
          personal: response.personal?.pagination,
          groups: response.groups?.pagination,
          publicGroups: response.publicGroups?.pagination
        }

        lastSearchTerm.value = response.search || trimmed
      }

      return response
    } catch (err: any) {
      searchError.value = err.response?.data?.error || err.message || 'Search failed'
      throw err
    } finally {
      if (sequenceId === searchSequence.value) {
        isSearching.value = false
      }
    }
  }

  function clearSearch() {
    searchSequence.value++
    searchResults.value = {
      personal: [],
      groups: [],
      publicGroups: []
    }
    searchPagination.value = {}
    lastSearchTerm.value = ''
    searchError.value = null
    isSearching.value = false
  }

  return {
    dialogs,
    currentDialog,
    isLoading,
    error,
    fetchDialogs,
    createDialog,
    selectDialog,
    updateDialogUnreadCount,
    incrementUnreadCount,
    updateLastMessage,
    isSearching,
    searchError,
    searchResults,
    searchPagination,
    lastSearchTerm,
    searchDialogs,
    clearSearch
  }
})

