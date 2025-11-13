import mongoose from 'mongoose';
import config from '../src/config/index.js';
import User from '../src/models/User.js';

async function checkAccountId() {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ Connected to MongoDB');

    const usersWithoutAccountId = await User.countDocuments({ accountId: { $exists: false } });
    const totalUsers = await User.countDocuments();
    const sampleUsers = await User.find().limit(5).select('userId accountId name phone').lean();

    console.log('\n📊 Statistics:');
    console.log(`   Total users: ${totalUsers}`);
    console.log(`   Users without accountId: ${usersWithoutAccountId}`);
    
    console.log('\n📋 Sample users:');
    sampleUsers.forEach((user, index) => {
      console.log(`   ${index + 1}. ${user.userId} - accountId: ${user.accountId || 'MISSING'} - ${user.name}`);
    });

    if (usersWithoutAccountId > 0) {
      console.log(`\n⚠️  Warning: ${usersWithoutAccountId} users are missing accountId!`);
      console.log('   Run: node scripts/seed-models.mjs to fix this');
    } else {
      console.log('\n✅ All users have accountId');
    }

    await mongoose.connection.close();
    console.log('\n👋 MongoDB connection closed');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  }
}

checkAccountId();

