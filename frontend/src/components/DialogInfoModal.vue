<template>
  <Teleport to="body">
    <Transition name="modal">
      <div
        v-if="isOpen"
        class="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50"
        @click.self="close"
      >
        <div class="bg-white rounded-lg shadow-xl max-w-md w-full mx-4 max-h-[90vh] flex flex-col">
          <!-- Header -->
          <div class="flex items-center justify-between p-4 border-b border-gray-200 flex-shrink-0">
            <h2 class="text-lg font-semibold text-gray-900">Информация о диалоге</h2>
            <button
              @click="close"
              class="text-gray-400 hover:text-gray-600 transition-colors"
              aria-label="Закрыть"
            >
              <svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <!-- Content - динамический компонент в зависимости от типа диалога -->
          <div class="flex-1 overflow-y-auto">
            <P2PDialogInfo
              v-if="dialogType === 'p2p'"
              :dialog="dialog"
              @close="close"
            />
            <GroupDialogInfo
              v-else-if="dialogType === 'group'"
              :dialog="dialog"
              @close="close"
              @add-members="$emit('add-members')"
              @left-group="$emit('left-group')"
            />
            <BusinessContactDialogInfo
              v-else-if="dialogType === 'personal_contact'"
              :dialog="dialog"
              @close="close"
            />
            <div
              v-else
              class="p-6 text-center text-gray-500"
            >
              <p>Тип диалога не определен</p>
            </div>
          </div>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { Dialog } from '@/types'
import P2PDialogInfo from './P2PDialogInfo.vue'
import GroupDialogInfo from './GroupDialogInfo.vue'
import BusinessContactDialogInfo from './BusinessContactDialogInfo.vue'

const props = defineProps<{
  isOpen: boolean
  dialog: Dialog
}>()

const emit = defineEmits<{
  close: []
  'add-members': []
  'left-group': []
}>()

const dialogType = computed(() => {
  // Определяем тип диалога
  const chatType = props.dialog.chatType || props.dialog.meta?.type
  
  if (chatType === 'personal_contact') {
    return 'personal_contact'
  }
  
  if (chatType === 'group') {
    return 'group'
  }
  
  // По умолчанию считаем p2p
  return 'p2p'
})

function close() {
  emit('close')
}
</script>

<style scoped>
.modal-enter-active,
.modal-leave-active {
  transition: opacity 0.2s ease;
}

.modal-enter-from,
.modal-leave-to {
  opacity: 0;
}
</style>

