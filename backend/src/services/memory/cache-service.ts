import { createClient, RedisClientType } from 'redis';
import { createHash } from 'crypto';
import { config } from '../../config';

/**
 * Cache Service for Memory Layer
 * 
 * Provides Redis caching with connection pooling for the Memory Service.
 * Implements get/set/delete operations with consistent cache key generation
 * using SHA-256 hashing for query parameters.
 * 
 * Cache Key Format: wallet:{address}:{query_type}:{params_hash}
 * 
 * Connection Pool: 10-50 connections (configurable via environment)
 * Default TTL: 5 minutes (300 seconds)
 * 
 * Validates Requirements: 9.1, 9.5, 13.3
 */

export interface CacheServiceConfig {
  url: string;
  password?: string;
  poolMin: number;
  poolMax: number;
  ttl: number;
  memoryThreshold: number;
}

export interface CacheStats {
  hits: number;
  misses: number;
  sets: number;
  deletes: number;
  errors: number;
  hitRate: number;
}

/**
 * Cache Service with Redis connection pooling
 */
export class CacheService {
  private clients: RedisClientType[] = [];
  private availableClients: RedisClientType[] = [];
  private config: CacheServiceConfig;
  private stats: CacheStats = {
    hits: 0,
    misses: 0,
    sets: 0,
    deletes: 0,
    errors: 0,
    hitRate: 0,
  };
  private isInitialized = false;

  constructor(customConfig?: Partial<CacheServiceConfig>) {
    this.config = {
      url: config.redis.url,
      password: config.redis.password || undefined,
      poolMin: config.redis.pool.min,
      poolMax: config.redis.pool.max,
      ttl: config.memoryService.cache.ttl,
      memoryThreshold: config.memoryService.cache.memoryThreshold,
      ...customConfig,
    };
  }

  /**
   * Initialize the connection pool
   * Creates minimum number of connections on startup
   * Configures Redis eviction policy for automatic LRU eviction
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) {
      return;
    }

    console.log(`[CacheService] Initializing connection pool (min: ${this.config.poolMin}, max: ${this.config.poolMax})`);

    // Create minimum number of connections
    for (let i = 0; i < this.config.poolMin; i++) {
      const client = await this.createClient();
      this.clients.push(client);
      this.availableClients.push(client);
    }

    // Configure Redis eviction policy for automatic LRU eviction
    await this.configureEvictionPolicy();

    this.isInitialized = true;
    console.log(`[CacheService] Connection pool initialized with ${this.clients.length} connections`);
  }

  /**
   * Create a new Redis client
   */
  private async createClient(): Promise<RedisClientType> {
    const client = createClient({
      url: this.config.url,
      password: this.config.password,
    }) as RedisClientType;

    client.on('error', (err) => {
      console.error('[CacheService] Redis Client Error:', err);
      this.stats.errors++;
    });

    client.on('reconnecting', () => {
      console.log('[CacheService] Redis client reconnecting...');
    });

    client.on('ready', () => {
      console.log('[CacheService] Redis client ready');
    });

    await client.connect();
    return client;
  }

  /**
   * Acquire a client from the pool
   * Creates a new client if pool is not at max capacity and no clients are available
   */
  private async acquireClient(): Promise<RedisClientType> {
    if (!this.isInitialized) {
      await this.initialize();
    }

    // If there's an available client, use it
    if (this.availableClients.length > 0) {
      return this.availableClients.pop()!;
    }

    // If we haven't reached max pool size, create a new client
    if (this.clients.length < this.config.poolMax) {
      const client = await this.createClient();
      this.clients.push(client);
      console.log(`[CacheService] Pool expanded to ${this.clients.length} connections`);
      return client;
    }

    // Wait for a client to become available
    return new Promise((resolve) => {
      const checkInterval = setInterval(() => {
        if (this.availableClients.length > 0) {
          clearInterval(checkInterval);
          resolve(this.availableClients.pop()!);
        }
      }, 10);
    });
  }

  /**
   * Release a client back to the pool
   */
  private releaseClient(client: RedisClientType): void {
    if (!this.availableClients.includes(client)) {
      this.availableClients.push(client);
    }
  }

