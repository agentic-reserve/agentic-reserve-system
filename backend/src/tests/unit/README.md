# Unit Tests for Memory Service

## Cache Service Tests

The cache service tests require Redis to be running. There are two ways to run Redis:

### Option 1: Using Docker Compose (Recommended)

1. Start Redis using Docker Compose:
   ```bash
   docker-compose up -d redis
   ```

2. Run the tests:
   ```bash
   npm run test -- cache-service.test.ts
   ```

3. Stop Redis when done:
   ```bash
   docker-compose down redis
   ```

### Option 2: Using Local Redis

1. Install Redis locally:
   - **Windows**: Download from https://github.com/microsoftarchive/redis/releases
   - **macOS**: `brew install redis`
   - **Linux**: `sudo apt-get install redis-server`

2. Start Redis:
   ```bash
   redis-server
   ```

3. Run the tests:
   ```bash
   npm run test -- cache-service.test.ts
   ```

## Environment Variables

The tests use the following environment variables (with defaults):

- `REDIS_URL`: Redis connection URL (default: `redis://localhost:6379`)
- `REDIS_PASSWORD`: Redis password (optional)

## Test Coverage

The cache service tests cover:

- ✅ Connection pooling (10-50 connections)
- ✅ Cache key generation with SHA-256 hashing
- ✅ Get/set/delete operations
- ✅ Pattern-based deletion
- ✅ TTL management
- ✅ Statistics tracking (hits, misses, hit rate)
- ✅ Memory monitoring
- ✅ Error handling

## Running All Tests

To run all unit tests:

```bash
npm run test
```

To run tests in watch mode:

```bash
npm run test:watch
```

## Troubleshooting

### Redis Connection Refused

If you see `ECONNREFUSED` errors:

1. Check if Redis is running:
   ```bash
   docker ps | grep redis
   # or
   redis-cli ping
   ```

2. Check the Redis URL in your environment:
   ```bash
   echo $REDIS_URL
   ```

3. Verify Redis is listening on the correct port:
   ```bash
   netstat -an | grep 6379
   ```

### Tests Timeout

If tests timeout during initialization:

1. Increase the test timeout in the test file
2. Check Redis logs for errors:
   ```bash
   docker logs ars-redis
   ```

3. Verify network connectivity to Redis
