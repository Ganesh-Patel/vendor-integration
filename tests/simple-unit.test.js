import { test, describe } from 'node:test';
import assert from 'node:assert';
import { v4 as uuidv4 } from 'uuid';
import Job from '../src/models/Job.js';
import vendorService from '../src/services/vendorService.js';

describe('Vendor Integration Service - Simple Unit Tests', () => {
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

  test('UUID generation should work correctly', () => {
    const uuid1 = uuidv4();
    const uuid2 = uuidv4();
    
    assert.strictEqual(typeof uuid1, 'string');
    assert.strictEqual(typeof uuid2, 'string');
    assert.notStrictEqual(uuid1, uuid2);
    
    // Check UUID format
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    assert.ok(uuidRegex.test(uuid1));
    assert.ok(uuidRegex.test(uuid2));
  });

  test('JSON operations should work correctly', () => {
    const testData = {
      userId: 12345,
      data: { query: 'test', timestamp: Date.now() },
      vendor: 'sync-vendor'
    };
    
    const jsonString = JSON.stringify(testData);
    const parsedData = JSON.parse(jsonString);
    
    assert.deepStrictEqual(parsedData, testData);
    assert.strictEqual(typeof jsonString, 'string');
  });

  test('Array operations should work correctly', () => {
    const numbers = [1, 2, 3, 4, 5];
    const doubled = numbers.map(n => n * 2);
    const evens = numbers.filter(n => n % 2 === 0);
    const sum = numbers.reduce((acc, n) => acc + n, 0);
    
    assert.deepStrictEqual(doubled, [2, 4, 6, 8, 10]);
    assert.deepStrictEqual(evens, [2, 4]);
    assert.strictEqual(sum, 15);
  });

  test('String operations should work correctly', () => {
    const testString = '  hello world  ';
    const trimmed = testString.trim();
    const upper = testString.toUpperCase();
    const lower = testString.toLowerCase();
    
    assert.strictEqual(trimmed, 'hello world');
    assert.strictEqual(upper, '  HELLO WORLD  ');
    assert.strictEqual(lower, '  hello world  ');
  });
}); 