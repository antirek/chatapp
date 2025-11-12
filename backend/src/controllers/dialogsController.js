import Chat3Client from '../services/Chat3Client.js';
import { mapOutgoingMessageType } from '../utils/messageType.js';
import {
  updateP2PPersonalization,
  getP2PUserProfile,
} from '../utils/p2pPersonalization.js';
import { resolveNameFromMeta } from '../utils/nameResolver.js';
import { authenticate } from '../middleware/auth.js';

const MIN_SEARCH_LENGTH = 2;

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

async function safeGetUserDialogs(userId, params) {
  try {
    return await Chat3Client.getUserDialogs(userId, params);
  } catch (error) {
    if (error.response?.status === 404) {
      return createEmptyResult(parseInt(params.page, 10) || 1, parseInt(params.limit, 10) || 0);
    }
    throw error;
  }
}

async function safeGetDialogs(params) {
  try {
    return await Chat3Client.getDialogs(params);
  } catch (error) {
    if (error.response?.status === 404) {
      return createEmptyResult(parseInt(params.page, 10) || 1, parseInt(params.limit, 10) || 0);
    }
    throw error;
  }
}

async function ensureP2PMeta(dialog, currentUserId) {
  const nameKey = `p2pDialogNameFor${currentUserId}`;
  const avatarKey = `p2pDialogAvatarFor${currentUserId}`;

  const meta = dialog.meta || {};
  let name = extractMetaValue(meta, nameKey);
  let avatar = extractMetaValue(meta, avatarKey);

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

async function processP2PDialog(dialog, currentUser) {
  const currentUserId =
    typeof currentUser === 'string' ? currentUser : currentUser?.userId;

  if (!currentUserId) {
    return dialog;
  }

  const dialogType = dialog.meta?.type || dialog.type;

  if (dialogType !== 'p2p') {
    return dialog;
  }

  const nameKey = `p2pDialogNameFor${currentUserId}`;
  const avatarKey = `p2pDialogAvatarFor${currentUserId}`;
  const personalizedName = extractMetaValue(dialog.meta, nameKey);
  const personalizedAvatar = extractMetaValue(dialog.meta, avatarKey);

  if (personalizedName && personalizedAvatar !== undefined) {
    return {
      ...dialog,
      name: personalizedName,
      avatar: personalizedAvatar ?? null,
      chatType: 'p2p',
    };
  }

  const { name, avatar } = await ensureP2PMeta(dialog, currentUserId);

  const resolvedName = name ?? personalizedName ?? dialog.dialogId;
  const resolvedAvatar =
    avatar ?? personalizedAvatar ?? dialog.avatar ?? null;

  return {
    ...dialog,
    name: resolvedName,
    avatar: resolvedAvatar,
    chatType: 'p2p',
  };
}

function isPublicGroup(dialog) {
  const groupType =
    extractMetaValue(dialog.meta, 'groupType') ||
    extractMetaValue(dialog.meta, 'visibility') ||
    dialog.meta?.groupType ||
    dialog.meta?.visibility;
  return (groupType || '').toLowerCase() === 'public';
}

function isGroupDialog(dialog) {
  const dialogType = dialog.chatType || dialog.meta?.type || dialog.type;
  return dialogType === 'group';
}

export async function getDialogs(req, res) {
  try {
    const {
      page = 1,
      limit = 10,
      includeLastMessage = false,
      type: rawType,
    } = req.query;
    const currentUserId = req.user.userId;
    const requestedType = typeof rawType === 'string' ? rawType : null;

    const params = {
      page,
      limit,
      includeLastMessage,
    };

    if (requestedType === 'p2p') {
      params.filter = '(meta.type,eq,p2p)';
    } else if (requestedType === 'group:public') {
      params.filter = '(meta.type,eq,group)&(meta.groupType,eq,public)';
    } else if (requestedType === 'group:private') {
      params.filter = '(meta.type,eq,group)&(meta.groupType,eq,private)';
    } else if (requestedType === 'favorites') {
      const favoriteKey = `favoriteFor${currentUserId}`;
      params.filter = `(meta.${favoriteKey},eq,true)`;
    }

    const result = await Chat3Client.getUserDialogs(currentUserId, params);

    const dialogsWithContext = result.data.map((dialog) => ({
      ...dialog,
      unreadCount: dialog.context?.unreadCount || 0,
      lastSeenAt: dialog.context?.lastSeenAt,
      lastMessageAt: dialog.context?.lastMessageAt,
      isActive: dialog.context?.isActive || false,
      joinedAt: dialog.context?.joinedAt,
    }));

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

    // All filtering is done by Chat3 API via filter parameter
    // No additional client-side filtering needed

    return res.json({
      success: true,
      data: processedDialogs,
      pagination: result.pagination,
    });
  } catch (error) {
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

export async function searchDialogs(req, res) {
  const {
    search,
    p2pPage = 1,
    p2pLimit = 10,
    groupPage = 1,
    groupLimit = 10,
    publicPage = 1,
    publicLimit = 10,
  } = req.query;

  const trimmedSearch = (search || '').trim();

  if (!trimmedSearch || trimmedSearch.length < MIN_SEARCH_LENGTH) {
    return res.status(400).json({
      success: false,
      error: `Search term must be at least ${MIN_SEARCH_LENGTH} characters`,
    });
  }

  const currentUserId = req.user.userId;
  const escaped = escapeRegex(trimmedSearch);
  const nameMetaKey = `p2pDialogNameFor${currentUserId}`;
  const pattern = `.*${escaped}.*`;
  const searchLower = trimmedSearch.toLowerCase();

  const matchesName = (dialog) => {
    const dialogName = (dialog?.name || dialog?.dialogName || '').toString();
    return dialogName.toLowerCase().includes(searchLower);
  };

  const p2pFilter = `(meta.type,eq,p2p)&(meta.${nameMetaKey},regex,"${pattern}")`;
  const groupsFilter = `(meta.type,eq,group)&(name,regex,"${pattern}")`;
  const publicFilter = `(meta.type,eq,group)&(meta.groupType,eq,public)&(member,ne,${currentUserId})&(name,regex,"${pattern}")`;

  try {
    const [p2pResult, groupResult, publicResult] = await Promise.all([
      safeGetUserDialogs(currentUserId, {
        page: parseInt(p2pPage, 10) || 1,
        limit: parseInt(p2pLimit, 10) || 10,
        filter: p2pFilter,
        includeLastMessage: true,
      }),
      safeGetUserDialogs(currentUserId, {
        page: parseInt(groupPage, 10) || 1,
        limit: parseInt(groupLimit, 10) || 10,
        filter: groupsFilter,
        includeLastMessage: true,
      }),
      safeGetDialogs({
        page: parseInt(publicPage, 10) || 1,
        limit: parseInt(publicLimit, 10) || 10,
        filter: publicFilter,
        includeLastMessage: true,
      }),
    ]);

    const processedPersonal = await Promise.all(
      (p2pResult.data || []).map(async (dialog) => {
        const processed = await processP2PDialog(dialog, req.user);
        return {
          ...processed,
          chatType: 'p2p',
        };
      }),
    );

    const processedGroups = (groupResult.data || [])
      .map((dialog) => ({
        ...dialog,
        chatType: 'group',
      }))
      .filter(matchesName);

    const processedPublic = (publicResult.data || [])
      .map((dialog) => ({
        ...dialog,
        chatType: 'group',
        meta: {
          ...(dialog.meta || {}),
          groupType: dialog.meta?.groupType || 'public',
        },
        isPublic: true,
      }))
      .filter(matchesName);

    return res.json({
      success: true,
      search: trimmedSearch,
      personal: {
        data: processedPersonal,
        pagination: p2pResult.pagination || {
          page: parseInt(p2pPage, 10) || 1,
          limit: parseInt(p2pLimit, 10) || 10,
          total: processedPersonal.length,
          pages: processedPersonal.length ? 1 : 0,
        },
      },
      groups: {
        data: processedGroups,
        pagination: groupResult.pagination || {
          page: parseInt(groupPage, 10) || 1,
          limit: parseInt(groupLimit, 10) || 10,
          total: processedGroups.length,
          pages: processedGroups.length ? 1 : 0,
        },
      },
      publicGroups: {
        data: processedPublic,
        pagination: publicResult.pagination || {
          page: parseInt(publicPage, 10) || 1,
          limit: parseInt(publicLimit, 10) || 10,
          total: processedPublic.length,
          pages: processedPublic.length ? 1 : 0,
        },
      },
    });
  } catch (error) {
    console.error('Dialog search failed:', error.message, error.response?.data || '');
    return res.status(500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to search dialogs',
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
      name,
      createdBy: req.user.userId,
    });

    const dialogId = dialog.data.dialogId || dialog.data._id;

    await Chat3Client.addDialogMember(dialogId, req.user.userId);

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

    for (const memberId of memberIds) {
      await Chat3Client.addDialogMember(dialogId, memberId);
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

    const publicGroups = result.data || [];

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
  try {
    const { dialogId } = req.params;
    const currentUserId = req.user.userId;

    const dialog = await Chat3Client.getDialog(dialogId);
    const dialogType = dialog.data?.meta?.type || dialog.data?.type;
    const groupType = dialog.data?.meta?.groupType;

    if (dialogType !== 'group') {
      return res.status(400).json({
        success: false,
        error: 'Dialog is not a group',
      });
    }

    if (groupType !== 'public') {
      return res.status(403).json({
        success: false,
        error: 'Group is not public',
      });
    }

    const membersResponse = await Chat3Client.getDialogMembers(dialogId, { limit: 200 });
    const members = extractMembersFromResponse(membersResponse);
    const isMember = members.some((member) => member.userId === currentUserId);

    console.log(`🔍 Checking membership for user ${currentUserId} in dialog ${dialogId}`);
    console.log('📋 Dialog members:', members.map((m) => m.userId));
    console.log(`✅ Is member: ${isMember}`);

    if (isMember) {
      return res.status(400).json({
        success: false,
        error: 'User is already a member of this group',
      });
    }

    await Chat3Client.addDialogMember(dialogId, currentUserId);

    const userName = await resolveUserName(currentUserId, req.user?.name || null);

    try {
      await Chat3Client.createMessage(dialogId, {
        content: `Пользователь ${userName} вошел в группу`,
        senderId: 'system',
        type: mapOutgoingMessageType('system'),
      });
    } catch (error) {
      console.warn(
        `Failed to send system notification for user ${currentUserId}:`,
        error.message,
      );
    }

    const updatedDialog = await Chat3Client.getDialog(dialogId);

    return res.json({
      success: true,
      data: updatedDialog.data,
    });
  } catch (error) {
    console.error('Failed to join group:', error);
    return res.status(500).json({
      success: false,
      error: error.message,
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

    const dialogWithContext = {
      ...dialogData,
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

          try {
            const roleMeta = await Chat3Client.getMeta('dialogMember', entityId, 'role');
            console.log(
              `🔍 Getting role key for member ${member.userId} in dialog ${dialogId} (entityId: ${entityId}):`,
              roleMeta,
            );
            role =
              roleMeta?.value ||
              roleMeta?.data?.value ||
              roleMeta?.data ||
              roleMeta ||
              null;
          } catch (keyError) {
            if (keyError.response?.status !== 404) {
              console.warn(
                `⚠️ Error getting role key for member ${member.userId} with entityId ${entityId}:`,
                keyError.message,
              );
            } else {
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
              }
            }
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

    await Chat3Client.addDialogMember(dialogId, userId);

    const userName = await resolveUserName(userId, null);

    try {
      await Chat3Client.createMessage(dialogId, {
        content: `Пользователь ${userName} вошел в группу`,
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

export async function toggleDialogFavorite(req, res) {
  try {
    const { dialogId } = req.params;
    const currentUserId = req.user.userId;
    const metaKey = `favoriteFor${currentUserId}`;

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

    // Check if favorite already exists
    let isFavorite = false;
    try {
      const existingMeta = await Chat3Client.getMeta('dialog', dialogId, metaKey);
      isFavorite = !!existingMeta;
    } catch (error) {
      if (error.response?.status !== 404) {
        throw error;
      }
    }

    if (isFavorite) {
      // Remove from favorites
      await Chat3Client.deleteMeta('dialog', dialogId, metaKey);
      return res.json({
        success: true,
        isFavorite: false,
        message: 'Dialog removed from favorites',
      });
    } else {
      // Add to favorites
      await Chat3Client.setMeta('dialog', dialogId, metaKey, { value: true });
      return res.json({
        success: true,
        isFavorite: true,
        message: 'Dialog added to favorites',
      });
    }
  } catch (error) {
    console.error('Error toggling dialog favorite:', error);
    return res.status(500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to toggle favorite',
    });
  }
}


