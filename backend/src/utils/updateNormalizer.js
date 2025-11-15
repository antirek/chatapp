function hasEnvelopeShape(data) {
  if (!data || typeof data !== 'object') {
    return false;
  }

  return (
    Object.prototype.hasOwnProperty.call(data, 'dialog') ||
    Object.prototype.hasOwnProperty.call(data, 'member') ||
    Object.prototype.hasOwnProperty.call(data, 'message') ||
    Object.prototype.hasOwnProperty.call(data, 'typing') ||
    Object.prototype.hasOwnProperty.call(data, 'context')
  );
}

function buildLegacyEnvelope(update) {
  const legacyMessage =
    update?.data && !hasEnvelopeShape(update.data) ? update.data : update?.message || null;

  const dialog = update?.dialog || null;
  const member = update?.member || null;
  const typing = update?.typing || null;

  const context =
    update?.context ||
    (update?.eventType
      ? {
          eventType: update.eventType,
          dialogId: update.dialogId || legacyMessage?.dialogId,
          entityId: update.entityId || legacyMessage?.messageId || legacyMessage?._id,
        }
      : null);

  return {
    dialog,
    member,
    message: legacyMessage,
    typing,
    context,
  };
}

export function normalizeChat3Update(rawUpdate) {
  if (!rawUpdate || typeof rawUpdate !== 'object') {
    return rawUpdate;
  }

  const envelope = hasEnvelopeShape(rawUpdate.data)
    ? { ...rawUpdate.data }
    : buildLegacyEnvelope(rawUpdate);

  const dialog = envelope.dialog || null;
  const member = envelope.member || null;
  const message = envelope.message || null;
  const typing = envelope.typing || null;
  const context = envelope.context || null;

  const eventType = rawUpdate.eventType || context?.eventType || null;
  const dialogId =
    rawUpdate.dialogId ||
    context?.dialogId ||
    dialog?.dialogId ||
    message?.dialogId ||
    rawUpdate.data?.dialogId ||
    null;
  const entityId =
    rawUpdate.entityId ||
    context?.entityId ||
    message?.messageId ||
    message?._id ||
    null;
  const userId = rawUpdate.userId || member?.userId || rawUpdate.member?.userId || null;

  return {
    ...rawUpdate,
    eventType,
    dialogId,
    entityId,
    userId,
    data: {
      dialog,
      member,
      message,
      typing,
      context: context || (eventType ? { eventType } : null),
    },
  };
}


