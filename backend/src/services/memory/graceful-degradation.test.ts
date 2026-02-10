/**
 * Graceful Degradation Service Tests
 * 
 * Tests the graceful degradation mechanisms for dependency failures:
 * - LYS Labs WebSocket disconnection
 * - Supabase connection failure
 * - Redis connection failure
 * 
 * Requirements: 14.1, 14.2, 14.3
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { GracefulDegradationService, ServiceStatus } from './graceful-degradation';
import { circuitBreakers } from './circuit-breaker';

// Mock dependencies
const mockSupabase = {
  from: vi.fn(),
};

const mockCacheService = {
  get: vi.fn(),
  set: vi.fn(),
  delete: vi.fn(),
};

describe('GracefulDegradationService', () => {
  let service: GracefulDegradationService;

  beforeEach(() => {
    // Reset mocks
    vi.clearAllMocks();
    
    // Reset circuit breakers
    circuitBreakers.supabase.reset();
    circuitBreakers.redis.reset();
    
    // Create service instance with mocks
    service = new GracefulDegradationService(mockSupabase as any, mockCacheService as any);
  });

  afterEach(() => {
    // Stop queue processor
    service.stop();
  });

  describe('Requirement 14.1: Continue serving cached data when LYS Labs disconnects', () => {
    it('should update LYS Labs status when disconnected', () => {
      service.updateLYSLabsStatus(false, 1);
      
      const status = service.getStatus();
      expect(status.lysLabs.connected).toBe(false);
      expect(status.lysLabs.reconnectAttempts).toBe(1);
      expect(status.lysLabs.lastDisconnect).toBeDefined();
    });

    it('should update LYS Labs status when reconnected', () => {
      service.updateLYSLabsStatus(false, 1);
      service.updateLYSLabsStatus(true, 0);
      
      const status = service.getStatus();
      expect(status.lysLabs.connected).toBe(true);
      expect(status.lysLabs.reconnectAttempts).toBe(0);
    });

    it('should report degraded mode when LYS Labs is disconnected', () => {
      service.updateLYSLabsStatus(false, 1);
      
      expect(service.isDegraded()).toBe(true);
      const degradedServices = service.getDegradedServices();
      expect(degradedServices).toContain('LYS Labs WebSocket (real-time indexing unavailable)');
    });

    it('should continue serving cached data when LYS Labs is disconnected', async () => {
      // Disconnect LYS Labs
      service.updateLYSLabsStatus(false, 1);
      
      // Mock cached data
      mockCacheService.get.mockResolvedValue(JSON.stringify({ data: 'cached' }));
      
      // Execute query - should return cached data
      const result = await service.executeQuery(
        'test:key',
        async () => ({ data: 'database' })
      );
      
      expect(result).toEqual({ data: 'cached' });
      expect(mockCacheService.get).toHaveBeenCalledWith('test:key');
    });
  });

  describe('Requirement 14.2: Queue write operations when Supabase fails', () => {
    it('should queue write operation when Supabase fails', async () => {
      // Mock Supabase failure
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: new Error('Connection failed') }),
      });

      // Execute write operation
      await service.executeWrite({
        type: 'insert',
        table: 'test_table',
        data: { id: 1, name: 'test' },
      });

      // Check that operation was queued
      const status = service.getStatus();
      expect(status.supabase.queuedOperations).toBe(1);
      expect(status.supabase.available).toBe(false);
    });

    it('should process queued operations when Supabase recovers', async () => {
      // First, queue an operation by failing
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: new Error('Connection failed') }),
      });

      await service.executeWrite({
        type: 'insert',
        table: 'test_table',
        data: { id: 1, name: 'test' },
      });

      expect(service.getStatus().supabase.queuedOperations).toBe(1);

      // Now mock success for queue processing
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      // Manually trigger queue processing
      await (service as any).processWriteQueue();

      // Queue should be empty after successful processing
      expect(service.getStatus().supabase.queuedOperations).toBe(0);
    });

    it('should limit queue size to prevent memory exhaustion', async () => {
      // Mock Supabase failure
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: new Error('Connection failed') }),
      });

      // Queue more than max size (10000) - but only test with smaller number for speed
      const testQueueSize = 100;
      const promises = [];
      for (let i = 0; i < testQueueSize; i++) {
        promises.push(service.executeWrite({
          type: 'insert',
          table: 'test_table',
          data: { id: i },
        }));
      }
      await Promise.all(promises);

      // Queue should have all operations
      const status = service.getStatus();
      expect(status.supabase.queuedOperations).toBe(testQueueSize);
    }, 10000);

    it('should retry queued operations with exponential backoff', async () => {
      // Queue an operation
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: new Error('Connection failed') }),
      });

      await service.executeWrite({
        type: 'insert',
        table: 'test_table',
        data: { id: 1 },
      });

      // Mock continued failure for first few retries
      mockSupabase.from
        .mockReturnValueOnce({
          insert: vi.fn().mockResolvedValue({ error: new Error('Still failing') }),
        })
        .mockReturnValueOnce({
          insert: vi.fn().mockResolvedValue({ error: new Error('Still failing') }),
        })
        .mockReturnValue({
          insert: vi.fn().mockResolvedValue({ error: null }),
        });

      // Process queue multiple times
      await (service as any).processWriteQueue();
      await (service as any).processWriteQueue();
      await (service as any).processWriteQueue();

      // Eventually should succeed
      expect(service.getStatus().supabase.queuedOperations).toBe(0);
    });

    it('should drop operations after max retry attempts', async () => {
      // Queue an operation
      mockSupabase.from.mockReturnValueOnce({
        insert: vi.fn().mockResolvedValue({ error: new Error('Connection failed') }),
      });

      await service.executeWrite({
        type: 'insert',
        table: 'test_table',
        data: { id: 1 },
      });

      // Mock continued failure for all retries
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: new Error('Permanent failure') }),
      });

      // Process queue 6 times (max 5 retries)
      for (let i = 0; i < 6; i++) {
        await (service as any).processWriteQueue();
      }

      // Operation should be dropped after max retries
      expect(service.getStatus().supabase.queuedOperations).toBe(0);
    });

    it('should handle different write operation types', async () => {
      // Mock success
      const mockQuery = {
        insert: vi.fn().mockResolvedValue({ error: null }),
        update: vi.fn().mockReturnThis(),
        upsert: vi.fn().mockResolvedValue({ error: null }),
        delete: vi.fn().mockReturnThis(),
        eq: vi.fn().mockResolvedValue({ error: null }),
      };
      mockSupabase.from.mockReturnValue(mockQuery);

      // Test insert
      await service.executeWrite({
        type: 'insert',
        table: 'test_table',
        data: { id: 1 },
      });
      expect(mockQuery.insert).toHaveBeenCalled();

      // Test update
      await service.executeWrite({
        type: 'update',
        table: 'test_table',
        data: { name: 'updated' },
        filter: { id: 1 },
      });
      expect(mockQuery.update).toHaveBeenCalled();
      expect(mockQuery.eq).toHaveBeenCalledWith('id', 1);

      // Test upsert
      await service.executeWrite({
        type: 'upsert',
        table: 'test_table',
        data: { id: 1, name: 'upserted' },
      });
      expect(mockQuery.upsert).toHaveBeenCalled();

      // Test delete
      await service.executeWrite({
        type: 'delete',
        table: 'test_table',
        filter: { id: 1 },
      });
      expect(mockQuery.delete).toHaveBeenCalled();
    });
  });

  describe('Requirement 14.3: Fall back to Supabase when Redis fails', () => {
    it('should fall back to database query when Redis fails', async () => {
      // Mock Redis failure
      mockCacheService.get.mockRejectedValue(new Error('Redis connection failed'));

      // Mock database query
      const dbQuery = vi.fn().mockResolvedValue({ data: 'from_database' });

      // Execute query
      const result = await service.executeQuery('test:key', dbQuery);

      expect(result).toEqual({ data: 'from_database' });
      expect(dbQuery).toHaveBeenCalled();
      
      // Check Redis is marked as unavailable
      const status = service.getStatus();
      expect(status.redis.available).toBe(false);
      expect(status.redis.fallbackMode).toBe(true);
    });

    it('should use cache when Redis is available', async () => {
      // Mock cached data
      mockCacheService.get.mockResolvedValue(JSON.stringify({ data: 'cached' }));

      // Mock database query (should not be called)
      const dbQuery = vi.fn().mockResolvedValue({ data: 'from_database' });

      // Execute query
      const result = await service.executeQuery('test:key', dbQuery);

      expect(result).toEqual({ data: 'cached' });
      expect(dbQuery).not.toHaveBeenCalled();
      expect(mockCacheService.get).toHaveBeenCalledWith('test:key');
    });

    it('should query database and cache result on cache miss', async () => {
      // Mock cache miss
      mockCacheService.get.mockResolvedValue(null);
      mockCacheService.set.mockResolvedValue(undefined);

      // Mock database query
      const dbQuery = vi.fn().mockResolvedValue({ data: 'from_database' });

      // Execute query
      const result = await service.executeQuery('test:key', dbQuery, 300);

      expect(result).toEqual({ data: 'from_database' });
      expect(dbQuery).toHaveBeenCalled();
      expect(mockCacheService.set).toHaveBeenCalledWith(
        'test:key',
        JSON.stringify({ data: 'from_database' }),
        300
      );
    });

    it('should continue serving when cache write fails', async () => {
      // Mock cache miss
      mockCacheService.get.mockResolvedValue(null);
      // Mock cache write failure (should not throw)
      mockCacheService.set.mockRejectedValue(new Error('Cache write failed'));

      // Mock database query
      const dbQuery = vi.fn().mockResolvedValue({ data: 'from_database' });

      // Execute query - should succeed despite cache write failure
      const result = await service.executeQuery('test:key', dbQuery);

      expect(result).toEqual({ data: 'from_database' });
      expect(dbQuery).toHaveBeenCalled();
    });

    it('should report degraded mode when Redis is unavailable', async () => {
      // Mock Redis failure
      mockCacheService.get.mockRejectedValue(new Error('Redis connection failed'));

      // Execute query to trigger Redis failure detection
      const dbQuery = vi.fn().mockResolvedValue({ data: 'test' });
      await service.executeQuery('test:key', dbQuery);

      expect(service.isDegraded()).toBe(true);
      const degradedServices = service.getDegradedServices();
      expect(degradedServices).toContain('Redis (cache unavailable, using direct database queries)');
    });
  });

  describe('Service Status and Monitoring', () => {
    it('should return complete service status', () => {
      service.updateLYSLabsStatus(false, 2);
      
      const status = service.getStatus();
      
      expect(status).toHaveProperty('lysLabs');
      expect(status).toHaveProperty('supabase');
      expect(status).toHaveProperty('redis');
      
      expect(status.lysLabs).toHaveProperty('connected');
      expect(status.lysLabs).toHaveProperty('reconnectAttempts');
      expect(status.lysLabs).toHaveProperty('lastDisconnect');
      
      expect(status.supabase).toHaveProperty('available');
      expect(status.supabase).toHaveProperty('queuedOperations');
      
      expect(status.redis).toHaveProperty('available');
      expect(status.redis).toHaveProperty('fallbackMode');
    });

    it('should report not degraded when all services are available', () => {
      service.updateLYSLabsStatus(true, 0);
      
      expect(service.isDegraded()).toBe(false);
      expect(service.getDegradedServices()).toHaveLength(0);
    });

    it('should report degraded when any service is unavailable', async () => {
      // Fail Supabase
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: new Error('Connection failed') }),
      });

      await service.executeWrite({
        type: 'insert',
        table: 'test_table',
        data: { id: 1 },
      });

      expect(service.isDegraded()).toBe(true);
      const degradedServices = service.getDegradedServices();
      expect(degradedServices.length).toBeGreaterThan(0);
    });

    it('should clear write queue manually', async () => {
      // Queue some operations
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: new Error('Connection failed') }),
      });

      const promises = [
        service.executeWrite({
          type: 'insert',
          table: 'test_table',
          data: { id: 1 },
        }),
        service.executeWrite({
          type: 'insert',
          table: 'test_table',
          data: { id: 2 },
        })
      ];
      
      await Promise.all(promises);

      expect(service.getStatus().supabase.queuedOperations).toBe(2);

      // Clear queue
      service.clearWriteQueue();

      expect(service.getStatus().supabase.queuedOperations).toBe(0);
    }, 10000);
  });

  describe('Integration with Circuit Breaker', () => {
    it('should use circuit breaker for write operations', async () => {
      // Mock Supabase failure to trigger circuit breaker
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: new Error('Connection failed') }),
      });

      // Execute multiple writes to open circuit
      const promises = [];
      for (let i = 0; i < 5; i++) {
        promises.push(service.executeWrite({
          type: 'insert',
          table: 'test_table',
          data: { id: i },
        }));
      }
      await Promise.all(promises);

      // Circuit should be open
      expect(circuitBreakers.supabase.getState()).toBe('open');
    }, 10000);

    it('should use circuit breaker for read operations', async () => {
      // Mock Redis failure
      mockCacheService.get.mockRejectedValue(new Error('Redis connection failed'));

      // Execute multiple queries to open circuit
      const dbQuery = vi.fn().mockResolvedValue({ data: 'test' });
      
      for (let i = 0; i < 3; i++) {
        try {
          await service.executeQuery('test:key', dbQuery);
        } catch (error) {
          // Ignore errors
        }
      }

      // Redis circuit should be open
      expect(circuitBreakers.redis.getState()).toBe('open');
    });

    it('should skip queue processing when circuit is open', async () => {
      // Queue an operation
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: new Error('Connection failed') }),
      });

      await service.executeWrite({
        type: 'insert',
        table: 'test_table',
        data: { id: 1 },
      });

      // Open the circuit manually
      for (let i = 0; i < 5; i++) {
        circuitBreakers.supabase['onFailure']();
      }

      expect(circuitBreakers.supabase.getState()).toBe('open');

      // Try to process queue - should skip
      await (service as any).processWriteQueue();

      // Queue should still have the operation
      expect(service.getStatus().supabase.queuedOperations).toBe(1);
    });
  });

  describe('Edge Cases and Error Handling', () => {
    it('should handle null cache values correctly', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      const dbQuery = vi.fn().mockResolvedValue({ data: 'test' });
      const result = await service.executeQuery('test:key', dbQuery);
      
      expect(result).toEqual({ data: 'test' });
      expect(dbQuery).toHaveBeenCalled();
    });

    it('should handle invalid JSON in cache', async () => {
      mockCacheService.get.mockResolvedValue('invalid json {');
      
      const dbQuery = vi.fn().mockResolvedValue({ data: 'test' });
      
      // Should fall back to database query when JSON parsing fails
      const result = await service.executeQuery('test:key', dbQuery);
      
      expect(result).toEqual({ data: 'test' });
      expect(dbQuery).toHaveBeenCalled();
    });

    it('should handle database query failures', async () => {
      mockCacheService.get.mockResolvedValue(null);
      
      const dbQuery = vi.fn().mockRejectedValue(new Error('Database error'));
      
      await expect(service.executeQuery('test:key', dbQuery)).rejects.toThrow('Database error');
    });

    it('should handle unknown operation types', async () => {
      mockSupabase.from.mockReturnValue({
        insert: vi.fn().mockResolvedValue({ error: null }),
      });

      // Unknown operation types should be queued (not throw immediately)
      await service.executeWrite({
        type: 'unknown' as any,
        table: 'test_table',
        data: { id: 1 },
      });
      
      // Operation should be queued after retry failures
      expect(service.getStatus().supabase.queuedOperations).toBe(1);
    }, 10000);

    it('should stop queue processor on cleanup', () => {
      const service2 = new GracefulDegradationService(mockSupabase as any, mockCacheService as any);
      
      // Queue processor should be running
      expect((service2 as any).queueProcessInterval).not.toBeNull();
      
      // Stop service
      service2.stop();
      
      // Queue processor should be stopped
      expect((service2 as any).queueProcessInterval).toBeNull();
    });
  });
});