  /**
   * Generate cache key with consistent format
   * Format: wallet:{address}:{query_type}:{params_hash}
   * 
   * @param address - Wallet address
   * @param queryType - Type of query (e.g., 'transactions', 'balances', 'pnl')
   * @param params - Query parameters to hash
   * @returns Formatted cache key
   */
  generateCacheKey(address: string, queryType: string, params?: Record<string, any>): string {
    let key = `wallet:${address}:${queryType}`;
    
    if (params && Object.keys(params).length > 0) {
      const paramsHash = this.hashParams(params);
      key += `:${paramsHash}`;
    }
    
    return key;
  }

  /**
   * Generate SHA-256 hash of query parameters
   * Ensures consistent hashing by sorting keys
   * 
   * @param params - Query parameters to hash
   * @returns SHA-256 hash (hex string)
   */
  private hashParams(params: Record<string, any>): string {
    // Sort keys for consistent hashing
    const sortedKeys = Object.keys(params).sort();
    const sortedParams: Record<string, any> = {};
    
    for (const key of sortedKeys) {
      sortedParams[key] = params[key];
    }
    
    const paramsString = JSON.stringify(sortedParams);
    return createHash('sha256').update(paramsString).digest('hex');
  }

  /**
   * Get data from cache
   * 
   * @param key - Cache key
   * @returns Cached data or null if not found
   */
  async get<T>(key: string): Promise<T | null> {
    const client = await this.acquireClient();
    
    try {
      const data = await client.get(key);
      
      if (data) {
        this.stats.hits++;
        this.updateHitRate();
        return JSON.parse(data) as T;
      } else {
        this.stats.misses++;
        this.updateHitRate();
        return null;
      }
    } catch (error) {
      console.error('[CacheService] Error getting data from cache:', error);
      this.stats.errors++;
      this.stats.misses++;
      this.updateHitRate();
      return null;
    } finally {
      this.releaseClient(client);
    }
  }

  /**
   * Set data in cache with TTL
   * 
   * Checks for memory pressure before setting data and triggers eviction if needed.
   * 
   * @param key - Cache key
   * @param data - Data to cache
   * @param ttl - Time to live in seconds (default: 300 seconds / 5 minutes)
   */
  async set<T>(key: string, data: T, ttl?: number): Promise<void> {
    const client = await this.acquireClient();
    const cacheTtl = ttl ?? this.config.ttl;
    
    try {
      // Check for memory pressure before setting
      const underPressure = await this.isMemoryPressure();
      
      if (underPressure) {
        console.log('[CacheService] Memory pressure detected during set operation, triggering eviction...');
        // Trigger eviction in background (don't await to avoid blocking the set operation)
        this.evictUnderMemoryPressure().catch(error => {
          console.error('[CacheService] Error during background eviction:', error);
        });
      }
      
      await client.setEx(key, cacheTtl, JSON.stringify(data));
      this.stats.sets++;
    } catch (error) {
      console.error('[CacheService] Error setting data in cache:', error);
      this.stats.errors++;
    } finally {
      this.releaseClient(client);
    }
  }

  /**
   * Delete data from cache
   * 
   * @param key - Cache key
   * @returns Number of keys deleted
   */
  async delete(key: string): Promise<number> {
    const client = await this.acquireClient();
    
    try {
      const result = await client.del(key);
      this.stats.deletes++;
      return result;
    } catch (error) {
      console.error('[CacheService] Error deleting data from cache:', error);
      this.stats.errors++;
      return 0;
    } finally {
      this.releaseClient(client);
    }
  }

