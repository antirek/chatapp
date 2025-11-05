import amqp from 'amqplib';
import config from '../config/index.js';

/**
 * RabbitMQ Service for consuming Chat3 updates
 * Subscribes to chat3_updates exchange and forwards updates to WebSocket clients
 */
class RabbitMQService {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.isConnected = false;
    this.subscribers = new Map(); // userId -> callback
    this.userQueues = new Map(); // userId -> queueName
  }

  /**
   * Connect to RabbitMQ
   */
  async connect() {
    try {
      console.log('🔌 Connecting to RabbitMQ:', config.rabbitmq.url);
      
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      
      // Verify exchange exists
      await this.channel.checkExchange(config.rabbitmq.updatesExchange);
      
      this.isConnected = true;
      console.log('✅ RabbitMQ connected successfully');
      console.log(`   Exchange: ${config.rabbitmq.updatesExchange}`);
      
      // Handle connection errors
      this.connection.on('error', (err) => {
        console.error('❌ RabbitMQ connection error:', err.message);
        this.isConnected = false;
      });
      
      this.connection.on('close', () => {
        console.log('⚠️  RabbitMQ connection closed');
        this.isConnected = false;
        
        // Try to reconnect after 5 seconds
        setTimeout(() => this.reconnect(), 5000);
      });
      
    } catch (error) {
      console.error('❌ Failed to connect to RabbitMQ:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Reconnect to RabbitMQ
   */
  async reconnect() {
    if (this.isConnected) return;
    
    console.log('🔄 Attempting to reconnect to RabbitMQ...');
    
    try {
      await this.connect();
      
      // Re-subscribe all users
      const userIds = Array.from(this.subscribers.keys());
      console.log(`🔄 Re-subscribing ${userIds.length} users...`);
      
      for (const userId of userIds) {
        const callback = this.subscribers.get(userId);
        await this.subscribeUser(userId, callback);
      }
      
      console.log('✅ Reconnection successful');
    } catch (error) {
      console.error('❌ Reconnection failed:', error.message);
      // Will retry again due to connection.on('close') handler
    }
  }

  /**
   * Subscribe user to their updates
   * Creates a personal queue and binds it to chat3_updates exchange
   * 
   * @param {string} userId - User ID (usr_XXXXXXXX)
   * @param {function} callback - Function to call when update arrives
   */
  async subscribeUser(userId, callback) {
    if (!this.isConnected) {
      throw new Error('RabbitMQ not connected');
    }

    try {
      // Create user-specific queue (auto-delete when user disconnects)
      const queueName = `chatpapp_user_${userId}_updates`;
      const queue = await this.channel.assertQueue(queueName, {
        durable: false,
        autoDelete: true,
        exclusive: false,
      });

      // Bind queue to exchange with routing key: user.{userId}.*
      const routingKey = `user.${userId}.*`;
      await this.channel.bindQueue(queue.queue, config.rabbitmq.updatesExchange, routingKey);

      console.log(`📬 User ${userId} subscribed to updates`);
      console.log(`   Queue: ${queue.queue}`);
      console.log(`   Routing key: ${routingKey}`);

      // Store subscriber info
      this.subscribers.set(userId, callback);
      this.userQueues.set(userId, queue.queue);

      // Start consuming messages
      await this.channel.consume(queue.queue, async (msg) => {
        if (!msg) return;

        try {
          const update = JSON.parse(msg.content.toString());
          
          // Log received update
          if (config.nodeEnv === 'development') {
            console.log(`📨 Update received for ${userId}:`, {
              eventType: update.eventType,
              dialogId: update.dialogId,
              entityId: update.entityId,
            });
          }

          // Call callback to forward update to WebSocket
          await callback(update);

          // Acknowledge message
          this.channel.ack(msg);
        } catch (error) {
          console.error(`❌ Error processing update for ${userId}:`, error.message);
          // Reject and requeue message
          this.channel.nack(msg, false, true);
        }
      }, {
        noAck: false,
      });

    } catch (error) {
      console.error(`❌ Failed to subscribe user ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Unsubscribe user from updates
   * Deletes user's queue
   * 
   * @param {string} userId - User ID
   */
  async unsubscribeUser(userId) {
    if (!this.isConnected) return;

    try {
      const queueName = this.userQueues.get(userId);
      
      if (queueName) {
        // Cancel consumer and delete queue
        await this.channel.deleteQueue(queueName);
        console.log(`📭 User ${userId} unsubscribed from updates`);
      }

      // Remove from subscribers
      this.subscribers.delete(userId);
      this.userQueues.delete(userId);

    } catch (error) {
      console.error(`❌ Error unsubscribing user ${userId}:`, error.message);
    }
  }

  /**
   * Check if user is subscribed
   * 
   * @param {string} userId - User ID
   * @returns {boolean}
   */
  isUserSubscribed(userId) {
    return this.subscribers.has(userId);
  }

  /**
   * Get number of subscribed users
   * 
   * @returns {number}
   */
  getSubscribersCount() {
    return this.subscribers.size;
  }

  /**
   * Close connection to RabbitMQ
   */
  async close() {
    try {
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }
      
      this.isConnected = false;
      this.subscribers.clear();
      this.userQueues.clear();
      
      console.log('👋 RabbitMQ connection closed');
    } catch (error) {
      console.error('❌ Error closing RabbitMQ connection:', error.message);
    }
  }
}

export default new RabbitMQService();

