import { Server } from 'socket.io';
import AuthService from '../services/AuthService.js';
import RabbitMQService from '../services/RabbitMQService.js';

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

  // Connect to RabbitMQ
  try {
    await RabbitMQService.connect();
  } catch (error) {
    console.error('⚠️  Failed to connect to RabbitMQ. Updates will not be available.');
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

    // Subscribe user to RabbitMQ updates
    try {
      await RabbitMQService.subscribeUser(socket.userId, async (update) => {
        // Forward update to user via WebSocket
        socket.emit('chat3:update', update);
        
        // Also emit specific event based on eventType
        if (update.eventType === 'message.create') {
          socket.emit('message:new', update.data);
        } else if (update.eventType.startsWith('message.')) {
          socket.emit('message:update', update);
        } else if (update.eventType.startsWith('dialog.')) {
          socket.emit('dialog:update', update);
        }
      });
    } catch (error) {
      console.error(`❌ Failed to subscribe user ${socket.userId} to RabbitMQ:`, error.message);
    }

    // Notify user is online
    socket.broadcast.emit('user:online', {
      userId: socket.userId,
      userName: socket.userName,
    });

    // Handle user joining a dialog room
    socket.on('dialog:join', (dialogId) => {
      socket.join(`dialog:${dialogId}`);
      console.log(`📨 User ${socket.userName} joined dialog ${dialogId}`);
    });

    // Handle user leaving a dialog room
    socket.on('dialog:leave', (dialogId) => {
      socket.leave(`dialog:${dialogId}`);
      console.log(`📭 User ${socket.userName} left dialog ${dialogId}`);
    });

    // Handle typing indicator
    socket.on('typing:start', ({ dialogId }) => {
      socket.to(`dialog:${dialogId}`).emit('typing:start', {
        userId: socket.userId,
        userName: socket.userName,
        dialogId,
      });
    });

    socket.on('typing:stop', ({ dialogId }) => {
      socket.to(`dialog:${dialogId}`).emit('typing:stop', {
        userId: socket.userId,
        dialogId,
      });
    });

    // Handle disconnect
    socket.on('disconnect', async () => {
      console.log(`❌ User disconnected: ${socket.userName} (${socket.userId})`);
      
      connectedUsers.delete(socket.userId);
      
      // Unsubscribe from RabbitMQ updates
      try {
        await RabbitMQService.unsubscribeUser(socket.userId);
      } catch (error) {
        console.error(`❌ Failed to unsubscribe user ${socket.userId}:`, error.message);
      }
      
      socket.broadcast.emit('user:offline', {
        userId: socket.userId,
      });
    });
  });

  // Helper functions to emit events from other parts of the application

  /**
   * Emit new message to dialog members
   */
  io.emitNewMessage = (dialogId, message) => {
    io.to(`dialog:${dialogId}`).emit('message:new', message);
  };

  /**
   * Emit message status update
   */
  io.emitMessageStatus = (dialogId, messageId, userId, status) => {
    io.to(`dialog:${dialogId}`).emit('message:status', {
      messageId,
      userId,
      status,
    });
  };

  /**
   * Emit message reaction
   */
  io.emitMessageReaction = (dialogId, messageId, reaction) => {
    io.to(`dialog:${dialogId}`).emit('message:reaction', {
      messageId,
      reaction,
    });
  };

  /**
   * Emit dialog update
   */
  io.emitDialogUpdate = (dialogId, update) => {
    io.to(`dialog:${dialogId}`).emit('dialog:update', update);
  };

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