  /**
   * Delete multiple keys matching a pattern
   * Uses SCAN to avoid blocking the server
   * 
   * @param pattern - Key pattern (e.g., 'wallet:address:*')
   * @returns Number of keys deleted
   */
  async deletePattern(pattern: string): Promise<number> {
    const client = await this.acquireClient();
    let deletedCount = 0;
    
    try {
      let cursor = 0;
      
      do {
        const result = await client.scan(cursor, {
          MATCH: pattern,
          COUNT: 100,
        });
        
        cursor = result.cursor;
        const keys = result.keys;
        
        if (keys.length > 0) {
          const deleted = await client.del(keys);
          deletedCount += deleted;
          this.stats.deletes += deleted;
        }
      } while (cursor !== 0);
      
      return deletedCount;
    } catch (error) {
      console.error('[CacheService] Error deleting pattern from cache:', error);
      this.stats.errors++;
      return deletedCount;
    } finally {
      this.releaseClient(client);
    }
  }

  /**
   * Check if a key exists in cache
   * 
   * @param key - Cache key
   * @returns True if key exists
   */
  async exists(key: string): Promise<boolean> {
    const client = await this.acquireClient();
    
    try {
      const result = await client.exists(key);
      return result === 1;
    } catch (error) {
      console.error('[CacheService] Error checking key existence:', error);
      this.stats.errors++;
      return false;
    } finally {
      this.releaseClient(client);
    }
  }

  /**
   * Get remaining TTL for a key
   * 
   * @param key - Cache key
   * @returns TTL in seconds, -1 if no expiry, -2 if key doesn't exist
   */
  async getTTL(key: string): Promise<number> {
    const client = await this.acquireClient();
    
    try {
      return await client.ttl(key);
    } catch (error) {
      console.error('[CacheService] Error getting TTL:', error);
      this.stats.errors++;
      return -2;
    } finally {
      this.releaseClient(client);
    }
  }

  /**
   * Get cache statistics
   * 
   * @returns Cache statistics including hit rate
   */
  getStats(): CacheStats {
    return { ...this.stats };
  }

  /**
   * Reset cache statistics
   */
  resetStats(): void {
    this.stats = {
      hits: 0,
      misses: 0,
      sets: 0,
      deletes: 0,
      errors: 0,
      hitRate: 0,
    };
  }

  /**
   * Update hit rate calculation
   */
  private updateHitRate(): void {
    const total = this.stats.hits + this.stats.misses;
    this.stats.hitRate = total > 0 ? this.stats.hits / total : 0;
  }

  /**
   * Get memory usage information
   * 
   * @returns Memory usage stats from Redis
   */
  async getMemoryInfo(): Promise<{
    usedMemory: number;
    maxMemory: number;
    usedMemoryPercentage: number;
  } | null> {
    const client = await this.acquireClient();
    
    try {
      const info = await client.info('memory');
      const lines = info.split('\r\n');
      
      let usedMemory = 0;
      let maxMemory = 0;
      
      for (const line of lines) {
        if (line.startsWith('used_memory:')) {
          usedMemory = parseInt(line.split(':')[1], 10);
        } else if (line.startsWith('maxmemory:')) {
          maxMemory = parseInt(line.split(':')[1], 10);
        }
      }
      
      const usedMemoryPercentage = maxMemory > 0 ? usedMemory / maxMemory : 0;
      
      return {
        usedMemory,
        maxMemory,
        usedMemoryPercentage,
      };
    } catch (error) {
      console.error('[CacheService] Error getting memory info:', error);
      this.stats.errors++;
      return null;
    } finally {
      this.releaseClient(client);
    }
  }

  /**
   * Check if memory usage exceeds threshold
   * 
   * @returns True if memory usage exceeds configured threshold (default: 80%)
   */
  async isMemoryPressure(): Promise<boolean> {
    const memoryInfo = await this.getMemoryInfo();
    
    if (!memoryInfo) {
      return false;
    }
    
    return memoryInfo.usedMemoryPercentage >= this.config.memoryThreshold;
  }

  /**
   * Configure Redis maxmemory policy for LRU eviction
   * 
   * Sets Redis to use allkeys-lru policy which evicts least recently used keys
   * when memory limit is reached. This ensures automatic eviction under memory pressure.
   * 
   * @returns True if policy was set successfully
   * 
   * **Validates: Requirement 9.7**
   */
  async configureEvictionPolicy(): Promise<boolean> {
    const client = await this.acquireClient();
    
    try {
      // Set maxmemory-policy to allkeys-lru for automatic LRU eviction
      await client.configSet('maxmemory-policy', 'allkeys-lru');
      console.log('[CacheService] Configured Redis maxmemory-policy to allkeys-lru');
      return true;
    } catch (error) {
      console.error('[CacheService] Error configuring eviction policy:', error);
      this.stats.errors++;
      return false;
    } finally {
      this.releaseClient(client);
    }
  }

