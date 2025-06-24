import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../src/server.js';
import Job from '../src/models/Job.js';
import { globalSetup, globalTeardown } from './setup.js';

describe('Vendor Integration Service - Integration Tests', () => {
  let testJobs = [];

  before(async () => {
    await globalSetup();
    // Ensure database is connected
    await new Promise(resolve => setTimeout(resolve, 1000));
  });

  after(async () => {
    await globalTeardown();
  });

  function logJobCreationDebug(payload, res) {
    console.log('[TEST DEBUG] Job creation payload:', payload);
    console.log('[TEST DEBUG] Job creation response:', res.status, res.body);
  }

  test('Health check endpoint should return healthy status', async () => {
    const response = await request(app)
      .get('/health')
      .expect(200);

    assert.strictEqual(response.body.status, 'healthy');
    assert.strictEqual(typeof response.body.timestamp, 'string');
  });

  test('Should create job successfully with valid payload', async () => {
    const payload = {
      userId: 12345,
      data: { query: 'test query', timestamp: Date.now() }
    };

    const response = await request(app)
      .post('/api/jobs')
      .send({ payload })
      .expect(201);

    logJobCreationDebug(payload, response);
    assert.ok(response.body.request_id);
    assert.strictEqual(typeof response.body.request_id, 'string');
    testJobs.push(response.body.request_id);
  });

  test('Should reject job creation without payload', async () => {
    const response = await request(app)
      .post('/api/jobs')
      .send({})
      .expect(400);

    assert.strictEqual(response.body.error, 'Payload is required');
  });

  test('Should reject job creation with large payload', async () => {
    const largePayload = {
      userId: 12345,
      data: { query: 'x'.repeat(1000000) }
    };

    const response = await request(app)
      .post('/api/jobs')
      .send({ payload: largePayload })
      .expect(413);

    assert.ok(response.body.error.includes('Payload too large'));
  });

  test('Should get job status for existing job', async () => {
    if (testJobs.length === 0) {
      const payload = { userId: 12345, data: { query: 'test' } };
      const createResponse = await request(app)
        .post('/api/jobs')
        .send({ payload })
        .expect(201);
      testJobs.push(createResponse.body.request_id);
    }

    const jobId = testJobs[0];
    const response = await request(app)
      .get(`/api/jobs/${jobId}/status`)
      .expect(200);

    assert.ok(response.body.request_id);
    assert.ok(response.body.status);
    assert.ok(response.body.vendor);
    assert.strictEqual(response.body.request_id, jobId);
  });

  test('Should return 404 for non-existent job', async () => {
    const fakeJobId = uuidv4();
    const response = await request(app)
      .get(`/api/jobs/${fakeJobId}/status`)
      .expect(404);

    assert.strictEqual(response.body.error, 'Job not found');
  });

  test('Should return 400 for invalid request ID format', async () => {
    const response = await request(app)
      .get('/api/jobs/invalid-uuid/status')
      .expect(400);

    assert.ok(response.body.error.includes('Invalid request ID'));
  });

  test('Should list jobs with pagination', async () => {
    const response = await request(app)
      .get('/api/jobs?limit=10&page=1')
      .expect(200);

    assert.ok(response.body.jobs);
    assert.ok(response.body.pagination);
    assert.strictEqual(Array.isArray(response.body.jobs), true);
    assert.ok(response.body.pagination.total);
    assert.ok(response.body.pagination.page);
    assert.ok(response.body.pagination.limit);
  });

  test('Should filter jobs by status', async () => {
    const response = await request(app)
      .get('/api/jobs?status=pending&limit=5')
      .expect(200);

    assert.ok(response.body.jobs);
    assert.strictEqual(Array.isArray(response.body.jobs), true);
    
    if (response.body.jobs.length > 0) {
      response.body.jobs.forEach(job => {
        assert.strictEqual(job.status, 'pending');
      });
    }
  });

  test('Should filter jobs by vendor', async () => {
    const response = await request(app)
      .get('/api/jobs?vendor=sync-vendor&limit=5')
      .expect(200);

    assert.ok(response.body.jobs);
    assert.strictEqual(Array.isArray(response.body.jobs), true);
    
    if (response.body.jobs.length > 0) {
      response.body.jobs.forEach(job => {
        assert.strictEqual(job.vendor, 'sync-vendor');
      });
    }
  });

  test('Should process valid vendor webhook', async () => {
    const webhookData = {
      id: 'webhook-123',
      data: { userId: 12345, result: 'success' },
      timestamp: new Date().toISOString()
    };

    const response = await request(app)
      .post('/api/vendor-webhook/sync-vendor')
      .send(webhookData)
      .expect(200);

    assert.strictEqual(response.body.status, 'success');
    assert.strictEqual(response.body.message, 'Webhook processed successfully');
  });

  test('Should reject invalid vendor webhook', async () => {
    const webhookData = {
      id: 'webhook-123',
      data: { userId: 12345 }
    };

    const response = await request(app)
      .post('/api/vendor-webhook/invalid-vendor')
      .send(webhookData)
      .expect(400);

    assert.strictEqual(response.body.error, 'Invalid vendor');
  });

  test('Should enforce rate limiting on job creation', async () => {
    const promises = [];
    const rateLimitRequests = 15;

    for (let i = 0; i < rateLimitRequests; i++) {
      const payload = {
        userId: 10000 + i,
        data: { query: `rate-limit-test-${i}` }
      };

      promises.push(
        request(app)
          .post('/api/jobs')
          .send({ payload })
          .then(response => response.status)
          .catch(() => 500)
      );
    }

    const results = await Promise.all(promises);
    const successfulRequests = results.filter(status => status === 201).length;
    const rateLimitedRequests = results.filter(status => status === 429).length;

    // Should have some successful requests and some rate limited
    assert.ok(successfulRequests > 0, 'Should have some successful requests');
    assert.ok(rateLimitedRequests > 0, 'Should have some rate limited requests');
  });

  test('Should handle malformed JSON requests', async () => {
    const response = await request(app)
      .post('/api/jobs')
      .set('Content-Type', 'application/json')
      .send('{"invalid": json}')
      .expect(400);

    assert.ok(response.body.error);
  });

  test('Should handle server errors gracefully', async () => {
    // Test with a very large payload that might cause server errors
    const largePayload = {
      userId: 12345,
      data: { query: 'x'.repeat(5000000) } // 5MB payload
    };

    const response = await request(app)
      .post('/api/jobs')
      .send({ payload: largePayload })
      .expect(413);

    assert.ok(response.body.error);
  });

  test('Should validate job payload structure', async () => {
    const invalidPayload = null;

    const response = await request(app)
      .post('/api/jobs')
      .send({ payload: invalidPayload })
      .expect(400);

    assert.strictEqual(response.body.error, 'Payload is required');
  });

  test('Should handle nested payload structures', async () => {
    const nestedPayload = {
      userId: 12345,
      data: {
        query: 'test query',
        metadata: {
          source: 'test',
          timestamp: Date.now(),
          nested: {
            level: 3,
            value: 'deep'
          }
        }
      }
    };

    const response = await request(app)
      .post('/api/jobs')
      .send({ payload: nestedPayload })
      .expect(201);

    assert.ok(response.body.request_id);
    testJobs.push(response.body.request_id);
  });
}); 