import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import dotenv from 'dotenv';
import connectDB from './config/database.js';
import { connectRedis } from './config/redis.js';
import jobRoutes from './routes/jobRoutes.js';
import logger from './utils/logger.js';

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path} - ${req.ip}`);
  next();
});

app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    service: 'vendor-integration'
  });
});

app.use('/api', jobRoutes);

app.use('*', (req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

app.use((error, req, res, next) => {
  logger.error('Unhandled error:', error);
  res.status(500).json({ error: 'Internal server error' });
});

process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  process.exit(0);
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  process.exit(0);
});

let serverInstance = null;

const startServer = async () => {
  try {
    await connectDB();
    await connectRedis();
    if (process.env.NODE_ENV !== 'test') {
      serverInstance = app.listen(PORT, () => {
        logger.info(`Server running on port ${PORT}`);
        logger.info(`Health check: http://localhost:${PORT}/health`);
        logger.info(`API base: http://localhost:${PORT}/api`);
      });
    }
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

const stopServer = async () => {
  if (serverInstance) {
    serverInstance.close();
  }
  // Close DB and Redis connections for test teardown
  try {
    const mongoose = (await import('mongoose')).default;
    await mongoose.connection.close();
  } catch (e) {}
  try {
    const { redisClient } = await import('./config/redis.js');
    await redisClient.quit();
  } catch (e) {}
};

// Always start server connections, even in test mode
if (process.env.NODE_ENV === 'test') {
  // For tests, just connect to DB/Redis without starting HTTP server
  startServer().catch(console.error);
} else {
  startServer();
}

export { startServer, stopServer };
export default app; 