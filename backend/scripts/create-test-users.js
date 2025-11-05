import mongoose from 'mongoose';
import config from '../src/config/index.js';
import User from '../src/models/User.js';

// Test users data
const testUsers = [
  { phone: '79111111111', name: 'Александр Петров' },
  { phone: '79222222222', name: 'Мария Иванова' },
  { phone: '79333333333', name: 'Дмитрий Смирнов' },
  { phone: '79444444444', name: 'Елена Козлова' },
  { phone: '79555555555', name: 'Сергей Новиков' },
  { phone: '79666666666', name: 'Ольга Морозова' },
  { phone: '79777777777', name: 'Андрей Волков' },
];

async function createTestUsers() {
  try {
    // Connect to MongoDB
    console.log('🔌 Connecting to MongoDB...');
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ Connected to MongoDB\n');

    console.log('👥 Creating test users...\n');

    for (const userData of testUsers) {
      try {
        // Check if user already exists
        const existing = await User.findOne({ phone: userData.phone });
        
        if (existing) {
          console.log(`⏭️  User ${userData.name} (${userData.phone}) already exists - skipping`);
          continue;
        }

        // Generate userId
        const userId = 'usr_' + Math.random().toString(36).substring(2, 10);

        // Create user
        const user = new User({
          userId,
          phone: userData.phone,
          name: userData.name,
          verificationCode: {
            code: '1234',
            expiresAt: new Date(Date.now() + 5 * 60 * 1000) // 5 minutes
          },
          lastActiveAt: new Date()
        });

        await user.save();
        console.log(`✅ Created: ${userData.name} (${userData.phone}) → userId: ${userId}`);
      } catch (error) {
        console.error(`❌ Failed to create ${userData.name}:`, error.message);
      }
    }

    console.log('\n🎉 Test users creation completed!');
    console.log('\n📊 Summary:');
    
    const totalUsers = await User.countDocuments();
    console.log(`Total users in database: ${totalUsers}`);

    // List all users
    console.log('\n👥 All users:');
    const allUsers = await User.find().select('userId name phone').sort({ createdAt: -1 });
    allUsers.forEach((user, index) => {
      console.log(`${index + 1}. ${user.name} - ${user.phone} (${user.userId})`);
    });

    console.log('\n✨ Ready to use! All test users have verification code: 1234');
    
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await mongoose.connection.close();
    console.log('\n👋 MongoDB connection closed');
  }
}

createTestUsers();

