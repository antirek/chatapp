import express from 'express';
import { receiveChannelMessage } from '../controllers/channelsController.js';

const router = express.Router();

/**
 * @openapi
 * /api/channels/{channelType}/{instanceId}/message:
 *   post:
 *     tags: [Channels]
 *     summary: Receive incoming message from channel
 *     description: |
 *       Receives an incoming message from an external channel (WhatsApp, Telegram, etc.).
 *       Finds or creates a dialog with the business contact and adds the message.
 *     parameters:
 *       - in: path
 *         name: channelType
 *         required: true
 *         schema:
 *           type: string
 *           enum: [whatsapp, telegram, viber, sms]
 *         description: Type of channel
 *       - in: path
 *         name: instanceId
 *         required: true
 *         schema:
 *           type: string
 *         description: Channel instance ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - phone
 *               - text
 *             properties:
 *               phone:
 *                 type: string
 *                 pattern: '^79\d{9}$'
 *                 description: Phone number of the sender (79XXXXXXXXX)
 *                 example: '79123456789'
 *               text:
 *                 type: string
 *                 description: Message text content
 *                 example: 'Hello, I need help'
 *               name:
 *                 type: string
 *                 description: Contact name (required if contact doesn't exist, optional if contact exists - will update name if provided)
 *                 example: 'Иван Иванов'
 *     responses:
 *       '200':
 *         description: Message received and added to dialog successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                   example: true
 *                 data:
 *                   type: object
 *                   properties:
 *                     messageId:
 *                       type: string
 *                     dialogId:
 *                       type: string
 *                     contactId:
 *                       type: string
 *                     message:
 *                       type: object
 *       '400':
 *         description: Validation error (invalid phone format, missing fields)
 *       '404':
 *         description: Channel or contact not found
 *       '500':
 *         description: Internal server error
 */
router.post('/:channelType/:instanceId/message', receiveChannelMessage);

export default router;