  /**
   * Manually evict least recently used entries under memory pressure
   * 
   * This method is called when memory usage exceeds the configured threshold (default: 80%).
   * It evicts keys in batches until memory usage falls below the threshold.
   * 
   * The eviction process:
   * 1. Check if memory pressure exists
   * 2. Sample random keys and evict the least recently used ones
   * 3. Repeat until memory usage is below threshold or max iterations reached
   * 
   * @param batchSize - Number of keys to sample and potentially evict per iteration (default: 100)
   * @param maxIterations - Maximum number of eviction iterations (default: 10)
   * @returns Number of keys evicted
   * 
   * **Validates: Requirement 9.7**
   */
  async evictUnderMemoryPressure(batchSize: number = 100, maxIterations: number = 10): Promise<number> {
    let totalEvicted = 0;
    let iterations = 0;
    
    console.log('[CacheService] Checking for memory pressure...');
    
    while (iterations < maxIterations) {
      const underPressure = await this.isMemoryPressure();
      
      if (!underPressure) {
        console.log(`[CacheService] Memory pressure resolved after evicting ${totalEvicted} keys`);
        break;
      }
      
      console.log(`[CacheService] Memory pressure detected, evicting batch ${iterations + 1}...`);
      
      const evicted = await this.evictLRUBatch(batchSize);
      totalEvicted += evicted;
      iterations++;
      
      if (evicted === 0) {
        console.log('[CacheService] No more keys to evict');
        break;
      }
    }
    
    if (iterations >= maxIterations) {
      console.warn(`[CacheService] Reached max eviction iterations (${maxIterations}), evicted ${totalEvicted} keys`);
    }
    
    return totalEvicted;
  }

  /**
   * Evict a batch of least recently used keys
   * 
   * Uses RANDOMKEY to sample keys and OBJECT IDLETIME to determine LRU candidates.
   * Evicts keys with the highest idle time (least recently used).
   * 
   * @param batchSize - Number of keys to sample and potentially evict
   * @returns Number of keys evicted
   */
  private async evictLRUBatch(batchSize: number): Promise<number> {
    const client = await this.acquireClient();
    let evicted = 0;
    
    try {
      // Sample random keys and get their idle times
      const keysWithIdleTime: Array<{ key: string; idleTime: number }> = [];
      
      for (let i = 0; i < batchSize; i++) {
        try {
          const key = await client.randomKey();
          
          if (!key) {
            break; // No more keys available
          }
          
          // Get idle time in seconds (time since last access)
          const idleTime = await client.objectIdleTime(key);
          
          if (idleTime !== null) {
            keysWithIdleTime.push({ key, idleTime });
          }
        } catch (error) {
          // Skip keys that cause errors (might have been deleted)
          continue;
        }
      }
      
      if (keysWithIdleTime.length === 0) {
        return 0;
      }
      
      // Sort by idle time (descending) to get least recently used keys
      keysWithIdleTime.sort((a, b) => b.idleTime - a.idleTime);
      
      // Evict the top 20% of sampled keys (most idle)
      const evictionCount = Math.max(1, Math.floor(keysWithIdleTime.length * 0.2));
      const keysToEvict = keysWithIdleTime.slice(0, evictionCount).map(k => k.key);
      
      if (keysToEvict.length > 0) {
        evicted = await client.del(keysToEvict);
        this.stats.deletes += evicted;
        console.log(`[CacheService] Evicted ${evicted} LRU keys (sampled ${keysWithIdleTime.length} keys)`);
      }
      
      return evicted;
    } catch (error) {
      console.error('[CacheService] Error evicting LRU batch:', error);
      this.stats.errors++;
      return evicted;
    } finally {
      this.releaseClient(client);
    }
  }

