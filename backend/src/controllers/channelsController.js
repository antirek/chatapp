import Contact from '../models/Contact.js';
import Channel from '../models/Channel.js';
import User from '../models/User.js';
import Chat3Client from '../services/Chat3Client.js';
import { mapOutgoingMessageType } from '../utils/messageType.js';

/**
 * Receive incoming message from channel
 * POST /api/channels/:channelType/:instanceId/message
 * Body: { phone: '79...', text: '...' }
 */
export async function receiveChannelMessage(req, res) {
  try {
    const { channelType, instanceId } = req.params;
    const { phone, text, name } = req.body;

    console.log(`📨 Receiving message from channel. Type: ${channelType}, InstanceId: ${instanceId}, Phone: ${phone}, Name: ${name || 'not provided'}`);

    // Validate input
    if (!phone || !text) {
      return res.status(400).json({
        success: false,
        error: 'Phone and text are required',
      });
    }

    // Validate phone format
    const phoneRegex = /^79\d{9}$/;
    if (!phoneRegex.test(phone)) {
      return res.status(400).json({
        success: false,
        error: 'Invalid phone format. Expected: 79XXXXXXXXX',
      });
    }

    // Find channel by instanceId
    const channel = await Channel.findOne({ instanceId }).lean();
    if (!channel) {
      return res.status(404).json({
        success: false,
        error: 'Channel not found',
      });
    }

    const accountId = channel.accountId;
    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'Channel does not have accountId',
      });
    }

    console.log(`✅ Found channel with instanceId ${instanceId} (channelId: ${channel.channelId}) with accountId: ${accountId}`);

    // Find or create contact by accountId and phone
    let contact = await Contact.findOne({
      accountId,
      phone,
    }).lean();

    if (!contact) {
      // Contact not found, create new one
      if (!name) {
        return res.status(400).json({
          success: false,
          error: 'Contact not found and name is required to create new contact',
        });
      }

      console.log(`📝 Creating new contact for phone ${phone} with name: ${name}`);

      try {
        const newContact = new Contact({
          accountId,
          name: name.trim(),
          phone,
        });
        await newContact.save();
        contact = newContact.toObject();
        console.log(`✅ Created contact ${contact.contactId} (${contact.name}) for phone ${phone}`);
      } catch (contactError) {
        console.error('❌ Error creating contact:', contactError);
        return res.status(500).json({
          success: false,
          error: `Failed to create contact: ${contactError.message}`,
        });
      }
    } else {
      console.log(`✅ Found existing contact ${contact.contactId} (${contact.name}) for phone ${phone}`);
      
      // Update contact name if provided and different
      if (name && name.trim() && name.trim() !== contact.name) {
        try {
          await Contact.updateOne(
            { contactId: contact.contactId },
            { name: name.trim(), updatedAt: new Date() }
          );
          contact.name = name.trim();
          console.log(`✅ Updated contact ${contact.contactId} name to: ${contact.name}`);
        } catch (updateError) {
          console.error('⚠️ Failed to update contact name:', updateError);
          // Continue - contact exists, we can still process message
        }
      }
    }

    // Find or create dialog with this contact
    let dialogId = null;
    const contactId = contact.contactId;

    try {
      // Search for existing dialog with this contactId
      // Contact is a member of the dialog, so we can search dialogs directly via contact
      try {
        const dialogsResponse = await Chat3Client.getUserDialogs(contactId, {
          page: 1,
          limit: 100,
        });

        const allDialogs = dialogsResponse?.data || dialogsResponse || [];
        
        // Filter dialogs by contactId meta tag to ensure it's the right dialog
        const dialogs = allDialogs.filter(dialog => {
          const dialogContactId = dialog.meta?.contactId?.value || dialog.meta?.contactId;
          return dialogContactId === contactId;
        });
        
        if (dialogs.length > 0) {
          // Dialog exists
          const existingDialog = dialogs[0];
          dialogId = existingDialog.dialogId || existingDialog._id;
          console.log(`✅ Found existing dialog ${dialogId} for contact ${contactId}`);
        } else {
          console.log(`ℹ️  No existing dialog found for contact ${contactId}, will create new one`);
        }
      } catch (contactDialogError) {
        // If contact doesn't have dialogs yet or error occurred, will create new dialog
        console.log(`ℹ️  Could not search dialogs for contact ${contactId}:`, contactDialogError.message);
        console.log(`   Will create new dialog`);
      }
      
      if (!dialogId) {
        // Dialog doesn't exist, create new one
        console.log(`📝 Creating new dialog for contact ${contactId}`);
        
        // Find first user with this accountId to use as createdBy
        const createdByUser = await User.findOne({ accountId }).select('userId name').lean();
        const createdBy = createdByUser?.userId || accountId; // Fallback to accountId if no user found
        
        const dialogName = contact.name;
        
        const dialogResponse = await Chat3Client.createDialog({
          name: dialogName,
          createdBy,
          meta: {
            type: { value: 'personal_contact' },
            contactId: { value: contact.contactId },
            contactName: { value: contact.name },
            classifyStatus: { value: 'init' },
          },
        });
        
        dialogId = dialogResponse?.data?.dialogId || dialogResponse?.data?._id || dialogResponse?.dialogId || dialogResponse?._id;
        
        if (!dialogId) {
          return res.status(500).json({
            success: false,
            error: 'Failed to create dialog: dialogId not found in response',
          });
        }

        console.log(`✅ Created dialog ${dialogId} for contact ${contactId}`);

        // Step 1: Add system message "Начат диалог"
        try {
          await Chat3Client.createMessage(dialogId, {
            content: 'Начат диалог',
            type: mapOutgoingMessageType('system'),
            senderId: 'system',
          });
          console.log(`✅ Added system message "Начат диалог" to dialog ${dialogId}`);
        } catch (systemMsgError) {
          console.error('⚠️ Failed to add system message:', systemMsgError);
        }

        // Step 2: Add contact as member with type=contact
        try {
          await Chat3Client.addDialogMember(dialogId, contact.contactId, {
            type: 'contact',
            name: contact.name,
          });
          await Chat3Client.setMeta(
            'dialogMember',
            `${dialogId}:${contact.contactId}`,
            'memberType',
            { value: 'contact' }
          );
          console.log(`✅ Added contact ${contact.contactId} to dialog ${dialogId}`);
        } catch (contactMemberError) {
          console.error('⚠️ Failed to add contact as member:', contactMemberError);
          // Continue - dialog is created, we can still add message
        }

        // Step 3: Add bot_classify to dialog for classification
        try {
          await Chat3Client.addDialogMember(dialogId, 'bot_classify', {
            type: 'bot',
            name: 'Classify',
          });
          await Chat3Client.setMeta(
            'dialogMember',
            `${dialogId}:bot_classify`,
            'memberType',
            { value: 'bot' }
          );
          console.log(`✅ Added bot_classify to dialog ${dialogId} for classification`);
        } catch (botMemberError) {
          console.error('⚠️ Failed to add bot_classify as member:', botMemberError);
          // Continue - dialog is created, we can still add message
        }

        // Step 4: Add system message "Подключен bot_classify"
        try {
          await Chat3Client.createMessage(dialogId, {
            content: 'Подключен bot_classify',
            type: mapOutgoingMessageType('system'),
            senderId: 'system',
          });
          console.log(`✅ Added system message "Подключен bot_classify" to dialog ${dialogId}`);
        } catch (systemMsgError) {
          console.error('⚠️ Failed to add system message:', systemMsgError);
        }

        // Step 5: Bot sends clarification message (will be sent via messageSender worker to channel)
        // This message will be created after contact message is added, so bot can respond
        // The bot will send it automatically when it receives the first message

        // Note: Users are NOT automatically added to the dialog when receiving incoming messages.
        // Users will be added after classification via bot_classify.
      }
    } catch (dialogError) {
      console.error('❌ Error finding/creating dialog:', dialogError);
      return res.status(500).json({
        success: false,
        error: `Failed to find or create dialog: ${dialogError.message}`,
      });
    }

    // Ensure contact exists in Chat3 as a user before sending message
    try {
      try {
        await Chat3Client.getUser(contact.contactId);
        console.log(`✅ Contact ${contact.contactId} already exists in Chat3`);
      } catch (getUserError) {
        if (getUserError.response?.status === 404) {
          // Contact doesn't exist in Chat3, create it
          console.log(`📝 Creating contact ${contact.contactId} in Chat3 as user with type 'contact'...`);
          await Chat3Client.createUser(contact.contactId, {
            name: contact.name,
            type: 'contact',
            meta: {
              phone: contact.phone,
            },
          });
          console.log(`✅ Created contact ${contact.contactId} in Chat3 with type 'contact'`);
        } else {
          throw getUserError;
        }
      }
    } catch (userError) {
      console.error('⚠️ Failed to ensure contact exists in Chat3:', userError.message);
      // Continue - try to send message anyway
    }

    // Ensure contact is a member of the dialog before sending message
    try {
      const membersResponse = await Chat3Client.getDialogMembers(dialogId, { limit: 100 });
      const members = membersResponse?.data || membersResponse || [];
      const isMember = Array.isArray(members) && members.some(m => (m.userId || m._id) === contact.contactId);

      if (!isMember) {
        console.log(`📝 Adding contact ${contact.contactId} to dialog ${dialogId} as member...`);
        await Chat3Client.addDialogMember(dialogId, contact.contactId, {
          type: 'contact',
          name: contact.name,
        });
        await Chat3Client.setMeta(
          'dialogMember',
          `${dialogId}:${contact.contactId}`,
          'memberType',
          { value: 'contact' }
        );
        console.log(`✅ Added contact ${contact.contactId} to dialog ${dialogId}`);
      }
    } catch (memberError) {
      console.error('⚠️ Failed to ensure contact is dialog member:', memberError.message);
      // Continue - try to send message anyway
    }

    // Add message to dialog
    try {
      const messagePayload = {
        content: text.trim(),
        type: mapOutgoingMessageType('text'),
        senderId: contact.contactId, // Message from contact
      };

      const messageResponse = await Chat3Client.createMessage(dialogId, messagePayload);

      const messageId = messageResponse?.data?.messageId || messageResponse?.data?._id || messageResponse?.messageId || messageResponse?._id;
      
      console.log(`✅ Added message ${messageId} to dialog ${dialogId}`);

      return res.json({
        success: true,
        data: {
          messageId,
          dialogId,
          contactId: contact.contactId,
          message: messageResponse?.data || messageResponse,
        },
      });
    } catch (messageError) {
      console.error('❌ Error creating message:', messageError);
      const errorMessage = messageError.response?.data?.error || messageError.response?.data?.message || messageError.message;
      const errorStatus = messageError.response?.status || 500;
      return res.status(errorStatus).json({
        success: false,
        error: `Failed to create message: ${errorMessage}`,
        details: process.env.NODE_ENV === 'development' ? messageError.response?.data : undefined,
      });
    }
  } catch (error) {
    console.error('❌ Error receiving channel message:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to receive channel message',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

