import amqp from 'amqplib';
import config from '../config/index.js';
import messageSenderWorker from '../workers/messageSender.js';
import { extractUserType, generateUserRoutingKey } from '../utils/userTypeExtractor.js';
import Chat3Client from './Chat3Client.js';

/**
 * RabbitMQ Consumer для получения Updates от Chat3
 * Создает персональные очереди для каждого подключенного пользователя
 */
class RabbitMQConsumer {
  constructor() {
    this.connection = null;
    this.channel = null;
    this.userQueues = new Map(); // userId -> { queueName, consumerTag }
    this.isConnected = false;
    this.globalMessageQueue = null; // Global queue for message sender worker
    this.globalConsumerTag = null;
  }

  /**
   * Подключение к RabbitMQ
   */
  async connect() {
    try {
      console.log('🔌 Connecting to RabbitMQ for Updates...');
      this.connection = await amqp.connect(config.rabbitmq.url);
      this.channel = await this.connection.createChannel();
      
      // Убедиться что exchange существует
      await this.channel.assertExchange(
        config.rabbitmq.updatesExchange,
        'topic',
        { durable: true }
      );

      this.isConnected = true;
      console.log('✅ RabbitMQ Consumer connected successfully');
      console.log(`   Exchange: ${config.rabbitmq.updatesExchange} (topic)`);
      console.log(`   🔍 Config check: updatesExchange = ${config.rabbitmq.updatesExchange}, env var = ${process.env.RABBITMQ_UPDATES_EXCHANGE || 'not set'}`);

      // Create global queue for message sender worker (only if running as standalone worker)
      // Check if we're running as a worker process
      const scriptPath = process.argv[1] || '';
      const isWorkerProcess = scriptPath.includes('workers/start.js') || 
                              scriptPath.includes('workers\\start.js') ||
                              process.env.RUN_AS_WORKER === 'true';
      
      if (isWorkerProcess) {
        await this.createGlobalMessageQueue();
      }

      // Обработка закрытия соединения
      this.connection.on('close', () => {
        console.log('❌ RabbitMQ Consumer connection closed');
        this.isConnected = false;
      });

      this.connection.on('error', (err) => {
        console.error('❌ RabbitMQ Consumer connection error:', err.message);
        this.isConnected = false;
      });

      return true;
    } catch (error) {
      console.error('❌ Failed to connect RabbitMQ Consumer:', error.message);
      this.isConnected = false;
      throw error;
    }
  }

  /**
   * Создать персональную очередь для пользователя
   * @param {string} userId - ID пользователя
   * @param {Function} onUpdate - Callback для обработки updates
   * @returns {Promise<string>} - Имя созданной очереди
   */
  async createUserQueue(userId, onUpdate) {
    if (!this.isConnected) {
      throw new Error('RabbitMQ Consumer not connected');
    }

    // Проверить существующую очередь
    if (this.userQueues.has(userId)) {
      console.log(`⚠️  Queue for user ${userId} already exists`);
      return this.userQueues.get(userId).queueName;
    }

    try {
      const queueName = `user_${userId}_updates`;
      
      // Get user type from Chat3 API (recommended) or fallback to prefix
      let userType = extractUserType(userId); // Fallback: extract from prefix
      try {
        const userResponse = await Chat3Client.getUser(userId);
        const userData = userResponse.data || userResponse;
        if (userData.type) {
          userType = userData.type; // Use type from Chat3 DB
          console.log(`📋 User ${userId} type from Chat3: ${userType}`);
        }
      } catch (error) {
        // If user not found in Chat3, use fallback (prefix extraction)
        console.log(`⚠️  User ${userId} not found in Chat3, using type from prefix: ${userType}`);
      }
      
      // Chat3 format: update.{category}.{userType}.{userId}.{updateType}
      // Use wildcard for category: update.*.{userType}.{userId}.*
      const routingKey = `update.*.${userType}.${userId}.*`;

      // Создать очередь (сохраняется 1 час для краткосрочных отключений)
      await this.channel.assertQueue(queueName, {
        durable: true,         // Сохраняется на диск
        autoDelete: false,     // НЕ удалять при отключении consumer
        exclusive: false,      // Разрешить переподключение
        arguments: {
          'x-message-ttl': 3600000,  // Сообщения живут 1 час
          'x-expires': 3600000       // Очередь удаляется через 1 час неактивности
        }
      });

      // Привязать к exchange
      console.log(`🔗 Binding queue ${queueName} to exchange ${config.rabbitmq.updatesExchange} with routing key: ${routingKey}`);
      await this.channel.bindQueue(
        queueName,
        config.rabbitmq.updatesExchange,
        routingKey
      );
      console.log(`✅ Queue ${queueName} bound successfully`);

      console.log(`📬 Created queue for user: ${userId}`);
      console.log(`   Queue: ${queueName}`);
      console.log(`   Routing: ${routingKey}`);
      console.log(`   Exchange: ${config.rabbitmq.updatesExchange}`);

      // Начать получать updates
      console.log(`👂 Starting to consume from queue: ${queueName} with routing key: ${routingKey}`);
      const { consumerTag } = await this.channel.consume(
        queueName,
        async (msg) => {
          if (msg) {
            try {
              const update = JSON.parse(msg.content.toString());
              console.log(`📨 Received update for ${userId}:`, update.eventType);
              console.log(`   Full update:`, JSON.stringify(update, null, 2));

              // Вызвать callback
              await onUpdate(update);

              // Подтвердить получение
              this.channel.ack(msg);
            } catch (error) {
              console.error(`❌ Error processing update for ${userId}:`, error.message);
              console.error(`   Update content:`, msg.content.toString());
              // Отклонить сообщение (не будет повторно отправлено)
              this.channel.nack(msg, false, false);
            }
          } else {
            console.log(`⚠️  Received null message for ${userId} - consumer cancelled?`);
          }
        },
        { noAck: false } // Manual acknowledgment
      );
      
      console.log(`✅ Consumer started for ${userId}, tag: ${consumerTag}`);

      // Сохранить информацию об очереди
      this.userQueues.set(userId, { queueName, consumerTag });

      return queueName;
    } catch (error) {
      console.error(`❌ Failed to create queue for ${userId}:`, error.message);
      throw error;
    }
  }