  /**
   * Get eviction statistics from Redis
   * 
   * @returns Eviction stats including evicted keys count
   */
  async getEvictionStats(): Promise<{
    evictedKeys: number;
    evictionPolicy: string;
  } | null> {
    const client = await this.acquireClient();
    
    try {
      const info = await client.info('stats');
      const lines = info.split('\r\n');
      
      let evictedKeys = 0;
      
      for (const line of lines) {
        if (line.startsWith('evicted_keys:')) {
          evictedKeys = parseInt(line.split(':')[1], 10);
        }
      }
      
      // Get current eviction policy
      const policy = await client.configGet('maxmemory-policy');
      const evictionPolicy = policy['maxmemory-policy'] || 'noeviction';
      
      return {
        evictedKeys,
        evictionPolicy,
      };
    } catch (error) {
      console.error('[CacheService] Error getting eviction stats:', error);
      this.stats.errors++;
      return null;
    } finally {
      this.releaseClient(client);
    }
  }

  /**
   * Get pool status
   * 
   * @returns Connection pool status
   */
  getPoolStatus(): {
    totalConnections: number;
    availableConnections: number;
    activeConnections: number;
    poolMin: number;
    poolMax: number;
  } {
    return {
      totalConnections: this.clients.length,
      availableConnections: this.availableClients.length,
      activeConnections: this.clients.length - this.availableClients.length,
      poolMin: this.config.poolMin,
      poolMax: this.config.poolMax,
    };
  }

  /**
   * Invalidate cache entries for a wallet when a transaction is indexed
   * 
   * Invalidates all cache entries matching the pattern: wallet:{address}:*
   * This ensures cache consistency when new transactions are indexed.
   * 
   * @param walletAddress - Wallet address to invalidate cache for
   * @returns Number of keys invalidated
   * 
   * **Validates: Requirement 9.4**
   */
  async invalidateWalletCache(walletAddress: string): Promise<number> {
    const pattern = `wallet:${walletAddress}:*`;
    console.log(`[CacheService] Invalidating cache for wallet ${walletAddress} (pattern: ${pattern})`);
    
    const deletedCount = await this.deletePattern(pattern);
    console.log(`[CacheService] Invalidated ${deletedCount} cache entries for wallet ${walletAddress}`);
    
    return deletedCount;
  }

  /**
   * Invalidate balance cache for a specific wallet
   * 
   * Invalidates cache entries matching: wallet:{address}:balances
   * This is called when wallet balances are updated.
   * 
   * @param walletAddress - Wallet address to invalidate balance cache for
   * @returns Number of keys invalidated
   * 
   * **Validates: Requirement 9.4**
   */
  async invalidateBalanceCache(walletAddress: string): Promise<number> {
    const key = `wallet:${walletAddress}:balances`;
    console.log(`[CacheService] Invalidating balance cache for wallet ${walletAddress}`);
    
    const deletedCount = await this.delete(key);
    console.log(`[CacheService] Invalidated balance cache for wallet ${walletAddress}`);
    
    return deletedCount;
  }

  /**
   * Invalidate PnL cache for a specific wallet
   * 
   * Invalidates cache entries matching: wallet:{address}:pnl:*
   * This is called when PnL calculations are updated.
   * 
   * @param walletAddress - Wallet address to invalidate PnL cache for
   * @returns Number of keys invalidated
   * 
   * **Validates: Requirement 9.4**
   */
  async invalidatePnLCache(walletAddress: string): Promise<number> {
    const pattern = `wallet:${walletAddress}:pnl:*`;
    console.log(`[CacheService] Invalidating PnL cache for wallet ${walletAddress}`);
    
    const deletedCount = await this.deletePattern(pattern);
    console.log(`[CacheService] Invalidated ${deletedCount} PnL cache entries for wallet ${walletAddress}`);
    
    return deletedCount;
  }

