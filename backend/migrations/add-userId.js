/**
 * Migration: Add custom userId to existing users
 * 
 * Run: node migrations/add-userId.js
 */

import mongoose from 'mongoose';
import crypto from 'crypto';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

/**
 * Generate custom userId in format: usr_XXXXXXXX
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

async function migrate() {
  try {
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatpapp';
    
    console.log('🔌 Connecting to MongoDB:', mongoUri);
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');
    
    // Get User model
    const User = mongoose.model('User', new mongoose.Schema({
      userId: String,
      phone: String,
      name: String,
    }));
    
    // Find all users without userId
    const usersWithoutId = await User.find({ 
      $or: [
        { userId: { $exists: false } },
        { userId: null },
        { userId: '' }
      ]
    });
    
    console.log(`\n📊 Found ${usersWithoutId.length} users without userId`);
    
    if (usersWithoutId.length === 0) {
      console.log('✨ No migration needed. All users already have userId.');
      await mongoose.disconnect();
      return;
    }
    
    console.log('\n🔄 Starting migration...\n');
    
    let successCount = 0;
    let failCount = 0;
    
    for (const user of usersWithoutId) {
      let userId;
      let attempts = 0;
      const maxAttempts = 10;
      
      // Generate unique userId
      while (attempts < maxAttempts) {
        userId = generateUserId();
        const existing = await User.findOne({ userId });
        
        if (!existing) {
          // Update user
          await User.updateOne(
            { _id: user._id },
            { $set: { userId } }
          );
          
          console.log(`✅ ${user.phone} -> ${userId}`);
          successCount++;
          break;
        }
        
        attempts++;
      }
      
      if (attempts >= maxAttempts) {
        console.error(`❌ Failed to generate unique userId for ${user.phone}`);
        failCount++;
      }
    }
    
    console.log('\n📈 Migration Summary:');
    console.log(`   ✅ Success: ${successCount}`);
    console.log(`   ❌ Failed: ${failCount}`);
    console.log(`   📊 Total: ${usersWithoutId.length}`);
    
    // Verify all users now have userId
    const stillWithoutId = await User.countDocuments({ 
      $or: [
        { userId: { $exists: false } },
        { userId: null },
        { userId: '' }
      ]
    });
    
    if (stillWithoutId === 0) {
      console.log('\n✨ Migration completed successfully! All users have userId.');
    } else {
      console.warn(`\n⚠️  Warning: ${stillWithoutId} users still without userId`);
    }
    
    console.log('\n🔌 Disconnecting from MongoDB...');
    await mongoose.disconnect();
    console.log('✅ Done!\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run migration
migrate();

