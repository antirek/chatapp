import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getDialogs,
  createDialog,
  getPublicDialogs,
  joinPublicDialog,
  getDialogById,
  deleteDialog,
  getDialogMembers,
  getDialogBotCommands,
  addDialogMember,
  removeDialogMember,
  sendTypingIndicator,
  markDialogAsRead,
  toggleDialogFavorite,
  pinMessage,
  unpinMessage,
  getPinnedMessage,
} from '../controllers/dialogsController.js';

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /api/dialogs:
 *   get:
 *     tags: [Dialog Members]
 *     summary: List dialogs for current user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *       - in: query
 *         name: includeLastMessage
 *         schema:
 *           type: boolean
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [p2p, group:private, group:public]
 *         description: Filter dialogs by type
 *     responses:
 *       '200':
 *         description: List of dialogs
 *       '401':
 *         description: Unauthorized
 */
router.get('/', getDialogs);

/**
 * @openapi
 * /api/dialogs:
 *   post:
 *     tags: [Dialog Members]
 *     summary: Create a new dialog
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - name
 *             properties:
 *               name:
 *                 type: string
 *               memberIds:
 *                 type: array
 *                 items:
 *                   type: string
 *               chatType:
 *                 type: string
 *                 enum: [p2p, group]
 *     responses:
 *       '201':
 *         description: Dialog created
 *       '400':
 *         description: Validation error
 */
router.post('/', createDialog);

/**
 * @openapi
 * /api/dialogs/public:
 *   get:
 *     tags: [Dialogs]
 *     summary: List public groups available to join
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: List of public dialogs
 */
router.get('/public', getPublicDialogs);

/**
 * @openapi
 * /api/dialogs/{dialogId}/typing:
 *   post:
 *     tags: [Dialogs]
 *     summary: Send typing indicator for current user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '202':
 *         description: Typing indicator accepted
 *       '400':
 *         description: Invalid dialog ID
 */
router.post('/:dialogId/typing', sendTypingIndicator);

/**
 * @openapi
 * /api/dialogs/{dialogId}/unread:
 *   patch:
 *     tags: [Dialogs]
 *     summary: Reset unread counter for current user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: false
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               unreadCount:
 *                 type: integer
 *                 description: Desired unread counter value (defaults to 0)
 *               lastSeenAt:
 *                 type: number
 *                 description: Timestamp in ms (defaults to now)
 *               reason:
 *                 type: string
 *                 description: Optional audit reason
 *     responses:
 *       '200':
 *         description: Unread counter updated
 *       '400':
 *         description: Validation error
 */
router.patch('/:dialogId/unread', markDialogAsRead);

/**
 * @openapi
 * /api/dialogs/{dialogId}/join:
 *   post:
 *     tags: [Dialogs]
 *     summary: Join a public group
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Joined group successfully
 *       '400':
 *         description: Already a member or invalid group
 */
router.post('/:dialogId/join', joinPublicDialog);

/**
 * @openapi
 * /api/dialogs/{dialogId}:
 *   get:
 *     tags: [Dialogs]
 *     summary: Get dialog by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Dialog information
 *       '404':
 *         description: Dialog not found
 */
router.get('/:dialogId', getDialogById);

/**
 * @openapi
 * /api/dialogs/{dialogId}:
 *   delete:
 *     tags: [Dialogs]
 *     summary: Delete a dialog
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Dialog removed
 */
router.delete('/:dialogId', deleteDialog);

/**
 * @openapi
 * /api/dialogs/{dialogId}/members:
 *   get:
 *     tags: [Dialogs]
 *     summary: Get members of dialog
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: List of members
 */
router.get('/:dialogId/members', getDialogMembers);

/**
 * @openapi
 * /api/dialogs/{dialogId}/bots/commands:
 *   get:
 *     tags: [Dialogs]
 *     summary: Get bot commands for dialog
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: List of bots with their commands
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: array
 *                   items:
 *                     type: object
 *                     properties:
 *                       botId:
 *                         type: string
 *                       name:
 *                         type: string
 *                       commands:
 *                         type: array
 *                         items:
 *                           type: object
 *                           properties:
 *                             name:
 *                               type: string
 *                             description:
 *                               type: string
 *                             usage:
 *                               type: string
 */
router.get('/:dialogId/bots/commands', getDialogBotCommands);

/**
 * @openapi
 * /api/dialogs/{dialogId}/members:
 *   post:
 *     tags: [Dialogs]
 *     summary: Add member to dialog
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - userId
 *             properties:
 *               userId:
 *                 type: string
 *     responses:
 *       '200':
 *         description: Member added
 */
router.post('/:dialogId/members', addDialogMember);

/**
 * @openapi
 * /api/dialogs/{dialogId}/members/{userId}:
 *   delete:
 *     tags: [Dialogs]
 *     summary: Remove member from dialog
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: userId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Member removed
 */
router.delete('/:dialogId/members/:userId', removeDialogMember);

/**
 * @openapi
 * /api/dialogs/{dialogId}/favorite:
 *   post:
 *     tags: [Dialogs]
 *     summary: Toggle dialog favorite status for current user
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Favorite status toggled
 *       '404':
 *         description: Dialog not found
 */
router.post('/:dialogId/favorite', toggleDialogFavorite);

/**
 * @openapi
 * /api/dialogs/{dialogId}/pin/{messageId}:
 *   post:
 *     tags: [Dialogs]
 *     summary: Pin a message in a dialog
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *       - in: path
 *         name: messageId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Message pinned successfully
 *       '403':
 *         description: User is not a member of the dialog
 *       '404':
 *         description: Message not found
 */
router.post('/:dialogId/pin/:messageId', pinMessage);

/**
 * @openapi
 * /api/dialogs/{dialogId}/pin:
 *   delete:
 *     tags: [Dialogs]
 *     summary: Unpin a message from a dialog
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Message unpinned successfully
 *       '403':
 *         description: User is not a member of the dialog
 */
router.delete('/:dialogId/pin', unpinMessage);

/**
 * @openapi
 * /api/dialogs/{dialogId}/pinned:
 *   get:
 *     tags: [Dialogs]
 *     summary: Get pinned message for a dialog
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: dialogId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Pinned message data (or null if no pinned message)
 *       '403':
 *         description: User is not a member of the dialog
 */
router.get('/:dialogId/pinned', getPinnedMessage);

export default router;
