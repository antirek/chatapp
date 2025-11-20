import mongoose from 'mongoose';
import crypto from 'crypto';

/**
 * Generate custom botId in format: bot_XXXXXXXX
 * Where X is lowercase letter or digit (8 characters)
 */
function generateBotId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'bot_';
  const randomBytes = crypto.randomBytes(8);
  
  for (let i = 0; i < 8; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  
  return result;
}

const botSchema = new mongoose.Schema({
  botId: {
    type: String,
    unique: true,
    index: true,
    match: /^bot_[a-z0-9]{8}$/,
  },
  name: {
    type: String,
    required: true,
    trim: true,
  },
  type: {
    type: String,
    required: true,
    enum: ['system', 'custom'],
    default: 'system',
    index: true,
  },
  description: {
    type: String,
    trim: true,
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true,
  },
  // Bot handler type (echo, command, ai, etc.)
  handler: {
    type: String,
    required: true,
    enum: ['echo', 'command', 'ai'],
    default: 'echo',
  },
  // Settings specific to bot type
  settings: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  // Bot commands (array of command objects)
  commands: [{
    name: {
      type: String,
      required: true,
      trim: true,
    },
    description: {
      type: String,
      trim: true,
    },
    usage: {
      type: String,
      trim: true,
    },
  }],
  createdAt: {
    type: Date,
    default: Date.now,
  },
  updatedAt: {
    type: Date,
    default: Date.now,
  },
});

// Generate botId before saving new bot
botSchema.pre('save', async function(next) {
  if (this.isNew && !this.botId) {
    // Generate unique botId
    let botId;
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      botId = generateBotId();
      const existing = await mongoose.model('Bot').findOne({ botId });
      
      if (!existing) {
        this.botId = botId;
        break;
      }
      
      attempts++;
    }
    
    if (!this.botId) {
      return next(new Error('Failed to generate unique botId'));
    }
  }
  
  this.updatedAt = new Date();
  next();
});

const Bot = mongoose.model('Bot', botSchema);

export default Bot;

