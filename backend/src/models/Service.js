import mongoose from 'mongoose';
import crypto from 'crypto';

function generateServiceId() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let result = 'srv_';
  const randomBytes = crypto.randomBytes(6); // 6 chars for serviceId
  for (let i = 0; i < 6; i++) {
    result += chars[randomBytes[i] % chars.length];
  }
  return result;
}

const serviceSchema = new mongoose.Schema({
  serviceId: {
    type: String,
    unique: true,
    index: true,
    match: /^srv_[a-z0-9]{6}$/,
  },
  type: {
    type: String,
    required: true,
    enum: ['whatsapp', 'telegram', 'viber', 'sms'],
  },
  apiUrl: {
    type: String,
    required: true,
    trim: true,
    validate: {
      validator: function(v) {
        try {
          new URL(v);
          return true;
        } catch {
          return false;
        }
      },
      message: 'apiUrl must be a valid URL',
    },
  },
  isActive: {
    type: Boolean,
    default: true,
  },
  description: {
    type: String,
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

serviceSchema.index({ type: 1 }, { unique: false });

serviceSchema.pre('save', async function(next) {
  if (this.isNew && !this.serviceId) {
    let serviceId;
    let attempts = 0;
    const maxAttempts = 10;
    while (attempts < maxAttempts) {
      serviceId = generateServiceId();
      const existing = await mongoose.model('Service').findOne({ serviceId });
      if (!existing) {
        this.serviceId = serviceId;
        break;
      }
      attempts++;
    }
    if (!this.serviceId) {
      return next(new Error('Failed to generate unique serviceId'));
    }
  }
  this.updatedAt = new Date();
  next();
});

const Service = mongoose.model('Service', serviceSchema);
export default Service;

