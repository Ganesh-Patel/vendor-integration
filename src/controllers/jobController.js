import { v4 as uuidv4 } from 'uuid';
import Job from '../models/Job.js';
import queueService from '../services/queueService.js';
import vendorService from '../services/vendorService.js';
import logger from '../utils/logger.js';

class JobController {
  async createJob(req, res) {
    try {
      const { payload } = req.body;
      logger.info('[DEBUG] Incoming job creation payload:', payload);
      if (!payload) {
        logger.warn('[DEBUG] Payload missing in job creation request');
        return res.status(400).json({ error: 'Payload is required' });
      }
      const requestId = uuidv4();
      const vendor = Math.random() > 0.5 ? 'sync-vendor' : 'async-vendor';
      const job = new Job({
        requestId,
        payload,
        vendor,
        status: 'pending'
      });
      try {
        await job.save();
      } catch (err) {
        logger.error('[DEBUG] Error saving job:', err);
        return res.status(400).json({ error: 'Job validation failed', details: err.message });
      }
      try {
        await queueService.addJob({
          requestId,
          payload,
          vendor
        });
      } catch (err) {
        logger.error('[DEBUG] Error adding job to queue:', err);
        return res.status(500).json({ error: 'Failed to queue job', details: err.message });
      }
      logger.info(`[DEBUG] Job created: ${requestId} for vendor: ${vendor}`);
      res.status(201).json({
        request_id: requestId
      });
    } catch (error) {
      logger.error('[DEBUG] Error creating job:', error);
      res.status(500).json({ error: 'Internal server error', details: error.message });
    }
  }

  async getJobStatus(req, res) {
    try {
      const { request_id } = req.params;
      
      // Validate UUID format
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      if (!uuidRegex.test(request_id)) {
        return res.status(400).json({ error: 'Invalid request ID format' });
      }
      
      const job = await Job.findOne({ requestId: request_id });
      
      if (!job) {
        return res.status(404).json({ error: 'Job not found' });
      }
      
      const response = {
        status: job.status,
        request_id: job.requestId,
        vendor: job.vendor,
        created_at: job.createdAt,
        updated_at: job.updatedAt
      };
      
      if (job.status === 'complete') {
        response.result = job.result;
        response.completed_at = job.completedAt;
      } else if (job.status === 'failed') {
        response.error = job.error;
        response.completed_at = job.completedAt;
      }
      
      res.json(response);
    } catch (error) {
      logger.error('Error getting job status:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async handleWebhook(req, res) {
    try {
      const { vendor } = req.params;
      const data = req.body;
      
      if (!['sync-vendor', 'async-vendor'].includes(vendor)) {
        return res.status(400).json({ error: 'Invalid vendor' });
      }
      
      const success = await vendorService.handleWebhook(vendor, data);
      
      if (success) {
        res.json({ status: 'success', message: 'Webhook processed successfully' });
      } else {
        res.status(404).json({ error: 'No processing job found for this vendor' });
      }
    } catch (error) {
      logger.error('Error handling webhook:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }

  async getJobs(req, res) {
    try {
      const { status, vendor, limit = 10, page = 1 } = req.query;
      
      const filter = {};
      if (status) filter.status = status;
      if (vendor) filter.vendor = vendor;
      
      const skip = (parseInt(page) - 1) * parseInt(limit);
      
      const jobs = await Job.find(filter)
        .sort({ createdAt: -1 })
        .limit(parseInt(limit))
        .skip(skip)
        .select('-__v');
      
      const total = await Job.countDocuments(filter);
      
      res.json({
        jobs,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / parseInt(limit))
        }
      });
    } catch (error) {
      logger.error('Error getting jobs:', error);
      res.status(500).json({ error: 'Internal server error' });
    }
  }
}

export default new JobController(); 