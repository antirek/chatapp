import express from 'express';
import { authenticate } from '../middleware/auth.js';
import {
  getDialogs,
  searchDialogs,
  createDialog,
  getPublicDialogs,
  joinPublicDialog,
  getDialogById,
  deleteDialog,
  getDialogMembers,
  addDialogMember,
  removeDialogMember,
} from '../controllers/dialogsController.js';

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /api/dialogs:
 *   get:
 *     tags: [Dialogs]
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
 * /api/dialogs/search:
 *   get:
 *     tags: [Dialogs]
 *     summary: Search dialogs by name
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Search results
 *       '400':
 *         description: Validation error
 */
router.get('/search', searchDialogs);

/**
 * @openapi
 * /api/dialogs:
 *   post:
 *     tags: [Dialogs]
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

export default router;
