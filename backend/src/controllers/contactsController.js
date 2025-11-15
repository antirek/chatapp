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
        contactName: { value: name },
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

    // Add contact as member with memberType=contact
    try {
      await Chat3Client.addDialogMember(dialogId, contact.contactId);
      await Chat3Client.setMeta(
        'dialogMember',
        `${dialogId}:${contact.contactId}`,
        'memberType',
        { value: 'contact' }
      );
      console.log(`✅ Added contact ${contact.contactId} to dialog ${dialogId} with memberType=contact`);
    } catch (contactMemberError) {
      console.error('Failed to add contact as member:', contactMemberError);
      // Continue - we'll try to clean up if user addition also fails
    }

    // Add current user as member with memberType=user
    try {
      await Chat3Client.addDialogMember(dialogId, currentUserId);
      await Chat3Client.setMeta(
        'dialogMember',
        `${dialogId}:${currentUserId}`,
        'memberType',
        { value: 'user' }
      );
      console.log(`✅ Added user ${currentUserId} to dialog ${dialogId} with memberType=user`);
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

/**
 * Get business contact by ID
 */
export async function getContact(req, res) {
  try {
    const { contactId } = req.params;
    const accountId = req.user.accountId;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'User accountId is required',
      });
    }

    const contact = await Contact.findOne({
      contactId,
      accountId, // Ensure contact belongs to user's account
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    return res.json({
      success: true,
      data: {
        contactId: contact.contactId,
        accountId: contact.accountId,
        name: contact.name,
        phone: contact.phone,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      },
    });
  } catch (error) {
    console.error('Error getting contact:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get contact',
    });
  }
}

/**
 * Get list of business contacts with optional search filter
 */
export async function listContacts(req, res) {
  try {
    const accountId = req.user.accountId;
    const { search, page = 1, limit = 50 } = req.query;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'User accountId is required',
      });
    }

    // Build query
    const query = { accountId };

    // Add search filter if provided
    if (search && search.trim()) {
      const searchRegex = new RegExp(search.trim(), 'i');
      query.name = searchRegex;
    }

    // Calculate pagination
    const skip = (Number(page) - 1) * Number(limit);
    const parsedLimit = Number(limit);

    // Get contacts
    const contacts = await Contact.find(query)
      .sort({ name: 1 })
      .skip(skip)
      .limit(parsedLimit)
      .lean();

    // Get total count for pagination
    const total = await Contact.countDocuments(query);

    return res.json({
      success: true,
      data: contacts.map(contact => ({
        contactId: contact.contactId,
        accountId: contact.accountId,
        name: contact.name,
        phone: contact.phone,
        createdAt: contact.createdAt,
        updatedAt: contact.updatedAt,
      })),
      pagination: {
        page: Number(page),
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error('Error listing contacts:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to list contacts',
    });
  }
}

/**
 * Get or create dialog for a business contact
 */
