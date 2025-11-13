import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Generate custom contactId in format: cnt_XXXXXXXXX
 * Where X is lowercase letter or digit (9 characters)
 */
function generateContactId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'cnt_';
  const randomBytes = crypto.randomBytes(9);
  
  for (let i = 0; i < 9; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  return result;
}

const contactSchema = new mongoose.Schema({
  accountId: {
    type: String,
    required: true,
    index: true,
    // Note: accountId is a custom string ID, not ObjectId, so no ref
  },
  contactId: {
    type: String,
    unique: true,
    index: true,
    match: /^cnt_[a-z0-9]{9}$/,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  phone: {
    type: String,
    required: true,
    match: /^79\d{9}$/,
    index: true,
  },
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Generate contactId before saving new contact
contactSchema.pre('save', async function(next) {
  if (this.isNew && !this.contactId) {
    let contactId;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      contactId = generateContactId();
      const existing = await mongoose.model('Contact').findOne({ contactId });
      
      if (!existing) {
        this.contactId = contactId;
        break;
      }
      
      attempts++;
    }
    
    if (!this.contactId) {
      return next(new Error('Failed to generate unique contactId'));
    }
  }
  
  this.updatedAt = new Date();
  next();
});

// Compound index: phone + accountId (contact can have same phone in different accounts)
contactSchema.index({ accountId: 1, phone: 1 });

const Contact = mongoose.model('Contact', contactSchema);

export default Contact;

