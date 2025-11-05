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
    
    const result = await Chat3Client.getUserDialogs(req.user.userId, {
      page,
      limit,
      includeLastMessage,
    });

    res.json({
      success: true,
      ...result,
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
 * Body: { name: "Dialog name", memberIds: ["userId1", "userId2"] }
 */
router.post('/', async (req, res) => {
  try {
    const { name, memberIds = [] } = req.body;

    if (!name) {
      return res.status(400).json({
        success: false,
        error: 'Dialog name is required',
      });
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

    // Add other members
    for (const memberId of memberIds) {
      await Chat3Client.addDialogMember(dialogId, memberId);
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
 * Get dialog members
 */
router.get('/:dialogId/members', async (req, res) => {
  try {
    const { dialogId } = req.params;
    const dialog = await Chat3Client.getDialog(dialogId);
    
    // Get members info
    const members = dialog.data.members || [];
    
    res.json({
      success: true,
      data: members,
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

