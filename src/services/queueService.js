import { redisClient } from '../config/redis.js';
import logger from '../utils/logger.js';

const QUEUE_NAME = 'vendor-jobs';
const RATE_LIMIT_KEY = 'vendor-rate-limit';
const RATE_LIMIT_WINDOW = 60;
const RATE_LIMIT_MAX_REQUESTS = 10;

class QueueService {
  async addJob(jobData) {
    try {
      await redisClient.lPush(QUEUE_NAME, JSON.stringify(jobData));
      logger.info(`Job added to queue: ${jobData.requestId}`);
      return true;
    } catch (error) {
      logger.error('Error adding job to queue:', error);
      throw error;
    }
  }

  async getNextJob() {
    try {
      const job = await redisClient.rPop(QUEUE_NAME);
      if (job) {
        logger.info('Job retrieved from queue');
        return JSON.parse(job);
      }
      return null;
    } catch (error) {
      logger.error('Error getting job from queue:', error);
      throw error;
    }
  }

  async checkRateLimit(vendor) {
    try {
      const key = `${RATE_LIMIT_KEY}:${vendor}`;
      const current = await redisClient.get(key);
      
      if (!current) {
        await redisClient.setEx(key, RATE_LIMIT_WINDOW, '1');
        return true;
      }
      
      const count = parseInt(current);
      if (count >= RATE_LIMIT_MAX_REQUESTS) {
        logger.warn(`Rate limit exceeded for vendor: ${vendor}`);
        return false;
      }
      
      await redisClient.incr(key);
      return true;
    } catch (error) {
      logger.error('Error checking rate limit:', error);
      return false;
    }
  }

  async waitForRateLimit(vendor) {
    const maxWaitTime = 60000;
    const checkInterval = 1000;
    let waited = 0;
    
    while (waited < maxWaitTime) {
      const canProceed = await this.checkRateLimit(vendor);
      if (canProceed) {
        return true;
      }
      
      await new Promise(resolve => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }
    
    throw new Error(`Rate limit wait timeout for vendor: ${vendor}`);
  }
}

export default new QueueService(); 