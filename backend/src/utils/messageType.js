const OUTGOING_TYPE_MAP = {
  text: 'internal.text',
  image: 'internal.image',
  file: 'internal.file',
  audio: 'internal.audio',
  video: 'internal.video',
  system: 'system.notification',
};

const DEFAULT_OUTGOING_TYPE = OUTGOING_TYPE_MAP.text;

/**
 * Map legacy/simple message types to the new Chat3 message type identifiers.
 * If the provided type already uses the new dotted format, it's returned as-is.
 *
 * @param {string | undefined | null} type
 * @returns {string}
 */
export function mapOutgoingMessageType(type) {
  if (!type) {
    return DEFAULT_OUTGOING_TYPE;
  }

  const normalized = String(type).trim().toLowerCase();

  if (!normalized) {
    return DEFAULT_OUTGOING_TYPE;
  }

  if (normalized.includes('.')) {
    return normalized;
  }

  return OUTGOING_TYPE_MAP[normalized] || `internal.${normalized}`;
}


