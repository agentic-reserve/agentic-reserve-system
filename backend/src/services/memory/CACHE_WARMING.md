# Cache Warming Documentation

## Overview

Cache warming is a performance optimization technique that pre-loads frequently accessed data into Redis cache on service startup. This ensures that initial queries for ARS protocol wallets respond quickly without waiting for database queries.

## Implementation

The cache warming functionality is implemented in two main components:

### 1. CacheService.warmCache()

Located in `backend/src/services/memory/cache-service.ts`

**Purpose:** Pre-loads data for specified wallet addresses into Redis cache.

**Pre-loaded Data:**
- **Wallet Balances**: All token balances for each wallet
- **Recent Transactions**: Last 24 hours of transaction history (up to 100 transactions)
- **PnL Snapshots**: Latest PnL calculations for all time periods (24h, 7d, 30d, all)

**Usage:**
```typescript
import { getCacheService } from './services/memory/cache-service';

const cacheService = getCacheService();
await cacheService.initialize();

const walletAddresses = [
  'wallet1address...',
  'wallet2address...',
];

const result = await cacheService.warmCache(walletAddresses);
console.log(`Cache warmed: ${result.successCount} successful, ${result.errorCount} errors, ${result.totalTimeMs}ms`);
```

**Return Value:**
```typescript
{
  successCount: number;    // Number of wallets successfully cached
  errorCount: number;      // Number of wallets that failed
  totalTimeMs: number;     // Total time taken in milliseconds
}
```

**Error Handling:**
- Continues processing remaining wallets if one fails
- Logs errors for each failed wallet
- Returns summary with success/error counts

### 2. WalletRegistrationManager.autoRegisterAndWarmCache()

Located in `backend/src/services/memory/wallet-registration.ts`

**Purpose:** Combines auto-registration of ARS protocol wallets with cache warming for optimal startup performance.

**Process:**
1. Auto-registers ARS protocol wallets (if not already registered)
2. Retrieves list of all protocol wallet addresses from environment
3. Warms cache for all protocol wallets

**Usage:**
```typescript
import { WalletRegistrationManager } from './services/memory/wallet-registration';
import { getCacheService } from './services/memory/cache-service';

const walletManager = new WalletRegistrationManager();
const cacheService = getCacheService();

const result = await walletManager.autoRegisterAndWarmCache(cacheService);
console.log(`Registered: ${result.registeredCount}, Cache warmed: ${result.cacheWarmingResults.successCount}`);
```

**Return Value:**
```typescript
{
  registeredCount: number;           // Number of newly registered wallets
  cacheWarmingResults: {
    successCount: number;            // Number of wallets successfully cached
    errorCount: number;              // Number of wallets that failed
    totalTimeMs: number;             // Total time taken in milliseconds
  };
}
```

## Configuration

Cache warming is controlled by environment variables:

### Required Environment Variables

```bash
# Enable auto-registration of protocol wallets
MEMORY_AUTO_REGISTER=true

# Comma-separated list of ARS protocol wallet addresses
MEMORY_PROTOCOL_WALLETS=wallet1address,wallet2address,wallet3address
```

### Optional Environment Variables

```bash
# Redis connection
REDIS_URL=redis://localhost:6379
REDIS_PASSWORD=your-redis-password

# Cache configuration
MEMORY_CACHE_TTL=300                    # Cache TTL in seconds (default: 5 minutes)
MEMORY_CACHE_MEMORY_THRESHOLD=0.8       # Memory threshold for eviction (default: 80%)

# Connection pool configuration
REDIS_POOL_MIN=10                       # Minimum connections (default: 10)
REDIS_POOL_MAX=50                       # Maximum connections (default: 50)
```

## Integration with Service Startup

To integrate cache warming into your service startup sequence:

```typescript
// backend/src/index.ts or similar

import { WalletRegistrationManager } from './services/memory/wallet-registration';
import { getCacheService, initializeCacheService } from './services/memory/cache-service';

async function startServer() {
  try {
    // 1. Initialize cache service
    await initializeCacheService();
    console.log('Cache service initialized');

    // 2. Auto-register protocol wallets and warm cache
    const walletManager = new WalletRegistrationManager();
    const result = await walletManager.autoRegisterAndWarmCache();
    
    console.log(`Startup complete:`);
    console.log(`  - Registered wallets: ${result.registeredCount}`);
    console.log(`  - Cache warmed: ${result.cacheWarmingResults.successCount}`);
    console.log(`  - Cache warming time: ${result.cacheWarmingResults.totalTimeMs}ms`);

    // 3. Start your server
    // ... rest of server initialization
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
```