  /**
   * Invalidate risk profile cache for a specific wallet
   * 
   * Invalidates cache entries matching: wallet:{address}:risk
   * This is called when risk assessments are updated.
   * 
   * @param walletAddress - Wallet address to invalidate risk cache for
   * @returns Number of keys invalidated
   * 
   * **Validates: Requirement 9.4**
   */
  async invalidateRiskCache(walletAddress: string): Promise<number> {
    const key = `wallet:${walletAddress}:risk`;
    console.log(`[CacheService] Invalidating risk cache for wallet ${walletAddress}`);
    
    const deletedCount = await this.delete(key);
    console.log(`[CacheService] Invalidated risk cache for wallet ${walletAddress}`);
    
    return deletedCount;
  }

  /**
   * Invalidate portfolio cache for a specific wallet
   * 
   * Invalidates cache entries matching: wallet:{address}:portfolio
   * This is called when portfolio analytics are updated.
   * 
   * @param walletAddress - Wallet address to invalidate portfolio cache for
   * @returns Number of keys invalidated
   * 
   * **Validates: Requirement 9.4**
   */
  async invalidatePortfolioCache(walletAddress: string): Promise<number> {
    const key = `wallet:${walletAddress}:portfolio`;
    console.log(`[CacheService] Invalidating portfolio cache for wallet ${walletAddress}`);
    
    const deletedCount = await this.delete(key);
    console.log(`[CacheService] Invalidated portfolio cache for wallet ${walletAddress}`);
    
    return deletedCount;
  }

  /**
   * Invalidate prediction market cache
   * 
   * Invalidates cache entries matching: market:{address}:*
   * This is called when market odds or data are updated.
   * 
   * @param marketAddress - Market address to invalidate cache for
   * @returns Number of keys invalidated
   * 
   * **Validates: Requirement 9.4**
   */
  async invalidateMarketCache(marketAddress: string): Promise<number> {
    const pattern = `market:${marketAddress}:*`;
    console.log(`[CacheService] Invalidating market cache for ${marketAddress}`);
    
    const deletedCount = await this.deletePattern(pattern);
    console.log(`[CacheService] Invalidated ${deletedCount} market cache entries for ${marketAddress}`);
    
    return deletedCount;
  }

  /**
   * Invalidate transaction history cache for a specific wallet
   * 
   * Invalidates cache entries matching: wallet:{address}:transactions:*
   * This is called when new transactions are indexed.
   * 
   * @param walletAddress - Wallet address to invalidate transaction cache for
   * @returns Number of keys invalidated
   * 
   * **Validates: Requirement 9.4**
   */
  async invalidateTransactionCache(walletAddress: string): Promise<number> {
    const pattern = `wallet:${walletAddress}:transactions:*`;
    console.log(`[CacheService] Invalidating transaction cache for wallet ${walletAddress}`);
    
    const deletedCount = await this.deletePattern(pattern);
    console.log(`[CacheService] Invalidated ${deletedCount} transaction cache entries for wallet ${walletAddress}`);
    
    return deletedCount;
  }

  /**
   * Invalidate all cache entries for a wallet on transaction update
   * 
   * This is the main invalidation method called when a new transaction is indexed.
   * It invalidates all wallet-related cache entries to ensure consistency.
   * 
   * Invalidates:
   * - All wallet cache entries (wallet:{address}:*)
   * 
   * @param walletAddress - Wallet address to invalidate cache for
   * @returns Total number of keys invalidated
   * 
   * **Validates: Requirement 9.4**
   */
  async invalidateOnTransactionUpdate(walletAddress: string): Promise<number> {
    console.log(`[CacheService] Invalidating all cache entries for wallet ${walletAddress} due to transaction update`);
    
    // Invalidate all wallet-related cache entries
    const deletedCount = await this.invalidateWalletCache(walletAddress);
    
    console.log(`[CacheService] Total ${deletedCount} cache entries invalidated for wallet ${walletAddress}`);
    
    return deletedCount;
  }

