import Bot from '../models/Bot.js';
import Chat3Client from './Chat3Client.js';
import { normalizeChat3Update } from '../utils/updateNormalizer.js';

/**
 * Bot Service
 * Handles bot logic and message processing
 */
class BotService {
  constructor() {
    this.botHandlers = new Map();
    this.registerHandlers();
  }

  /**
   * Register bot handlers
   */
  registerHandlers() {
    // Echo handler - responds with the same message
    this.botHandlers.set('echo', async (bot, message, dialogId) => {
      const content = message.content || '';
      
      // Echo the message back
      return {
        content: content,
        type: message.type || 'internal.text',
        meta: {
          ...message.meta,
          botResponse: true,
          originalMessageId: message.messageId || message._id,
        },
      };
    });

    // Command handler - processes commands (can be extended)
    this.botHandlers.set('command', async (bot, message, dialogId) => {
      const content = message.content || '';
      
      // Check if it's a command (starts with /)
      if (content.startsWith('/')) {
        const command = content.split(' ')[0].substring(1).toLowerCase();
        const args = content.split(' ').slice(1).join(' ');
        
        // Handle commands
        switch (command) {
          case 'help':
            return {
              content: 'Available commands:\n/help - Show this help\n/ping - Check if bot is alive\n/time - Get current time',
              type: 'internal.text',
              meta: { botResponse: true },
            };
          
          case 'ping':
            return {
              content: 'pong',
              type: 'internal.text',
              meta: { botResponse: true },
            };
          
          case 'time':
            return {
              content: `Current time: ${new Date().toISOString()}`,
              type: 'internal.text',
              meta: { botResponse: true },
            };
          
          default:
            return {
              content: `Unknown command: /${command}. Type /help for available commands.`,
              type: 'internal.text',
              meta: { botResponse: true },
            };
        }
      }
      
      // If not a command, echo the message
      return {
        content: content,
        type: message.type || 'internal.text',
        meta: {
          ...message.meta,
          botResponse: true,
          originalMessageId: message.messageId || message._id,
        },
      };
    });
  }

  /**
   * Get bot by botId
   */
  async getBot(botId) {
    return await Bot.findOne({ botId, isActive: true });
  }

  /**
   * Get all active bots
   */
  async getAllActiveBots() {
    return await Bot.find({ isActive: true });
  }

  /**
   * Get system bots
   */
  async getSystemBots() {
    return await Bot.find({ type: 'system', isActive: true });
  }

  /**
   * Process message for bot
   */
  async processMessage(botId, update) {
    try {
      // Get bot
      const bot = await this.getBot(botId);
      if (!bot) {
        console.log(`⏭️  Bot ${botId} not found or inactive`);
        return null;
      }

      // Normalize update
      const normalizedUpdate = normalizeChat3Update(update);
      const envelope = normalizedUpdate?.data || {};
      const message = envelope.message;
      
      if (!message) {
        console.log(`⏭️  No message data in update for bot ${botId}`);
        return null;
      }

      // Get dialog ID
      const dialogId = message.dialogId || normalizedUpdate.dialogId || envelope.context?.dialogId;
      if (!dialogId) {
        console.log(`⏭️  No dialogId found for bot ${botId}`);
        return null;
      }

      // Get handler
      const handler = this.botHandlers.get(bot.handler);
      if (!handler) {
        console.error(`❌ No handler found for bot ${botId} with handler type: ${bot.handler}`);
        return null;
      }

      // Process message with handler
      const response = await handler(bot, message, dialogId);
      
      if (!response) {
        return null;
      }

      // Send response via Chat3Client
      const result = await Chat3Client.createMessage(dialogId, {
        senderId: botId,
        content: response.content,
        type: response.type,
        meta: response.meta || {},
      });

      console.log(`✅ Bot ${botId} responded to message in dialog ${dialogId}`);
      return result;
    } catch (error) {
      console.error(`❌ Error processing message for bot ${botId}:`, error.message);
      throw error;
    }
  }

  /**
   * Initialize system bots (create if they don't exist)
   */
  async initializeSystemBots() {
    try {
      // Check if bot_echo exists
      let echoBot = await Bot.findOne({ botId: 'bot_echo' });
      
      if (!echoBot) {
        // Create bot with fixed botId
        const botData = {
          botId: 'bot_echo',
          name: 'Echo Bot',
          type: 'system',
          description: 'Echo bot that responds with the same message',
          handler: 'echo',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        // Use insertOne to bypass pre-save hook that would generate new botId
        await Bot.collection.insertOne(botData);
        echoBot = await Bot.findOne({ botId: 'bot_echo' });
        console.log('✅ Created system bot: bot_echo');
      } else {
        console.log('ℹ️  System bot bot_echo already exists');
      }

      return echoBot;
    } catch (error) {
      console.error('❌ Error initializing system bots:', error.message);
      throw error;
    }
  }
}

// Create singleton instance
const botService = new BotService();

export default botService;

