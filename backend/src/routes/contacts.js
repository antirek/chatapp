import express from 'express';
import { authenticate } from '../middleware/auth.js';
import { createBusinessContact, getContact, listContacts, getOrCreateContactDialog } from '../controllers/contactsController.js';

const router = express.Router();

router.use(authenticate);

/**
 * @openapi
 * /api/contacts:
 *   post:
 *     tags: [Contacts]
 *     summary: Create a business contact and associated dialog
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
 *               - phone
 *             properties:
 *               name:
 *                 type: string
 *               phone:
 *                 type: string
 *                 pattern: '^79\d{9}$'
 *     responses:
 *       '200':
 *         description: Contact and dialog created successfully
 *       '400':
 *         description: Validation error
 *       '401':
 *         description: Unauthorized
 */
router.post('/', createBusinessContact);

/**
 * @openapi
 * /api/contacts/list:
 *   get:
 *     tags: [Contacts]
 *     summary: Get list of business contacts with optional search
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *         description: Search by contact name
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 50
 *     responses:
 *       '200':
 *         description: List of contacts retrieved successfully
 *       '401':
 *         description: Unauthorized
 */
router.get('/list', listContacts);

/**
 * @openapi
 * /api/contacts/{contactId}/dialog:
 *   get:
 *     tags: [Contacts]
 *     summary: Get or create dialog for a business contact
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Dialog retrieved or created successfully
 *       '404':
 *         description: Contact not found
 *       '401':
 *         description: Unauthorized
 */
router.get('/:contactId/dialog', getOrCreateContactDialog);

/**
 * @openapi
 * /api/contacts/{contactId}:
 *   get:
 *     tags: [Contacts]
 *     summary: Get business contact by ID
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: contactId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       '200':
 *         description: Contact retrieved successfully
 *       '404':
 *         description: Contact not found
 *       '401':
 *         description: Unauthorized
 */
router.get('/:contactId', getContact);

export default router;

