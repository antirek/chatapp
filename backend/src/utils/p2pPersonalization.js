import Chat3Client from '../services/Chat3Client.js';
import User from '../models/User.js';
import Contact from '../models/Contact.js';

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

export async function getP2PUserProfile(userId) {
  // Skip API request for business contacts (cnt_...) - they are not users
  // Business contacts are loaded from Contact model, not User model
  if (userId && userId.startsWith('cnt_')) {
    try {
      const contact = await Contact.findOne({ contactId: userId }).lean().exec();

      if (contact) {
        const meta = {
          displayName: contact.name,
          fullName: contact.name,
          phone: contact.phone,
          contactType: 'business',
        };

        return {
          userId: contact.contactId,
          name: contact.name,
          phone: contact.phone,
          meta,
        };
      }
    } catch (error) {
      console.warn(`⚠️ Failed to load contact ${userId}:`, error.message);
    }

    // Fallback if contact not found
    return {
      userId,
      name: userId,
      phone: null,
      meta: {
        displayName: userId,
        fullName: userId,
        contactType: 'business',
      },
    };
  }

  try {
    const response = await Chat3Client.getUser(userId);
    return response.data || response;
  } catch (error) {
    if (error.response?.status === 404) {
      const localUser = await User.findOne({ userId }).lean().exec();
      if (localUser) {
        return {
          userId: localUser.userId,
          name: localUser.name,
          phone: localUser.phone,
          meta: {
            displayName: localUser.name,
            fullName: localUser.name,
            phone: localUser.phone,
          },
        };
      }
    }

    throw error;
  }
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
    const [userA, userB] = await Promise.all([
      getP2PUserProfile(userIdA),
      getP2PUserProfile(userIdB),
    ]);

    const nameForA = resolveUserName(userB);
    const nameForB = resolveUserName(userA);
    const avatarForA = resolveUserAvatar(userB);
    const avatarForB = resolveUserAvatar(userA);

    const tasks = [
      setDialogMeta(dialogId, dialogNameKey(userIdA), nameForA),
      setDialogMeta(dialogId, dialogNameKey(userIdB), nameForB),
      setDialogMeta(dialogId, dialogAvatarKey(userIdA), avatarForA),
      setDialogMeta(dialogId, dialogAvatarKey(userIdB), avatarForB),
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

