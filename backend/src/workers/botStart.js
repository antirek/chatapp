import botWorker from './botWorker.js';

/**
 * Start Bot Worker as standalone process
 */
async function startBotWorker() {
  try {
    console.log('🚀 Starting Bot Worker...');
    console.log(`🌍 Environment: ${process.env.NODE_ENV || 'development'}`);
    
    // Initialize bot worker
    await botWorker.initialize();

    // Periodic cleanup of processed messages cache
    setInterval(() => {
      botWorker.cleanupProcessedCache();
    }, 60000); // Every minute

    // Periodic reload of active bots (every 5 minutes)
    setInterval(async () => {
      await botWorker.reloadBots();
    }, 300000); // Every 5 minutes

  } catch (error) {
    console.error('❌ Failed to start Bot Worker:', error);
    console.error('Error stack:', error.stack);
    process.exit(1);
  }
}

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Shutting down gracefully...`);
  
  try {
    // Close RabbitMQ connection
    if (botWorker.connection) {
      await botWorker.channel?.close();
      await botWorker.connection.close();
      console.log('✅ RabbitMQ closed');
    }
    
    // Close MongoDB connection
    const mongoose = (await import('mongoose')).default;
    await mongoose.connection.close();
    console.log('✅ MongoDB closed');
    
    console.log('👋 Bot Worker stopped');
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
startBotWorker();

