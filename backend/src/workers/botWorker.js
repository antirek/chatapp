import amqp from 'amqplib';
import botService from '../services/BotService.js';
import { connectDB } from '../db/index.js';
import config from '../config/index.js';
import { normalizeChat3Update } from '../utils/updateNormalizer.js';

/**
 * Bot Worker
 * Processes messages for bots and sends responses
 */
class BotWorker {
  constructor() {
    this.isProcessing = false;
    this.processedMessages = new Set(); // Track processed messages to avoid duplicates
    this.botIds = new Set(); // Track active bot IDs
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
  }

  /**
   * Initialize worker
   */
  async initialize() {
    try {
      console.log('🤖 Bot Worker: Initializing...');
      
      // Connect to MongoDB
      console.log('📦 Connecting to MongoDB...');
      await connectDB();
      console.log('✅ MongoDB connected');

      // Initialize system bots
      console.log('🤖 Initializing system bots...');
      await botService.initializeSystemBots();
      
      // Load active bots
      const bots = await botService.getAllActiveBots();
      this.botIds = new Set(bots.map(bot => bot.botId));
      console.log(`✅ Loaded ${this.botIds.size} active bot(s):`, Array.from(this.botIds));

      // Connect to RabbitMQ
      console.log('🔌 Connecting to RabbitMQ...');
      await this.connectRabbitMQ();
      console.log('✅ RabbitMQ connected');

      // Create global queue for bot updates
      await this.createBotQueue();

      console.log('\n✨ Bot Worker is running and ready to process bot messages!\n');
    } catch (error) {
      console.error('❌ Failed to initialize Bot Worker:', error);
      throw error;
    }
  }

  /**
   * Connect to RabbitMQ
   */
  async connectRabbitMQ() {
    try {
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      
      // Ensure exchange exists
      await this.channel.assertExchange(
        config.rabbitmq.updatesExchange,
        'topic',
        { durable: true }
      );

      this.isConnected = true;

      // Handle connection errors
      this.connection.on('error', (err) => {
        console.error('❌ RabbitMQ connection error:', err.message);
        this.isConnected = false;
      });

      this.connection.on('close', () => {
        console.log('⚠️  RabbitMQ connection closed');
        this.isConnected = false;
      });
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Create global queue for bot updates
   */
  async createBotQueue() {
    if (!this.isConnected) {
      throw new Error('RabbitMQ not connected');
    }

    try {
      const queueName = 'chatpapp_bot_worker';

      // Create durable queue for bot worker
      await this.channel.assertQueue(queueName, {
        durable: true,
        autoDelete: false,
        exclusive: false,
      });

      // Bind to exchange with routing key for all bot events
      // Pattern: user.bot.# - matches all events for all bots
      await this.channel.bindQueue(
        queueName,
        config.rabbitmq.updatesExchange,
        'user.bot.#' // Matches all events for all bots
      );

      console.log(`📤 Created bot worker queue: ${queueName}`);
      console.log(`   Routing: user.bot.# (all bots)`);

      // Start consuming messages for bot worker
      const { consumerTag } = await this.channel.consume(
        queueName,
        async (msg) => {
          if (msg) {
            try {
              const update = JSON.parse(msg.content.toString());
              
              // Process message through bot worker
              await this.processMessage(update);

              // Acknowledge message
              this.channel.ack(msg);
            } catch (error) {
              console.error('❌ Error in bot worker:', error.message);
              // Reject and requeue message (will retry)
              this.channel.nack(msg, false, true);
            }
          }
        },
        { noAck: false }
      );

      console.log('✅ Bot Worker queue created and consuming');
    } catch (error) {
      console.error('❌ Failed to create bot worker queue:', error.message);
      throw error;
    }
  }

  /**
   * Process message update for bots
   */
  async processMessage(update) {
    const normalizedUpdate = normalizeChat3Update(update);
    const envelope = normalizedUpdate?.data || {};
    const eventType = normalizedUpdate?.eventType;

    try {
      // Only process message.create events
      if (eventType !== 'message.create') {
        return;
      }

      // Check if update is for a bot
      const userId = normalizedUpdate.userId;
      if (!userId || !userId.startsWith('bot_')) {
        // Not for a bot, skip
        return;
      }

      // Check if this bot is active
      if (!this.botIds.has(userId)) {
        console.log(`⏭️  Bot ${userId} is not active`);
        return;
      }

      const message = envelope.message;
      if (!message) {
        console.log('⏭️  No message data in update');
        return;
      }

      const messageId = message.messageId || message._id;
      if (!messageId) {
        console.log('⏭️  No messageId found in message');
        return;
      }

      // Avoid processing the same message twice
      if (this.processedMessages.has(messageId)) {
        console.log(`⏭️  Message ${messageId} already processed, skipping`);
        return;
      }

      // Check if this is a message TO the bot (not FROM the bot)
      const senderId = message.senderId;
      if (!senderId || senderId.startsWith('bot_')) {
        // Message is from a bot, skip (don't respond to bot messages)
        console.log(`⏭️  Message ${messageId} is from a bot (senderId: ${senderId}), skipping`);
        return;
      }

      // Skip system messages
      if (senderId === 'system' || (message.type && (message.type === 'system' || message.type.startsWith('system.')))) {
        console.log(`⏭️  Message ${messageId} is a system message (senderId: ${senderId}, type: ${message.type}), skipping`);
        return;
      }

      // Mark message as processed
      this.processedMessages.add(messageId);

      console.log(`\n🤖 [START] Processing message ${messageId} for bot ${userId}`);
      console.log('📋 Message data:', JSON.stringify({
        messageId,
        senderId,
        dialogId: message.dialogId,
        type: message.type,
        content: message.content?.substring(0, 100) + (message.content?.length > 100 ? '...' : ''),
      }, null, 2));

      // Process message through bot service
      await botService.processMessage(userId, update);

      console.log(`✅ [END] Processing message ${messageId} for bot ${userId} - SUCCESS\n`);
    } catch (error) {
      console.error('❌ Error in processMessage:', error.message);
      console.error('Error stack:', error.stack);
    }
  }

  /**
   * Clean up processed messages cache (periodic cleanup)
   */
  cleanupProcessedCache() {
    // Keep only last 1000 processed message IDs
    if (this.processedMessages.size > 1000) {
      const array = Array.from(this.processedMessages);
      this.processedMessages = new Set(array.slice(-1000));
    }
  }

  /**
   * Reload active bots
   */
  async reloadBots() {
    try {
      const bots = await botService.getAllActiveBots();
      this.botIds = new Set(bots.map(bot => bot.botId));
      console.log(`🔄 Reloaded ${this.botIds.size} active bot(s):`, Array.from(this.botIds));
    } catch (error) {
      console.error('❌ Error reloading bots:', error.message);
    }
  }
}

// Create singleton instance
const botWorker = new BotWorker();

export default botWorker;