  /**
   * Invalidate cache on balance update
   * 
   * This is called when wallet balances are updated.
   * It invalidates balance and portfolio cache entries.
   * 
   * @param walletAddress - Wallet address to invalidate cache for
   * @returns Total number of keys invalidated
   * 
   * **Validates: Requirement 9.4**
   */
  async invalidateOnBalanceUpdate(walletAddress: string): Promise<number> {
    console.log(`[CacheService] Invalidating cache for wallet ${walletAddress} due to balance update`);
    
    // Invalidate balance and portfolio cache
    const balanceDeleted = await this.invalidateBalanceCache(walletAddress);
    const portfolioDeleted = await this.invalidatePortfolioCache(walletAddress);
    
    const totalDeleted = balanceDeleted + portfolioDeleted;
    console.log(`[CacheService] Total ${totalDeleted} cache entries invalidated for wallet ${walletAddress}`);
    
    return totalDeleted;
  }

  /**
   * Warm cache for specified wallets on startup
   * 
   * Pre-loads frequently accessed data into Redis cache to improve initial query performance.
   * This method is called after auto-registration of ARS protocol wallets completes.
   * 
   * Pre-loaded data:
   * - Wallet balances (all tokens)
   * - Recent transaction history (last 24 hours)
   * - Latest PnL snapshots (all periods: 24h, 7d, 30d, all)
   * 
   * The cache warming process:
   * 1. Fetch data from Supabase for each wallet
   * 2. Store data in Redis cache with standard TTL (5 minutes)
   * 3. Log progress and completion
   * 4. Handle errors gracefully (continue with other wallets if one fails)
   * 
   * @param walletAddresses - Array of wallet addresses to warm cache for
   * @returns Object with success count, error count, and total time
   * 
   * **Validates: Requirement 9.6**
   */
  async warmCache(walletAddresses: string[]): Promise<{
    successCount: number;
    errorCount: number;
    totalTimeMs: number;
  }> {
    const startTime = Date.now();
    let successCount = 0;
    let errorCount = 0;

    console.log(`[CacheService] Starting cache warming for ${walletAddresses.length} wallets...`);

    // Import Supabase client dynamically to avoid circular dependencies
    const { getSupabaseClient } = await import('../supabase');
    const supabase = getSupabaseClient();

    for (const address of walletAddresses) {
      try {
        console.log(`[CacheService] Warming cache for wallet ${address}...`);

        // 1. Pre-load wallet balances
        await this.warmWalletBalances(supabase, address);

        // 2. Pre-load recent transaction history (last 24 hours)
        await this.warmTransactionHistory(supabase, address);

        // 3. Pre-load latest PnL snapshots
        await this.warmPnLSnapshots(supabase, address);

        successCount++;
        console.log(`[CacheService] Cache warmed successfully for wallet ${address}`);
      } catch (error) {
        errorCount++;
        console.error(`[CacheService] Failed to warm cache for wallet ${address}:`, error);
        // Continue with other wallets
      }
    }

    const totalTimeMs = Date.now() - startTime;
    console.log(
      `[CacheService] Cache warming complete: ${successCount} successful, ${errorCount} errors, ${totalTimeMs}ms total`
    );

    return {
      successCount,
      errorCount,
      totalTimeMs,
    };
  }

  /**
   * Warm cache for wallet balances
   * 
   * Fetches all token balances for a wallet and stores them in cache.
   * Cache key format: wallet:{address}:balances
   * 
   * @param supabase - Supabase client
   * @param address - Wallet address
   */
  private async warmWalletBalances(supabase: any, address: string): Promise<void> {
    try {
      const { data, error } = await supabase
        .from('wallet_balances')
        .select('*')
        .eq('wallet_address', address);

      if (error) {
        throw new Error(`Failed to fetch balances: ${error.message}`);
      }

      if (data && data.length > 0) {
        const cacheKey = this.generateCacheKey(address, 'balances');
        await this.set(cacheKey, data);
        console.log(`[CacheService] Cached ${data.length} balances for wallet ${address}`);
      } else {
        console.log(`[CacheService] No balances found for wallet ${address}`);
      }
    } catch (error) {
      console.error(`[CacheService] Error warming balances for wallet ${address}:`, error);
      throw error;
    }
  }

