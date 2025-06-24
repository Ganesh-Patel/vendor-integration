import mongoose from 'mongoose';
import { redisClient, connectRedis } from '../src/config/redis.js';
import connectDB from '../src/config/database.js';
import Job from '../src/models/Job.js';

const TEST_MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/vendor-integration-test';
const TEST_REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1';

export async function globalSetup() {
  try {
    // Set test URIs
    process.env.MONGODB_URI = TEST_MONGODB_URI;
    process.env.REDIS_URL = TEST_REDIS_URL;

    // Connect to DB and Redis only if not already connected
    if (mongoose.connection.readyState !== 1) {
      await connectDB();
    }
    await connectRedis();

    // Wait for connections to be ready
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Verify connections
    if (mongoose.connection.readyState !== 1) {
      throw new Error('MongoDB connection not ready');
    }

    // Clean up test data
    await Job.deleteMany({});
    await redisClient.flushDb();
    
    // Explicitly delete rate limit keys if needed
    const keys = await redisClient.keys('vendor-rate-limit*');
    if (keys.length > 0) await redisClient.del(keys);
    
    console.log('✅ Test setup completed successfully');
  } catch (error) {
    console.error('❌ Test setup failed:', error);
    throw error;
  }
}

export async function globalTeardown() {
  try {
    // Clean up test data
    await Job.deleteMany({});
    await redisClient.flushDb();
    
    // Explicitly delete rate limit keys if needed
    const keys = await redisClient.keys('vendor-rate-limit*');
    if (keys.length > 0) await redisClient.del(keys);

    // Don't close connections here as they might be reused
    console.log('✅ Test teardown completed successfully');
  } catch (error) {
    console.error('❌ Test teardown failed:', error);
    throw error;
  }
} 