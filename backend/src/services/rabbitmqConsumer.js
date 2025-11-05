import amqp from 'amqplib';
import config from '../config/index.js';

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
      const routingKey = `user.${userId}.*`; // Все updates пользователя

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
      await this.channel.bindQueue(
        queueName,
        config.rabbitmq.updatesExchange,
        routingKey
      );

      console.log(`📬 Created queue for user: ${userId}`);
      console.log(`   Queue: ${queueName}`);
      console.log(`   Routing: ${routingKey}`);

      // Начать получать updates
      const { consumerTag } = await this.channel.consume(
        queueName,
        async (msg) => {
          if (msg) {
            try {
              const update = JSON.parse(msg.content.toString());
              console.log(`📨 Received update for ${userId}:`, update.eventType);

              // Вызвать callback
              await onUpdate(update);

              // Подтвердить получение
              this.channel.ack(msg);
            } catch (error) {
              console.error(`❌ Error processing update for ${userId}:`, error.message);
              // Отклонить сообщение (не будет повторно отправлено)
              this.channel.nack(msg, false, false);
            }
          }
        },
        { noAck: false } // Manual acknowledgment
      );

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
   * Получить статистику
   */
  getStats() {
    return {
      isConnected: this.isConnected,
      activeQueues: this.userQueues.size,
      users: Array.from(this.userQueues.keys())
    };
  }
}

// Singleton instance
const rabbitmqConsumer = new RabbitMQConsumer();

export default rabbitmqConsumer;

