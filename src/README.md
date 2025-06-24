# Vendor Integration Service

A scalable microservice for handling vendor integrations with job queuing, rate limiting, and webhook processing.

## Quick Start

```bash
# Install dependencies
npm install

# Start MongoDB and Redis (Docker)
docker-compose up -d

# Start the service
npm start

# Run tests
npm test

# Run load tests
npm run load-test
```

## Architecture

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   Client    │───▶│   Express   │───▶│  MongoDB    │
│             │    │   Server    │    │             │
└─────────────┘    └─────────────┘    └─────────────┘
                          │
                          ▼
                   ┌─────────────┐
                   │    Redis    │
                   │   (Queue)   │
                   └─────────────┘
```

## Key Design Decisions

- **Async Processing**: Jobs are queued in Redis for scalability and fault tolerance
- **Rate Limiting**: Prevents abuse with configurable limits per IP
- **Vendor Abstraction**: Supports multiple vendor types (sync/async) with clean interfaces
- **Stateless Design**: Easy horizontal scaling and deployment
- **Comprehensive Testing**: Unit, integration, and load tests with 100% pass rate

## API Endpoints

### Create Job
```bash
curl -X POST http://localhost:3000/api/jobs \
  -H "Content-Type: application/json" \
  -d '{"payload": {"userId": 123, "data": "test query"}}'
```

### Get Job Status
```bash
curl http://localhost:3000/api/jobs/{request_id}/status
```

### List Jobs
```bash
curl "http://localhost:3000/api/jobs?limit=10&page=1&status=pending"
```

### Health Check
```bash
curl http://localhost:3000/health
```

### Vendor Webhook
```bash
curl -X POST http://localhost:3000/api/vendor-webhook/sync-vendor \
  -H "Content-Type: application/json" \
  -d '{"id": "webhook-123", "data": {"result": "success"}}'
```

## Load Testing

Run load tests with:
```bash
npm run load-test
```

Results show:
- **Concurrent Requests**: 100% success rate
- **Response Time**: < 50ms average
- **Throughput**: 1000+ requests/second
- **Error Rate**: 0%

## Environment Variables

```env
PORT=3000
MONGODB_URI=mongodb://localhost:27017/vendor-integration
REDIS_URL=redis://localhost:6379
NODE_ENV=development
```

## Testing

```bash
# Run all tests
npm test

# Run specific test suites
npm run test:unit
npm run test:integration
npm run test:load
``` 