## Performance Benefits

Cache warming provides several performance benefits:

1. **Faster Initial Queries**: First queries for protocol wallets respond in <200ms (from cache) instead of querying Supabase
2. **Reduced Database Load**: Frequently accessed data is served from Redis, reducing load on PostgreSQL
3. **Improved User Experience**: Dashboard and API endpoints respond immediately on startup
4. **Predictable Performance**: Cache hit rate is high for protocol wallets from the start

## Cache Key Format

Cache warming uses the standard cache key format:

```
wallet:{address}:balances
wallet:{address}:transactions:{params_hash}
wallet:{address}:pnl:24h
wallet:{address}:pnl:7d
wallet:{address}:pnl:30d
wallet:{address}:pnl:all
```

All cached data has a 5-minute TTL by default (configurable via `MEMORY_CACHE_TTL`).

## Monitoring

Monitor cache warming performance using the returned metrics:

```typescript
const result = await walletManager.autoRegisterAndWarmCache();

// Log metrics
console.log('Cache Warming Metrics:');
console.log(`  Success Rate: ${(result.cacheWarmingResults.successCount / (result.cacheWarmingResults.successCount + result.cacheWarmingResults.errorCount) * 100).toFixed(2)}%`);
console.log(`  Average Time per Wallet: ${(result.cacheWarmingResults.totalTimeMs / result.cacheWarmingResults.successCount).toFixed(2)}ms`);

// Check cache stats
const cacheService = getCacheService();
const stats = cacheService.getStats();
console.log('Cache Stats:', stats);
```

## Testing

To test cache warming functionality:

1. **Start Redis:**
   ```bash
   docker-compose up -d redis
   ```

2. **Configure Environment:**
   ```bash
   export MEMORY_AUTO_REGISTER=true
   export MEMORY_PROTOCOL_WALLETS=test_wallet_1,test_wallet_2
   export REDIS_URL=redis://localhost:6379
   ```

3. **Run Tests:**
   ```bash
   npm run test -- cache-warming.test.ts
   ```

## Troubleshooting

### Cache Warming Fails

**Symptom:** `errorCount > 0` in cache warming results

**Possible Causes:**
- Wallet not registered in `wallet_registrations` table
- No data available for wallet (balances, transactions, PnL)
- Redis connection issues
- Supabase connection issues

**Solution:**
- Check logs for specific error messages
- Verify wallet is registered: `SELECT * FROM wallet_registrations WHERE address = 'wallet_address'`
- Verify Redis is running: `redis-cli ping`
- Verify Supabase connection: Check `SUPABASE_URL` and `SUPABASE_KEY`

### Slow Cache Warming

**Symptom:** `totalTimeMs` is very high (>10 seconds for a few wallets)

**Possible Causes:**
- Large amount of data to cache (many transactions, balances)
- Slow Supabase queries (missing indexes)
- Network latency to Supabase
- Redis connection pool exhausted

**Solution:**
- Check Supabase query performance
- Verify indexes exist on `wallet_transactions`, `wallet_balances`, `wallet_pnl` tables
- Increase Redis connection pool size: `REDIS_POOL_MAX=100`
- Consider caching fewer transactions (modify `warmTransactionHistory` limit)

### Cache Not Being Used

**Symptom:** Queries are slow even after cache warming

**Possible Causes:**
- Cache keys don't match query keys
- Cache TTL expired
- Cache was invalidated by transaction updates

**Solution:**
- Verify cache keys match: Use `cacheService.generateCacheKey()` with same parameters
- Check cache TTL: `cacheService.getTTL(key)`
- Check cache stats: `cacheService.getStats()` - verify `hitRate > 0`

## Requirements Validation

This implementation validates the following requirements:

- **Requirement 9.6**: THE Memory_Service SHALL support cache warming for ARS protocol wallets on startup
- **Requirement 11.1**: THE Memory_Service SHALL auto-register all ARS protocol wallets from configuration

## Related Documentation

- [Cache Service Documentation](./cache-service.ts)
- [Wallet Registration Documentation](./wallet-registration.ts)
- [Memory Service Design Document](../../../.kiro/specs/solder-cortex-supabase-integration/design.md)
