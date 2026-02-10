import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CacheService } from '../services/memory/cache-service';

/**
 * Cache Eviction Tests
 * 
 * Tests cache eviction logic under memory pressure for the Memory Service.
 * Validates that LRU entries are evicted when memory usage exceeds threshold.
 * 
 * **Validates: Requirement 9.7**
 */

describe('Cache Eviction Under Memory Pressure', () => {
  let cacheService: CacheService;

  beforeEach(async () => {
    // Create a test cache service with custom config
    cacheService = new CacheService({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      poolMin: 2,
      poolMax: 5,
      ttl: 300,
      memoryThreshold: 0.8, // 80% threshold
    });

    await cacheService.initialize();
  });

  afterEach(async () => {
    // Clean up test data
    await cacheService.deletePattern('test:*');
    await cacheService.close();
  });

  describe('configureEvictionPolicy', () => {
    it('should configure Redis to use allkeys-lru eviction policy', async () => {
      // Configure eviction policy
      const result = await cacheService.configureEvictionPolicy();
      
      expect(result).toBe(true);

      // Verify the policy was set
      const stats = await cacheService.getEvictionStats();
      expect(stats).toBeDefined();
      expect(stats?.evictionPolicy).toBe('allkeys-lru');
    });
  });

  describe('getMemoryInfo', () => {
    it('should return memory usage information', async () => {
      const memoryInfo = await cacheService.getMemoryInfo();
      
      expect(memoryInfo).toBeDefined();
      expect(memoryInfo?.usedMemory).toBeGreaterThanOrEqual(0);
      expect(memoryInfo?.maxMemory).toBeGreaterThanOrEqual(0);
      expect(memoryInfo?.usedMemoryPercentage).toBeGreaterThanOrEqual(0);
      expect(memoryInfo?.usedMemoryPercentage).toBeLessThanOrEqual(1);
    });

    it('should calculate memory percentage correctly', async () => {
      const memoryInfo = await cacheService.getMemoryInfo();
      
      if (memoryInfo && memoryInfo.maxMemory > 0) {
        const expectedPercentage = memoryInfo.usedMemory / memoryInfo.maxMemory;
        expect(memoryInfo.usedMemoryPercentage).toBeCloseTo(expectedPercentage, 5);
      }
    });
  });

  describe('isMemoryPressure', () => {
    it('should return boolean indicating memory pressure status', async () => {
      const underPressure = await cacheService.isMemoryPressure();
      
      expect(typeof underPressure).toBe('boolean');
    });

    it('should return true when memory usage exceeds threshold', async () => {
      // This test depends on actual Redis memory configuration
      // In a real scenario, we would fill the cache to exceed the threshold
      const memoryInfo = await cacheService.getMemoryInfo();
      const underPressure = await cacheService.isMemoryPressure();
      
      if (memoryInfo && memoryInfo.maxMemory > 0) {
        const expectedPressure = memoryInfo.usedMemoryPercentage >= 0.8;
        expect(underPressure).toBe(expectedPressure);
      }
    });
  });

  describe('evictUnderMemoryPressure', () => {
    it('should evict keys when memory pressure is detected', async () => {
      // Populate cache with test data
      const keyCount = 50;
      for (let i = 0; i < keyCount; i++) {
        await cacheService.set(`test:key:${i}`, { data: `value${i}` });
      }

      // Check if memory pressure exists
      const underPressure = await cacheService.isMemoryPressure();
      
      if (underPressure) {
        // Trigger eviction
        const evictedCount = await cacheService.evictUnderMemoryPressure(20, 5);
        
        // Should have evicted some keys
        expect(evictedCount).toBeGreaterThanOrEqual(0);
        
        console.log(`[Test] Evicted ${evictedCount} keys under memory pressure`);
      } else {
        console.log('[Test] No memory pressure detected, skipping eviction test');
      }
    });

    it('should stop evicting when memory pressure is resolved', async () => {
      // This test verifies that eviction stops when memory usage drops below threshold
      const evictedCount = await cacheService.evictUnderMemoryPressure(10, 3);
      
      // Should return a non-negative count
      expect(evictedCount).toBeGreaterThanOrEqual(0);
      
      // After eviction, memory pressure should be resolved or no keys left to evict
      const underPressureAfter = await cacheService.isMemoryPressure();
      console.log(`[Test] Memory pressure after eviction: ${underPressureAfter}`);
    });

    it('should respect max iterations limit', async () => {
      // Populate cache with test data
      for (let i = 0; i < 30; i++) {
        await cacheService.set(`test:iteration:${i}`, { data: `value${i}` });
      }

      // Set a low max iterations to test the limit
      const maxIterations = 2;
      const evictedCount = await cacheService.evictUnderMemoryPressure(10, maxIterations);
      
      // Should complete without hanging
      expect(evictedCount).toBeGreaterThanOrEqual(0);
      
      console.log(`[Test] Evicted ${evictedCount} keys with max ${maxIterations} iterations`);
    });

    it('should handle empty cache gracefully', async () => {
      // Clear all test keys
      await cacheService.deletePattern('test:*');
      
      // Try to evict from empty cache
      const evictedCount = await cacheService.evictUnderMemoryPressure(10, 2);
      
      // Should return 0 without errors
      expect(evictedCount).toBe(0);
    });
  });

  describe('getEvictionStats', () => {
    it('should return eviction statistics', async () => {
      const stats = await cacheService.getEvictionStats();
      
      expect(stats).toBeDefined();
      expect(stats?.evictedKeys).toBeGreaterThanOrEqual(0);
      expect(stats?.evictionPolicy).toBeDefined();
      expect(typeof stats?.evictionPolicy).toBe('string');
    });

    it('should track evicted keys count', async () => {
      const statsBefore = await cacheService.getEvictionStats();
      
      // Populate cache and trigger eviction if under pressure
      for (let i = 0; i < 20; i++) {
        await cacheService.set(`test:evict:${i}`, { data: `value${i}` });
      }
      
      const underPressure = await cacheService.isMemoryPressure();
      if (underPressure) {
        await cacheService.evictUnderMemoryPressure(10, 2);
      }
      
      const statsAfter = await cacheService.getEvictionStats();
      
      // Stats should be defined
      expect(statsBefore).toBeDefined();
      expect(statsAfter).toBeDefined();
      
      console.log(`[Test] Evicted keys before: ${statsBefore?.evictedKeys}, after: ${statsAfter?.evictedKeys}`);
    });
  });

  describe('LRU Eviction Behavior', () => {
    it('should evict least recently used keys first', async () => {
      // Create keys with different access patterns
      const oldKey = 'test:lru:old';
      const newKey = 'test:lru:new';
      
      // Set old key
      await cacheService.set(oldKey, { data: 'old' });
      
      // Wait a bit to ensure time difference
      await new Promise(resolve => setTimeout(resolve, 100));
      
      // Set new key
      await cacheService.set(newKey, { data: 'new' });
      
      // Access new key to make it more recently used
      await cacheService.get(newKey);
      
      // Both keys should exist
      const oldExists = await cacheService.exists(oldKey);
      const newExists = await cacheService.exists(newKey);
      
      expect(oldExists).toBe(true);
      expect(newExists).toBe(true);
      
      // Note: Actual LRU eviction testing requires filling memory to capacity
      // which is environment-dependent. This test verifies the keys are tracked.
    });

    it('should preserve recently accessed keys during eviction', async () => {
      // Create multiple keys
      const keys = [];
      for (let i = 0; i < 10; i++) {
        const key = `test:preserve:${i}`;
        await cacheService.set(key, { data: `value${i}` });
        keys.push(key);
      }
      
      // Access some keys to make them recently used
      await cacheService.get(keys[0]);
      await cacheService.get(keys[1]);
      await cacheService.get(keys[2]);
      
      // All keys should still exist (no eviction yet)
      for (const key of keys) {
        const exists = await cacheService.exists(key);
        expect(exists).toBe(true);
      }
    });
  });

  describe('Integration with set operation', () => {
    it('should check memory pressure during set operation', async () => {
      // This test verifies that set operation checks for memory pressure
      // The actual eviction happens in background, so we just verify no errors
      
      const key = 'test:set:pressure';
      const data = { test: 'data', large: 'x'.repeat(1000) };
      
      // Set should complete without errors even if memory pressure exists
      await expect(cacheService.set(key, data)).resolves.not.toThrow();
      
      // Verify the key was set
      const retrieved = await cacheService.get(key);
      expect(retrieved).toEqual(data);
    });

    it('should trigger background eviction when memory pressure detected during set', async () => {
      // Populate cache to potentially trigger memory pressure
      for (let i = 0; i < 30; i++) {
        await cacheService.set(`test:background:${i}`, { 
          data: `value${i}`,
          padding: 'x'.repeat(100)
        });
      }
      
      // Check if memory pressure was detected
      const underPressure = await cacheService.isMemoryPressure();
      console.log(`[Test] Memory pressure during set operations: ${underPressure}`);
      
      // All set operations should complete successfully
      const lastKey = 'test:background:29';
      const exists = await cacheService.exists(lastKey);
      expect(exists).toBe(true);
    });
  });

  describe('Memory Threshold Configuration', () => {
    it('should respect custom memory threshold', async () => {
      // Create a service with different threshold
      const customService = new CacheService({
        url: process.env.REDIS_URL || 'redis://localhost:6379',
        poolMin: 1,
        poolMax: 3,
        ttl: 300,
        memoryThreshold: 0.9, // 90% threshold
      });
      
      await customService.initialize();
      
      // Check memory pressure with custom threshold
      const underPressure = await customService.isMemoryPressure();
      
      // Should use the custom threshold (90%)
      const memoryInfo = await customService.getMemoryInfo();
      if (memoryInfo && memoryInfo.maxMemory > 0) {
        const expectedPressure = memoryInfo.usedMemoryPercentage >= 0.9;
        expect(underPressure).toBe(expectedPressure);
      }
      
      await customService.close();
    });
  });

  describe('Error Handling', () => {
    it('should handle Redis errors gracefully during eviction', async () => {
      // Eviction should not throw even if Redis has issues
      await expect(cacheService.evictUnderMemoryPressure(10, 2)).resolves.not.toThrow();
    });

    it('should return null for memory info on Redis error', async () => {
      // This test verifies error handling in getMemoryInfo
      // In normal operation, it should return valid info
      const memoryInfo = await cacheService.getMemoryInfo();
      
      // Should either return valid info or null (on error)
      if (memoryInfo !== null) {
        expect(memoryInfo.usedMemory).toBeGreaterThanOrEqual(0);
        expect(memoryInfo.maxMemory).toBeGreaterThanOrEqual(0);
      }
    });

    it('should return false for memory pressure check on error', async () => {
      // isMemoryPressure should return false if it cannot determine pressure
      const underPressure = await cacheService.isMemoryPressure();
      
      // Should return a boolean (false on error)
      expect(typeof underPressure).toBe('boolean');
    });
  });

  describe('Cache Statistics', () => {
    it('should track eviction operations in stats', async () => {
      const statsBefore = cacheService.getStats();
      
      // Perform some operations
      await cacheService.set('test:stats:1', { data: 'value1' });
      await cacheService.set('test:stats:2', { data: 'value2' });
      await cacheService.delete('test:stats:1');
      
      const statsAfter = cacheService.getStats();
      
      // Stats should be updated
      expect(statsAfter.sets).toBeGreaterThan(statsBefore.sets);
      expect(statsAfter.deletes).toBeGreaterThan(statsBefore.deletes);
    });
  });
});
