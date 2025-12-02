import dotenv from 'dotenv';
import crypto from 'crypto';

dotenv.config();

// Generate random JWT secret if not provided
const JWT_SECRET = process.env.JWT_SECRET || crypto.randomBytes(64).toString('hex');

const config = {
  port: process.env.PORT || 3010,
  nodeEnv: process.env.NODE_ENV || 'development',
  
  mongodb: {
    uri: process.env.MONGODB_URI || 'mongodb://localhost:27017/chatpapp',
  },
  
  jwt: {
    secret: JWT_SECRET,
    expiresIn: process.env.JWT_EXPIRES_IN || '48h',
  },
  
  chat3: {
    apiUrl: process.env.CHAT3_API_URL || 'http://localhost:3000/api',
    apiKey: process.env.CHAT3_API_KEY || 'chat3_91b81eff6a450427e9e8f7e9bcd8431e02982871623301321890736ab97d55d7',
  },
  
  sms: {
    mockMode: process.env.SMS_MOCK_MODE === 'true',
  },
  
  rabbitmq: {
    url: process.env.RABBITMQ_URL || 'amqp://rmuser:rmpassword@localhost:5672/',
    updatesExchange: process.env.RABBITMQ_UPDATES_EXCHANGE || 'chat3_updates',
  },
};

// Log generated JWT secret in development
if (!process.env.JWT_SECRET && config.nodeEnv === 'development') {
  console.log('⚠️  Generated JWT Secret:', JWT_SECRET);
  console.log('💡 Add it to .env file: JWT_SECRET=' + JWT_SECRET);
}

export default config;

