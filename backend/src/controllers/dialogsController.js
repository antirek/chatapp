import Chat3Client from '../services/Chat3Client.js';
import { mapOutgoingMessageType } from '../utils/messageType.js';
import {
  updateP2PPersonalization,
  getP2PUserProfile,
} from '../utils/p2pPersonalization.js';
import { resolveNameFromMeta } from '../utils/nameResolver.js';
import Contact from '../models/Contact.js';
import User from '../models/User.js';
import Bot from '../models/Bot.js';
import { extractUserType } from '../utils/userTypeExtractor.js';
// import { authenticate } from '../middleware/auth.js';

const MIN_SEARCH_LENGTH = 2;
const P2P_DIALOG_NAME_KEY = 'p2pDialogName';
const P2P_DIALOG_AVATAR_KEY = 'p2pDialogAvatar';
const LEGACY_P2P_NAME_PREFIX = 'p2pDialogNameFor';
const LEGACY_P2P_AVATAR_PREFIX = 'p2pDialogAvatarFor';
const FAVORITE_META_KEY = 'favorite';
const LEGACY_FAVORITE_PREFIX = 'favoriteFor';
const PINNED_MESSAGE_META_KEY = 'pinnedMessage';

function extractMetaValue(meta, key) {
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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getScopedMetaValue(meta, key, currentUserId, legacyPrefix) {
  const scopedValue = extractMetaValue(meta, key);
  if (scopedValue !== undefined && scopedValue !== null) {
    return scopedValue;
  }

  if (legacyPrefix && currentUserId) {
    return extractMetaValue(meta, `${legacyPrefix}${currentUserId}`);
  }

  return undefined;
}

function resolveFavoriteState(metaResponse, currentUserId) {
  if (!metaResponse) {
    return undefined;
  }

  const containers = [metaResponse, metaResponse?.data];
  for (const container of containers) {
    const value = getScopedMetaValue(
      container,
      FAVORITE_META_KEY,
      currentUserId,
      LEGACY_FAVORITE_PREFIX,
    );

    if (value !== undefined) {
      return value;
    }
  }

  return undefined;
}

function createEmptyResult(page, limit) {
  return {
    data: [],
    pagination: {
      page,
      limit,
      total: 0,
      pages: 0,
    },
  };
}

function extractMembersFromResponse(response) {
  if (!response) {
    return [];
  }

  if (Array.isArray(response.data?.data)) {
    return response.data.data;
  }

  if (Array.isArray(response?.data?.results)) {
    return response.data.results;
  }

  if (Array.isArray(response?.data?.items)) {
    return response.data.items;
  }

  if (Array.isArray(response.data)) {
    return response.data;
  }

  if (Array.isArray(response.members)) {
    return response.members;
  }

  if (Array.isArray(response.results)) {
    return response.results;
  }

  if (Array.isArray(response.items)) {
    return response.items;
  }

  if (Array.isArray(response.list)) {
    return response.list;
  }

  if (Array.isArray(response)) {
    return response;
  }

  return [];
}

export async function resolveUserName(userId, fallbackName) {
  try {
    const profile = await getP2PUserProfile(userId);
    return resolveNameFromMeta(profile.meta, profile.name || fallbackName, userId);
  } catch (error) {
    console.warn(`Failed to resolve user ${userId}:`, error.message);
    return fallbackName || userId;
  }
}

/**
 * Get user info (type, name) for adding to dialog
 * @param {string} userId - User ID
 * @returns {Promise<{type: string, name: string}>}
 */
async function getUserInfoForDialog(userId) {
  try {
    // Check if it's a bot
    if (userId.startsWith('bot_')) {
      const bot = await Bot.findOne({ botId: userId }).select('botId name type').lean();
      if (bot) {
        return {
          type: 'bot',
          name: bot.name,
        };
      }
    }

    // Check if it's a contact
    if (userId.startsWith('cnt_')) {
      const contact = await Contact.findOne({ contactId: userId }).select('contactId name').lean();
      if (contact) {
        return {
          type: 'contact',
          name: contact.name,
        };
      }
    }

    // Check if it's a regular user
    const user = await User.findOne({ userId }).select('userId name').lean();
    if (user) {
      // Try to get type from Chat3 API
      try {
        const chat3User = await Chat3Client.getUser(userId);
        const chat3UserData = chat3User.data || chat3User;
        return {
          type: chat3UserData.type || 'user',
          name: user.name,
        };
      } catch (error) {
        // Fallback to default type
        return {
          type: 'user',
          name: user.name,
        };
      }
    }

    // Fallback: try to get from Chat3 API
    try {
      const chat3User = await Chat3Client.getUser(userId);
      const chat3UserData = chat3User.data || chat3User;
      return {
        type: chat3UserData.type || extractUserType(userId),
        name: chat3UserData.name || userId,
      };
    } catch (error) {
      // Final fallback
      return {
        type: extractUserType(userId),
        name: userId,
      };
    }
  } catch (error) {
    console.warn(`Failed to get user info for ${userId}:`, error.message);
    // Fallback
    return {
      type: extractUserType(userId),
      name: userId,
    };
  }
}


async function ensureP2PMeta(dialog, currentUserId) {
  const meta = dialog.meta || {};
  let name = getScopedMetaValue(meta, P2P_DIALOG_NAME_KEY, currentUserId, LEGACY_P2P_NAME_PREFIX);
  let avatar = getScopedMetaValue(meta, P2P_DIALOG_AVATAR_KEY, currentUserId, LEGACY_P2P_AVATAR_PREFIX);

  if (name && avatar !== undefined) {
    return { name, avatar };
  }

  let members = dialog.members || [];

  if (members.length === 0) {
    try {
      const membersResponse = await Chat3Client.getDialogMembers(dialog.dialogId, {
        limit: 50,
      });
      members = extractMembersFromResponse(membersResponse);
    } catch (error) {
      console.warn(`Failed to get members for dialog ${dialog.dialogId}:`, error.message);
      return { name, avatar };
    }
  }

  const interlocutor = members.find(
    (member) => member.userId && member.userId !== currentUserId,
  );

  if (!interlocutor) {
    console.warn(`No interlocutor found for P2P dialog ${dialog.dialogId}`);
    return { name, avatar };
  }

  try {
    const interlocutorUser = await getP2PUserProfile(interlocutor.userId);

    console.log(
      `ℹ️ Resolving P2P meta for dialog ${dialog.dialogId} (user: ${currentUserId}, peer: ${interlocutor.userId})`,
    );

    const interlocutorMeta = interlocutorUser?.meta || {};
    const resolvedName =
      interlocutorMeta.displayName ||
      interlocutorMeta.fullName ||
      `${interlocutorMeta.lastName || ''} ${interlocutorMeta.firstName || ''}`.trim() ||
      interlocutorUser.name ||
      interlocutorMeta.nickname ||
      interlocutorMeta.phone ||
      interlocutorUser.phone ||
      interlocutor.userId;

    const resolvedAvatar =
      interlocutorMeta.avatar?.value ||
      interlocutorMeta.avatar ||
      interlocutorMeta.photoUrl ||
      interlocutorUser.avatar ||
      null;

    try {
      await updateP2PPersonalization(
        dialog.dialogId,
        currentUserId,
        interlocutor.userId,
      );
    } catch (updateError) {
      console.warn(
        `Failed to update P2P personalization for dialog ${dialog.dialogId}:`,
        updateError.message,
      );
    }

    return {
      name: name || resolvedName || null,
      avatar: avatar ?? resolvedAvatar ?? null,
    };
  } catch (error) {
    console.warn(`Failed to resolve interlocutor for dialog ${dialog.dialogId}:`, error.message);
    return { name, avatar };
  }
}

export async function processP2PDialog(dialog, currentUser) {
  const currentUserId =
    typeof currentUser === 'string' ? currentUser : currentUser?.userId;

  if (!currentUserId) {
    return dialog;
  }

  const dialogType = dialog.meta?.type || dialog.type;

  // Process both p2p and personal_contact dialogs
  if (dialogType !== 'p2p' && dialogType !== 'personal_contact') {
    return dialog;
  }

  if (dialogType === 'personal_contact') {
    dialog = await enrichBusinessContactDialog(dialog);
  }

  const personalizedName = getScopedMetaValue(
    dialog.meta,
    P2P_DIALOG_NAME_KEY,
    currentUserId,
    LEGACY_P2P_NAME_PREFIX,
  );
  const personalizedAvatar = getScopedMetaValue(
    dialog.meta,
    P2P_DIALOG_AVATAR_KEY,
    currentUserId,
    LEGACY_P2P_AVATAR_PREFIX,
  );

  if (personalizedName && personalizedAvatar !== undefined) {
    return {
      ...dialog,
      name: personalizedName,
      avatar: personalizedAvatar ?? null,
      chatType: dialogType === 'personal_contact' ? 'personal_contact' : 'p2p',
    };
  }

  const { name, avatar } = await ensureP2PMeta(dialog, currentUserId);

  // For personal_contact dialogs, use dialog.name (contact name) as fallback
  // For p2p dialogs, use dialog.dialogId as fallback
  const contactName = dialog.meta?.contactName?.value || dialog.meta?.contactName;
  const nameFallback = dialogType === 'personal_contact' 
    ? (contactName || dialog.name || dialog.dialogName || dialog.dialogId)
    : dialog.dialogId;
  
  const resolvedName = name ?? personalizedName ?? nameFallback;
  const resolvedAvatar =
    avatar ?? personalizedAvatar ?? dialog.avatar ?? null;

  return {
    ...dialog,
    name: resolvedName,
    avatar: resolvedAvatar,
    chatType: dialogType === 'personal_contact' ? 'personal_contact' : 'p2p',
  };
}

async function enrichBusinessContactDialog(dialog) {
  const meta = dialog.meta || {};
  const contactId =
    meta.contactId?.value ||
    meta.contactId ||
    dialog?.contact?.contactId ||
    null;

  if (!contactId) {
    return dialog;
  }

  try {
    const contact = await Contact.findOne({ contactId }).lean().exec();
    if (contact?.name) {
      const updatedMeta = {
        ...meta,
        contactName:
          meta.contactName ||
          { value: contact.name },
        contactPhone:
          meta.contactPhone ||
          (contact.phone ? { value: contact.phone } : undefined),
      };

      return {
        ...dialog,
        name: contact.name,
        dialogName: contact.name,
        meta: updatedMeta,
      };
    }
  } catch (error) {
    console.warn(`Failed to load contact ${contactId}:`, error.message);
  }

  return dialog;
}

export async function getDialogs(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      includeLastMessage = false,
      type: rawType,
      search: rawSearch,
    } = req.query;
    const currentUserId = req.user.userId;
    const requestedType = typeof rawType === 'string' ? rawType : null;
    const trimmedSearch = (rawSearch || '').trim();

    // Validate search term if provided
    if (trimmedSearch && trimmedSearch.length < MIN_SEARCH_LENGTH) {
      return res.status(400).json({
        success: false,
        error: `Search term must be at least ${MIN_SEARCH_LENGTH} characters`,
      });
    }

    const params = {
      page,
      limit,
      includeLastMessage,
    };

    // Build filter conditions
    const filterParts = [];

    // Type filter
    if (requestedType === 'p2p') {
      filterParts.push('(meta.type,eq,p2p)');
    } else if (requestedType === 'business-contacts') {
      filterParts.push('(meta.type,eq,personal_contact)');
    } else if (requestedType === 'group:public') {
      filterParts.push('(meta.type,eq,group)&(meta.groupType,eq,public)');
    } else if (requestedType === 'group:private') {
      filterParts.push('(meta.type,eq,group)&(meta.groupType,eq,private)');
    } else if (requestedType === 'favorites') {
      filterParts.push(`(meta.${FAVORITE_META_KEY},eq,true)`);
    } else if (requestedType === 'unread') {
      filterParts.push('(unreadCount,gte,1)');
      params.sort = params.sort || '(unreadCount,desc)';
    }

    // Search filter
    if (trimmedSearch && trimmedSearch.length >= MIN_SEARCH_LENGTH) {
      const escaped = escapeRegex(trimmedSearch);
      const pattern = `.*${escaped}.*`;
      const nameMetaKey = P2P_DIALOG_NAME_KEY;

      if (requestedType === 'p2p') {
        // Search only in P2P dialogs by personalized name
        filterParts.push(`(meta.${nameMetaKey},regex,"${pattern}")`);
      } else if (requestedType === 'business-contacts') {
        // Search in business contacts by dialog name (contact name stored in meta.name)
        filterParts.push(`(meta.name,regex,"${pattern}")`);
      } else if (requestedType === 'group:public' || requestedType === 'group:private') {
        // Search only in groups by name (stored in meta.name)
        filterParts.push(`(meta.name,regex,"${pattern}")`);
      } else {
        // Search in both P2P and groups (universal search)
        // For P2P: search by personalized name meta
        // For groups: search by meta.name
        // Since Chat3 API may not support OR, we'll search by meta.name which works for groups
        // and also check P2P personalized names via meta
        // Using meta.name filter which will match groups, and we'll filter P2P client-side if needed
        filterParts.push(`(meta.name,regex,"${pattern}")`);
      }
    }

    // Combine all filter parts
    if (filterParts.length > 0) {
      params.filter = filterParts.join('&');
    }

    const result = await Chat3Client.getUserDialogs(currentUserId, params);

    const dialogsWithContext = result.data.map((dialog) => {
      // Extract name from meta.name.value (Chat3 no longer has name property)
      const nameFromMeta = dialog.meta?.name?.value || dialog.meta?.name;
      return {
      ...dialog,
        // Use meta.name as fallback for dialog.name
        name: dialog.name || nameFromMeta || dialog.dialogId,
      unreadCount: dialog.context?.unreadCount || 0,
      lastSeenAt: dialog.context?.lastSeenAt,
      lastMessageAt: dialog.context?.lastMessageAt,
      isActive: dialog.context?.isActive || false,
      joinedAt: dialog.context?.joinedAt,
      };
    });

    const processedDialogs = await Promise.all(
      dialogsWithContext.map(async (dialog) => {
        const dialogType = dialog.meta?.type || dialog.type;
        const processed = await processP2PDialog(dialog, req.user);
        return {
          ...processed,
          chatType: processed.chatType || dialogType || 'group',
        };
      }),
    );

    // Additional client-side filtering for search
    // This ensures that search results are properly filtered even when Chat3 API regex filter
    // doesn't work correctly or when we need to filter by processed dialog names (e.g., P2P personalized names)
    let filteredDialogs = processedDialogs;
    if (trimmedSearch && trimmedSearch.length >= MIN_SEARCH_LENGTH) {
      const searchLower = trimmedSearch.toLowerCase();
      filteredDialogs = processedDialogs.filter((dialog) => {
        const dialogName = (dialog?.name || dialog?.dialogName || '').toString();
        return dialogName.toLowerCase().includes(searchLower);
      });
    }

    return res.json({
      success: true,
      data: filteredDialogs,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function createDialog(req, res) {
  try {
    const { name, memberIds = [], chatType, groupType = 'private' } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Dialog name is required',
      });
    }

    const totalMembers = 1 + memberIds.length;
    const finalChatType = chatType || (totalMembers === 2 ? 'p2p' : 'group');

    if (finalChatType === 'p2p' && memberIds.length === 1) {
      const otherUserId = memberIds[0];
      const currentUserId = req.user.userId;

      console.log(`🔍 Checking for existing P2P dialog between ${currentUserId} and ${otherUserId}`);

      const filter = `(member,in,[${otherUserId}])&(meta.type,eq,p2p)`;

      const userDialogs = await Chat3Client.getUserDialogs(currentUserId, {
        page: 1,
        limit: 100,
        filter,
      });

      if (userDialogs.data && userDialogs.data.length > 0) {
        for (const dialog of userDialogs.data) {
          try {
            const membersResponse = await Chat3Client.getDialogMembers(dialog.dialogId, {
              limit: 10,
            });
            const members = extractMembersFromResponse(membersResponse);

            const dialogMemberIds = members.map((m) => m.userId);
            if (
              dialogMemberIds.length === 2 &&
              dialogMemberIds.includes(currentUserId) &&
              dialogMemberIds.includes(otherUserId)
            ) {
              console.log(
                `✅ Found existing P2P dialog ${dialog.dialogId} between ${currentUserId} and ${otherUserId}`,
              );

              await updateP2PPersonalization(dialog.dialogId, currentUserId, otherUserId);

              const processedDialog = await processP2PDialog(dialog, req.user);

              return res.json({
                success: true,
                data: processedDialog,
                message: 'Dialog already exists',
              });
            }
          } catch (error) {
            console.warn(`Failed to get full dialog info for ${dialog.dialogId}:`, error.message);
          }
        }
      }

      console.log('ℹ️ No existing P2P dialog found, creating new one');
    }

    const dialog = await Chat3Client.createDialog({
      createdBy: req.user.userId,
    });

    const dialogId = dialog.data.dialogId || dialog.data._id;

    // Set dialog name via meta tag (Chat3 no longer has name property)
    try {
      await Chat3Client.setMeta('dialog', dialogId, 'name', { value: name });
      console.log(`✅ Set dialog name meta tag: "${name}" for dialog ${dialogId}`);
    } catch (error) {
      console.warn(`Failed to set name meta tag for dialog ${dialogId}:`, error.message);
    }

    // Add creator as member with memberType=user
    const creatorInfo = await getUserInfoForDialog(req.user.userId);
    await Chat3Client.addDialogMember(dialogId, req.user.userId, {
      type: creatorInfo.type,
      name: creatorInfo.name,
    });
    try {
      await Chat3Client.setMeta(
        'dialogMember',
        `${dialogId}:${req.user.userId}`,
        'memberType',
        { value: 'user' }
      );
      console.log(`✅ Set memberType=user for creator ${req.user.userId} in dialog ${dialogId}`);
    } catch (error) {
      console.warn(`Failed to set memberType meta tag for creator in dialog ${dialogId}:`, error.message);
    }

    if (finalChatType === 'group') {
      try {
        const metaResult = await Chat3Client.setMeta(
          'dialogMember',
          `${dialogId}:${req.user.userId}`,
          'role',
          { value: 'owner' },
        );
        console.log(
          `✅ Set role: owner for creator ${req.user.userId} in dialog ${dialogId}:`,
          metaResult,
        );
      } catch (error) {
        console.error(`❌ Failed to set role meta tag for creator in dialog ${dialogId}:`, error.message);
        console.error('Error details:', error.response?.data || error);
      }
    }

    // Add other members with memberType=user
    for (const memberId of memberIds) {
      const memberInfo = await getUserInfoForDialog(memberId);
      await Chat3Client.addDialogMember(dialogId, memberId, {
        type: memberInfo.type,
        name: memberInfo.name,
      });
      try {
        await Chat3Client.setMeta(
          'dialogMember',
          `${dialogId}:${memberId}`,
          'memberType',
          { value: 'user' }
        );
        console.log(`✅ Set memberType=user for member ${memberId} in dialog ${dialogId}`);
      } catch (error) {
        console.warn(`Failed to set memberType meta tag for member ${memberId} in dialog ${dialogId}:`, error.message);
      }
    }

    try {
      await Chat3Client.setMeta('dialog', dialogId, 'type', { value: finalChatType });
    } catch (error) {
      console.warn(`Failed to set chat type meta tag for dialog ${dialogId}:`, error.message);
    }

    if (finalChatType === 'group') {
      try {
        await Chat3Client.setMeta('dialog', dialogId, 'groupType', { value: groupType });
        console.log(`✅ Set groupType: ${groupType} for dialog ${dialogId}`);
      } catch (error) {
        console.warn(`Failed to set groupType meta tag for dialog ${dialogId}:`, error.message);
      }
    }

    if (finalChatType === 'p2p' && memberIds.length === 1) {
      try {
        await updateP2PPersonalization(dialogId, req.user.userId, memberIds[0]);
      } catch (error) {
        console.warn(`⚠️ Failed to update search tokens for dialog ${dialogId}:`, error.message);
      }
    }

    const fullDialog = await Chat3Client.getUserDialogs(req.user.userId, {
      dialogId,
      limit: 1,
    });

    const createdDialog =
      fullDialog.data && fullDialog.data.length > 0
        ? fullDialog.data[0]
        : dialog.data;

    return res.status(201).json({
      success: true,
      data: createdDialog,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function getPublicDialogs(req, res) {
  try {
    const { page = 1, limit = 50 } = req.query;
    const currentUserId = req.user.userId;

    const filter = `(meta.type,eq,group)&(meta.groupType,eq,public)`;

    console.log(`🔍 Getting public groups with filter: ${filter}, page: ${page}, limit: ${limit}`);

    const result = await Chat3Client.getDialogs({
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
      filter,
    });

    console.log('✅ Got result from Chat3 API:', {
      dataLength: result.data?.length || 0,
      pagination: result.pagination,
    });

    // Map public groups to include name from meta
    const publicGroups = (result.data || []).map((group) => {
      const nameFromMeta = group.meta?.name?.value || group.meta?.name;
      return {
        ...group,
        name: group.name || nameFromMeta || group.dialogId,
      };
    });

    const userDialogIds = new Set();
    let userPage = 1;
    let hasMoreUserDialogs = true;

    while (hasMoreUserDialogs) {
      const userDialogs = await Chat3Client.getUserDialogs(currentUserId, {
        page: userPage,
        limit: 100,
      });

      if (userDialogs.data && userDialogs.data.length > 0) {
        userDialogs.data.forEach((d) => userDialogIds.add(d.dialogId));
        hasMoreUserDialogs = userDialogs.pagination && userPage < userDialogs.pagination.pages;
        userPage += 1;
      } else {
        hasMoreUserDialogs = false;
      }
    }

    console.log(`📊 Public groups found: ${publicGroups.length}, User dialog IDs: ${userDialogIds.size}`);
    console.log('📋 Public group IDs:', publicGroups.map((g) => g.dialogId));
    console.log('👤 User dialog IDs:', Array.from(userDialogIds));

    const availableGroups = publicGroups.filter((group) => !userDialogIds.has(group.dialogId));

    console.log(`✅ Available groups (after filtering): ${availableGroups.length}`);

    return res.json({
      success: true,
      data: availableGroups,
      pagination: {
        page: parseInt(page, 10),
        limit: parseInt(limit, 10),
        total: result.pagination?.total || availableGroups.length,
        pages:
          result.pagination?.pages ||
          Math.ceil(availableGroups.length / parseInt(limit, 10)),
      },
    });
  } catch (error) {
    console.error('Failed to get public groups:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function joinPublicDialog(req, res) {
  const startTime = Date.now();
  try {
    const { dialogId } = req.params;
    const currentUserId = req.user.userId;

    console.log(`\n🔵 [joinPublicDialog] ========== START ==========`);
    console.log(`🔵 [joinPublicDialog] User: ${currentUserId}`);
    console.log(`🔵 [joinPublicDialog] Dialog ID: ${dialogId}`);
    console.log(`🔵 [joinPublicDialog] Timestamp: ${new Date().toISOString()}`);

    console.log(`🔵 [joinPublicDialog] Step 1: Getting dialog from Chat3 API...`);
    let dialogResponse;
    try {
      dialogResponse = await Chat3Client.getDialog(dialogId);
      console.log(`✅ [joinPublicDialog] Step 1: Got dialog response`);
      console.log(`🔵 [joinPublicDialog] Response type:`, typeof dialogResponse);
      console.log(`🔵 [joinPublicDialog] Response keys:`, Object.keys(dialogResponse || {}));
      console.log(`🔵 [joinPublicDialog] Full response (first 1000 chars):`, JSON.stringify(dialogResponse, null, 2).substring(0, 1000));
    } catch (error) {
      console.error(`❌ [joinPublicDialog] Step 1 FAILED:`, error.message);
      console.error(`❌ [joinPublicDialog] Step 1 error stack:`, error.stack);
      throw error;
    }
    
    // Chat3Client.getDialog returns response.data, which may be { data: {...} } or just {...}
    const dialog = dialogResponse?.data || dialogResponse;
    console.log(`🔵 [joinPublicDialog] Extracted dialog:`, JSON.stringify(dialog, null, 2).substring(0, 500));
    
    // Handle both structures: { meta: {...} } and { data: { meta: {...} } }
    const dialogMeta = dialog?.meta || dialog?.data?.meta || {};
    const metaType = extractMetaValue(dialogMeta, 'type');
    const dialogType = metaType || dialog?.type || dialog?.data?.type;
    const groupType = extractMetaValue(dialogMeta, 'groupType');

    console.log(`🔵 [joinPublicDialog] dialog.meta:`, JSON.stringify(dialogMeta, null, 2).substring(0, 300));
    console.log(`🔵 [joinPublicDialog] dialog.type:`, dialog.type);
    console.log(`🔵 [joinPublicDialog] metaType (from extractMetaValue):`, metaType);
    console.log(`🔵 [joinPublicDialog] dialogType (final):`, dialogType);
    console.log(`🔵 [joinPublicDialog] groupType:`, groupType);

    if (!dialogType || dialogType !== 'group') {
      console.error(`❌ [joinPublicDialog] Dialog type mismatch! Expected 'group', got '${dialogType}'`);
      console.error(`❌ [joinPublicDialog] Full dialog object:`, JSON.stringify(dialog, null, 2));
      return res.status(400).json({
        success: false,
        error: `Dialog is not a group (type: ${dialogType || 'undefined'})`,
        details: {
          dialogId,
          dialogType,
          metaType,
          dialogMetaKeys: Object.keys(dialogMeta),
          dialogKeys: Object.keys(dialog || {}),
        },
      });
    }

    if (groupType !== 'public') {
      return res.status(403).json({
        success: false,
        error: 'Group is not public',
      });
    }

    // Skip membership check - let Chat3 API handle it
    // If user is already a member, addDialogMember will return an error

    console.log(`🔵 [joinPublicDialog] Step 2: Adding user ${currentUserId} to dialog ${dialogId}...`);
    try {
      const userInfo = await getUserInfoForDialog(currentUserId);
      await Chat3Client.addDialogMember(dialogId, currentUserId, {
        type: userInfo.type,
        name: userInfo.name,
      });
      console.log(`✅ [joinPublicDialog] Step 2: Successfully added user to dialog`);
    } catch (error) {
      // Check if user is already a member
      if (error.response?.status === 400 || error.response?.status === 409) {
        const errorMessage = error.response?.data?.message || error.response?.data?.error || error.message;
        if (errorMessage.toLowerCase().includes('already') || errorMessage.toLowerCase().includes('member')) {
          console.log(`ℹ️ [joinPublicDialog] User ${currentUserId} is already a member of dialog ${dialogId}`);
      return res.status(400).json({
        success: false,
        error: 'User is already a member of this group',
      });
    }
      }
      console.error(`❌ [joinPublicDialog] Step 2 FAILED:`, error.message);
      console.error(`❌ [joinPublicDialog] Step 2 error response:`, error.response?.data);
      console.error(`❌ [joinPublicDialog] Step 2 error stack:`, error.stack);
      throw error;
    }
    
    try {
      await Chat3Client.setMeta(
        'dialogMember',
        `${dialogId}:${currentUserId}`,
        'memberType',
        { value: 'user' }
      );
      console.log(`✅ Set memberType=user for user ${currentUserId} in dialog ${dialogId}`);
    } catch (error) {
      console.warn(`Failed to set memberType meta tag for user ${currentUserId} in dialog ${dialogId}:`, error.message);
    }

    console.log(`🔵 [joinPublicDialog] Step 3: Resolving user name for ${currentUserId}`);
    let userName;
    try {
      userName = await resolveUserName(currentUserId, req.user?.name || null);
      console.log(`🔵 [joinPublicDialog] Resolved userName: ${userName}`);
    } catch (error) {
      console.error(`❌ [joinPublicDialog] Failed to resolve userName:`, error);
      userName = req.user?.name || currentUserId;
    }

    console.log(`🔵 [joinPublicDialog] Step 4: Creating system message`);
    try {
      await Chat3Client.createMessage(dialogId, {
        content: `Пользователь ${userName} вошел в группу`,
        senderId: 'system',
        type: mapOutgoingMessageType('system'),
      });
      console.log(`✅ [joinPublicDialog] Step 4: Created system message`);
    } catch (error) {
      console.warn(
        `⚠️ [joinPublicDialog] Step 4: Failed to send system notification (non-critical):`,
        error.message,
      );
    }

    console.log(`🔵 [joinPublicDialog] Step 5: Getting updated dialog`);
    const updatedDialogResponse = await Chat3Client.getDialog(dialogId);
    const updatedDialog = updatedDialogResponse.data || updatedDialogResponse;

    console.log(`✅ [joinPublicDialog] Successfully joined dialog ${dialogId}`);
    return res.json({
      success: true,
      data: updatedDialog,
    });
  } catch (error) {
    const duration = Date.now() - startTime;
    console.error(`\n❌ [joinPublicDialog] ========== ERROR ==========`);
    console.error(`❌ [joinPublicDialog] Duration: ${duration}ms`);
    console.error(`❌ [joinPublicDialog] Error name:`, error.name);
    console.error(`❌ [joinPublicDialog] Error message:`, error.message);
    console.error(`❌ [joinPublicDialog] Error code:`, error.code);
    if (error.response) {
      console.error(`❌ [joinPublicDialog] Error response status:`, error.response.status);
      console.error(`❌ [joinPublicDialog] Error response data:`, JSON.stringify(error.response.data, null, 2));
      console.error(`❌ [joinPublicDialog] Error response headers:`, JSON.stringify(error.response.headers, null, 2));
    }
    if (error.request) {
      console.error(`❌ [joinPublicDialog] Error request:`, error.request);
    }
    console.error(`❌ [joinPublicDialog] Error stack:`, error.stack);
    console.error(`❌ [joinPublicDialog] ============================\n`);
    
    return res.status(500).json({
      success: false,
      error: error.message,
      details: error.response?.data || { code: error.code, name: error.name },
    });
  }
}

export async function getDialogById(req, res) {
  try {
    const { dialogId } = req.params;
    const result = await Chat3Client.getDialog(dialogId);

    const dialogData = result?.data || result;
    if (!dialogData) {
      return res.status(404).json({
        success: false,
        error: 'Dialog not found',
      });
    }

    // Extract name from meta.name.value (Chat3 no longer has name property)
    const nameFromMeta = dialogData.meta?.name?.value || dialogData.meta?.name;

    const dialogWithContext = {
      ...dialogData,
      // Use meta.name as fallback for dialog.name
      name: dialogData.name || nameFromMeta || dialogData.dialogId,
      unreadCount: dialogData.context?.unreadCount || 0,
      lastSeenAt: dialogData.context?.lastSeenAt,
      lastMessageAt: dialogData.context?.lastMessageAt,
      isActive: dialogData.context?.isActive ?? false,
      joinedAt: dialogData.context?.joinedAt,
    };

    const processed = await processP2PDialog(dialogWithContext, req.user);
    const chatType =
      processed.chatType || dialogWithContext.meta?.type || dialogWithContext.type || 'group';

    return res.json({
      success: true,
      data: {
        ...processed,
        chatType,
      },
    });
  } catch (error) {
    const status = error.response?.status === 404 ? 404 : 500;
    return res.status(status).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to fetch dialog',
    });
  }
}

export async function deleteDialog(req, res) {
  try {
    const { dialogId } = req.params;
    await Chat3Client.deleteDialog(dialogId);

    return res.json({
      success: true,
      message: 'Dialog deleted',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Get bot commands for a dialog
 * Returns list of bots in dialog with their commands
 */
export async function getDialogBotCommands(req, res) {
  try {
    const { dialogId } = req.params;
    
    if (!dialogId) {
      return res.status(400).json({
        success: false,
        error: 'Dialog ID is required',
      });
    }

    // Get dialog members
    const membersResponse = await Chat3Client.getDialogMembers(dialogId, { limit: 100 });
    const members = extractMembersFromResponse(membersResponse);
    
    // Filter bots (userId starts with 'bot_')
    const bots = members.filter(member => member.userId && member.userId.startsWith('bot_'));
    
    // Get bot commands from MongoDB
    const Bot = (await import('../models/Bot.js')).default;
    const botCommands = [];
    
    for (const bot of bots) {
      try {
        const botData = await Bot.findOne({ botId: bot.userId, isActive: true })
          .select('botId name commands')
          .lean();
        
        if (botData && botData.commands && botData.commands.length > 0) {
          botCommands.push({
            botId: botData.botId,
            name: botData.name,
            commands: botData.commands,
          });
        }
      } catch (error) {
        console.warn(`Failed to get commands for bot ${bot.userId}:`, error.message);
        // Continue with other bots
      }
    }
    
    return res.json({
      success: true,
      data: botCommands,
    });
  } catch (error) {
    console.error('Error getting dialog bot commands:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get bot commands',
    });
  }
}

export async function getDialogMembers(req, res) {
  try {
    const { dialogId } = req.params;
    const membersResponse = await Chat3Client.getDialogMembers(dialogId, req.query || {});
    const members = extractMembersFromResponse(membersResponse);

    const membersWithRoles = await Promise.all(
      members.map(async (member) => {
        try {
          const entityId = `${dialogId}:${member.userId}`;

          let role = null;

          // Note: Chat3 API doesn't support /api/meta/dialogMember/{entityId}/role endpoint (returns 404)
          // So we only request all meta tags and extract role from there
          try {
            const metaResponse = await Chat3Client.getMeta('dialogMember', entityId);
            console.log(
              `🔍 Getting all meta for member ${member.userId} in dialog ${dialogId} (entityId: ${entityId}):`,
              {
                entityId,
                metaResponse,
                metaType: typeof metaResponse,
                metaKeys: metaResponse ? Object.keys(metaResponse) : null,
              },
            );

            role =
              metaResponse?.role?.value ||
              metaResponse?.role ||
              metaResponse?.data?.role?.value ||
              metaResponse?.data?.role ||
              (metaResponse?.data &&
              typeof metaResponse.data === 'object' &&
              'role' in metaResponse.data
                ? metaResponse.data.role
                : null) ||
              null;
          } catch (metaError) {
            if (metaError.response?.status !== 404) {
              console.warn(
                `⚠️ Error getting meta for member ${member.userId} with entityId ${entityId}:`,
                metaError.message,
              );
            }
            // If 404, role will remain null (member has no role meta)
          }

          if (!role) {
            console.log(`⚠️ No role found for member ${member.userId} in dialog ${dialogId}`);
          }

          return {
            ...member,
            role: role || null,
          };
        } catch (error) {
          console.warn(
            `⚠️ Failed to get role for member ${member.userId} in dialog ${dialogId}:`,
            error.message,
          );
          if (error.response?.status !== 404) {
            console.error('Error details:', error.response?.data || error);
          }
          return {
            ...member,
            role: null,
          };
        }
      }),
    );

    return res.json({
      success: true,
      data: membersWithRoles,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function addDialogMember(req, res) {
  try {
    const { dialogId } = req.params;
    const { userId } = req.body;

    if (!userId) {
      return res.status(400).json({
        success: false,
        error: 'User ID is required',
      });
    }

    const userInfo = await getUserInfoForDialog(userId);
    await Chat3Client.addDialogMember(dialogId, userId, {
      type: userInfo.type,
      name: userInfo.name,
    });
    try {
      await Chat3Client.setMeta(
        'dialogMember',
        `${dialogId}:${userId}`,
        'memberType',
        { value: 'user' }
      );
      console.log(`✅ Set memberType=user for member ${userId} in dialog ${dialogId}`);
    } catch (error) {
      console.warn(`Failed to set memberType meta tag for member ${userId} in dialog ${dialogId}:`, error.message);
    }

    const userName = await resolveUserName(userId, null);
    let dialogType = null;
    let contactId = null;

    try {
      const dialogResponse = await Chat3Client.getDialog(dialogId);
      const dialogMeta = dialogResponse?.data?.meta || dialogResponse?.meta || {};
      dialogType = dialogMeta?.type?.value || dialogMeta?.type || dialogResponse?.data?.type || null;
      contactId = dialogMeta?.contactId?.value || dialogMeta?.contactId || null;
    } catch (dialogError) {
      console.warn(`⚠️ Failed to load dialog ${dialogId} for system message context:`, dialogError.message);
    }

    try {
      const content =
        dialogType === 'personal_contact' && contactId
          ? `Пользователь ${userName} подключился к бизнес-чату`
          : `Пользователь ${userName} вошел в группу`;

      await Chat3Client.createMessage(dialogId, {
        content,
        senderId: 'system',
        type: mapOutgoingMessageType('system'),
      });
    } catch (error) {
      console.warn(`Failed to send system notification for user ${userId}:`, error.message);
    }

    return res.json({
      success: true,
      message: 'Member added',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function removeDialogMember(req, res) {
  try {
    const { dialogId, userId } = req.params;

    const userName = await resolveUserName(userId, null);

    await Chat3Client.removeDialogMember(dialogId, userId);

    try {
      await Chat3Client.createMessage(dialogId, {
        content: `Пользователь ${userName} вышел из группы`,
        senderId: 'system',
        type: mapOutgoingMessageType('system'),
      });
    } catch (error) {
      console.warn(`Failed to send system notification for user ${userId}:`, error.message);
    }

    return res.json({
      success: true,
      message: 'Member removed',
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function sendTypingIndicator(req, res) {
  try {
    const { dialogId } = req.params;
    const userId = req.user?.userId;
    const userName = req.user?.name;

    if (!dialogId) {
      return res.status(400).json({
        success: false,
        error: 'Dialog ID is required',
      });
    }

    if (!userId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
      });
    }

    const response = await Chat3Client.sendTypingSignal(dialogId, userId);
    const expiresInMs =
      response?.data?.expiresInMs ??
      response?.data?.expiresIn ??
      response?.data?.ttl ??
      5000;

    try {
      const io = req.app.get('io');
      if (io) {
        io.emit('typing:update', {
          dialogId,
          userId,
          userName,
          expiresInMs,
        });
      }
    } catch (broadcastError) {
      console.warn('Failed to broadcast typing update via WebSocket:', broadcastError.message);
    }

    return res.status(202).json({
      success: true,
      expiresInMs,
    });
  } catch (error) {
    const status = error.response?.status || 500;
    return res.status(status).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to send typing indicator',
    });
  }
}

export async function markDialogAsRead(req, res) {
  try {
    const { dialogId } = req.params;
    const currentUserId = req.user?.userId;

    if (!dialogId) {
      return res.status(400).json({
        success: false,
        error: 'Dialog ID is required',
      });
    }

    if (!currentUserId) {
      return res.status(401).json({
        success: false,
        error: 'User authentication required',
      });
    }

    const requestedUnread = Number(req.body?.unreadCount);
    const payload = {
      unreadCount:
        Number.isFinite(requestedUnread) && requestedUnread >= 0 ? requestedUnread : 0,
      lastSeenAt: req.body?.lastSeenAt || Date.now(),
    };

    if (req.body?.reason) {
      payload.reason = req.body.reason;
    }

    const response = await Chat3Client.updateDialogMemberUnread(
      dialogId,
      currentUserId,
      payload,
    );

    return res.json({
      success: true,
      data: {
        dialogId,
        unreadCount: payload.unreadCount,
        response,
      },
    });
  } catch (error) {
    const status = error.response?.status || 500;
    return res.status(status).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to mark dialog as read',
      details: error.response?.data,
    });
  }
}

export async function toggleDialogFavorite(req, res) {
  try {
    const { dialogId } = req.params;
    const currentUserId = req.user.userId;
    const legacyMetaKey = `${LEGACY_FAVORITE_PREFIX}${currentUserId}`;
    const scopeParams = { scope: currentUserId };

    // Check if dialog exists and user is a member
    try {
      const dialog = await Chat3Client.getDialog(dialogId);
      if (!dialog || !dialog.data) {
        return res.status(404).json({
          success: false,
          error: 'Dialog not found',
        });
      }
    } catch (error) {
      if (error.response?.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Dialog not found',
        });
      }
      throw error;
    }

    let isFavorite = false;
    try {
      const metaResponse = await Chat3Client.getMeta('dialog', dialogId, null, scopeParams);
      const metaValue = resolveFavoriteState(metaResponse, currentUserId);
      isFavorite = !!metaValue;
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }

    if (isFavorite) {
      await Chat3Client.deleteMeta('dialog', dialogId, FAVORITE_META_KEY, scopeParams);
      try {
        await Chat3Client.deleteMeta('dialog', dialogId, legacyMetaKey);
      } catch (legacyError) {
        if (legacyError.response?.status !== 404) {
          throw legacyError;
        }
      }

      return res.json({
        success: true,
        isFavorite: false,
        message: 'Dialog removed from favorites',
      });
    }

    await Chat3Client.setMeta(
      'dialog',
      dialogId,
      FAVORITE_META_KEY,
      { value: true },
      scopeParams,
    );
    await Chat3Client.setMeta('dialog', dialogId, legacyMetaKey, { value: true });

    return res.json({
      success: true,
      isFavorite: true,
      message: 'Dialog added to favorites',
    });
  } catch (error) {
    console.error('Error toggling dialog favorite:', error);
    return res.status(500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to toggle favorite',
    });
  }
}

/**
 * Pin a message in a dialog
 * POST /api/dialogs/:dialogId/pin/:messageId
 */
export async function pinMessage(req, res) {
  try {
    const { dialogId, messageId } = req.params;
    const currentUserId = req.user.userId;

    console.log(`📌 [pinMessage] User ${currentUserId} pinning message ${messageId} in dialog ${dialogId}`);

    // Check if user is a member of the dialog
    const membersResponse = await Chat3Client.getDialogMembers(dialogId, { limit: 100 });
    const members = membersResponse?.data || membersResponse || [];
    const isMember = members.some(m => m.userId === currentUserId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this dialog',
      });
    }

    // Verify message exists and belongs to this dialog
    let message;
    try {
      const messageResponse = await Chat3Client.getMessage(messageId);
      message = messageResponse?.data || messageResponse;
      
      // Check if message exists and belongs to this dialog
      // dialogId might be in different formats (string or ObjectId)
      const messageDialogId = message?.dialogId?.toString() || message?.dialogId;
      const targetDialogId = dialogId.toString();
      
      if (!message || messageDialogId !== targetDialogId) {
        return res.status(404).json({
          success: false,
          error: 'Message not found in this dialog',
        });
      }
    } catch (error) {
      if (error.response?.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Message not found',
        });
      }
      throw error;
    }

    // Set pinned message meta
    const pinnedData = {
      value: messageId,
      pinnedAt: new Date().toISOString(),
      pinnedBy: currentUserId,
    };

    await Chat3Client.setMeta('dialog', dialogId, PINNED_MESSAGE_META_KEY, pinnedData);

    console.log(`✅ [pinMessage] Message ${messageId} pinned in dialog ${dialogId}`);

    return res.json({
      success: true,
      data: {
        messageId,
        pinnedAt: pinnedData.pinnedAt,
        pinnedBy: currentUserId,
      },
    });
  } catch (error) {
    console.error('Error pinning message:', error);
    return res.status(500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to pin message',
    });
  }
}

/**
 * Unpin a message from a dialog
 * DELETE /api/dialogs/:dialogId/pin
 */
export async function unpinMessage(req, res) {
  try {
    const { dialogId } = req.params;
    const currentUserId = req.user.userId;

    console.log(`📌 [unpinMessage] User ${currentUserId} unpinning message from dialog ${dialogId}`);

    // Check if user is a member of the dialog
    const membersResponse = await Chat3Client.getDialogMembers(dialogId, { limit: 100 });
    const members = membersResponse?.data || membersResponse || [];
    const isMember = members.some(m => m.userId === currentUserId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this dialog',
      });
    }

    // Delete pinned message meta
    await Chat3Client.deleteMeta('dialog', dialogId, PINNED_MESSAGE_META_KEY);

    console.log(`✅ [unpinMessage] Message unpinned from dialog ${dialogId}`);

    return res.json({
      success: true,
      message: 'Message unpinned',
    });
  } catch (error) {
    console.error('Error unpinning message:', error);
    return res.status(500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to unpin message',
    });
  }
}

/**
 * Get pinned message for a dialog
 * GET /api/dialogs/:dialogId/pinned
 */
export async function getPinnedMessage(req, res) {
  try {
    const { dialogId } = req.params;
    const currentUserId = req.user.userId;

    console.log(`📌 [getPinnedMessage] Getting pinned message for dialog ${dialogId}`);

    // Check if user is a member of the dialog
    const membersResponse = await Chat3Client.getDialogMembers(dialogId, { limit: 100 });
    const members = membersResponse?.data || membersResponse || [];
    const isMember = members.some(m => m.userId === currentUserId);

    if (!isMember) {
      return res.status(403).json({
        success: false,
        error: 'You are not a member of this dialog',
      });
    }

    // Get dialog to retrieve pinned message from meta
    let dialog;
    try {
      const dialogResponse = await Chat3Client.getDialog(dialogId);
      dialog = dialogResponse?.data || dialogResponse;
    } catch (error) {
      if (error.response?.status === 404) {
        return res.status(404).json({
          success: false,
          error: 'Dialog not found',
        });
      }
      throw error;
    }

    // Get pinned message ID from dialog meta
    // pinnedMessage can be stored as:
    // 1. dialog.meta.pinnedMessage (string) - direct value
    // 2. dialog.meta.pinnedMessage.value (string) - nested value
    // 3. dialog.meta.pinnedMessage.value (object with pinnedAt, pinnedBy) - full object
    const pinnedMessageMeta = dialog?.meta?.[PINNED_MESSAGE_META_KEY];
    let messageId = null;
    let pinnedAt = null;
    let pinnedBy = null;

    if (pinnedMessageMeta) {
      if (typeof pinnedMessageMeta === 'string') {
        // Direct string value
        messageId = pinnedMessageMeta;
      } else if (pinnedMessageMeta.value) {
        // Nested value
        messageId = typeof pinnedMessageMeta.value === 'string' 
          ? pinnedMessageMeta.value 
          : pinnedMessageMeta.value.value || pinnedMessageMeta.value;
        pinnedAt = pinnedMessageMeta.pinnedAt || pinnedMessageMeta.value.pinnedAt;
        pinnedBy = pinnedMessageMeta.pinnedBy || pinnedMessageMeta.value.pinnedBy;
      }
    }

    if (!messageId) {
      return res.json({
        success: true,
        data: null,
      });
    }

    // Get the actual message
    let message;
    try {
      const messageResponse = await Chat3Client.getMessage(messageId);
      message = messageResponse?.data || messageResponse;
      
      // Ensure message has required fields
      if (!message) {
        throw new Error('Message data is empty');
      }
    } catch (error) {
      if (error.response?.status === 404 || error.message === 'Message data is empty') {
        // Message was deleted, remove pinned meta from dialog
        console.warn(`⚠️ [getPinnedMessage] Pinned message ${messageId} not found, removing pin`);
        try {
          // Try to remove via deleteMeta, but if it fails, we'll update dialog meta directly
          await Chat3Client.deleteMeta('dialog', dialogId, PINNED_MESSAGE_META_KEY);
        } catch (deleteError) {
          // If deleteMeta fails, just log the error
          // We can't update dialog meta directly as there's no updateDialog method
          console.warn('deleteMeta failed, pinned message meta will remain in dialog.meta:', deleteError.message);
        }
        return res.json({
          success: true,
          data: null,
        });
      }
      throw error;
    }

    return res.json({
      success: true,
      data: {
        message,
        pinnedAt: pinnedAt || message.createdAt,
        pinnedBy: pinnedBy || message.senderId,
      },
    });
  } catch (error) {
    console.error('Error getting pinned message:', error);
    return res.status(500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to get pinned message',
    });
  }
}


