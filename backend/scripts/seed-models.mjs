#!/usr/bin/env node

/**
 * Script to seed models with initial data
 * - Creates one Account
 * - Updates all Users with accountId
 * - Creates one Contact
 * - Creates one Channel
 */

import mongoose from 'mongoose';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
dotenv.config({ path: join(__dirname, '..', '.env') });

// Import models
import Account from '../src/models/Account.js';
import User from '../src/models/User.js';
import Contact from '../src/models/Contact.js';
import Channel from '../src/models/Channel.js';

async function seedData() {
  try {
    // Connect to MongoDB
    const mongoUri = process.env.MONGODB_URI || 'mongodb://localhost:27017/chatpapp';
    await mongoose.connect(mongoUri);
    console.log('✅ Connected to MongoDB');

    // 1. Create Account
    console.log('\n📦 Creating Account...');
    let account = await Account.findOne();
    
    if (!account) {
      account = new Account({
        name: 'Основной аккаунт',
      });
      await account.save();
      console.log(`✅ Account created: ${account.accountId} - ${account.name}`);
    } else {
      console.log(`ℹ️  Account already exists: ${account.accountId} - ${account.name}`);
    }

    const accountId = account.accountId;

    // 2. Update all Users with accountId
    console.log('\n👥 Updating Users...');
    const usersWithoutAccount = await User.find({ accountId: { $exists: false } });
    const usersWithWrongAccount = await User.find({ accountId: { $ne: accountId } });
    const allUsersToUpdate = [...usersWithoutAccount, ...usersWithWrongAccount];

    if (allUsersToUpdate.length > 0) {
      const updateResult = await User.updateMany(
        { $or: [{ accountId: { $exists: false } }, { accountId: { $ne: accountId } }] },
        { $set: { accountId } }
      );
      console.log(`✅ Updated ${updateResult.modifiedCount} users with accountId: ${accountId}`);
    } else {
      console.log('ℹ️  All users already have correct accountId');
    }

    // 3. Create Contact
    console.log('\n📇 Creating Contact...');
    let contact = await Contact.findOne();
    
    if (!contact) {
      contact = new Contact({
        accountId,
        name: 'Тестовый контакт',
        phone: '79991234567',
      });
      await contact.save();
      console.log(`✅ Contact created: ${contact.contactId} - ${contact.name} (${contact.phone})`);
    } else {
      console.log(`ℹ️  Contact already exists: ${contact.contactId} - ${contact.name}`);
    }

    // 4. Create Channel
    console.log('\n📡 Creating Channel...');
    let channel = await Channel.findOne();
    
    if (!channel) {
      channel = new Channel({
        accountId,
        type: 'whatsapp',
        instanceId: 'test-instance-001',
        token: 'test-token-12345',
        isActive: true,
      });
      await channel.save();
      console.log(`✅ Channel created: ${channel.channelId} - ${channel.type} (${channel.instanceId})`);
    } else {
      console.log(`ℹ️  Channel already exists: ${channel.channelId} - ${channel.type}`);
    }

    // Summary
    console.log('\n📊 Summary:');
    const accountCount = await Account.countDocuments();
    const userCount = await User.countDocuments();
    const contactCount = await Contact.countDocuments();
    const channelCount = await Channel.countDocuments();
    
    console.log(`   Accounts: ${accountCount}`);
    console.log(`   Users: ${userCount}`);
    console.log(`   Contacts: ${contactCount}`);
    console.log(`   Channels: ${channelCount}`);

    console.log('\n✅ Seeding completed successfully!');
  } catch (error) {
    console.error('❌ Error seeding data:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 MongoDB connection closed');
  }
}

// Run the script
seedData();