  /**
   * Warm cache for recent transaction history
   * 
   * Fetches transactions from the last 24 hours for a wallet and stores them in cache.
   * Cache key format: wallet:{address}:transactions:{params_hash}
   * 
   * @param supabase - Supabase client
   * @param address - Wallet address
   */
  private async warmTransactionHistory(supabase: any, address: string): Promise<void> {
    try {
      // Calculate timestamp for 24 hours ago
      const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;

      const { data, error } = await supabase
        .from('wallet_transactions')
        .select('*')
        .eq('wallet_address', address)
        .gte('timestamp', twentyFourHoursAgo)
        .order('timestamp', { ascending: false })
        .limit(100); // Limit to 100 most recent transactions

      if (error) {
        throw new Error(`Failed to fetch transactions: ${error.message}`);
      }

      if (data && data.length > 0) {
        // Cache with query parameters for consistency
        const params = {
          fromTimestamp: twentyFourHoursAgo,
          page: 1,
          pageSize: 100,
        };
        const cacheKey = this.generateCacheKey(address, 'transactions', params);
        await this.set(cacheKey, {
          transactions: data,
          totalCount: data.length,
          page: 1,
          pageSize: 100,
          hasMore: false,
        });
        console.log(`[CacheService] Cached ${data.length} transactions for wallet ${address}`);
      } else {
        console.log(`[CacheService] No recent transactions found for wallet ${address}`);
      }
    } catch (error) {
      console.error(`[CacheService] Error warming transactions for wallet ${address}:`, error);
      throw error;
    }
  }

  /**
   * Warm cache for PnL snapshots
   * 
   * Fetches the latest PnL snapshots for all time periods (24h, 7d, 30d, all) and stores them in cache.
   * Cache key format: wallet:{address}:pnl:{period}
   * 
   * @param supabase - Supabase client
   * @param address - Wallet address
   */
  private async warmPnLSnapshots(supabase: any, address: string): Promise<void> {
    try {
      const periods = ['24h', '7d', '30d', 'all'];
      let cachedCount = 0;

      for (const period of periods) {
        const { data, error } = await supabase
          .from('wallet_pnl')
          .select('*')
          .eq('wallet_address', address)
          .eq('period', period)
          .order('calculated_at', { ascending: false })
          .limit(1)
          .single();

        if (error) {
          // If no data found (PGRST116), that's okay - just skip this period
          if (error.code === 'PGRST116') {
            console.log(`[CacheService] No PnL data found for wallet ${address}, period ${period}`);
            continue;
          }
          throw new Error(`Failed to fetch PnL for period ${period}: ${error.message}`);
        }

        if (data) {
          const cacheKey = this.generateCacheKey(address, `pnl:${period}`);
          await this.set(cacheKey, data);
          cachedCount++;
        }
      }

      if (cachedCount > 0) {
        console.log(`[CacheService] Cached ${cachedCount} PnL snapshots for wallet ${address}`);
      } else {
        console.log(`[CacheService] No PnL snapshots found for wallet ${address}`);
      }
    } catch (error) {
      console.error(`[CacheService] Error warming PnL for wallet ${address}:`, error);
      throw error;
    }
  }

  /**
   * Close all connections and cleanup
   */
  async close(): Promise<void> {
    console.log('[CacheService] Closing all connections...');
    
    for (const client of this.clients) {
      try {
        await client.quit();
      } catch (error) {
        console.error('[CacheService] Error closing client:', error);
      }
    }
    
    this.clients = [];
    this.availableClients = [];
    this.isInitialized = false;
    
    console.log('[CacheService] All connections closed');
  }
}

// Singleton instance
let cacheServiceInstance: CacheService | null = null;

/**
 * Get the singleton CacheService instance
 * 
 * @returns CacheService instance
 */
export function getCacheService(): CacheService {
  if (!cacheServiceInstance) {
    cacheServiceInstance = new CacheService();
  }
  return cacheServiceInstance;
}

/**
 * Initialize the cache service
 * Should be called on application startup
 */
export async function initializeCacheService(): Promise<void> {
  const service = getCacheService();
  await service.initialize();
}

/**
 * Close the cache service
 * Should be called on application shutdown
 */
export async function closeCacheService(): Promise<void> {
  if (cacheServiceInstance) {
    await cacheServiceInstance.close();
    cacheServiceInstance = null;
  }
}
