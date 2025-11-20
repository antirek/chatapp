import { Server } from 'socket.io';
import AuthService from '../services/AuthService.js';
import rabbitmqConsumer from '../services/rabbitmqConsumer.js';
import { normalizeChat3Update } from '../utils/updateNormalizer.js';

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
        const normalizedUpdate = normalizeChat3Update(update);
        const eventType = normalizedUpdate.eventType || normalizedUpdate.data?.context?.eventType;
        const envelope = normalizedUpdate.data || {};

        console.log(`➡️  Sending update to ${socket.userId}:`, eventType);
        if (eventType === 'message.create' || eventType?.startsWith('message.')) {
          console.log(`📨 [WebSocket] Message update details:`, {
            eventType,
            dialogId: normalizedUpdate.dialogId,
            messageId: envelope.message?.messageId || envelope.message?._id,
            senderId: envelope.message?.senderId,
            content: envelope.message?.content?.substring(0, 50),
          });
        }
        
        // Forward normalized update to client
        socket.emit('chat3:update', normalizedUpdate);
        
        // Also emit specific event based on eventType for compatibility
        if (eventType === 'message.create') {
          if (envelope.message) {
            socket.emit('message:new', envelope.message);
          }
        } else if (eventType?.startsWith('message.')) {
          socket.emit('message:update', normalizedUpdate);
        } else if (eventType === 'dialog.typing') {
          const typingUpdate = buildTypingEvent(normalizedUpdate);
          if (typingUpdate) {
            socket.emit('typing:update', typingUpdate);
          }
        } else if (eventType?.startsWith('dialog.')) {
          socket.emit('dialog:update', normalizedUpdate);
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

function buildTypingEvent(update) {
  if (!update || typeof update !== 'object') {
    return null;
  }

  const envelope = update.data || {};
  const typingPayload = envelope.typing;

  if (!typingPayload) {
    return null;
  }

  const dialogId =
    update.dialogId ||
    envelope.context?.dialogId ||
    envelope.dialog?.dialogId ||
    typingPayload.dialogId ||
    update.entityId ||
    null;

  if (!dialogId) {
    return null;
  }

  const embeddedUserInfo = typingPayload.userInfo || null;
  const targetUserId = typingPayload.userId || embeddedUserInfo?.userId;

  if (!targetUserId) {
    return null;
  }

  return {
    dialogId,
    userId: targetUserId,
    userName: embeddedUserInfo?.name || undefined,
    userInfo: embeddedUserInfo
      ? {
          userId: embeddedUserInfo.userId,
          name: embeddedUserInfo.name,
          avatar: embeddedUserInfo.avatar || embeddedUserInfo.meta?.avatar || null,
        }
      : undefined,
    expiresInMs: typingPayload.expiresInMs ?? envelope.context?.expiresInMs ?? 5000,
  };
}


