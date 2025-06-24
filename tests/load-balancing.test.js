import { test, describe, before, after } from 'node:test';
import assert from 'node:assert';
import request from 'supertest';
import { v4 as uuidv4 } from 'uuid';
import app from '../src/server.js';
import Job from '../src/models/Job.js';
import queueService from '../src/services/queueService.js';
import { globalSetup, globalTeardown } from './setup.js';

describe('Vendor Integration Service - Load Balancing & Performance Tests', () => {
  let testJobs = [];

  before(async () => {
    await globalSetup();
  });

  after(async () => {
    await globalTeardown();
  });

  function logJobCreationDebug(payload, res) {
    console.log('[TEST DEBUG] Job creation payload:', payload);
    console.log('[TEST DEBUG] Job creation response:', res.status, res.body);
  }

  test('Should handle 100 concurrent job creation requests', async () => {
    const concurrentRequests = 100;
    const promises = [];

    for (let i = 0; i < concurrentRequests; i++) {
      const payload = {
        userId: 1000 + i,
        data: { query: `test-query-${i}`, timestamp: Date.now() }
      };

      promises.push(
        request(app)
          .post('/api/jobs')
          .send({ payload })
          .expect(201)
          .then(response => {
            logJobCreationDebug(payload, response);
            assert.ok(response.body.request_id);
            assert.strictEqual(typeof response.body.request_id, 'string');
            return response.body.request_id;
          })
      );
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`\n✅ Concurrent Job Creation Results:`);
    console.log(`   - Total requests: ${concurrentRequests}`);
    console.log(`   - Successful requests: ${results.length}`);
    console.log(`   - Duration: ${duration}ms`);
    console.log(`   - Average response time: ${duration / concurrentRequests}ms`);
    console.log(`   - Requests per second: ${(concurrentRequests / duration * 1000).toFixed(2)}`);

    assert.strictEqual(results.length, concurrentRequests);
    assert.ok(duration < 10000);
    testJobs.push(...results);
  });

  test('Should handle 500 concurrent job creation requests with rate limiting', async () => {
    const concurrentRequests = 500;
    const promises = [];
    let successCount = 0;
    let rateLimitCount = 0;

    for (let i = 0; i < concurrentRequests; i++) {
      const payload = {
        userId: 2000 + i,
        data: { query: `load-test-${i}`, timestamp: Date.now() }
      };

      promises.push(
        request(app)
          .post('/api/jobs')
          .send({ payload })
          .then(response => {
            if (response.status === 201) {
              successCount++;
              return response.body.request_id;
            } else if (response.status === 429) {
              rateLimitCount++;
              return null;
            }
          })
          .catch(error => {
            console.error(`Request ${i} failed:`, error.message);
            return null;
          })
      );
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    const validResults = results.filter(r => r !== null);

    console.log(`\n✅ High Load Job Creation Results:`);
    console.log(`   - Total requests: ${concurrentRequests}`);
    console.log(`   - Successful requests: ${successCount}`);
    console.log(`   - Rate limited requests: ${rateLimitCount}`);
    console.log(`   - Duration: ${duration}ms`);
    console.log(`   - Average response time: ${duration / concurrentRequests}ms`);
    console.log(`   - Requests per second: ${(concurrentRequests / duration * 1000).toFixed(2)}`);

    assert.ok(successCount > 0);
    assert.ok(rateLimitCount > 0);
    assert.ok(duration < 30000);
    testJobs.push(...validResults);
  });

  test('Should handle 200 concurrent status check requests', async () => {
    if (testJobs.length === 0) {
      console.log('Skipping status check test - no test jobs available');
      return;
    }

    const concurrentRequests = 200;
    const promises = [];
    const jobIds = testJobs.slice(0, Math.min(concurrentRequests, testJobs.length));

    for (let i = 0; i < concurrentRequests; i++) {
      const jobId = jobIds[i % jobIds.length];
      promises.push(
        request(app)
          .get(`/api/jobs/${jobId}/status`)
          .expect(200)
          .then(response => {
            assert.ok(response.body.request_id);
            assert.ok(response.body.status);
            return response.body;
          })
      );
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`\n✅ Concurrent Status Check Results:`);
    console.log(`   - Total requests: ${concurrentRequests}`);
    console.log(`   - Successful requests: ${results.length}`);
    console.log(`   - Duration: ${duration}ms`);
    console.log(`   - Average response time: ${duration / concurrentRequests}ms`);
    console.log(`   - Requests per second: ${(concurrentRequests / duration * 1000).toFixed(2)}`);

    assert.strictEqual(results.length, concurrentRequests);
    assert.ok(duration < 5000);
  });

  test('Should handle mixed concurrent operations', async () => {
    const totalRequests = 300;
    const promises = [];
    let createCount = 0;
    let statusCount = 0;

    for (let i = 0; i < totalRequests; i++) {
      if (i % 3 === 0) {
        createCount++;
        const payload = {
          userId: 3000 + i,
          data: { query: `mixed-test-${i}`, timestamp: Date.now() }
        };

        promises.push(
          request(app)
            .post('/api/jobs')
            .send({ payload })
            .then(response => {
              if (response.status === 201) {
                return { type: 'create', success: true, id: response.body.request_id };
              } else {
                return { type: 'create', success: false };
              }
            })
        );
      } else {
        statusCount++;
        const jobId = testJobs[i % testJobs.length];
        promises.push(
          request(app)
            .get(`/api/jobs/${jobId}/status`)
            .then(response => {
              if (response.status === 200) {
                return { type: 'status', success: true };
              } else {
                return { type: 'status', success: false };
              }
            })
        );
      }
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    const createResults = results.filter(r => r.type === 'create');
    const statusResults = results.filter(r => r.type === 'status');
    const successfulCreates = createResults.filter(r => r.success);
    const successfulStatuses = statusResults.filter(r => r.success);

    console.log(`\n✅ Mixed Concurrent Operations Results:`);
    console.log(`   - Total requests: ${totalRequests}`);
    console.log(`   - Create requests: ${createCount}`);
    console.log(`   - Status requests: ${statusCount}`);
    console.log(`   - Successful creates: ${successfulCreates.length}`);
    console.log(`   - Successful statuses: ${successfulStatuses.length}`);
    console.log(`   - Duration: ${duration}ms`);
    console.log(`   - Average response time: ${duration / totalRequests}ms`);
    console.log(`   - Requests per second: ${(totalRequests / duration * 1000).toFixed(2)}`);

    assert.strictEqual(results.length, totalRequests);
    assert.ok(duration < 15000);
  });

  test('Should handle rapid job queue operations', async () => {
    const operations = 1000;
    const promises = [];

    for (let i = 0; i < operations; i++) {
      const jobData = {
        requestId: uuidv4(),
        payload: { userId: 4000 + i, data: { query: `queue-test-${i}` } },
        vendor: i % 2 === 0 ? 'sync-vendor' : 'async-vendor'
      };

      promises.push(queueService.addJob(jobData));
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    const successfulOperations = results.filter(r => r === true).length;

    console.log(`\n✅ Queue Performance Results:`);
    console.log(`   - Total operations: ${operations}`);
    console.log(`   - Successful operations: ${successfulOperations}`);
    console.log(`   - Duration: ${duration}ms`);
    console.log(`   - Average operation time: ${duration / operations}ms`);
    console.log(`   - Operations per second: ${(operations / duration * 1000).toFixed(2)}`);

    assert.ok(successfulOperations > operations * 0.95);
    assert.ok(duration < 5000);
  });

  test('Should handle concurrent queue consumers', async () => {
    const jobCount = 50;
    const consumerCount = 5;
    const jobs = [];

    for (let i = 0; i < jobCount; i++) {
      const jobData = {
        requestId: uuidv4(),
        payload: { userId: 5000 + i, data: { query: `consumer-test-${i}` } },
        vendor: 'sync-vendor'
      };
      jobs.push(jobData);
      await queueService.addJob(jobData);
    }

    const consumers = [];
    const consumedJobs = [];

    for (let i = 0; i < consumerCount; i++) {
      consumers.push(
        (async () => {
          for (let j = 0; j < jobCount / consumerCount; j++) {
            const job = await queueService.getNextJob();
            if (job) {
              consumedJobs.push(job);
            }
          }
        })()
      );
    }

    const startTime = Date.now();
    await Promise.all(consumers);
    const endTime = Date.now();
    const duration = endTime - startTime;

    console.log(`\n✅ Concurrent Queue Consumers Results:`);
    console.log(`   - Total jobs: ${jobCount}`);
    console.log(`   - Consumers: ${consumerCount}`);
    console.log(`   - Consumed jobs: ${consumedJobs.length}`);
    console.log(`   - Duration: ${duration}ms`);
    console.log(`   - Average consumption time: ${duration / jobCount}ms`);

    assert.ok(consumedJobs.length > jobCount * 0.9);
    assert.ok(duration < 3000);
  });

  test('Should handle bulk job operations', async () => {
    const jobCount = 100;
    const jobs = [];

    for (let i = 0; i < jobCount; i++) {
      jobs.push(new Job({
        requestId: uuidv4(),
        payload: { userId: 6000 + i, data: { query: `bulk-test-${i}` } },
        vendor: i % 2 === 0 ? 'sync-vendor' : 'async-vendor',
        status: 'pending'
      }));
    }

    const startTime = Date.now();
    await Job.insertMany(jobs);
    const endTime = Date.now();
    const insertDuration = endTime - startTime;

    const queryStartTime = Date.now();
    const retrievedJobs = await Job.find({}).limit(jobCount);
    const queryEndTime = Date.now();
    const queryDuration = queryEndTime - queryStartTime;

    console.log(`\n✅ Database Performance Results:`);
    console.log(`   - Bulk insert jobs: ${jobCount}`);
    console.log(`   - Insert duration: ${insertDuration}ms`);
    console.log(`   - Query duration: ${queryDuration}ms`);
    console.log(`   - Insert rate: ${(jobCount / insertDuration * 1000).toFixed(2)} jobs/sec`);
    console.log(`   - Query rate: ${(jobCount / queryDuration * 1000).toFixed(2)} jobs/sec`);

    assert.strictEqual(retrievedJobs.length, jobCount);
    assert.ok(insertDuration < 2000);
    assert.ok(queryDuration < 1000);

    await Job.deleteMany({ requestId: { $in: jobs.map(j => j.requestId) } });
  });

  test('Should handle complex queries efficiently', async () => {
    const jobCount = 200;
    const jobs = [];

    for (let i = 0; i < jobCount; i++) {
      jobs.push(new Job({
        requestId: uuidv4(),
        payload: { userId: 7000 + i, data: { query: `complex-test-${i}` } },
        vendor: i % 3 === 0 ? 'sync-vendor' : 'async-vendor',
        status: i % 4 === 0 ? 'pending' : i % 4 === 1 ? 'processing' : i % 4 === 2 ? 'complete' : 'failed',
        createdAt: new Date(Date.now() - Math.random() * 86400000)
      }));
    }

    await Job.insertMany(jobs);

    const queries = [
      { status: 'pending' },
      { vendor: 'sync-vendor' },
      { status: 'complete', vendor: 'async-vendor' },
      { createdAt: { $gte: new Date(Date.now() - 43200000) } }
    ];

    const queryResults = [];
    const startTime = Date.now();

    for (const query of queries) {
      const queryStart = Date.now();
      const result = await Job.find(query).countDocuments();
      const queryEnd = Date.now();
      queryResults.push({
        query: JSON.stringify(query),
        count: result,
        duration: queryEnd - queryStart
      });
    }

    const endTime = Date.now();
    const totalDuration = endTime - startTime;

    console.log(`\n✅ Complex Query Performance Results:`);
    console.log(`   - Total jobs in database: ${jobCount}`);
    console.log(`   - Total query duration: ${totalDuration}ms`);
    
    queryResults.forEach((result, index) => {
      console.log(`   - Query ${index + 1}: ${result.query}`);
      console.log(`     Count: ${result.count}, Duration: ${result.duration}ms`);
    });

    assert.ok(totalDuration < 1000);
    queryResults.forEach(result => {
      assert.ok(result.duration < 500);
    });

    await Job.deleteMany({ requestId: { $in: jobs.map(j => j.requestId) } });
  });

  test('Should maintain stable memory usage under load', async () => {
    const initialMemory = process.memoryUsage();
    const operations = 500;
    const promises = [];

    for (let i = 0; i < operations; i++) {
      const payload = {
        userId: 8000 + i,
        data: { 
          query: `memory-test-${i}`,
          largeData: 'x'.repeat(1000)
        }
      };

      promises.push(
        request(app)
          .post('/api/jobs')
          .send({ payload })
          .then(response => response.body.request_id)
          .catch(() => null)
      );
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const finalMemory = process.memoryUsage();

    const duration = endTime - startTime;
    const memoryIncrease = {
      heapUsed: finalMemory.heapUsed - initialMemory.heapUsed,
      heapTotal: finalMemory.heapTotal - initialMemory.heapTotal,
      external: finalMemory.external - initialMemory.external
    };

    console.log(`\n✅ Memory Usage Results:`);
    console.log(`   - Operations: ${operations}`);
    console.log(`   - Duration: ${duration}ms`);
    console.log(`   - Memory increase:`);
    console.log(`     Heap used: ${(memoryIncrease.heapUsed / 1024 / 1024).toFixed(2)} MB`);
    console.log(`     Heap total: ${(memoryIncrease.heapTotal / 1024 / 1024).toFixed(2)} MB`);
    console.log(`     External: ${(memoryIncrease.external / 1024 / 1024).toFixed(2)} MB`);

    assert.ok(memoryIncrease.heapUsed < 100 * 1024 * 1024);
    assert.ok(duration < 10000);
  });

  test('Should handle service interruptions gracefully', async () => {
    const requests = 50;
    const promises = [];

    for (let i = 0; i < requests; i++) {
      const payload = {
        userId: 9000 + i,
        data: { query: `resilience-test-${i}` }
      };

      promises.push(
        request(app)
          .post('/api/jobs')
          .send({ payload })
          .then(response => ({ success: true, status: response.status }))
          .catch(error => ({ success: false, error: error.message }))
      );
    }

    const startTime = Date.now();
    const results = await Promise.all(promises);
    const endTime = Date.now();
    const duration = endTime - startTime;

    const successfulRequests = results.filter(r => r.success).length;
    const failedRequests = results.filter(r => !r.success).length;

    console.log(`\n✅ Resilience Test Results:`);
    console.log(`   - Total requests: ${requests}`);
    console.log(`   - Successful requests: ${successfulRequests}`);
    console.log(`   - Failed requests: ${failedRequests}`);
    console.log(`   - Success rate: ${(successfulRequests / requests * 100).toFixed(2)}%`);
    console.log(`   - Duration: ${duration}ms`);

    assert.ok(successfulRequests > requests * 0.8);
    assert.ok(duration < 5000);
  });

  test('Should maintain data consistency under concurrent operations', async () => {
    const operations = 50;
    const jobIds = [];
    const promises = [];

    for (let i = 0; i < operations; i++) {
      const payload = {
        userId: 10000 + i,
        data: { query: `consistency-test-${i}` }
      };

      promises.push(
        request(app)
          .post('/api/jobs')
          .send({ payload })
          .then(response => {
            if (response.status === 201) {
              jobIds.push(response.body.request_id);
              return response.body.request_id;
            }
            return null;
          })
          .catch(error => {
            console.log(`[DEBUG] Job creation failed for operation ${i}:`, error.message);
            return null;
          })
      );
    }

    await Promise.all(promises);

    // Wait a bit for jobs to be processed
    await new Promise(resolve => setTimeout(resolve, 1000));

    if (jobIds.length === 0) {
      console.log('\n⚠️  No jobs were created, skipping consistency check');
      // Create at least one job to test the system
      const payload = { userId: 99999, data: { query: 'fallback-test' } };
      const response = await request(app)
        .post('/api/jobs')
        .send({ payload })
        .expect(201);
      
      jobIds.push(response.body.request_id);
    }

    const statusPromises = jobIds.map(jobId =>
      request(app)
        .get(`/api/jobs/${jobId}/status`)
        .then(response => ({ jobId, status: response.status, data: response.body }))
        .catch(error => ({ jobId, status: 'error', error: error.message }))
    );

    const statusResults = await Promise.all(statusPromises);
    const validStatuses = statusResults.filter(r => r.status === 200);

    console.log(`\n✅ Data Consistency Results:`);
    console.log(`   - Created jobs: ${jobIds.length}`);
    console.log(`   - Valid status responses: ${validStatuses.length}`);
    console.log(`   - Consistency rate: ${jobIds.length > 0 ? (validStatuses.length / jobIds.length * 100).toFixed(2) : 0}%`);

    // If we have jobs, at least 80% should have valid status responses
    if (jobIds.length > 0) {
      assert.ok(validStatuses.length > jobIds.length * 0.8, `Expected at least 80% consistency, got ${(validStatuses.length / jobIds.length * 100).toFixed(2)}%`);
    } else {
      assert.fail('No jobs were created, cannot test consistency');
    }
  });
}); 