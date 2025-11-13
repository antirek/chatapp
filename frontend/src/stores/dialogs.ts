import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'
import { normalizeMessageType } from '@/utils/messageType'
import type { Dialog, PaginatedResponse } from '@/types'

export const useDialogsStore = defineStore('dialogs', () => {
  const dialogs = ref<Dialog[]>([])
  const currentDialog = ref<Dialog | null>(null)
  const isLoading = ref(false)
  const isLoadingMore = ref(false)
  const error = ref<string | null>(null)
  const pagination = ref<PaginatedResponse<Dialog>['pagination'] | null>(null)
  const isSearching = ref(false)
  const isLoadingMoreSearch = ref(false)
  const searchError = ref<string | null>(null)
  const lastSearchTerm = ref('')
  const searchResults = ref<Dialog[]>([])
  const searchPagination = ref<PaginatedResponse<Dialog>['pagination'] | null>(null)
  const searchSequence = ref(0)
  const currentFilter = ref<'all' | 'p2p' | 'group:private' | 'group:public' | 'favorites'>('all')

  const hasMoreDialogs = computed(() => {
    if (!pagination.value) {
      return false
    }
    const currentPage = Number(pagination.value.page) || 0
    const totalPages = Number(pagination.value.pages) || 0
    return currentPage < totalPages
  })

  const hasMoreSearchResults = computed(() => {
    if (!searchPagination.value) {
      return false
    }
    const currentPage = Number(searchPagination.value.page) || 0
    const totalPages = Number(searchPagination.value.pages) || 0
    return currentPage < totalPages
  })

  interface FetchDialogsParams {
    page?: number
    limit?: number
    includeLastMessage?: boolean
    append?: boolean
    retries?: number
    type?: 'all' | 'p2p' | 'group:private' | 'group:public' | 'favorites'
  }

  async function fetchDialogs(params?: FetchDialogsParams) {
    const page = params?.page ?? 1
    const limit = params?.limit ?? pagination.value?.limit ?? 50
    const includeLastMessage = params?.includeLastMessage ?? true
    const append = params?.append ?? page > 1
    let filterForRequest: 'all' | 'p2p' | 'group:private' | 'group:public' | 'favorites' = currentFilter.value

    if (params?.type !== undefined) {
      filterForRequest = params.type
      if (!append) {
        currentFilter.value = filterForRequest
      } else {
        currentFilter.value = filterForRequest
      }
    }

    if (append) {
      if (isLoadingMore.value || isLoading.value) {
        return
      }
      isLoadingMore.value = true
    } else {
      isLoading.value = true
      error.value = null
    }

    const maxRetries = params?.retries ?? 3
    let lastError: any = null

    const clearLoadingState = () => {
      if (append) {
        isLoadingMore.value = false
      } else {
        isLoading.value = false
      }
    }

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const response = await api.getDialogs({
          page,
          limit,
          includeLastMessage,
          type: filterForRequest
        })

        const normalizedDialogs = response.data.map(dialog => normalizeDialog(dialog))
        const rawPagination = response.pagination || {
          page,
          limit,
          total: normalizedDialogs.length,
          pages: normalizedDialogs.length ? 1 : 0
        }

        const parsedPage = Number(rawPagination.page)
        const parsedLimit = Number(rawPagination.limit)
        const parsedTotal = Number(rawPagination.total)
        const parsedPages = Number(rawPagination.pages)

        const sanitizedLimit = Number.isFinite(parsedLimit) && parsedLimit > 0 ? parsedLimit : limit
        const sanitizedTotal = Number.isFinite(parsedTotal) && parsedTotal >= 0 ? parsedTotal : normalizedDialogs.length
        const computedPages = sanitizedLimit > 0 ? Math.ceil(sanitizedTotal / sanitizedLimit) : 0

        const sanitizedPagination = {
          page: Number.isFinite(parsedPage) && parsedPage > 0 ? parsedPage : page,
          limit: sanitizedLimit,
          total: sanitizedTotal,
          pages: Number.isFinite(parsedPages) && parsedPages >= 0 ? parsedPages : (sanitizedTotal === 0 ? 0 : Math.max(1, computedPages))
        }

        pagination.value = sanitizedPagination

        if (append) {
          const existing = dialogs.value.slice()
          const indexMap = new Map(existing.map((dialog, idx) => [dialog.dialogId, idx]))

          for (const dialog of normalizedDialogs) {
            const existingIndex = indexMap.get(dialog.dialogId)
            if (existingIndex != null) {
              existing[existingIndex] = dialog
            } else {
              existing.push(dialog)
            }
          }

          dialogs.value = existing
        } else {
          dialogs.value = normalizedDialogs
        }

        error.value = null

        clearLoadingState()

        return {
          ...response,
          data: normalizedDialogs,
          pagination: sanitizedPagination
        }
      } catch (err: any) {
        lastError = err
        const isNetworkError = err.code === 'ERR_NETWORK' || err.code === 'ECONNREFUSED'

        if (isNetworkError && attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 5000)
          console.log(`⏳ Failed to load dialogs (attempt ${attempt + 1}/${maxRetries + 1}), retrying in ${delay}ms...`)
          await new Promise(resolve => setTimeout(resolve, delay))
          continue
        }

        break
      }
    }

    const message = lastError?.response?.data?.error || lastError?.message || 'Failed to load dialogs'
    error.value = message
    clearLoadingState()
    throw lastError
  }

  async function loadMoreDialogs() {
    if (isLoading.value || isLoadingMore.value || !hasMoreDialogs.value) {
      return
    }

    const nextPage = (pagination.value?.page ?? 1) + 1
    const limit = pagination.value?.limit ?? 50

    await fetchDialogs({
      page: nextPage,
      limit,
      includeLastMessage: true,
      append: true,
      type: currentFilter.value
    })
  }

  async function createDialog(name: string, memberIds?: string[]) {
    isLoading.value = true
    error.value = null

    try {
      const response = await api.createDialog({ name, memberIds })

      if (response.data) {
        const normalizedDialog = normalizeDialog(response.data as Dialog)
        const dialogId = normalizedDialog.dialogId
        const existingIndex = dialogs.value.findIndex(d => d.dialogId === dialogId)

        if (existingIndex !== -1) {
          dialogs.value[existingIndex] = normalizedDialog
          console.log(`✅ Updated existing dialog ${dialogId} in list`)
        } else {
          dialogs.value.unshift(normalizedDialog)
          console.log(`✅ Added new dialog ${dialogId} to list`)
        }

        if (pagination.value) {
          pagination.value.total = (pagination.value.total || 0) + (existingIndex === -1 ? 1 : 0)
          pagination.value.pages = Math.max(
            pagination.value.pages || 1,
            Math.ceil((pagination.value.total || 0) / (pagination.value.limit || 50))
          )
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
    } else {
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
    page?: number
    limit?: number
    type?: 'all' | 'p2p' | 'group:private' | 'group:public' | 'favorites'
    append?: boolean
  }) {
    const trimmed = search?.trim() || ''

    if (trimmed.length < 2) {
      clearSearch()
      return
    }

    const append = options?.append ?? false
    const page = options?.page || (append && searchPagination.value ? Number(searchPagination.value.page) + 1 : 1)

    if (append) {
      isLoadingMoreSearch.value = true
    } else {
      isSearching.value = true
    }
    searchError.value = null
    const sequenceId = ++searchSequence.value

    try {
      const response = await api.getDialogs({
        search: trimmed,
        page,
        limit: options?.limit || 50,
        includeLastMessage: true,
        type: options?.type || currentFilter.value === 'all' ? undefined : currentFilter.value
      })

      if (sequenceId === searchSequence.value) {
        if (append) {
          // Append new results to existing ones
          searchResults.value = [...searchResults.value, ...(response.data || [])]
        } else {
          // Replace results
          searchResults.value = response.data || []
        }
        searchPagination.value = response.pagination || null
        lastSearchTerm.value = trimmed
      }

      return response
    } catch (err: any) {
      searchError.value = err.response?.data?.error || err.message || 'Search failed'
      throw err
    } finally {
      if (sequenceId === searchSequence.value) {
        if (append) {
          isLoadingMoreSearch.value = false
        } else {
          isSearching.value = false
        }
      }
    }
  }

  async function loadMoreSearchResults() {
    if (isSearching.value || isLoadingMoreSearch.value || !hasMoreSearchResults.value || !lastSearchTerm.value) {
      return
    }

    await searchDialogs(lastSearchTerm.value, {
      append: true,
      type: currentFilter.value === 'all' ? undefined : currentFilter.value
    })
  }

  function clearSearch() {
    searchSequence.value++
    searchResults.value = []
    searchPagination.value = null
    lastSearchTerm.value = ''
    searchError.value = null
    isSearching.value = false
  }

  return {
    dialogs,
    currentDialog,
    isLoading,
    isLoadingMore,
    error,
    pagination,
    hasMoreDialogs,
    fetchDialogs,
    loadMoreDialogs,
    createDialog,
    selectDialog,
    updateDialogUnreadCount,
    incrementUnreadCount,
    updateLastMessage,
    currentFilter,
    isSearching,
    isLoadingMoreSearch,
    searchError,
    searchResults,
    searchPagination,
    lastSearchTerm,
    hasMoreSearchResults,
    searchDialogs,
    loadMoreSearchResults,
    clearSearch
  }
})