  /**
   * Отключить consumer пользователя (очередь НЕ удаляется!)
   * Очередь сохраняется 1 час для накопления updates при краткосрочных отключениях
   * @param {string} userId - ID пользователя
   */
  async stopUserConsumer(userId) {
    if (!this.userQueues.has(userId)) {
      return;
    }

    try {
      const { consumerTag } = this.userQueues.get(userId);

      // Отменить consumer (очередь остается!)
      if (consumerTag) {
        await this.channel.cancel(consumerTag);
        console.log(`⏸️  Stopped consumer for user: ${userId} (queue preserved for 1h)`);
      }

      this.userQueues.delete(userId);
    } catch (error) {
      console.error(`❌ Failed to stop consumer for ${userId}:`, error.message);
    }
  }

  /**
   * Закрыть все соединения
   */
  async close() {
    try {
      // Остановить все consumers (очереди остаются!)
      const userIds = Array.from(this.userQueues.keys());
      await Promise.all(userIds.map(userId => this.stopUserConsumer(userId)));

      // Закрыть канал и соединение
      if (this.channel) {
        await this.channel.close();
      }
      if (this.connection) {
        await this.connection.close();
      }

      this.isConnected = false;
      console.log('👋 RabbitMQ Consumer closed (queues preserved)');
    } catch (error) {
      console.error('❌ Error closing RabbitMQ Consumer:', error.message);
    }
  }

  /**
   * Create global queue for processing all message.create events
   * This queue is used by the message sender worker to send messages to business contacts
   */
  async createGlobalMessageQueue() {
    if (!this.isConnected) {
      throw new Error('RabbitMQ Consumer not connected');
    }

    try {
      const queueName = 'chatpapp_message_sender_worker';

      // Create durable queue for message sender worker
      await this.channel.assertQueue(queueName, {
        durable: true,
        autoDelete: false,
        exclusive: false,
      });

      // Bind to exchange with routing key for contact events
      // New format: user.{type}.{userId}.{updateType}
      // Pattern: user.contact.# - matches all events for all contacts
      // Message sender worker processes messages sent to business contacts (cnt_*)
      // Contacts have type='contact' in Chat3, so routing key is user.contact.cnt_xxx.*
      await this.channel.bindQueue(
        queueName,
        config.rabbitmq.updatesExchange,
        'user.contact.#' // Matches all events for all contacts (topic exchange wildcard)
      );

      console.log(`📤 Created global message queue: ${queueName}`);
      console.log(`   Routing: user.contact.# (all contacts)`);

      // Start consuming messages for message sender worker
      const { consumerTag } = await this.channel.consume(
        queueName,
        async (msg) => {
          if (msg) {
            try {
              const update = JSON.parse(msg.content.toString());
              
              // Process message through message sender worker
              await messageSenderWorker.processMessage(update);

              // Acknowledge message
              this.channel.ack(msg);
            } catch (error) {
              console.error('❌ Error in message sender worker:', error.message);
              // Reject and requeue message (will retry)
              this.channel.nack(msg, false, true);
            }
          }
        },
        { noAck: false }
      );

      this.globalMessageQueue = queueName;
      this.globalConsumerTag = consumerTag;

      console.log('✅ Message Sender Worker queue created and consuming');
    } catch (error) {
      console.error('❌ Failed to create global message queue:', error.message);
      // Don't throw - worker is optional
    }
  }

  /**
   * Получить статистику
   */
  getStats() {
    return {
      isConnected: this.isConnected,
      activeQueues: this.userQueues.size,
      users: Array.from(this.userQueues.keys()),
      globalMessageQueue: this.globalMessageQueue,
    };
  }
}

// Singleton instance
const rabbitmqConsumer = new RabbitMQConsumer();

export default rabbitmqConsumer;

