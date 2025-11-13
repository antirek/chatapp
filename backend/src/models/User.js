import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Generate custom userId in format: usr_XXXXXXXX
 * Where X is lowercase letter or digit (8 characters)
 */
function generateUserId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'usr_';
  const randomBytes = crypto.randomBytes(8);
  
  for (let i = 0; i < 8; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  return result;
}

const userSchema = new mongoose.Schema({
  accountId: {
    type: String,
    required: true,
    index: true,
    // Note: accountId is a custom string ID, not ObjectId, so no ref
  },
  userId: {
    type: String,
    unique: true,
    index: true,
    match: /^usr_[a-z0-9]{8}$/,
    // Not required here - generated in pre-save hook
  },
  phone: {
    type: String,
    required: true,
    match: /^79\d{9}$/,
    index: true,
  },
  // Compound unique index: phone + accountId (user can have same phone in different accounts)
  // Note: unique: true removed from phone field above
  name: {
    type: String,
    required: true,
    trim: true,
  },
  // SMS verification code
  verificationCode: {
    code: String,
    expiresAt: Date,
  },
  // Track when user was created
  createdAt: {
    type: Date,
    default: Date.now,
  },
  // Track last activity
  lastActiveAt: {
    type: Date,
    default: Date.now,
  },
});

// Compound unique index: phone + accountId (user can have same phone in different accounts)
userSchema.index({ accountId: 1, phone: 1 }, { unique: true });

// Generate userId before saving new user
userSchema.pre('save', async function(next) {
  if (this.isNew && !this.userId) {
    // Generate unique userId
    let userId;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      userId = generateUserId();
      const existing = await mongoose.model('User').findOne({ userId });
      
      if (!existing) {
        this.userId = userId;
        break;
      }
      
      attempts++;
    }
    
    if (!this.userId) {
      return next(new Error('Failed to generate unique userId'));
    }
  }
  
  this.lastActiveAt = new Date();
  next();
});

// Instance method to check if verification code is valid
userSchema.methods.isVerificationCodeValid = function(code) {
  if (!this.verificationCode || !this.verificationCode.code) {
    return false;
  }
  
  const isExpired = new Date() > this.verificationCode.expiresAt;
  const isMatch = this.verificationCode.code === code;
  
  return !isExpired && isMatch;
};

const User = mongoose.model('User', userSchema);

export default User;

