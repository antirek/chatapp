import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import api from '@/services/api'
import type { Topic, PaginatedResponse } from '@/types'

export const useTopicsStore = defineStore('topics', () => {
  const topics = ref<Topic[]>([])
  const selectedTopicId = ref<string | null>(null) // null = все сообщения
  const isLoading = ref(false)
  const currentDialogId = ref<string | null>(null)
  const pagination = ref<PaginatedResponse<Topic>['pagination'] | null>(null)

  const selectedTopic = computed(() => {
    if (!selectedTopicId.value) return null
    return topics.value.find(t => t.topicId === selectedTopicId.value) || null
  })

  const hasMore = computed(() => {
    if (!pagination.value) return false
    const currentPage = Number(pagination.value.page) || 0
    const totalPages = Number(pagination.value.pages) || 0
    return currentPage < totalPages
  })

  /**
   * Fetch topics for a dialog (without unreadCount)
   */
  async function fetchTopics(dialogId: string, params?: {
    page?: number
    limit?: number
    append?: boolean
  }) {
    if (currentDialogId.value !== dialogId) {
      topics.value = []
      currentDialogId.value = dialogId
      selectedTopicId.value = null
      pagination.value = null
    }

    const page = params?.page || 1
    const limit = params?.limit || 50
    const append = params?.append || false

    if (append) {
      if (isLoading.value) return
    } else {
      isLoading.value = true
    }

    try {
      const response = await api.getTopics(dialogId, { page, limit })
      
      if (append && Array.isArray(response.data)) {
        topics.value = [...topics.value, ...response.data]
      } else if (Array.isArray(response.data)) {
        topics.value = response.data
      }

      if (response.pagination) {
        pagination.value = response.pagination
      }
    } catch (error: any) {
      console.error('Error fetching topics:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Fetch topics for a dialog in user context (with unreadCount)
   */
  async function fetchUserTopics(dialogId: string, params?: {
    page?: number
    limit?: number
    append?: boolean
  }) {
    if (currentDialogId.value !== dialogId) {
      topics.value = []
      currentDialogId.value = dialogId
      selectedTopicId.value = null
      pagination.value = null
    }

    const page = params?.page || 1
    const limit = params?.limit || 50
    const append = params?.append || false

    if (append) {
      if (isLoading.value) return
    } else {
      isLoading.value = true
    }

    try {
      const response = await api.getUserTopics(dialogId, { page, limit })
      
      if (append && Array.isArray(response.data)) {
        // Merge with existing topics, updating unreadCount
        const existingMap = new Map(topics.value.map(t => [t.topicId, t]))
        response.data.forEach(topic => {
          const existing = existingMap.get(topic.topicId)
          if (existing) {
            existing.unreadCount = topic.unreadCount
          } else {
            topics.value.push(topic)
          }
        })
      } else if (Array.isArray(response.data)) {
        topics.value = response.data
      }

      if (response.pagination) {
        pagination.value = response.pagination
      }
    } catch (error: any) {
      console.error('Error fetching user topics:', error)
      throw error
    } finally {
      isLoading.value = false
    }
  }

  /**
   * Create a new topic
   */
  async function createTopic(dialogId: string, topicData: {
    meta: {
      name: string
      color?: string
      description?: string
    }
  }) {
    try {
      const response = await api.createTopic(dialogId, topicData)
      
      if (response.data) {
        // Add to topics list if it's for current dialog
        if (currentDialogId.value === dialogId) {
          topics.value.push(response.data)
        }
      }

      return response.data
    } catch (error: any) {
      console.error('Error creating topic:', error)
      throw error
    }
  }

  /**
   * Select a topic (for filtering messages)
   */
  function selectTopic(topicId: string | null) {
    selectedTopicId.value = topicId
  }

  /**
   * Add or update topic (from WebSocket)
   */
  function addOrUpdateTopic(topic: Topic) {
    const index = topics.value.findIndex(t => t.topicId === topic.topicId)
    if (index >= 0) {
      topics.value[index] = topic
    } else {
      topics.value.push(topic)
    }
  }

  /**
   * Reset store
   */
  function reset() {
    topics.value = []
    selectedTopicId.value = null
    currentDialogId.value = null
    pagination.value = null
    isLoading.value = false
  }

  return {
    topics,
    selectedTopicId,
    selectedTopic,
    isLoading,
    currentDialogId,
    pagination,
    hasMore,
    fetchTopics,
    fetchUserTopics,
    createTopic,
    selectTopic,
    addOrUpdateTopic,
    reset,
  }
})
