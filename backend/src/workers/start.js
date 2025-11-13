import rabbitmqConsumer from '../services/rabbitmqConsumer.js';
import messageSenderWorker from './messageSender.js';
import { connectDB } from '../db/index.js';
import config from '../config/index.js';

/**
 * Start Message Sender Worker as standalone process
 */
async function startWorker() {
  try {
    console.log('🚀 Starting Message Sender Worker...');
    console.log(`🌍 Environment: ${config.nodeEnv}`);
    
    // Connect to MongoDB
    console.log('📦 Connecting to MongoDB...');
    await connectDB();
    console.log('✅ MongoDB connected');

    // Connect to RabbitMQ
    console.log('🔌 Connecting to RabbitMQ...');
    await rabbitmqConsumer.connect();
    console.log('✅ RabbitMQ connected');

    // Initialize message sender worker
    console.log('📤 Initializing Message Sender Worker...');
    await messageSenderWorker.initialize(rabbitmqConsumer);
    console.log('✅ Message Sender Worker initialized');

    console.log('\n✨ Message Sender Worker is running and ready to process messages!\n');

    // Periodic cleanup of processed messages cache
    setInterval(() => {
      messageSenderWorker.cleanupProcessedCache();
    }, 60000); // Every minute

  } catch (error) {
    console.error('❌ Failed to start Message Sender Worker:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  try {
    // Close RabbitMQ connection
    await rabbitmqConsumer.close();
    console.log('✅ RabbitMQ closed');
    
    // Close MongoDB connection
    const mongoose = (await import('mongoose')).default;
    await mongoose.connection.close();
    console.log('✅ MongoDB closed');
    
    console.log('👋 Message Sender Worker stopped');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught errors
process.on('unhandledRejection', (error) => {
  console.error('❌ Unhandled promise rejection:', error);
});

process.on('uncaughtException', (error) => {
  console.error('❌ Uncaught exception:', error);
  gracefulShutdown('UNCAUGHT_EXCEPTION');
});

// Start worker
startWorker();

