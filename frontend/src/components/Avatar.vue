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
      {{ initials }}
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
}

const props = withDefaults(defineProps<Props>(), {
  avatar: null,
  name: '',
  size: 'md',
  shape: 'circle',
  userId: ''
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

