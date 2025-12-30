<template>
  <div class="border-b border-gray-200 bg-white">
    <div class="px-4 py-2 flex items-center justify-between">
      <h3 class="text-sm font-semibold text-gray-700">📌 Топики</h3>
      <button
        v-if="isGroupChat"
        @click="openCreateTopicModal"
        class="p-1 text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded transition-colors"
        title="Создать топик"
      >
        <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 4v16m8-8H4" />
        </svg>
      </button>
    </div>

    <div class="px-2 pb-2 max-h-64 overflow-y-auto">
      <!-- All Messages Button -->
      <button
        @click="selectAllMessages"
        class="w-full px-3 py-2 text-left rounded-lg transition-colors mb-1 flex items-center justify-between"
        :class="selectedTopicId === null 
          ? 'bg-primary-50 text-primary-700 border border-primary-200' 
          : 'text-gray-700 hover:bg-gray-50'"
      >
        <span class="text-sm font-medium">Все сообщения</span>
        <span v-if="totalUnreadCount > 0" class="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full">
          {{ totalUnreadCount }}
        </span>
      </button>

      <!-- Topics List -->
      <div v-if="topics.length > 0" class="space-y-1">
        <button
          v-for="topic in topics"
          :key="topic.topicId"
          @click="selectTopic(topic.topicId)"
          class="w-full px-3 py-2 text-left rounded-lg transition-colors flex items-center justify-between group"
          :class="selectedTopicId === topic.topicId 
            ? 'bg-primary-50 text-primary-700 border border-primary-200' 
            : 'text-gray-700 hover:bg-gray-50'"
        >
          <div class="flex items-center gap-2 flex-1 min-w-0">
            <!-- Topic Color Indicator -->
            <div
              v-if="topic.meta?.color"
              class="w-3 h-3 rounded-full flex-shrink-0"
              :style="{ backgroundColor: topic.meta.color }"
            ></div>
            <div
              v-else
              class="w-3 h-3 rounded-full flex-shrink-0 bg-gray-400"
            ></div>
            <!-- Topic Name -->
            <span class="text-sm font-medium truncate">
              {{ topic.meta?.name || 'Без названия' }}
            </span>
          </div>
          <!-- Unread Count Badge -->
          <span
            v-if="topic.unreadCount && topic.unreadCount > 0"
            class="text-xs bg-primary-100 text-primary-700 px-2 py-0.5 rounded-full flex-shrink-0 ml-2"
          >
            {{ topic.unreadCount }}
          </span>
        </button>
      </div>

      <!-- Empty State -->
      <div v-else-if="!isLoading" class="px-3 py-2 text-sm text-gray-500 text-center">
        Нет топиков
      </div>

      <!-- Loading State -->
      <div v-if="isLoading" class="px-3 py-2 text-sm text-gray-400 text-center">
        Загрузка...
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { useTopicsStore } from '@/stores/topics'
import type { Dialog } from '@/types'

interface Props {
  dialog: Dialog | null
}

const props = defineProps<Props>()

const topicsStore = useTopicsStore()

const isGroupChat = computed(() => {
  return props.dialog?.chatType === 'group' || props.dialog?.meta?.type === 'group'
})

const topics = computed(() => topicsStore.topics)
const selectedTopicId = computed(() => topicsStore.selectedTopicId)
const isLoading = computed(() => topicsStore.isLoading)

const totalUnreadCount = computed(() => {
  return topics.value.reduce((sum, topic) => sum + (topic.unreadCount || 0), 0)
})

function selectTopic(topicId: string) {
  topicsStore.selectTopic(topicId)
}

function selectAllMessages() {
  topicsStore.selectTopic(null)
}

function openCreateTopicModal() {
  emit('create-topic')
}

const emit = defineEmits<{
  'create-topic': []
}>()
</script>
