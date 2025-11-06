import { ref } from 'vue'

// Audio notification system for incoming messages
let audioContext: AudioContext | null = null
const audioInitialized = ref(false)
const showAudioPermissionHint = ref(false)

/**
 * Composable for playing melodic notification sounds
 * @returns Object with audio control functions and state
 */
export function useNotificationSound() {
  /**
   * Initialize AudioContext on first user interaction
   */
  function initializeAudio() {
    if (!audioContext) {
      try {
        audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
        audioInitialized.value = true
        console.log('🔊 Audio context initialized')
      } catch (error) {
        console.error('Failed to initialize audio context:', error)
      }
    }
  }

  /**
   * Play a melodic three-note notification sound (C-E-G major triad)
   */
  function playNotificationSound() {
    // Initialize audio context if not already done
    if (!audioInitialized.value) {
      initializeAudio()
    }

    if (audioContext && audioContext.state === 'suspended') {
      // Attempt to resume context if suspended (e.g., after user interaction)
      audioContext.resume().then(() => {
        console.log('🔊 Audio context resumed successfully')
        showAudioPermissionHint.value = false
        playSound()
      }).catch(error => {
        console.error('Failed to resume audio context:', error)
        showAudioPermissionHint.value = true
      })
    } else if (audioContext && audioContext.state === 'running') {
      playSound()
      showAudioPermissionHint.value = false
    } else {
      console.warn('Audio context not available or not running.')
      showAudioPermissionHint.value = true
    }
  }

  /**
   * Internal function to play the actual sound (C-E-G major triad)
   */
  function playSound() {
    if (!audioContext) return
    
    const now = audioContext.currentTime
    const noteDuration = 0.12 // Duration of each note
    const noteGap = 0.05 // Gap between notes

    // First note: C5 (523 Hz)
    const osc1 = audioContext.createOscillator()
    const gain1 = audioContext.createGain()
    osc1.connect(gain1)
    gain1.connect(audioContext.destination)
    osc1.frequency.value = 523 // C5
    osc1.type = 'sine'
    
    gain1.gain.setValueAtTime(0, now)
    gain1.gain.linearRampToValueAtTime(0.2, now + 0.02)
    gain1.gain.linearRampToValueAtTime(0, now + noteDuration)
    
    osc1.start(now)
    osc1.stop(now + noteDuration)

    // Second note: E5 (659 Hz) - plays after first note
    const startTime2 = now + noteDuration + noteGap
    const osc2 = audioContext.createOscillator()
    const gain2 = audioContext.createGain()
    osc2.connect(gain2)
    gain2.connect(audioContext.destination)
    osc2.frequency.value = 659 // E5
    osc2.type = 'sine'
    
    gain2.gain.setValueAtTime(0, startTime2)
    gain2.gain.linearRampToValueAtTime(0.2, startTime2 + 0.02)
    gain2.gain.linearRampToValueAtTime(0, startTime2 + noteDuration)
    
    osc2.start(startTime2)
    osc2.stop(startTime2 + noteDuration)

    // Third note: G5 (784 Hz) - plays after second note
    const startTime3 = startTime2 + noteDuration + noteGap
    const osc3 = audioContext.createOscillator()
    const gain3 = audioContext.createGain()
    osc3.connect(gain3)
    gain3.connect(audioContext.destination)
    osc3.frequency.value = 784 // G5
    osc3.type = 'sine'
    
    gain3.gain.setValueAtTime(0, startTime3)
    gain3.gain.linearRampToValueAtTime(0.2, startTime3 + 0.02)
    gain3.gain.linearRampToValueAtTime(0, startTime3 + noteDuration)
    
    osc3.start(startTime3)
    osc3.stop(startTime3 + noteDuration)
  }

  /**
   * Clean up AudioContext on component unmount
   */
  function cleanupAudio() {
    if (audioContext) {
      audioContext.close()
      audioContext = null
      audioInitialized.value = false
    }
  }

  return {
    audioInitialized,
    showAudioPermissionHint,
    initializeAudio,
    playNotificationSound,
    cleanupAudio
  }
}


