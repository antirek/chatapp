import Bot from '../models/Bot.js';
import User from '../models/User.js';
import Channel from '../models/Channel.js';
import Chat3Client from './Chat3Client.js';
import { normalizeChat3Update } from '../utils/updateNormalizer.js';
import { mapOutgoingMessageType } from '../utils/messageType.js';

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

    // Classify handler - classifies incoming dialogs
    this.botHandlers.set('classify', async (bot, message, dialogId) => {
      const content = message.content || '';
      const senderId = message.senderId;
      
      // Skip system messages and messages from bots
      if (senderId === 'system' || senderId?.startsWith('bot_')) {
        console.log(`⏭️  [Classify Bot] Skipping message from ${senderId}`);
        return null;
      }
      
      try {
        // Get dialog to check classifyStatus
        const dialogResponse = await Chat3Client.getDialog(dialogId);
        const dialog = dialogResponse?.data || dialogResponse;
        const dialogMeta = dialog?.meta || {};
        const classifyStatus = dialogMeta?.classifyStatus?.value || dialogMeta?.classifyStatus;
        
        console.log(`📊 [Classify Bot] Dialog ${dialogId}, classifyStatus: ${classifyStatus}`);
        
        if (classifyStatus === 'init') {
          // First message - ask for more details
          console.log(`📊 [Classify Bot] First message in dialog ${dialogId}, asking for details`);
          
          // Set classifyStatus to firstStep
          await Chat3Client.setMeta('dialog', dialogId, 'classifyStatus', { value: 'firstStep' });
          
          // Send clarification message
          // channelId will be added in processMessage method
          return {
            content: 'Опишите подробнее вашу проблему',
            type: 'internal.text',
            meta: {
              botResponse: true,
            },
          };
        } else if (classifyStatus === 'firstStep') {
          // Second message - classify
          console.log(`📊 [Classify Bot] Classifying dialog ${dialogId}`);
          
          // Classify: check if content contains "проблема"
          const lowerContent = content.toLowerCase();
          const classification = lowerContent.includes('проблема') ? 'проблема' : 'пожелание';
          
          console.log(`📊 [Classify Bot] Classification result: ${classification}`);
          
          // Set classifyStatus to end
          await Chat3Client.setMeta('dialog', dialogId, 'classifyStatus', { value: 'end' });
          
          // Step 1: Add system message "классифицировано как: <вариант>"
          try {
            await Chat3Client.createMessage(dialogId, {
              content: `классифицировано как: ${classification}`,
              type: mapOutgoingMessageType('system'),
              senderId: 'system',
              meta: {
                classification,
                classifiedBy: bot.botId,
              },
            });
            console.log(`✅ [Classify Bot] Added system message "классифицировано как: ${classification}"`);
          } catch (systemMsgError) {
            console.error('⚠️ [Classify Bot] Failed to add classification system message:', systemMsgError);
          }
          
          // Step 2: Add user "Иванов Иван" to dialog
          try {
            const user = await User.findOne({ name: /Иванов.*Иван/i }).select('userId name').lean();
            if (user) {
              // Check if user is already a member
              const membersResponse = await Chat3Client.getDialogMembers(dialogId, { limit: 100 });
              const members = membersResponse?.data || membersResponse || [];
              const isMember = Array.isArray(members) && members.some(m => (m.userId || m._id) === user.userId);
              
              if (!isMember) {
                await Chat3Client.addDialogMember(dialogId, user.userId, {
                  type: 'user',
                  name: user.name,
                });
                await Chat3Client.setMeta(
                  'dialogMember',
                  `${dialogId}:${user.userId}`,
                  'memberType',
                  { value: 'user' }
                );
                console.log(`✅ [Classify Bot] Added user ${user.userId} (${user.name}) to dialog ${dialogId}`);
              } else {
                console.log(`ℹ️  [Classify Bot] User ${user.userId} already a member of dialog ${dialogId}`);
              }
            } else {
              console.warn(`⚠️  [Classify Bot] User "Иванов Иван" not found`);
            }
          } catch (userError) {
            console.error('⚠️ [Classify Bot] Failed to add user to dialog:', userError);
          }
          
          // Step 3: Add system message "Подключаем пользователя к диалогу"
          try {
            await Chat3Client.createMessage(dialogId, {
              content: 'Подключаем пользователя к диалогу',
              type: mapOutgoingMessageType('system'),
              senderId: 'system',
            });
            console.log(`✅ [Classify Bot] Added system message "Подключаем пользователя к диалогу"`);
          } catch (systemMsgError) {
            console.error('⚠️ [Classify Bot] Failed to add system message:', systemMsgError);
          }
          
          console.log(`✅ [Classify Bot] Classification complete: ${classification}`);
          
          // Return null - no user-visible response
          return null;
        } else if (classifyStatus === 'end') {
          // Already classified, do nothing
          console.log(`⏭️  [Classify Bot] Dialog ${dialogId} already classified, skipping`);
          return null;
        } else {
          // Unknown status, set to init and process
          console.log(`⚠️  [Classify Bot] Unknown classifyStatus: ${classifyStatus}, resetting to init`);
          await Chat3Client.setMeta('dialog', dialogId, 'classifyStatus', { value: 'init' });
          
          // Send clarification message
          return {
            content: 'Опишите подробнее вашу проблему',
            type: 'internal.text',
            meta: {
              botResponse: true,
            },
          };
        }
      } catch (error) {
        console.error(`❌ [Classify Bot] Error processing message:`, error.message);
        // Don't throw - bot should not break message flow
        return null;
      }
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

      // For bot_classify, add channelId to meta if available
      let messageMeta = response.meta || {};
      if (botId === 'bot_classify' && !messageMeta.channelId) {
        try {
          // Get dialog to find contactId and then channelId
          const dialogResponse = await Chat3Client.getDialog(dialogId);
          const dialog = dialogResponse?.data || dialogResponse;
          const dialogMeta = dialog?.meta || {};
          const contactId = dialogMeta?.contactId?.value || dialogMeta?.contactId;
          
          if (contactId) {
            const Contact = (await import('../models/Contact.js')).default;
            const contact = await Contact.findOne({ contactId }).select('accountId').lean();
            if (contact?.accountId) {
              const channel = await Channel.findOne({
                accountId: contact.accountId,
                isActive: true,
              }).sort({ createdAt: 1 }).lean();
              if (channel) {
                messageMeta.channelId = { value: channel.channelId };
                console.log(`📊 [BotService] Added channelId ${channel.channelId} to bot message meta`);
              }
            }
          }
        } catch (channelError) {
          console.warn(`⚠️ [BotService] Failed to get channelId for bot message:`, channelError.message);
        }
      }

      // Send response via Chat3Client
      const result = await Chat3Client.createMessage(dialogId, {
        senderId: botId,
        content: response.content,
        type: response.type,
        meta: messageMeta,
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
      const bots = [];

      // Initialize bot_echo
      let echoBot = await Bot.findOne({ botId: 'bot_echo' });
      
      if (!echoBot) {
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
        
        await Bot.collection.insertOne(botData);
        echoBot = await Bot.findOne({ botId: 'bot_echo' });
        console.log('✅ Created system bot: bot_echo');
      } else {
        console.log('ℹ️  System bot bot_echo already exists');
      }

      // Ensure bot_echo exists in Chat3
      await this.ensureBotInChat3(echoBot, 'Echo');
      bots.push(echoBot);

      // Initialize bot_classify
      let classifyBot = await Bot.findOne({ botId: 'bot_classify' });
      
      if (!classifyBot) {
        const botData = {
          botId: 'bot_classify',
          name: 'Classify Bot',
          type: 'system',
          description: 'Bot that classifies incoming dialogs',
          handler: 'classify',
          isActive: true,
          createdAt: new Date(),
          updatedAt: new Date(),
        };
        
        await Bot.collection.insertOne(botData);
        classifyBot = await Bot.findOne({ botId: 'bot_classify' });
        console.log('✅ Created system bot: bot_classify');
      } else {
        console.log('ℹ️  System bot bot_classify already exists');
      }

      // Ensure bot_classify exists in Chat3
      await this.ensureBotInChat3(classifyBot, 'Classify');
      bots.push(classifyBot);

      return bots;
    } catch (error) {
      console.error('❌ Error initializing system bots:', error.message);
      throw error;
    }
  }

  /**
   * Ensure bot exists in Chat3 as a user with type 'bot'
   */
  async ensureBotInChat3(bot, displayName) {
    try {
      const botUserId = bot.botId;
      console.log(`🔵 Checking if bot ${botUserId} exists in Chat3...`);
      
      try {
        const existingUser = await Chat3Client.getUser(botUserId);
        console.log(`✅ Bot ${botUserId} already exists in Chat3`);
        
        const userData = existingUser.data || existingUser;
        const needsUpdate = userData.type !== 'bot' || userData.name !== displayName;
        
        if (needsUpdate) {
          console.log(`🔵 Updating bot ${botUserId} in Chat3...`);
          await Chat3Client.updateUser(botUserId, { 
            type: 'bot',
            name: displayName,
          });
          console.log(`✅ Updated bot ${botUserId} in Chat3 (type: 'bot', name: '${displayName}')`);
        }
      } catch (error) {
        if (error.response?.status === 404) {
          console.log(`🔵 Creating bot ${botUserId} in Chat3 as user with type 'bot'...`);
          await Chat3Client.createUser(botUserId, {
            name: displayName,
            type: 'bot',
            meta: {
              description: bot.description,
              handler: bot.handler,
              botType: bot.type, // system
            },
          });
          console.log(`✅ Created bot ${botUserId} in Chat3 with type 'bot' and name '${displayName}'`);
        } else {
          throw error;
        }
      }
    } catch (error) {
      console.error(`❌ Failed to create/update bot ${bot.botId} in Chat3:`, error.message);
      // Don't throw - bot can still work without Chat3 user
    }
  }
}

// Create singleton instance
const botService = new BotService();

export default botService;

