import mongoose from 'mongoose';
import config from '../config/index.js';

/**
 * Connect to MongoDB
 */
export async function connectDB() {
  try {
    await mongoose.connect(config.mongodb.uri);
    console.log('✅ MongoDB connected successfully');
  } catch (error) {
    console.error('❌ MongoDB connection error:', error.message);
    process.exit(1);
  }

  // Handle connection events
  mongoose.connection.on('error', (err) => {
    console.error('MongoDB error:', err);
  });

  mongoose.connection.on('disconnected', () => {
    console.log('MongoDB disconnected');
  });

  // Note: Graceful shutdown handled in server.js
}

