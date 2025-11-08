import Chat3Client from '../services/Chat3Client.js';

function getMetaValue(meta, key) {
  if (!meta || !key) {
    return undefined;
  }

  const raw = meta[key];
  if (raw == null) {
    return undefined;
  }

  if (typeof raw === 'object' && raw !== null && 'value' in raw) {
    return raw.value;
  }

  return raw;
}

function resolveUserName(user) {
  const meta = user.meta || {};
  return (
    meta.displayName ||
    meta.fullName ||
    `${meta.lastName || ''} ${meta.firstName || ''}`.trim() ||
    user.name ||
    meta.nickname ||
    meta.phone ||
    user.phone ||
    user.userId
  );
}

function resolveUserAvatar(user) {
  const meta = user.meta || {};
  return (
    getMetaValue(meta, 'avatar') ||
    meta.photoUrl ||
    user.avatar ||
    null
  );
}

async function fetchUser(userId) {
  const response = await Chat3Client.getUser(userId);
  return response.data || response;
}

async function setDialogMeta(dialogId, key, value) {
  if (value == null || value === '') {
    try {
      await Chat3Client.deleteMeta('dialog', dialogId, key);
    } catch (error) {
      if (error.response?.status !== 404) {
        console.warn(`⚠️ Failed to delete dialog meta ${key} for ${dialogId}:`, error.message);
      }
    }
    return;
  }

  await Chat3Client.setMeta('dialog', dialogId, key, { value });
}

function dialogNameKey(userId) {
  return `p2pDialogNameFor${userId}`;
}

function dialogAvatarKey(userId) {
  return `p2pDialogAvatarFor${userId}`;
}

export async function updateP2PPersonalization(dialogId, userIdA, userIdB) {
  try {
    const [userA, userB] = await Promise.all([fetchUser(userIdA), fetchUser(userIdB)]);

    const nameForA = resolveUserName(userB);
    const nameForB = resolveUserName(userA);
    const avatarForA = resolveUserAvatar(userB);
    const avatarForB = resolveUserAvatar(userA);

    const tasks = [
      setDialogMeta(dialogId, dialogNameKey(userIdA), nameForA),
      setDialogMeta(dialogId, dialogNameKey(userIdB), nameForB),
      setDialogMeta(dialogId, dialogAvatarKey(userIdA), avatarForA),
      setDialogMeta(dialogId, dialogAvatarKey(userIdB), avatarForB),
      cleanupLegacyMeta(dialogId, [userIdA, userIdB]),
    ];

    await Promise.all(tasks);

    console.log(`✅ Updated personalization meta for dialog ${dialogId}`);
  } catch (error) {
    console.error(`❌ Failed to update personalization for dialog ${dialogId}:`, error.message);
    if (error.response?.data) {
      console.error('Error details:', error.response.data);
    }
  }
}

async function cleanupLegacyMeta(dialogId, userIds = []) {
  const deletions = [
    Chat3Client.deleteMeta('dialog', dialogId, 'searchTokens').catch((error) => {
      if (error.response?.status !== 404) {
        console.warn(`⚠️ Failed to delete legacy searchTokens for ${dialogId}:`, error.message);
      }
    }),
    Chat3Client.deleteMeta('dialog', dialogId, 'p2pNameMap').catch((error) => {
      if (error.response?.status !== 404) {
        console.warn(`⚠️ Failed to delete legacy p2pNameMap for ${dialogId}:`, error.message);
      }
    }),
    Chat3Client.deleteMeta('dialog', dialogId, 'p2pAvatarMap').catch((error) => {
      if (error.response?.status !== 404) {
        console.warn(`⚠️ Failed to delete legacy p2pAvatarMap for ${dialogId}:`, error.message);
      }
    }),
  ];

  userIds.forEach((userId) => {
    deletions.push(
      Chat3Client.deleteMeta('dialog', dialogId, `nameFor_${userId}`).catch((error) => {
        if (error.response?.status !== 404) {
          console.warn(
            `⚠️ Failed to delete legacy name meta nameFor_${userId} for ${dialogId}:`,
            error.message
          );
        }
      })
    );

    deletions.push(
      Chat3Client.deleteMeta('dialog', dialogId, `avatarFor_${userId}`).catch((error) => {
        if (error.response?.status !== 404) {
          console.warn(
            `⚠️ Failed to delete legacy avatar meta avatarFor_${userId} for ${dialogId}:`,
            error.message
          );
        }
      })
    );
  });

  await Promise.all(deletions);
}

