import type { Message } from '@/types'

const INCOMING_TYPE_ALIASES: Record<string, string> = {
  text: 'text',
  'internal.text': 'text',
  image: 'image',
  'internal.image': 'image',
  file: 'file',
  'internal.file': 'file',
  audio: 'audio',
  'internal.audio': 'audio',
  video: 'video',
  'internal.video': 'video',
  system: 'system',
  'system.notification': 'system',
  'system.event': 'system'
}

const OUTGOING_TYPE_MAP: Record<string, string> = {
  text: 'internal.text',
  image: 'internal.image',
  file: 'internal.file',
  audio: 'internal.audio',
  video: 'internal.video',
  system: 'system.notification'
}

const DEFAULT_NORMALIZED_TYPE = 'text'
const DEFAULT_OUTGOING_TYPE = OUTGOING_TYPE_MAP.text

function pickFallbackFromSegments(type: string): string {
  const segments = type.split('.').filter(Boolean)
  return segments.length > 0 ? segments[segments.length - 1] : type
}

export function normalizeMessageType(
  rawType?: string | null,
  meta?: Record<string, any> | null
): string {
  const candidates = [
    rawType,
    meta?.type,
    meta?.messageType
  ]

  for (const candidate of candidates) {
    if (!candidate) continue
    const normalized = String(candidate).trim().toLowerCase()
    if (!normalized) continue

    if (INCOMING_TYPE_ALIASES[normalized]) {
      return INCOMING_TYPE_ALIASES[normalized]
    }

    if (normalized.includes('.')) {
      const fallback = pickFallbackFromSegments(normalized)
      if (fallback) {
        return fallback
      }
    }

    return normalized
  }

  return DEFAULT_NORMALIZED_TYPE
}

export function ensureNormalizedMessage(message: Message): Message {
  const normalizedType = normalizeMessageType(message.type, message.meta)
  return {
    ...message,
    normalizedType
  }
}

export function mapOutgoingMessageType(type?: string | null): string {
  if (!type) {
    return DEFAULT_OUTGOING_TYPE
  }

  const normalized = String(type).trim().toLowerCase()
  if (!normalized) {
    return DEFAULT_OUTGOING_TYPE
  }

  if (normalized.includes('.')) {
    return normalized
  }

  return OUTGOING_TYPE_MAP[normalized] ?? `internal.${normalized}`
}

