<template>
  <div 
    class="avatar"
    :class="[sizeClass, shapeClass]"
    :style="avatarStyle"
  >
    <img 
      v-if="avatarUrl" 
      :src="avatarUrl" 
      :alt="name || 'Avatar'"
      @error="handleImageError"
      class="avatar-image"
    />
    <div 
      v-else 
      class="avatar-placeholder"
      :style="placeholderStyle"
    >
      <!-- Group icon for group chats without avatar -->
      <svg 
        v-if="isGroup" 
        class="w-full h-full p-1" 
        fill="none" 
        stroke="currentColor" 
        viewBox="0 0 24 24"
      >
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0zm6 3a2 2 0 11-4 0 2 2 0 014 0zM7 10a2 2 0 11-4 0 2 2 0 014 0z" />
      </svg>
      <!-- Initials for users -->
      <span v-else>{{ initials }}</span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref } from 'vue'

interface Props {
  avatar?: string | null
  name?: string
  size?: 'xs' | 'sm' | 'md' | 'lg' | 'xl'
  shape?: 'circle' | 'square'
  userId?: string
  isGroup?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  avatar: null,
  name: '',
  size: 'md',
  shape: 'circle',
  userId: '',
  isGroup: false
})

const imageError = ref(false)

const sizeClass = computed(() => {
  const sizes = {
    xs: 'w-6 h-6 text-xs',
    sm: 'w-8 h-8 text-sm',
    md: 'w-10 h-10 text-base',
    lg: 'w-12 h-12 text-lg',
    xl: 'w-16 h-16 text-xl'
  }
  return sizes[props.size]
})

const shapeClass = computed(() => {
  return props.shape === 'circle' ? 'rounded-full' : 'rounded-lg'
})

const avatarUrl = computed(() => {
  if (imageError.value) return null
  return props.avatar || null
})

const initials = computed(() => {
  if (!props.name) {
    // Fallback to userId initials if no name
    if (props.userId) {
      const parts = props.userId.split('_')
      if (parts.length > 1) {
        return parts[1].substring(0, 2).toUpperCase()
      }
    }
    return '?'
  }
  
  const parts = props.name.trim().split(/\s+/)
  if (parts.length >= 2) {
    // First letter of first name + first letter of last name
    return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
  } else if (parts.length === 1) {
    // First two letters of name
    return parts[0].substring(0, 2).toUpperCase()
  }
  return '?'
})

// Generate color based on name/userId for consistent avatar colors
const placeholderStyle = computed(() => {
  // For group chats, use fixed purple-pink gradient
  if (props.isGroup) {
    return {
      background: 'linear-gradient(to bottom right, #a855f7, #ec4899)',
      color: '#ffffff'
    }
  }
  
  const str = props.name || props.userId || 'default'
  let hash = 0
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash)
  }
  
  // Generate a color from hash
  const hue = hash % 360
  const saturation = 60 + (hash % 20) // 60-80%
  const lightness = 45 + (hash % 15) // 45-60%
  
  return {
    backgroundColor: `hsl(${hue}, ${saturation}%, ${lightness}%)`,
    color: '#ffffff'
  }
})

const avatarStyle = computed(() => {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    flexShrink: 0
  }
})

function handleImageError() {
  imageError.value = true
}
</script>

<style scoped>
.avatar {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  overflow: hidden;
  flex-shrink: 0;
  font-weight: 500;
}

.avatar-image {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.avatar-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 600;
  user-select: none;
}
</style>

