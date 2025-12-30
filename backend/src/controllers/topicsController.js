import Chat3Client from '../services/Chat3Client.js';

/**
 * Get topics for a dialog
 * GET /api/dialogs/:dialogId/topics
 */
export async function getDialogTopics(req, res) {
  try {
    const { dialogId } = req.params;
    const { page = 1, limit = 50 } = req.query;

    console.log(`📥 [getDialogTopics] Request for dialog ${dialogId}, page ${page}, limit ${limit}`);

    const result = await Chat3Client.getDialogTopics(dialogId, {
      page,
      limit,
    });

    console.log(`✅ [getDialogTopics] Returning ${Array.isArray(result.data) ? result.data.length : 0} topics for dialog ${dialogId}`);
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('❌ Error in getDialogTopics:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Get topics for a dialog in user context (with unreadCount)
 * GET /api/dialogs/:dialogId/topics/user
 */
export async function getUserDialogTopics(req, res) {
  try {
    const { dialogId } = req.params;
    const { page = 1, limit = 50 } = req.query;
    const currentUserId = req.user.userId;

    console.log(`📥 [getUserDialogTopics] Request for dialog ${dialogId}, user ${currentUserId}, page ${page}, limit ${limit}`);

    const result = await Chat3Client.getUserDialogTopics(currentUserId, dialogId, {
      page,
      limit,
    });

    console.log(`✅ [getUserDialogTopics] Returning ${Array.isArray(result.data) ? result.data.length : 0} topics for dialog ${dialogId}`);
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('❌ Error in getUserDialogTopics:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}

/**
 * Create a new topic in a dialog
 * POST /api/dialogs/:dialogId/topics
 */
export async function createDialogTopic(req, res) {
  try {
    const { dialogId } = req.params;
    const { meta = {} } = req.body;
    const currentUserId = req.user.userId;

    console.log(`📥 [createDialogTopic] Request for dialog ${dialogId}, user ${currentUserId}`);

    // Validate that meta.name is provided
    if (!meta.name || typeof meta.name !== 'string' || meta.name.trim().length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Topic name is required (meta.name)',
      });
    }

    const result = await Chat3Client.createDialogTopic(dialogId, {
      meta,
    });

    console.log(`✅ [createDialogTopic] Created topic ${result.data?.topicId || 'unknown'} in dialog ${dialogId}`);
    return res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    console.error('❌ Error in createDialogTopic:', error.message);
    return res.status(500).json({
      success: false,
      error: error.message,
    });
  }
}
