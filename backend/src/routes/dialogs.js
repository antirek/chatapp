import express from 'express';
import Chat3Client from '../services/Chat3Client.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

// All dialog routes require authentication
router.use(authenticate);

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
        // Check if dialog is P2P type
        const dialogType = dialog.meta?.type || dialog.type;
        
        if (dialogType === 'p2p') {
          try {
            // Find interlocutor (all members except current user)
            // Members might be in dialog.members or we need to get full dialog info
            let members = dialog.members || [];
            
            // If members not in dialog, get full dialog info
            if (members.length === 0) {
              try {
                const fullDialog = await Chat3Client.getDialog(dialog.dialogId);
                members = (fullDialog.data || fullDialog).members || [];
              } catch (error) {
                console.warn(`Failed to get full dialog info for ${dialog.dialogId}:`, error.message);
              }
            }
            
            const interlocutor = members.find(
              member => member.userId !== currentUserId
            );

            if (interlocutor && interlocutor.userId) {
              try {
                // Get interlocutor's data from Chat3 API
                const interlocutorData = await Chat3Client.getUser(interlocutor.userId);
                // Chat3Client.getUser returns response.data, which may contain nested data
                const interlocutorUser = interlocutorData.data || interlocutorData;
                
                // Extract name and avatar
                const interlocutorName = interlocutorUser.name || interlocutor.userId;
                // Avatar might be in meta.avatar or directly in avatar field
                const interlocutorAvatar = interlocutorUser.meta?.avatar?.value || 
                                         interlocutorUser.meta?.avatar || 
                                         interlocutorUser.avatar || 
                                         null;

                // Replace dialog name and avatar with interlocutor's data
                return {
                  ...dialog,
                  name: interlocutorName,
                  avatar: interlocutorAvatar,
                  chatType: 'p2p', // Explicitly set chat type
                };
              } catch (error) {
                // If failed to get interlocutor data, log and return dialog as is
                console.warn(`Failed to get interlocutor data for dialog ${dialog.dialogId}:`, error.message);
                return {
                  ...dialog,
                  chatType: 'p2p',
                };
              }
            } else {
              // No interlocutor found, return dialog as is
              console.warn(`No interlocutor found for P2P dialog ${dialog.dialogId}`);
              return {
                ...dialog,
                chatType: 'p2p',
              };
            }
          } catch (error) {
            console.warn(`Error processing P2P dialog ${dialog.dialogId}:`, error.message);
            return {
              ...dialog,
              chatType: 'p2p',
            };
          }
        }

        // For non-P2P dialogs, return as is
        return {
          ...dialog,
          chatType: dialogType || 'group',
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

      // Get all user dialogs with pagination
      let userPage = 1;
      let hasMoreDialogs = true;
      let existingDialog = null;

      while (hasMoreDialogs && !existingDialog) {
        const userDialogs = await Chat3Client.getUserDialogs(currentUserId, {
          page: userPage,
          limit: 100, // Max allowed by Chat3 API
        });

        if (!userDialogs.data || userDialogs.data.length === 0) {
          hasMoreDialogs = false;
          break;
        }

        // Find existing P2P dialog with the other user
        for (const dialog of userDialogs.data) {
          const dialogType = dialog.meta?.type || dialog.type;
          
          if (dialogType === 'p2p') {
            // Get full dialog info to check members
            try {
              const fullDialog = await Chat3Client.getDialog(dialog.dialogId);
              const members = (fullDialog.data || fullDialog).members || [];
              
              // Check if this dialog has exactly 2 members: current user and the other user
              const dialogMemberIds = members.map(m => m.userId);
              if (dialogMemberIds.length === 2 && 
                  dialogMemberIds.includes(currentUserId) && 
                  dialogMemberIds.includes(otherUserId)) {
                console.log(`✅ Found existing P2P dialog ${dialog.dialogId} between ${currentUserId} and ${otherUserId}`);
                existingDialog = dialog;
                break;
              }
            } catch (error) {
              console.warn(`Failed to get full dialog info for ${dialog.dialogId}:`, error.message);
              // Continue checking other dialogs
            }
          }
        }

        // Check if there are more pages
        hasMoreDialogs = userDialogs.pagination && userPage < userDialogs.pagination.pages;
        userPage++;
      }

      if (existingDialog) {
        // Return existing dialog
        return res.json({
          success: true,
          data: existingDialog,
          message: 'Dialog already exists',
        });
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
          // Get role meta tag for this dialogMember
          // Format: /meta/dialogMember/{dialogId}:{userId}/role
          // Try different possible entityId formats
          const entityIdFormats = [
            `${dialogId}:${member.userId}`,  // Format 1: dialogId:userId (correct format)
            `${dialogId}/${member.userId}`,  // Format 2: dialogId/userId (fallback)
            `${dialogId}_${member.userId}`,  // Format 3: dialogId_userId (fallback)
            member.userId,                    // Format 4: just userId (fallback)
          ];
          
          let role = null;
          let roleMeta = null;
          
          // Try each format until we find the role
          for (const entityId of entityIdFormats) {
            try {
              // First try to get specific 'role' key
              try {
                roleMeta = await Chat3Client.getMeta('dialogMember', entityId, 'role');
                console.log(`🔍 Getting role key for member ${member.userId} in dialog ${dialogId} (entityId: ${entityId}):`, roleMeta);
                
                // Extract role from response
                role = roleMeta?.value || roleMeta?.data?.value || roleMeta?.data || roleMeta || null;
                
                if (role) {
                  console.log(`✅ Found role for member ${member.userId} using entityId format: ${entityId}, role:`, role);
                  break; // Found role, stop trying other formats
                }
              } catch (keyError) {
                // If specific key not found, try getting all meta tags
                try {
                  roleMeta = await Chat3Client.getMeta('dialogMember', entityId);
                  
                  // Log for debugging
                  console.log(`🔍 Getting all meta for member ${member.userId} in dialog ${dialogId} (entityId: ${entityId}):`, {
                    entityId,
                    roleMeta,
                    roleMetaType: typeof roleMeta,
                    roleMetaKeys: roleMeta ? Object.keys(roleMeta) : null
                  });
                  
                  // Try different formats for role extraction
                  if (roleMeta) {
                    // Try different possible formats
                    role = roleMeta?.role?.value || 
                           roleMeta?.role || 
                           roleMeta?.data?.role?.value || 
                           roleMeta?.data?.role ||
                           (roleMeta?.data && typeof roleMeta.data === 'object' && 'role' in roleMeta.data ? roleMeta.data.role : null) ||
                           null;
                    
                    if (role) {
                      console.log(`✅ Found role for member ${member.userId} using entityId format: ${entityId}, role:`, role);
                      break; // Found role, stop trying other formats
                    }
                  }
                } catch (allMetaError) {
                  // Try next format
                  if (allMetaError.response?.status !== 404) {
                    console.warn(`⚠️ Error getting meta for member ${member.userId} with entityId ${entityId}:`, allMetaError.message);
                  }
                  continue;
                }
              }
            } catch (error) {
              // Try next format
              if (error.response?.status !== 404) {
                console.warn(`⚠️ Error getting role for member ${member.userId} with entityId ${entityId}:`, error.message);
              }
              continue;
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
    await Chat3Client.removeDialogMember(dialogId, userId);

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

