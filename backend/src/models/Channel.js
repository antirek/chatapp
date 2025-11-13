import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Generate custom channelId in format: chn_XXXXXX
 * Where X is lowercase letter or digit (6 characters)
 */
function generateChannelId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'chn_';
  const randomBytes = crypto.randomBytes(6);
  
  for (let i = 0; i < 6; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  return result;
}

const channelSchema = new mongoose.Schema({
  accountId: {
    type: String,
    required: true,
    index: true,
    // Note: accountId is a custom string ID, not ObjectId, so no ref
  },
  channelId: {
    type: String,
    unique: true,
    index: true,
    match: /^chn_[a-z0-9]{6}$/,
  },
  type: {
    type: String,
    required: true,
    enum: ['whatsapp', 'telegram', 'viber', 'sms'],
    index: true,
  },
  instanceId: {
    type: String,
    required: true,
    trim: true,
  },
  token: {
    type: String,
    required: true,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
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

// Generate channelId before saving new channel
channelSchema.pre('save', async function(next) {
  if (this.isNew && !this.channelId) {
    let channelId;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      channelId = generateChannelId();
      const existing = await mongoose.model('Channel').findOne({ channelId });
      
      if (!existing) {
        this.channelId = channelId;
        break;
      }
      
      attempts++;
    }
    
    if (!this.channelId) {
      return next(new Error('Failed to generate unique channelId'));
    }
  }
  
  this.updatedAt = new Date();
  next();
});

// Compound index: accountId + type (for filtering channels by account and type)
channelSchema.index({ accountId: 1, type: 1 });

const Channel = mongoose.model('Channel', channelSchema);

export default Channel;

