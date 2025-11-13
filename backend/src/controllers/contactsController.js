import Contact from '../models/Contact.js';
import Chat3Client from '../services/Chat3Client.js';
import { processP2PDialog } from './dialogsController.js';

/**
 * Create a business contact and associated dialog
 */
export async function createBusinessContact(req, res) {
  try {
    const { name, phone } = req.body;
    const currentUserId = req.user.userId;
    const accountId = req.user.accountId;

    console.log(`📝 Creating business contact. User: ${currentUserId}, accountId: ${accountId}, name: ${name}, phone: ${phone}`);

    if (!accountId) {
      console.error(`❌ User ${currentUserId} does not have accountId. req.user:`, JSON.stringify(req.user, null, 2));
      return res.status(400).json({
        success: false,
        error: 'User accountId is required. Please ensure your user has an accountId. You may need to run the seed script to update existing users.',
      });
    }

    if (!name || !phone) {
      return res.status(400).json({
        success: false,
        error: 'Name and phone are required',
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

    // Check if contact already exists for this account
    const existingContact = await Contact.findOne({
      accountId,
      phone,
    });

    if (existingContact) {
      return res.status(400).json({
        success: false,
        error: 'Contact with this phone already exists',
        contactId: existingContact.contactId,
      });
    }

    // Create contact
    let contact;
    try {
      contact = new Contact({
        accountId,
        name,
        phone,
      });
      await contact.save();
      console.log(`✅ Contact created: ${contact.contactId} - ${contact.name}`);
    } catch (contactError) {
      console.error('❌ Error creating contact:', contactError);
      return res.status(500).json({
        success: false,
        error: `Failed to create contact: ${contactError.message}`,
      });
    }

    // Create dialog in Chat3 with meta tags
    // For business contacts, we create a P2P-like dialog but with special meta tags
    const dialogName = name;
    
    // Create dialog with meta tags (Chat3 now supports passing meta tags during creation)
    const dialogResponse = await Chat3Client.createDialog({
      name: dialogName,
      createdBy: currentUserId,
      meta: {
        type: { value: 'personal_contact' },
        contactId: { value: contact.contactId },
      },
    });
    
    // Chat3Client.createDialog returns response.data, which may have structure:
    // { data: { dialogId: ... } } or { dialogId: ... }
    const dialogId = dialogResponse?.data?.dialogId || dialogResponse?.data?._id || dialogResponse?.dialogId || dialogResponse?._id;
    
    if (!dialogId) {
      // If dialog creation fails, delete the contact
      await Contact.deleteOne({ _id: contact._id });
      console.error('❌ Failed to create dialog for contact. Response:', JSON.stringify(dialogResponse, null, 2));
      return res.status(500).json({
        success: false,
        error: 'Failed to create dialog for contact: dialogId not found in response',
      });
    }

    console.log(`✅ Dialog created for contact: ${dialogId} with meta tags`);

    // Add current user as member
    try {
      await Chat3Client.addDialogMember(dialogId, currentUserId);
      console.log(`✅ Added user ${currentUserId} to dialog ${dialogId}`);
    } catch (memberError) {
      // If adding member fails, delete the dialog and contact
      try {
        await Chat3Client.deleteDialog(dialogId);
      } catch (deleteError) {
        console.error('Failed to cleanup dialog:', deleteError);
      }
      await Contact.deleteOne({ _id: contact._id });
      console.error('❌ Failed to add member to dialog:', memberError);
      return res.status(500).json({
        success: false,
        error: `Failed to add member to dialog: ${memberError.message}`,
      });
    }

    // Get full dialog details from Chat3
    const fullDialog = await Chat3Client.getDialog(dialogId);
    const fullDialogData = fullDialog.data || fullDialog;
    
    // Process dialog to get full details
    const processedDialog = await processP2PDialog(fullDialogData, req.user);

    return res.json({
      success: true,
      data: {
        contact: {
          contactId: contact.contactId,
          accountId: contact.accountId,
          name: contact.name,
          phone: contact.phone,
          createdAt: contact.createdAt,
        },
        dialog: {
          ...processedDialog,
          chatType: 'personal_contact',
        },
      },
    });
  } catch (error) {
    console.error('Error creating business contact:', error);
    console.error('Error stack:', error.stack);
    
    // If contact was created but dialog creation failed, try to clean up
    // Note: We can't easily track if contact was created here, but the error handler above should handle it
    
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to create business contact',
      details: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    });
  }
}

