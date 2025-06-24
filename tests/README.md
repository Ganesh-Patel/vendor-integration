# Vendor Integration Service - Test Suite

This directory contains comprehensive tests for the Vendor Integration Service, ensuring reliability, performance, and load balancing capabilities.

## Test Structure

### 1. Unit Tests (`unit.test.js`)
Tests individual components and services in isolation:
- **Job Model**: Validation, creation, and field requirements
- **Queue Service**: Redis operations, rate limiting, job management
- **Vendor Service**: Response cleaning, data processing
- **Job Controller**: Request handling, error responses
- **Error Handling**: Database, Redis, and service error scenarios
- **Data Validation**: UUID format, JSON structure, vendor types

### 2. Integration Tests (`integration.test.js`)
End-to-end API testing with real HTTP requests:
- **Health Check**: Service availability verification
- **Job Creation**: Successful creation, validation, error handling
- **Job Status Retrieval**: Status checking, pagination, filtering
- **Webhook Handling**: Vendor webhook processing
- **Rate Limiting**: Request throttling enforcement
- **Error Handling**: Malformed requests, missing routes
- **Data Validation**: Payload structure validation

### 3. Load Balancing Tests (`load-balancing.test.js`)
Performance and scalability testing:
- **Concurrent Job Creation**: 100-500 simultaneous requests
- **Concurrent Status Checks**: 200+ parallel status queries
- **Mixed Operations**: Combined create/status operations
- **Queue Performance**: 1000+ rapid queue operations
- **Database Performance**: Bulk operations, complex queries
- **Memory Usage**: Resource consumption monitoring
- **Error Recovery**: Service interruption handling
- **Data Consistency**: Concurrent operation integrity

## Running Tests

### Complete Test Suite
```bash
npm test
```
Runs all tests including unit, integration, load balancing, Artillery load tests, and mock vendor tests.

### Individual Test Suites
```bash
# Unit tests only
npm run test:unit

# Integration tests only
npm run test:integration

# Load balancing tests only
npm run test:load

# Artillery load tests only
npm run test:load-test-only

# Mock vendor tests only
npm run test:mock-only
```

### Manual Load Testing
```bash
# Run Artillery load tests
npm run load-test

# Run mock vendor service
npm run mock-vendor
```

## Test Configuration

### Environment Variables
Tests use the following environment variables:
- `NODE_ENV=test`: Enables test mode
- `MONGODB_URI`: MongoDB connection for test database
- `REDIS_URL`: Redis connection for test queue
- `PORT`: Test server port (default: 3000)

### Test Database
Tests use a separate test database to avoid affecting production data. The test runner automatically cleans up test data after each test suite.

## Performance Benchmarks

### Expected Performance Metrics
- **Concurrent Job Creation**: 100 requests in < 10 seconds
- **Status Checks**: 200 requests in < 5 seconds
- **Queue Operations**: 1000 operations in < 5 seconds
- **Database Queries**: 200 complex queries in < 1 second
- **Memory Usage**: < 100MB increase under load
- **Success Rate**: > 95% for all operations

### Load Test Scenarios
1. **Baseline Load**: 10 users, 30 seconds
2. **Peak Load**: 50 users, 60 seconds
3. **Stress Test**: 100 users, 120 seconds
4. **Spike Test**: 0-100 users in 30 seconds

## Test Coverage

### API Endpoints Tested
- `GET /health` - Health check
- `POST /api/jobs` - Job creation
- `GET /api/jobs/:request_id/status` - Job status
- `GET /api/jobs` - Job listing with pagination
- `POST /api/vendor-webhook/:vendor` - Webhook handling

### Error Scenarios Tested
- Invalid request payloads
- Missing required fields
- Rate limit exceeded
- Database connection failures
- Redis connection failures
- Vendor service unavailability
- Malformed JSON requests
- Invalid UUID formats

### Performance Scenarios Tested
- High concurrent load
- Memory leak detection
- Database query optimization
- Queue processing efficiency
- Error recovery mechanisms
- Data consistency under load

## Test Reports

The test runner generates comprehensive reports including:
- Test execution summary
- Performance metrics
- Success/failure rates
- Duration statistics
- Memory usage analysis

### Sample Report Output
```
🧪 Starting Comprehensive Test Suite
============================================================

🚀 Running integration tests: tests/integration.test.js
============================================================
✅ Integration tests passed

🚀 Running unit tests: tests/unit.test.js
============================================================
✅ Unit tests passed

🚀 Running loadBalancing tests: tests/load-balancing.test.js
============================================================
✅ Load balancing tests passed

============================================================
📊 TEST EXECUTION SUMMARY
============================================================
INTEGRATION TESTS: ✅ PASSED
  - Passed: 15
  - Failed: 0
  - Total: 15

UNIT TESTS: ✅ PASSED
  - Passed: 25
  - Failed: 0
  - Total: 25

LOADBALANCING TESTS: ✅ PASSED
  - Passed: 12
  - Failed: 0
  - Total: 12

OVERALL RESULTS:
  - Total Duration: 45000ms
  - Total Tests: 52
  - Passed: 52
  - Failed: 0
  - Success Rate: 100.00%

🎉 ALL TESTS PASSED!
============================================================
```

## Continuous Integration

The test suite is designed to run in CI/CD pipelines:
- Exit codes: 0 for success, 1 for failure
- Comprehensive logging for debugging
- Performance regression detection
- Automated cleanup of test data

## Troubleshooting

### Common Issues
1. **Database Connection**: Ensure MongoDB is running and accessible
2. **Redis Connection**: Verify Redis server is available
3. **Port Conflicts**: Check if port 3000 is available for tests
4. **Memory Issues**: Monitor system resources during load tests

### Debug Mode
Run tests with verbose logging:
```bash
NODE_ENV=test DEBUG=* npm test
```

### Test Data Cleanup
If tests fail unexpectedly, manually clean test data:
```bash
# Connect to MongoDB and clean test collections
mongo test-database --eval "db.jobs.deleteMany({})"
```

## Contributing

When adding new features:
1. Add corresponding unit tests
2. Add integration tests for API endpoints
3. Add load balancing tests for performance
4. Update this documentation
5. Ensure all tests pass before merging

## Test Dependencies

- **chai**: Assertion library
- **sinon**: Mocking and stubbing
- **supertest**: HTTP testing
- **artillery**: Load testing
- **uuid**: Test data generation 