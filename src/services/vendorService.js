import logger from '../utils/logger.js';
import Job from '../models/Job.js';

class VendorService {
  constructor() {
    this.syncVendorUrl = process.env.SYNC_VENDOR_URL || 'http://localhost:3001/sync-vendor';
    this.asyncVendorUrl = process.env.ASYNC_VENDOR_URL || 'http://localhost:3002/async-vendor';
  }

  async callSyncVendor(payload) {
    try {
      logger.info('Calling sync vendor');
      
      await new Promise(resolve => setTimeout(resolve, 1000 + Math.random() * 2000));
      
      const mockResponse = {
        id: Math.random().toString(36).substr(2, 9),
        data: payload,
        timestamp: new Date().toISOString(),
        source: 'sync-vendor',
        rawData: {
          userEmail: 'user@example.com',
          phoneNumber: '+1234567890',
          address: '  123 Main St, City, State 12345  ',
          preferences: ['pref1', 'pref2', 'pref3']
        }
      };
      
      return this.cleanVendorResponse(mockResponse);
    } catch (error) {
      logger.error('Error calling sync vendor:', error);
      throw error;
    }
  }

  async callAsyncVendor(payload) {
    try {
      logger.info('Calling async vendor');
      
      await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1000));
      
      const acknowledgment = {
        jobId: Math.random().toString(36).substr(2, 9),
        status: 'accepted',
        estimatedCompletion: new Date(Date.now() + 5000).toISOString()
      };
      
      setTimeout(async () => {
        try {
          const mockResponse = {
            id: acknowledgment.jobId,
            data: payload,
            timestamp: new Date().toISOString(),
            source: 'async-vendor',
            rawData: {
              userEmail: 'user@example.com',
              phoneNumber: '+1234567890',
              address: '  123 Main St, City, State 12345  ',
              preferences: ['pref1', 'pref2', 'pref3'],
              additionalData: {
                creditScore: 750,
                lastPurchase: '2023-12-01'
              }
            }
          };
          
          const cleanedResponse = this.cleanVendorResponse(mockResponse);
          
          await Job.findOneAndUpdate(
            { requestId: payload.requestId },
            { 
              status: 'complete',
              result: cleanedResponse,
              completedAt: new Date()
            }
          );
          
          logger.info(`Async job completed: ${payload.requestId}`);
        } catch (error) {
          logger.error('Error completing async job:', error);
          await Job.findOneAndUpdate(
            { requestId: payload.requestId },
            { 
              status: 'failed',
              error: error.message,
              completedAt: new Date()
            }
          );
        }
      }, 3000 + Math.random() * 4000);
      
      return acknowledgment;
    } catch (error) {
      logger.error('Error calling async vendor:', error);
      throw error;
    }
  }

  cleanVendorResponse(response) {
    try {
      // Handle null or undefined response
      if (!response) {
        return response;
      }
      
      const cleaned = {
        id: response.id,
        data: response.data,
        timestamp: response.timestamp,
        source: response.source,
        cleanedData: {}
      };
      
      if (response.rawData) {
        cleaned.cleanedData = {
          address: response.rawData.address ? response.rawData.address.trim() : null,
          preferences: response.rawData.preferences || [],
          ...(response.rawData.additionalData && {
            additionalData: {
              creditScore: response.rawData.additionalData.creditScore,
              lastPurchase: response.rawData.additionalData.lastPurchase
            }
          })
        };
      }
      
      return cleaned;
    } catch (error) {
      logger.error('Error cleaning vendor response:', error);
      return response;
    }
  }

  async handleWebhook(vendor, data) {
    try {
      logger.info(`Processing webhook for vendor: ${vendor}`);
      
      const cleanedResponse = this.cleanVendorResponse(data);
      
      const job = await Job.findOneAndUpdate(
        { 
          vendor: vendor,
          status: 'processing'
        },
        { 
          status: 'complete',
          result: cleanedResponse,
          completedAt: new Date()
        },
        { new: true }
      );
      
      if (!job) {
        logger.warn(`No processing job found for vendor: ${vendor}`);
        return false;
      }
      
      logger.info(`Webhook processed successfully for job: ${job.requestId}`);
      return true;
    } catch (error) {
      logger.error('Error processing webhook:', error);
      throw error;
    }
  }
}

export default new VendorService(); 