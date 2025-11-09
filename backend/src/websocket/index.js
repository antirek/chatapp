import { Server } from 'socket.io';
import AuthService from '../services/AuthService.js';
import rabbitmqConsumer from '../services/rabbitmqConsumer.js';
import { resolveUserName } from '../controllers/dialogsController.js';

/**
 * Initialize WebSocket server
 */
export async function initializeWebSocket(server) {
  const io = new Server(server, {
    cors: {
      origin: '*', // Configure properly in production
      methods: ['GET', 'POST'],
    },
  });

  const typingNameCache = new Map();
  const TYPING_NAME_CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

  // Connect to RabbitMQ Consumer for Updates
  try {
    await rabbitmqConsumer.connect();
  } catch (error) {
    console.error('⚠️  Failed to connect to RabbitMQ Consumer. Updates will not be available.');
    console.error('   Error:', error.message);
  }

  // Store connected users: userId -> socketId
  const connectedUsers = new Map();

  // Authentication middleware
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      
      if (!token) {
        return next(new Error('Authentication token required'));
      }

      const user = await AuthService.getUserByToken(token);
      
      socket.userId = user.userId;
      socket.userName = user.name;
      
      next();
    } catch (error) {
      next(new Error('Authentication failed'));
    }
  });

  io.on('connection', async (socket) => {
    console.log(`✅ User connected: ${socket.userName} (${socket.userId})`);
    
    // Track connected user
    connectedUsers.set(socket.userId, socket.id);

    // ✅ Create RabbitMQ queue for user and subscribe to updates
    try {
      await rabbitmqConsumer.createUserQueue(socket.userId, async (update) => {
        console.log(`➡️  Sending update to ${socket.userId}:`, update.eventType);
        
        // Forward raw update to client
        socket.emit('chat3:update', update);
        
        // Also emit specific event based on eventType for compatibility
        if (update.eventType === 'message.create') {
          socket.emit('message:new', update.data);
        } else if (update.eventType.startsWith('message.')) {
          socket.emit('message:update', update);
        } else if (update.eventType === 'dialog.typing') {
          console.log(
            `✍️  Typing update for dialog ${update.dialogId || update.data?.dialogId}:`,
            update.data?.userId || update.userId,
          );

          const targetUserId = update.data?.userId || update.userId;
          const dialogId = update.data?.dialogId || update.dialogId || update.entityId;
          const expiresInMs =
            update.data?.expiresInMs ??
            update.data?.expiresIn ??
            update.data?.ttl ??
            5000;

          let userName =
            update.data?.userName ||
            update.userName ||
            update.data?.name ||
            null;

          if (targetUserId) {
            const cached = typingNameCache.get(targetUserId);
            const now = Date.now();

            if (!cached || now - cached.timestamp > TYPING_NAME_CACHE_TTL_MS) {
              try {
                const resolvedName = await resolveUserName(
                  targetUserId,
                  userName || undefined,
                );
                userName = resolvedName;
                typingNameCache.set(targetUserId, {
                  name: resolvedName,
                  timestamp: now,
                });
              } catch (nameError) {
                console.warn(
                  `⚠️  Failed to resolve name for typing user ${targetUserId}:`,
                  nameError.message,
                );
              }
            } else {
              userName = cached.name;
            }
          }

          socket.emit('typing:update', {
            dialogId,
            userId: targetUserId,
            userName: userName || undefined,
            expiresInMs,
          });
        } else if (update.eventType.startsWith('dialog.')) {
          socket.emit('dialog:update', update);
        }
      });
    } catch (error) {
      console.error(`❌ Failed to create RabbitMQ queue for ${socket.userId}:`, error.message);
    }

    // Notify user is online
    socket.broadcast.emit('user:online', {
      userId: socket.userId,
      userName: socket.userName,
    });

    // 🔄 HYBRID: Keep dialog:join for fallback
    socket.on('dialog:join', (dialogId) => {
      socket.join(`dialog:${dialogId}`);
      console.log(`📨 [HYBRID] User ${socket.userName} joined dialog:${dialogId}`);
    });

    socket.on('dialog:leave', (dialogId) => {
      socket.leave(`dialog:${dialogId}`);
      console.log(`📭 [HYBRID] User ${socket.userName} left dialog:${dialogId}`);
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.userName} (${socket.userId})`);
      
      connectedUsers.delete(socket.userId);
      
      // ⏸️  Stop consumer (queue preserved for 1h to accumulate updates)
      try {
        await rabbitmqConsumer.stopUserConsumer(socket.userId);
      } catch (error) {
        console.error(`❌ Failed to stop consumer for ${socket.userId}:`, error.message);
      }
      
      socket.broadcast.emit('user:offline', {
        userId: socket.userId,
      });
    });
  });

  // ✅ Pure RabbitMQ architecture - no fallback helpers needed

  /**
   * Check if user is online
   */
  io.isUserOnline = (userId) => {
    return connectedUsers.has(userId);
  };

  /**
   * Get online users count
   */
  io.getOnlineUsersCount = () => {
    return connectedUsers.size;
  };

  return io;
}