export async function getOrCreateContactDialog(req, res) {
  try {
    const { contactId } = req.params;
    const currentUserId = req.user.userId;
    const accountId = req.user.accountId;

    if (!accountId) {
      return res.status(400).json({
        success: false,
        error: 'User accountId is required',
      });
    }

    // Find contact
    const contact = await Contact.findOne({
      contactId,
      accountId,
    });

    if (!contact) {
      return res.status(404).json({
        success: false,
        error: 'Contact not found',
      });
    }

    // Try to find existing dialog by contactId meta tag
    try {
      // Search for dialogs with contactId meta tag
      // First, get all user dialogs and filter client-side
      const dialogsResponse = await Chat3Client.getUserDialogs(currentUserId, {
        page: 1,
        limit: 100, // Get more dialogs to find the one with contactId
      });

      const allDialogs = dialogsResponse?.data || dialogsResponse || [];
      
      // Filter dialogs by contactId meta tag
      const dialogs = allDialogs.filter(dialog => {
        const dialogContactId = dialog.meta?.contactId?.value || dialog.meta?.contactId;
        return dialogContactId === contactId;
      });
      
      if (dialogs.length > 0) {
        // Dialog exists, check if user is a member
        const existingDialog = dialogs[0];
        const dialogId = existingDialog.dialogId || existingDialog._id;

        // Check if user is already a member
        try {
          const membersResponse = await Chat3Client.getDialogMembers(dialogId, { limit: 100 });
          const members = membersResponse?.data || membersResponse || [];
          const isMember = Array.isArray(members) && members.some(m => (m.userId || m._id) === currentUserId);

          if (!isMember) {
            // Add user to dialog with memberType=user
            await Chat3Client.addDialogMember(dialogId, currentUserId);
            await Chat3Client.setMeta(
              'dialogMember',
              `${dialogId}:${currentUserId}`,
              'memberType',
              { value: 'user' }
            );
            console.log(`✅ Added user ${currentUserId} to existing dialog ${dialogId} with memberType=user`);
          }

          // Get full dialog details
          const fullDialog = await Chat3Client.getDialog(dialogId);
          const fullDialogData = fullDialog.data || fullDialog;
          
          // Process dialog
          const processedDialog = await processP2PDialog(fullDialogData, req.user);

          return res.json({
            success: true,
            data: {
              dialog: {
                ...processedDialog,
                chatType: 'personal_contact',
              },
              isNew: false,
            },
          });
        } catch (memberError) {
          console.error('Error checking/adding member:', memberError);
          // Continue to create new dialog if member check fails
        }
      }
    } catch (searchError) {
      console.warn('Error searching for existing dialog:', searchError);
      // Continue to create new dialog if search fails
    }

    // Dialog doesn't exist or search failed, create new one
    const dialogName = contact.name;
    
    const dialogResponse = await Chat3Client.createDialog({
      name: dialogName,
      createdBy: currentUserId,
      meta: {
        type: { value: 'personal_contact' },
        contactId: { value: contact.contactId },
      },
    });
    
    const dialogId = dialogResponse?.data?.dialogId || dialogResponse?.data?._id || dialogResponse?.dialogId || dialogResponse?._id;
    
    if (!dialogId) {
      return res.status(500).json({
        success: false,
        error: 'Failed to create dialog: dialogId not found in response',
      });
    }

    // Add contact as member with memberType=contact
    try {
      await Chat3Client.addDialogMember(dialogId, contact.contactId);
      await Chat3Client.setMeta(
        'dialogMember',
        `${dialogId}:${contact.contactId}`,
        'memberType',
        { value: 'contact' }
      );
      console.log(`✅ Added contact ${contact.contactId} to dialog ${dialogId} with memberType=contact`);
    } catch (contactMemberError) {
      console.error('Failed to add contact as member:', contactMemberError);
      // Continue - we'll try to clean up if user addition also fails
    }

    // Add current user as member with memberType=user
    await Chat3Client.addDialogMember(dialogId, currentUserId);
    await Chat3Client.setMeta(
      'dialogMember',
      `${dialogId}:${currentUserId}`,
      'memberType',
      { value: 'user' }
    );
    console.log(`✅ Created dialog ${dialogId} and added user ${currentUserId} with memberType=user`);

    // Get full dialog details
    const fullDialog = await Chat3Client.getDialog(dialogId);
    const fullDialogData = fullDialog.data || fullDialog;
    
    // Process dialog
    const processedDialog = await processP2PDialog(fullDialogData, req.user);

    return res.json({
      success: true,
      data: {
        dialog: {
          ...processedDialog,
          chatType: 'personal_contact',
        },
        isNew: true,
      },
    });
  } catch (error) {
    console.error('Error getting or creating contact dialog:', error);
    return res.status(500).json({
      success: false,
      error: error.message || 'Failed to get or create contact dialog',
    });
  }
}
