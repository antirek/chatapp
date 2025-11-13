import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Generate custom accountId in format: acc_XXXXXX
 * Where X is lowercase letter or digit (6 characters)
 */
function generateAccountId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'acc_';
  const randomBytes = crypto.randomBytes(6);
  
  for (let i = 0; i < 6; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  return result;
}

const accountSchema = new mongoose.Schema({
  accountId: {
    type: String,
    unique: true,
    index: true,
    match: /^acc_[a-z0-9]{6}$/,
  },
  name: {
    type: String,
    required: true,
    trim: true,
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

// Generate accountId before saving new account
accountSchema.pre('save', async function(next) {
  if (this.isNew && !this.accountId) {
    let accountId;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      accountId = generateAccountId();
      const existing = await mongoose.model('Account').findOne({ accountId });
      
      if (!existing) {
        this.accountId = accountId;
        break;
      }
      
      attempts++;
    }
    
    if (!this.accountId) {
      return next(new Error('Failed to generate unique accountId'));
    }
  }
  
  this.updatedAt = new Date();
  next();
});

const Account = mongoose.model('Account', accountSchema);

export default Account;

