import express from 'express';
import Chat3Client from '../services/Chat3Client.js';
import { authenticate } from '../middleware/auth.js';
import { mapOutgoingMessageType } from '../utils/messageType.js';
import { updateP2PPersonalization } from '../utils/p2pPersonalization.js';

const router = express.Router();

// All dialog routes require authentication
router.use(authenticate);

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
/**
 * Process P2P dialog: replace name and avatar with interlocutor's data
 */
async function processP2PDialog(dialog, currentUserId) {
  const dialogType = dialog.meta?.type || dialog.type;
  
  if (dialogType !== 'p2p') {
    return dialog;
  }

  const nameKey = `p2pDialogNameFor${currentUserId}`;
  const avatarKey = `p2pDialogAvatarFor${currentUserId}`;
  const fallbackName = extractMetaValue(dialog.meta, `nameFor_${currentUserId}`);
  const fallbackAvatar = extractMetaValue(dialog.meta, `avatarFor_${currentUserId}`);

  const personalizedName = extractMetaValue(dialog.meta, nameKey) || fallbackName;
  const personalizedAvatar = extractMetaValue(dialog.meta, avatarKey) || fallbackAvatar;

  if (personalizedName || personalizedAvatar) {
    return {
      ...dialog,
      name: personalizedName || dialog.name || dialog.dialogName || dialog.dialogId,
      avatar: personalizedAvatar ?? dialog.avatar ?? null,
      chatType: 'p2p',
    };
  }

  try {
    // Find interlocutor (all members except current user)
    let members = dialog.members || [];
    
    // If members not in dialog, get full dialog info
    if (members.length === 0) {
      try {
        const fullDialog = await Chat3Client.getDialog(dialog.dialogId);
        members = (fullDialog.data || fullDialog).members || [];
      } catch (error) {
        console.warn(`Failed to get full dialog info for ${dialog.dialogId}:`, error.message);
        return { ...dialog, chatType: 'p2p' };
      }
    }
    
    const interlocutor = members.find(
      member => member.userId !== currentUserId
    );

    if (interlocutor && interlocutor.userId) {
      try {
        // Get interlocutor's data from Chat3 API
        const interlocutorData = await Chat3Client.getUser(interlocutor.userId);
        const interlocutorUser = interlocutorData.data || interlocutorData;
        
        // Extract name and avatar
        const interlocutorName = interlocutorUser.name || interlocutor.userId;
        const interlocutorAvatar = interlocutorUser.meta?.avatar?.value || 
                                 interlocutorUser.meta?.avatar || 
                                 interlocutorUser.avatar || 
                                 null;

        // Replace dialog name and avatar with interlocutor's data
        return {
          ...dialog,
          name: interlocutorName,
          avatar: interlocutorAvatar,
          chatType: 'p2p',
        };
      } catch (error) {
        console.warn(`Failed to get interlocutor data for dialog ${dialog.dialogId}:`, error.message);
        return { ...dialog, chatType: 'p2p' };
      }
    } else {
      console.warn(`No interlocutor found for P2P dialog ${dialog.dialogId}`);
      return { ...dialog, chatType: 'p2p' };
    }
  } catch (error) {
    console.warn(`Error processing P2P dialog ${dialog.dialogId}:`, error.message);
    return { ...dialog, chatType: 'p2p' };
  }
}

/**
 * GET /api/dialogs
 * Get all dialogs for current user
 */
