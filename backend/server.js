import express from 'express';
import { createServer } from 'http';
import cors from 'cors';
import helmet from 'helmet';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { fileURLToPath } from 'url';
import config from './src/config/index.js';
import { connectDB } from './src/db/index.js';
import { initializeWebSocket } from './src/websocket/index.js';

// Import routes
import authRoutes from './src/routes/auth.js';
import dialogRoutes from './src/routes/dialogs.js';
import messageRoutes from './src/routes/messages.js';
import userRoutes from './src/routes/users.js';

// Initialize Express app
const app = express();
const server = createServer(app);

// Swagger/OpenAPI setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const swaggerOptions = {
  definition: {
    openapi: '3.0.3',
    info: {
      title: 'ChatPApp Backend API',
      description:
        'REST API endpoints for authentication, dialogs, messages and users in the ChatPApp project.',
      version: '1.0.0',
    },
    servers: [
      {
        url: `http://localhost:${config.port}`,
        description: 'Local development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
  },
  apis: [
    path.resolve(__dirname, './src/routes/*.js'),
    path.resolve(__dirname, './src/controllers/*.js'),
  ],
};

const swaggerSpec = swaggerJsdoc(swaggerOptions);

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// API docs
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.get('/openapi.json', (req, res) => {
  res.json(swaggerSpec);
});

// Request logging in development
if (config.nodeEnv === 'development') {
  app.use((req, res, next) => {
    console.log(`${req.method} ${req.path}`);
    next();
  });
}

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    environment: config.nodeEnv,
  });
});

// API routes
app.use('/api/auth', authRoutes);
app.use('/api/dialogs', dialogRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/users', userRoutes);

// 404 handler
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: 'Route not found',
  });
});

// Error handler
app.use((err, req, res, next) => {
  console.error('Error:', err);
  
  res.status(err.status || 500).json({
    success: false,
    error: err.message || 'Internal server error',
  });
});

// Start server
async function startServer() {
  try {
    // Connect to MongoDB
    await connectDB();

    // Initialize WebSocket and RabbitMQ
    const io = await initializeWebSocket(server);
    
    // Make io available to routes
    app.set('io', io);

    // Start listening
    server.listen(config.port, () => {
      console.log('\n🚀 Server started successfully!');
      console.log(`📡 HTTP server: http://localhost:${config.port}`);
      console.log(`🔌 WebSocket server: ws://localhost:${config.port}`);
      console.log(`🌍 Environment: ${config.nodeEnv}`);
      console.log(`💾 MongoDB: ${config.mongodb.uri}`);
      console.log(`🔗 Chat3 API: ${config.chat3.apiUrl}`);
      console.log('\n✨ Ready to accept connections!\n');
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

// Graceful shutdown
async function gracefulShutdown(signal) {
  console.log(`\n${signal} received. Closing gracefully...`);
  
  try {
    // Close RabbitMQ connection
    const RabbitMQService = (await import('./src/services/RabbitMQService.js')).default;
    await RabbitMQService.close();
    console.log('✅ RabbitMQ closed');
    
    // Close MongoDB connection
    const mongoose = (await import('mongoose')).default;
    await mongoose.connection.close();
    console.log('✅ MongoDB closed');
    
    console.log('👋 Graceful shutdown complete');
    process.exit(0);
  } catch (error) {
    console.error('❌ Error during shutdown:', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

