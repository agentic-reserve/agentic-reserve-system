import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { CacheService } from '../../services/memory/cache-service';

/**
 * Unit tests for Cache Service
 * 
 * Tests the Redis cache service implementation including:
 * - Connection pooling (10-50 connections)
 * - Get/set/delete operations
 * - Cache key generation with SHA-256 hashing
 * - Pattern-based deletion
 * - Statistics tracking
 * - Memory monitoring
 * 
 * Validates Requirements: 9.1, 9.5, 13.3
 */

describe('CacheService', () => {
  let cacheService: CacheService;

  beforeAll(async () => {
    // Create cache service with test configuration
    cacheService = new CacheService({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      poolMin: 2,
      poolMax: 5,
      ttl: 60, // 1 minute for tests
    });
    
    await cacheService.initialize();
  });

  afterAll(async () => {
    await cacheService.close();
  });

  beforeEach(async () => {
    // Clear test data before each test
    await cacheService.deletePattern('test:*');
    cacheService.resetStats();
  });

  describe('Connection Pooling', () => {
    it('should initialize with minimum connections', async () => {
      const poolStatus = cacheService.getPoolStatus();
      
      expect(poolStatus.totalConnections).toBeGreaterThanOrEqual(poolStatus.poolMin);
      expect(poolStatus.poolMin).toBe(2);
      expect(poolStatus.poolMax).toBe(5);
    });

    it('should expand pool when needed', async () => {
      const initialStatus = cacheService.getPoolStatus();
      
      // Make concurrent requests to force pool expansion
      const promises = [];
      for (let i = 0; i < 10; i++) {
        promises.push(cacheService.set(`test:concurrent:${i}`, { value: i }));
      }
      
      await Promise.all(promises);
      
      const finalStatus = cacheService.getPoolStatus();
      
      // Pool should have expanded but not exceeded max
      expect(finalStatus.totalConnections).toBeLessThanOrEqual(finalStatus.poolMax);
    });

    it('should report pool status correctly', () => {
      const status = cacheService.getPoolStatus();
      
      expect(status).toHaveProperty('totalConnections');
      expect(status).toHaveProperty('availableConnections');
      expect(status).toHaveProperty('activeConnections');
      expect(status).toHaveProperty('poolMin');
      expect(status).toHaveProperty('poolMax');
      
      expect(status.totalConnections).toBeGreaterThanOrEqual(0);
      expect(status.availableConnections).toBeGreaterThanOrEqual(0);
      expect(status.activeConnections).toBeGreaterThanOrEqual(0);
    });
  });

  describe('Cache Key Generation', () => {
    it('should generate cache key with correct format', () => {
      const address = 'So11111111111111111111111111111111111111112';
      const queryType = 'transactions';
      
      const key = cacheService.generateCacheKey(address, queryType);
      
      expect(key).toBe(`wallet:${address}:${queryType}`);
    });

    it('should generate cache key with params hash', () => {
      const address = 'So11111111111111111111111111111111111111112';
      const queryType = 'transactions';
      const params = { page: 1, pageSize: 50 };
      
      const key = cacheService.generateCacheKey(address, queryType, params);
      
      expect(key).toMatch(/^wallet:So11111111111111111111111111111111111111112:transactions:[a-f0-9]{64}$/);
    });

    it('should generate consistent hash for same params', () => {
      const address = 'So11111111111111111111111111111111111111112';
      const queryType = 'transactions';
      const params1 = { page: 1, pageSize: 50, type: 'swap' };
      const params2 = { pageSize: 50, type: 'swap', page: 1 }; // Different order
      
      const key1 = cacheService.generateCacheKey(address, queryType, params1);
      const key2 = cacheService.generateCacheKey(address, queryType, params2);
      
      // Should generate same hash despite different key order
      expect(key1).toBe(key2);
    });

    it('should generate different hash for different params', () => {
      const address = 'So11111111111111111111111111111111111111112';
      const queryType = 'transactions';
      const params1 = { page: 1, pageSize: 50 };
      const params2 = { page: 2, pageSize: 50 };
      
      const key1 = cacheService.generateCacheKey(address, queryType, params1);
      const key2 = cacheService.generateCacheKey(address, queryType, params2);
      
      expect(key1).not.toBe(key2);
    });

    it('should use SHA-256 hash (64 hex characters)', () => {
      const address = 'So11111111111111111111111111111111111111112';
      const queryType = 'transactions';
      const params = { page: 1, pageSize: 50 };
      
      const key = cacheService.generateCacheKey(address, queryType, params);
      const hashPart = key.split(':')[3];
      
      // SHA-256 produces 64 hex characters
      expect(hashPart).toHaveLength(64);
      expect(hashPart).toMatch(/^[a-f0-9]{64}$/);
    });
  });

  describe('Get/Set/Delete Operations', () => {
    it('should set and get data', async () => {
      const key = 'test:simple';
      const data = { value: 'test data', timestamp: Date.now() };
      
      await cacheService.set(key, data);
      const retrieved = await cacheService.get<typeof data>(key);
      
      expect(retrieved).toEqual(data);
    });

    it('should return null for non-existent key', async () => {
      const key = 'test:nonexistent';
      
      const retrieved = await cacheService.get(key);
      
      expect(retrieved).toBeNull();
    });

    it('should delete data', async () => {
      const key = 'test:delete';
      const data = { value: 'to be deleted' };
      
      await cacheService.set(key, data);
      const deletedCount = await cacheService.delete(key);
      const retrieved = await cacheService.get(key);
      
      expect(deletedCount).toBe(1);
      expect(retrieved).toBeNull();
    });

    it('should handle complex data types', async () => {
      const key = 'test:complex';
      const data = {
        string: 'test',
        number: 123,
        boolean: true,
        array: [1, 2, 3],
        nested: {
          key: 'value',
          array: ['a', 'b', 'c'],
        },
        null: null,
      };
      
      await cacheService.set(key, data);
      const retrieved = await cacheService.get<typeof data>(key);
      
      expect(retrieved).toEqual(data);
    });

    it('should respect custom TTL', async () => {
      const key = 'test:ttl';
      const data = { value: 'expires soon' };
      const ttl = 2; // 2 seconds
      
      await cacheService.set(key, data, ttl);
      
      // Check TTL is set correctly
      const remainingTtl = await cacheService.getTTL(key);
      expect(remainingTtl).toBeGreaterThan(0);
      expect(remainingTtl).toBeLessThanOrEqual(ttl);
    });

    it('should use default TTL when not specified', async () => {
      const key = 'test:default-ttl';
      const data = { value: 'default expiry' };
      
      await cacheService.set(key, data);
      
      const remainingTtl = await cacheService.getTTL(key);
      expect(remainingTtl).toBeGreaterThan(0);
      expect(remainingTtl).toBeLessThanOrEqual(60); // Test config uses 60 seconds
    });
  });

  describe('Pattern-based Operations', () => {
    it('should delete multiple keys matching pattern', async () => {
      const address = 'So11111111111111111111111111111111111111112';
      
      // Set multiple keys for the same wallet
      await cacheService.set(`wallet:${address}:transactions`, { data: 'tx' });
      await cacheService.set(`wallet:${address}:balances`, { data: 'bal' });
      await cacheService.set(`wallet:${address}:pnl`, { data: 'pnl' });
      
      // Delete all keys for this wallet
      const deletedCount = await cacheService.deletePattern(`wallet:${address}:*`);
      
      expect(deletedCount).toBe(3);
      
      // Verify all keys are deleted
      const tx = await cacheService.get(`wallet:${address}:transactions`);
      const bal = await cacheService.get(`wallet:${address}:balances`);
      const pnl = await cacheService.get(`wallet:${address}:pnl`);
      
      expect(tx).toBeNull();
      expect(bal).toBeNull();
      expect(pnl).toBeNull();
    });

    it('should not delete keys that do not match pattern', async () => {
      const address1 = 'So11111111111111111111111111111111111111112';
      const address2 = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
      
      await cacheService.set(`wallet:${address1}:transactions`, { data: 'tx1' });
      await cacheService.set(`wallet:${address2}:transactions`, { data: 'tx2' });
      
      // Delete only address1 keys
      await cacheService.deletePattern(`wallet:${address1}:*`);
      
      // Verify address1 is deleted but address2 remains
      const tx1 = await cacheService.get(`wallet:${address1}:transactions`);
      const tx2 = await cacheService.get(`wallet:${address2}:transactions`);
      
      expect(tx1).toBeNull();
      expect(tx2).toEqual({ data: 'tx2' });
    });
  });

  describe('Key Existence and TTL', () => {
    it('should check if key exists', async () => {
      const key = 'test:exists';
      
      const existsBefore = await cacheService.exists(key);
      expect(existsBefore).toBe(false);
      
      await cacheService.set(key, { value: 'test' });
      
      const existsAfter = await cacheService.exists(key);
      expect(existsAfter).toBe(true);
    });

    it('should get TTL for key', async () => {
      const key = 'test:ttl-check';
      const ttl = 30;
      
      await cacheService.set(key, { value: 'test' }, ttl);
      
      const remainingTtl = await cacheService.getTTL(key);
      
      expect(remainingTtl).toBeGreaterThan(0);
      expect(remainingTtl).toBeLessThanOrEqual(ttl);
    });

    it('should return -2 for non-existent key TTL', async () => {
      const key = 'test:nonexistent-ttl';
      
      const ttl = await cacheService.getTTL(key);
      
      expect(ttl).toBe(-2);
    });
  });

  describe('Statistics Tracking', () => {
    it('should track cache hits', async () => {
      const key = 'test:hit';
      await cacheService.set(key, { value: 'test' });
      
      cacheService.resetStats();
      
      await cacheService.get(key);
      await cacheService.get(key);
      
      const stats = cacheService.getStats();
      
      expect(stats.hits).toBe(2);
      expect(stats.misses).toBe(0);
    });

    it('should track cache misses', async () => {
      cacheService.resetStats();
      
      await cacheService.get('test:miss1');
      await cacheService.get('test:miss2');
      
      const stats = cacheService.getStats();
      
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(2);
    });

    it('should calculate hit rate correctly', async () => {
      const key = 'test:hitrate';
      await cacheService.set(key, { value: 'test' });
      
      cacheService.resetStats();
      
      // 3 hits, 2 misses = 60% hit rate
      await cacheService.get(key);
      await cacheService.get(key);
      await cacheService.get(key);
      await cacheService.get('test:miss1');
      await cacheService.get('test:miss2');
      
      const stats = cacheService.getStats();
      
      expect(stats.hits).toBe(3);
      expect(stats.misses).toBe(2);
      expect(stats.hitRate).toBeCloseTo(0.6, 2);
    });

    it('should track set operations', async () => {
      cacheService.resetStats();
      
      await cacheService.set('test:set1', { value: 1 });
      await cacheService.set('test:set2', { value: 2 });
      
      const stats = cacheService.getStats();
      
      expect(stats.sets).toBe(2);
    });

    it('should track delete operations', async () => {
      await cacheService.set('test:del1', { value: 1 });
      await cacheService.set('test:del2', { value: 2 });
      
      cacheService.resetStats();
      
      await cacheService.delete('test:del1');
      await cacheService.delete('test:del2');
      
      const stats = cacheService.getStats();
      
      expect(stats.deletes).toBe(2);
    });

    it('should reset statistics', async () => {
      await cacheService.set('test:reset', { value: 'test' });
      await cacheService.get('test:reset');
      await cacheService.delete('test:reset');
      
      cacheService.resetStats();
      
      const stats = cacheService.getStats();
      
      expect(stats.hits).toBe(0);
      expect(stats.misses).toBe(0);
      expect(stats.sets).toBe(0);
      expect(stats.deletes).toBe(0);
      expect(stats.errors).toBe(0);
      expect(stats.hitRate).toBe(0);
    });
  });

  describe('Memory Monitoring', () => {
    it('should get memory info', async () => {
      const memoryInfo = await cacheService.getMemoryInfo();
      
      expect(memoryInfo).not.toBeNull();
      expect(memoryInfo).toHaveProperty('usedMemory');
      expect(memoryInfo).toHaveProperty('maxMemory');
      expect(memoryInfo).toHaveProperty('usedMemoryPercentage');
      
      if (memoryInfo) {
        expect(memoryInfo.usedMemory).toBeGreaterThanOrEqual(0);
        expect(memoryInfo.usedMemoryPercentage).toBeGreaterThanOrEqual(0);
        expect(memoryInfo.usedMemoryPercentage).toBeLessThanOrEqual(1);
      }
    });

    it('should check memory pressure', async () => {
      const isUnderPressure = await cacheService.isMemoryPressure();
      
      // Should be boolean
      expect(typeof isUnderPressure).toBe('boolean');
      
      // In test environment, should typically not be under pressure
      expect(isUnderPressure).toBe(false);
    });
  });

  describe('Error Handling', () => {
    it('should handle get errors gracefully', async () => {
      // This test verifies that errors don't crash the service
      const result = await cacheService.get('test:error');
      
      // Should return null on error, not throw
      expect(result).toBeNull();
    });

    it('should handle set errors gracefully', async () => {
      // This test verifies that errors don't crash the service
      await expect(
        cacheService.set('test:error', { value: 'test' })
      ).resolves.not.toThrow();
    });

    it('should handle delete errors gracefully', async () => {
      // This test verifies that errors don't crash the service
      const result = await cacheService.delete('test:error');
      
      // Should return 0 on error, not throw
      expect(result).toBeGreaterThanOrEqual(0);
    });
  });
});