router.get('/', async (req, res) => {
  try {
    const { page = 1, limit = 10, includeLastMessage = false } = req.query;
    const currentUserId = req.user.userId;
    
    const result = await Chat3Client.getUserDialogs(currentUserId, {
      page,
      limit,
      includeLastMessage,
    });

    // Extract context fields to top level for easier frontend access
    let dialogsWithContext = result.data.map(dialog => ({
      ...dialog,
      unreadCount: dialog.context?.unreadCount || 0,
      lastSeenAt: dialog.context?.lastSeenAt,
      lastMessageAt: dialog.context?.lastMessageAt,
      isActive: dialog.context?.isActive || false,
      joinedAt: dialog.context?.joinedAt,
    }));

    // Process P2P dialogs: replace name and avatar with interlocutor's data
    const processedDialogs = await Promise.all(
      dialogsWithContext.map(async (dialog) => {
        const dialogType = dialog.meta?.type || dialog.type;
        const processed = await processP2PDialog(dialog, currentUserId);
        return {
          ...processed,
          chatType: processed.chatType || dialogType || 'group',
        };
      })
    );

    res.json({
      success: true,
      data: processedDialogs,
      pagination: result.pagination,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

router.get('/search', async (req, res) => {
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
        const processed = await processP2PDialog(dialog, currentUserId);
        return {
          ...processed,
          chatType: 'p2p',
        };
      })
    );

    const processedGroups = (groupResult.data || []).map((dialog) => ({
      ...dialog,
      chatType: 'group',
    }));

    const processedPublic = (publicResult.data || []).map((dialog) => ({
      ...dialog,
      chatType: 'group',
      meta: {
        ...(dialog.meta || {}),
        groupType: dialog.meta?.groupType || 'public',
      },
      isPublic: true,
    }));

    res.json({
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
    res.status(500).json({
      success: false,
      error: error.response?.data?.error || error.message || 'Failed to search dialogs',
    });
  }
});

/**
 * POST /api/dialogs
 * Create new dialog
 * Body: { name: "Dialog name", memberIds: ["userId1", "userId2"], chatType?: "p2p" | "group" }
 */
router.post('/', async (req, res) => {
  try {
    const { name, memberIds = [], chatType, groupType = 'private' } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Dialog name is required',
      });
    }

    // Determine chat type
    const totalMembers = 1 + memberIds.length; // creator + other members
    const finalChatType = chatType || (totalMembers === 2 ? 'p2p' : 'group');

    // For P2P dialogs, check if dialog already exists between these two users
    if (finalChatType === 'p2p' && memberIds.length === 1) {
      const otherUserId = memberIds[0];
      const currentUserId = req.user.userId;

      console.log(`🔍 Checking for existing P2P dialog between ${currentUserId} and ${otherUserId}`);

      // Use filter to find P2P dialogs where the other user is a member
      // Filter format: (member,in,[userId])&(meta.type,eq,p2p)
      const filter = `(member,in,[${otherUserId}])&(meta.type,eq,p2p)`;
      
      const userDialogs = await Chat3Client.getUserDialogs(currentUserId, {
        page: 1,
        limit: 100, // Max allowed by Chat3 API
        filter: filter,
      });

      // Check if any of the found dialogs has exactly 2 members: current user and the other user
      if (userDialogs.data && userDialogs.data.length > 0) {
        for (const dialog of userDialogs.data) {
          // Get full dialog info to verify it has exactly 2 members
          try {
            const fullDialog = await Chat3Client.getDialog(dialog.dialogId);
            const members = (fullDialog.data || fullDialog).members || [];
            
            // Check if this dialog has exactly 2 members: current user and the other user
            const dialogMemberIds = members.map(m => m.userId);
            if (dialogMemberIds.length === 2 && 
                dialogMemberIds.includes(currentUserId) && 
                dialogMemberIds.includes(otherUserId)) {
              console.log(`✅ Found existing P2P dialog ${dialog.dialogId} between ${currentUserId} and ${otherUserId}`);
              
              // Ensure search tokens are up to date
              await updateP2PPersonalization(dialog.dialogId, currentUserId, otherUserId);
              
              // Process P2P dialog to replace name with interlocutor's name
              const processedDialog = await processP2PDialog(dialog, currentUserId);
              
              // Return existing dialog with processed name
              return res.json({
                success: true,
                data: processedDialog,
                message: 'Dialog already exists',
              });
            }
          } catch (error) {
            console.warn(`Failed to get full dialog info for ${dialog.dialogId}:`, error.message);
            // Continue checking other dialogs
          }
        }
      }

      console.log(`ℹ️ No existing P2P dialog found, creating new one`);
    }

    // Create dialog
    const dialog = await Chat3Client.createDialog({
      name,
      createdBy: req.user.userId,
    });

    // Use dialogId from response (not _id)
    const dialogId = dialog.data.dialogId || dialog.data._id;

    // Add creator as member
    await Chat3Client.addDialogMember(dialogId, req.user.userId);
    
    if (finalChatType === 'group') {
      try {
        // Set role: owner for creator in dialogMember meta
        // Format: /meta/dialogMember/{dialogId}:{userId}/role
        const metaResult = await Chat3Client.setMeta('dialogMember', `${dialogId}:${req.user.userId}`, 'role', { value: 'owner' });
        console.log(`✅ Set role: owner for creator ${req.user.userId} in dialog ${dialogId}:`, metaResult);
      } catch (error) {
        console.error(`❌ Failed to set role meta tag for creator in dialog ${dialogId}:`, error.message);
        console.error('Error details:', error.response?.data || error);
      }
    }

    // Add other members
    for (const memberId of memberIds) {
      await Chat3Client.addDialogMember(dialogId, memberId);
    }

    // Set chat type meta tag
    try {
      await Chat3Client.setMeta('dialog', dialogId, 'type', { value: finalChatType });
    } catch (error) {
      console.warn(`Failed to set chat type meta tag for dialog ${dialogId}:`, error.message);
    }

    // Set group type meta tag (only for group chats)
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

    // Fetch full dialog data with transformed structure
    const fullDialog = await Chat3Client.getUserDialogs(req.user.userId, {
      dialogId,
      limit: 1
    });

    // Return the dialog with proper structure
    const createdDialog = fullDialog.data && fullDialog.data.length > 0 
      ? fullDialog.data[0] 
      : dialog.data;

    res.status(201).json({
      success: true,
      data: createdDialog,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/dialogs/public
 * Get all public groups
 */
router.get('/public', async (req, res) => {
  try {
    const { page = 1, limit = 50 } = req.query;
    const currentUserId = req.user.userId;
    
    // Build filter for public groups: (meta.type,eq,group)&(meta.groupType,eq,public)
    const filter = `(meta.type,eq,group)&(meta.groupType,eq,public)`;
    
    console.log(`🔍 Getting public groups with filter: ${filter}, page: ${page}, limit: ${limit}`);
    
    // Get all public groups using filter (without user context)
    const result = await Chat3Client.getDialogs({
      page: parseInt(page),
      limit: parseInt(limit),
      filter: filter,
    });

    console.log(`✅ Got result from Chat3 API:`, {
      dataLength: result.data?.length || 0,
      pagination: result.pagination,
    });

    const publicGroups = result.data || [];

    // Get user's dialog IDs to exclude already joined groups
    // Chat3 API allows max limit of 100, so we need to paginate if needed
    const userDialogIds = new Set();
    let userPage = 1;
    let hasMoreUserDialogs = true;
    
    while (hasMoreUserDialogs) {
      const userDialogs = await Chat3Client.getUserDialogs(currentUserId, {
        page: userPage,
        limit: 100, // Max allowed by Chat3 API
      });
      
      if (userDialogs.data && userDialogs.data.length > 0) {
        userDialogs.data.forEach(d => userDialogIds.add(d.dialogId));
        hasMoreUserDialogs = userDialogs.pagination && userPage < userDialogs.pagination.pages;
        userPage++;
      } else {
        hasMoreUserDialogs = false;
      }
    }

    console.log(`📊 Public groups found: ${publicGroups.length}, User dialog IDs: ${userDialogIds.size}`);
    console.log(`📋 Public group IDs:`, publicGroups.map(g => g.dialogId));
    console.log(`👤 User dialog IDs:`, Array.from(userDialogIds));

    // Filter out groups user is already a member of
    const availableGroups = publicGroups.filter(group => !userDialogIds.has(group.dialogId));

    console.log(`✅ Available groups (after filtering): ${availableGroups.length}`);

    res.json({
      success: true,
      data: availableGroups,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: result.pagination?.total || availableGroups.length,
        pages: result.pagination?.pages || Math.ceil(availableGroups.length / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Failed to get public groups:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/dialogs/:dialogId/join
 * Join a public group
 */
router.post('/:dialogId/join', async (req, res) => {
  try {
    const { dialogId } = req.params;
    const currentUserId = req.user.userId;

    // Check if dialog exists and is public
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

    // Check if user is already a member by checking dialog members
    const dialogData = dialog.data;
    const members = dialogData?.members || [];
    const isMember = members.some(member => member.userId === currentUserId);

    console.log(`🔍 Checking membership for user ${currentUserId} in dialog ${dialogId}`);
    console.log(`📋 Dialog members:`, members.map(m => m.userId));
    console.log(`✅ Is member: ${isMember}`);

    if (isMember) {
      return res.status(400).json({
        success: false,
        error: 'User is already a member of this group',
      });
    }

    // Add user to group
    await Chat3Client.addDialogMember(dialogId, currentUserId);

    // Get user info for system notification
    try {
      const userResponse = await Chat3Client.getUser(currentUserId);
      const userName = userResponse?.data?.name || currentUserId;
      
      // Send system notification message
      await Chat3Client.createMessage(dialogId, {
        content: `Пользователь ${userName} вошел в группу`,
        senderId: 'system',
        type: mapOutgoingMessageType('system'),
      });
    } catch (error) {
      console.warn(`Failed to send system notification for user ${currentUserId}:`, error.message);
    }

    // Get updated dialog
    const updatedDialog = await Chat3Client.getDialog(dialogId);

    res.json({
      success: true,
      data: updatedDialog.data,
    });
  } catch (error) {
    console.error('Failed to join group:', error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/dialogs/:dialogId
 * Get dialog by ID
 */
router.get('/:dialogId', async (req, res) => {
  try {
    const { dialogId } = req.params;
    const result = await Chat3Client.getDialog(dialogId);

    res.json({
      success: true,
      dialog: result.data,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/dialogs/:dialogId
 * Delete dialog
 */
router.delete('/:dialogId', async (req, res) => {
  try {
    const { dialogId } = req.params;
    await Chat3Client.deleteDialog(dialogId);

    res.json({
      success: true,
      message: 'Dialog deleted',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * GET /api/dialogs/:dialogId/members
 * Get dialog members with their roles
 */
router.get('/:dialogId/members', async (req, res) => {
  try {
    const { dialogId } = req.params;
    const dialog = await Chat3Client.getDialog(dialogId);
    
    // Get members info
    const members = dialog.data.members || [];
    
    // Get role for each member from meta tags
    const membersWithRoles = await Promise.all(
      members.map(async (member) => {
        try {
          const entityId = `${dialogId}:${member.userId}`; // canonical format expected by Chat3

          let role = null;
          
          try {
            // Попробуем получить значение по ключу role
            const roleMeta = await Chat3Client.getMeta('dialogMember', entityId, 'role');
            console.log(`🔍 Getting role key for member ${member.userId} in dialog ${dialogId} (entityId: ${entityId}):`, roleMeta);
            role = roleMeta?.value || roleMeta?.data?.value || roleMeta?.data || roleMeta || null;
          } catch (keyError) {
            if (keyError.response?.status !== 404) {
              console.warn(`⚠️ Error getting role key for member ${member.userId} with entityId ${entityId}:`, keyError.message);
            } else {
              // Если конкретный ключ не найден — запросим весь meta для канонического ID
              try {
                const metaResponse = await Chat3Client.getMeta('dialogMember', entityId);
                console.log(`🔍 Getting all meta for member ${member.userId} in dialog ${dialogId} (entityId: ${entityId}):`, {
                  entityId,
                  metaResponse,
                  metaType: typeof metaResponse,
                  metaKeys: metaResponse ? Object.keys(metaResponse) : null
                });

                role = metaResponse?.role?.value ||
                       metaResponse?.role ||
                       metaResponse?.data?.role?.value ||
                       metaResponse?.data?.role ||
                       (metaResponse?.data && typeof metaResponse.data === 'object' && 'role' in metaResponse.data ? metaResponse.data.role : null) ||
                       null;
              } catch (metaError) {
                if (metaError.response?.status !== 404) {
                  console.warn(`⚠️ Error getting meta for member ${member.userId} with entityId ${entityId}:`, metaError.message);
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
          // If meta not found or error, member has no role
          console.warn(`⚠️ Failed to get role for member ${member.userId} in dialog ${dialogId}:`, error.message);
          if (error.response?.status !== 404) {
            console.error('Error details:', error.response?.data || error);
          }
          return {
            ...member,
            role: null,
          };
        }
      })
    );
    
    res.json({
      success: true,
      data: membersWithRoles,
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * POST /api/dialogs/:dialogId/members
 * Add member to dialog
 * Body: { userId: "userId" }
 */
router.post('/:dialogId/members', async (req, res) => {
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

    // Get user info for system notification
    try {
      const userResponse = await Chat3Client.getUser(userId);
      const userName = userResponse?.data?.name || userId;
      
      // Send system notification message
      await Chat3Client.createMessage(dialogId, {
        content: `Пользователь ${userName} вошел в группу`,
        senderId: 'system',
        type: mapOutgoingMessageType('system'),
      });
    } catch (error) {
      console.warn(`Failed to send system notification for user ${userId}:`, error.message);
    }

    res.json({
      success: true,
      message: 'Member added',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

/**
 * DELETE /api/dialogs/:dialogId/members/:userId
 * Remove member from dialog
 */
router.delete('/:dialogId/members/:userId', async (req, res) => {
  try {
    const { dialogId, userId } = req.params;
    
    // Get user info for system notification before removing
    let userName = userId;
    try {
      const userResponse = await Chat3Client.getUser(userId);
      userName = userResponse?.data?.name || userId;
    } catch (error) {
      console.warn(`Failed to get user info for ${userId}:`, error.message);
    }

    await Chat3Client.removeDialogMember(dialogId, userId);

    // Send system notification message
    try {
      await Chat3Client.createMessage(dialogId, {
        content: `Пользователь ${userName} вышел из группы`,
        senderId: 'system',
        type: mapOutgoingMessageType('system'),
      });
    } catch (error) {
      console.warn(`Failed to send system notification for user ${userId}:`, error.message);
    }

    res.json({
      success: true,
      message: 'Member removed',
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

export default router;

