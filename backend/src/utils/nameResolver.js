export function resolveNameFromMeta(meta, fallbackName, fallbackId) {
  if (!meta) {
    return fallbackName || fallbackId;
  }

  const displayName =
    meta.displayName ||
    meta.fullName ||
    `${meta.lastName || ''} ${meta.firstName || ''}`.trim() ||
    meta.nickname ||
    meta.phone;

  if (displayName && displayName.trim()) {
    return displayName.trim();
  }

  return fallbackName || fallbackId;
}

