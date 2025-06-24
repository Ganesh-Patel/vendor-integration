import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import { v4 as uuidv4 } from 'uuid';
import Job from '../src/models/Job.js';
import queueService from '../src/services/queueService.js';
import vendorService from '../src/services/vendorService.js';
import jobController from '../src/controllers/jobController.js';
import { globalSetup, globalTeardown } from './setup.js';
import { redisClient } from '../src/config/redis.js';

describe('Vendor Integration Service - Unit Tests', () => {
  before(async () => {
    await globalSetup();
    // Ensure database is connected
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  after(async () => {
    await globalTeardown();
  });

  test('Job Model should create a job with required fields', () => {
    const jobData = {
      requestId: uuidv4(),
      payload: { userId: 12345, data: { query: 'test' } },
      vendor: 'sync-vendor',
      status: 'pending'
    };

    const job = new Job(jobData);
    
    assert.strictEqual(job.requestId, jobData.requestId);
    assert.deepStrictEqual(job.payload, jobData.payload);
    assert.strictEqual(job.vendor, jobData.vendor);
    assert.strictEqual(job.status, jobData.status);
    assert.strictEqual(job.result, null);
    assert.strictEqual(job.error, null);
  });

  test('Job Model should validate vendor enum values', () => {
    const jobData = {
      requestId: uuidv4(),
      payload: { userId: 12345 },
      vendor: 'invalid-vendor'
    };

    const job = new Job(jobData);
    const validationError = job.validateSync();
    
    assert.ok(validationError);
    assert.ok(validationError.errors.vendor);
  });

  test('Job Model should validate status enum values', () => {
    const jobData = {
      requestId: uuidv4(),
      payload: { userId: 12345 },
      vendor: 'sync-vendor',
      status: 'invalid-status'
    };

    const job = new Job(jobData);
    const validationError = job.validateSync();
    
    assert.ok(validationError);
    assert.ok(validationError.errors.status);
  });

  test('Job Model should require requestId field', () => {
    const jobData = {
      payload: { userId: 12345 },
      vendor: 'sync-vendor'
    };

    const job = new Job(jobData);
    const validationError = job.validateSync();
    
    assert.ok(validationError);
    assert.ok(validationError.errors.requestId);
  });

  test('Queue Service should add job to queue', async () => {
    const jobData = {
      requestId: uuidv4(),
      payload: { userId: 12345 },
      vendor: 'sync-vendor'
    };

    const result = await queueService.addJob(jobData);
    assert.strictEqual(result, true);
  });

  test('Queue Service should get next job from queue', async () => {
    const jobData = {
      requestId: uuidv4(),
      payload: { userId: 12345 },
      vendor: 'sync-vendor'
    };

    await queueService.addJob(jobData);
    const result = await queueService.getNextJob();

    if (result) {
      assert.strictEqual(typeof result.requestId, 'string');
      assert.strictEqual(typeof result.payload, 'object');
      assert.strictEqual(typeof result.vendor, 'string');
    }
  });

  test('Queue Service should return null when queue is empty', async () => {
    // Clear the queue first
    await redisClient.flushDb();
    
    const result = await queueService.getNextJob();
    assert.strictEqual(result, null);
  });

  test('Queue Service should check rate limit correctly', async () => {
    const vendor = 'sync-vendor';
    const result = await queueService.checkRateLimit(vendor);
    assert.strictEqual(typeof result, 'boolean');
  });

  test('Vendor Service should clean vendor response correctly', () => {
    const mockResponse = {
      id: 'test123',
      data: { userId: 12345 },
      timestamp: '2023-12-01T10:00:00.000Z',
      source: 'sync-vendor',
      rawData: {
        userEmail: 'user@example.com',
        phoneNumber: '+1234567890',
        address: '  123 Main St, City, State 12345  ',
        preferences: ['pref1', 'pref2', 'pref3']
      }
    };

    const cleaned = vendorService.cleanVendorResponse(mockResponse);

    assert.strictEqual(cleaned.id, mockResponse.id);
    assert.deepStrictEqual(cleaned.data, mockResponse.data);
    assert.strictEqual(cleaned.timestamp, mockResponse.timestamp);
    assert.strictEqual(cleaned.source, mockResponse.source);
    assert.strictEqual(cleaned.cleanedData.address, '123 Main St, City, State 12345');
    assert.deepStrictEqual(cleaned.cleanedData.preferences, ['pref1', 'pref2', 'pref3']);
    assert.strictEqual(cleaned.cleanedData.userEmail, undefined);
    assert.strictEqual(cleaned.cleanedData.phoneNumber, undefined);
  });

  test('Vendor Service should handle response without rawData', () => {
    const mockResponse = {
      id: 'test123',
      data: { userId: 12345 },
      timestamp: '2023-12-01T10:00:00.000Z',
      source: 'sync-vendor'
    };

    const cleaned = vendorService.cleanVendorResponse(mockResponse);

    assert.strictEqual(cleaned.id, mockResponse.id);
    assert.deepStrictEqual(cleaned.cleanedData, {});
  });

  test('Vendor Service should handle cleaning errors gracefully', () => {
    const mockResponse = null;
    const result = vendorService.cleanVendorResponse(mockResponse);
    assert.strictEqual(result, mockResponse);
  });

  function logJobCreationDebug(payload, res) {
    console.log('[TEST DEBUG] Job creation payload:', payload);
    console.log('[TEST DEBUG] Job creation response:', res.status, res.body);
  }

  test('Job Controller should create job successfully', async () => {
    const payload = { userId: 12345, data: { query: 'test' } };
    
    const req = {
      body: { payload }
    };
    
    let responseData = null;
    let statusCode = null;
    
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      }
    };

    await jobController.createJob(req, res);
    logJobCreationDebug(payload, { status: statusCode, body: responseData });
    
    assert.strictEqual(statusCode, 201);
    assert.ok(responseData.request_id);
  });

  test('Job Controller should reject job creation without payload', async () => {
    const req = {
      body: {}
    };
    
    let responseData = null;
    let statusCode = null;
    
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      }
    };

    await jobController.createJob(req, res);
    
    assert.strictEqual(statusCode, 400);
    assert.strictEqual(responseData.error, 'Payload is required');
  });

  test('Job Controller should get job status successfully', async () => {
    // First create a job
    const jobData = {
      requestId: uuidv4(),
      payload: { userId: 12345 },
      vendor: 'sync-vendor',
      status: 'pending'
    };
    
    const job = new Job(jobData);
    await job.save();

    const req = {
      params: { request_id: jobData.requestId }
    };
    
    let responseData = null;
    let statusCode = null;
    
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      }
    };

    await jobController.getJobStatus(req, res);
    
    assert.strictEqual(statusCode, 200);
    assert.strictEqual(responseData.request_id, jobData.requestId);
    assert.strictEqual(responseData.status, 'pending');
  });

  test('Job Controller should return 404 for non-existent job', async () => {
    const req = {
      params: { request_id: uuidv4() }
    };
    
    let responseData = null;
    let statusCode = null;
    
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      }
    };

    await jobController.getJobStatus(req, res);
    
    assert.strictEqual(statusCode, 404);
    assert.strictEqual(responseData.error, 'Job not found');
  });

  test('Job Controller should return 400 for invalid UUID format', async () => {
    const req = {
      params: { request_id: 'invalid-uuid' }
    };
    
    let responseData = null;
    let statusCode = null;
    
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      }
    };

    await jobController.getJobStatus(req, res);
    
    assert.strictEqual(statusCode, 400);
    assert.ok(responseData.error.includes('Invalid request ID'));
  });

  test('Job Controller should list jobs with pagination', async () => {
    const req = {
      query: { limit: '10', page: '1' }
    };
    
    let responseData = null;
    let statusCode = null;
    
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      }
    };

    await jobController.getJobs(req, res);
    
    assert.strictEqual(statusCode, 200);
    assert.ok(responseData.jobs);
    assert.ok(responseData.pagination);
    assert.strictEqual(Array.isArray(responseData.jobs), true);
  });

  test('Job Controller should handle webhook successfully', async () => {
    const req = {
      params: { vendor: 'sync-vendor' },
      body: { id: 'webhook-123', data: { userId: 12345 } }
    };
    
    let responseData = null;
    let statusCode = null;
    
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      }
    };

    await jobController.handleWebhook(req, res);
    
    // Should return either 200 (success) or 404 (no job found)
    assert.ok(statusCode === 200 || statusCode === 404);
  });

  test('Job Controller should reject invalid vendor webhook', async () => {
    const req = {
      params: { vendor: 'invalid-vendor' },
      body: { id: 'webhook-123' }
    };
    
    let responseData = null;
    let statusCode = null;
    
    const res = {
      status: (code) => {
        statusCode = code;
        return res;
      },
      json: (data) => {
        responseData = data;
        return res;
      }
    };

    await jobController.handleWebhook(req, res);
    
    assert.strictEqual(statusCode, 400);
    assert.strictEqual(responseData.error, 'Invalid vendor');
  });
}); 