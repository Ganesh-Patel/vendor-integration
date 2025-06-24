import dotenv from 'dotenv';
import connectDB from './config/database.js';
import { connectRedis } from './config/redis.js';
import queueService from './services/queueService.js';
import vendorService from './services/vendorService.js';
import Job from './models/Job.js';
import logger from './utils/logger.js';

dotenv.config();

class Worker {
  constructor() {
    this.isRunning = false;
    this.pollingInterval = 1000;
  }

  async start() {
    try {
      await connectDB();
      await connectRedis();
      
      this.isRunning = true;
      logger.info('Worker started');
      
      this.poll();
    } catch (error) {
      logger.error('Failed to start worker:', error);
      process.exit(1);
    }
  }

  async poll() {
    while (this.isRunning) {
      try {
        const jobData = await queueService.getNextJob();
        
        if (jobData) {
          await this.processJob(jobData);
        } else {
          await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
        }
      } catch (error) {
        logger.error('Error in worker poll loop:', error);
        await new Promise(resolve => setTimeout(resolve, this.pollingInterval));
      }
    }
  }

  async processJob(jobData) {
    const { requestId, payload, vendor } = jobData;
    
    try {
      logger.info(`Processing job: ${requestId} for vendor: ${vendor}`);
      
      await Job.findOneAndUpdate(
        { requestId },
        { status: 'processing' }
      );
      
      await queueService.waitForRateLimit(vendor);
      
      let result;
      if (vendor === 'sync-vendor') {
        result = await vendorService.callSyncVendor(payload);
        
        await Job.findOneAndUpdate(
          { requestId },
          { 
            status: 'complete',
            result,
            completedAt: new Date()
          }
        );
        
        logger.info(`Sync job completed: ${requestId}`);
      } else if (vendor === 'async-vendor') {
        result = await vendorService.callAsyncVendor(payload);
        logger.info(`Async job acknowledged: ${requestId}`);
      }
      
    } catch (error) {
      logger.error(`Error processing job ${requestId}:`, error);
      
      await Job.findOneAndUpdate(
        { requestId },
        { 
          status: 'failed',
          error: error.message,
          completedAt: new Date()
        }
      );
    }
  }

  async stop() {
    this.isRunning = false;
    logger.info('Worker stopped');
  }
}

process.on('SIGTERM', async () => {
  logger.info('SIGTERM received, shutting down worker gracefully');
  await worker.stop();
  process.exit(0);
});

process.on('SIGINT', async () => {
  logger.info('SIGINT received, shutting down worker gracefully');
  await worker.stop();
  process.exit(0);
});

const worker = new Worker();
worker.start(); 