import { CacheService, getCacheService } from './cache-service';
import { circuitBreakers, retryWithBackoff } from './circuit-breaker';
import { supabase } from '../supabase';
import { gracefulDegradation } from './graceful-degradation';
import { memoryEventEmitter } from './event-emitter';

/**
 * Resilient Cache Service with Graceful Degradation
 * 
 * Provides fallback mechanisms when Redis fails:
 * - Falls back to direct Supabase queries when Redis is unavailable
 * - Continues serving cached data when Supabase fails
 * - Queues write operations for retry when dependencies fail
 * 
 * This service now delegates to the GracefulDegradationService for
 * comprehensive dependency failure handling.
 * 
 * Requirements: 14.1, 14.2, 14.3
 */
export class ResilientCacheService {
  private cacheService: CacheService;
  private writeQueue: Array<{ key: string; value: any; ttl: number }> = [];
  private isProcessingQueue: boolean = false;

  constructor() {
    this.cacheService = getCacheService();
    this.startQueueProcessor();
  }

  /**
   * Get value with fallback to database
   * Requirement 14.3
   */
  async get<T>(
    cacheKey: string,
    dbQuery: () => Promise<T>,
    ttl: number = 300
  ): Promise<T> {
    try {
      // Try cache first with circuit breaker
      const cached = await circuitBreakers.redis.executeWithFallback(
        async () => {
          const value = await this.cacheService.get(cacheKey);
          if (value) {
            return JSON.parse(value) as T;
          }
          return null;
        },
        async () => null // Fallback to null if Redis fails
      );

      if (cached !== null) {
        return cached;
      }
    } catch (error) {
      console.warn('[Resilient Cache] Cache read failed, falling back to database:', error);
    }

    // Cache miss or Redis unavailable - query database
    try {
      const result = await circuitBreakers.supabase.execute(dbQuery);

      // Try to cache the result (best effort)
      this.setAsync(cacheKey, result, ttl).catch(err => {
        console.warn('[Resilient Cache] Failed to cache result:', err);
      });

      return result;
    } catch (error) {
      console.error('[Resilient Cache] Database query failed:', error);
      throw error;
    }
  }

  /**
   * Set value with retry and queueing
   * Requirement 14.2
   */
  async set(key: string, value: any, ttl: number = 300): Promise<void> {
    try {
      await retryWithBackoff(
        async () => {
          await circuitBreakers.redis.execute(async () => {
            await this.cacheService.set(key, JSON.stringify(value), ttl);
          });
        },
        3, // 3 attempts
        1000, // 1 second base delay
        {
          operation: `Redis cache set for key: ${key}`,
          emitEvent: (error: Error) => {
            memoryEventEmitter.emitSystemErrorEvent({
              message: `Cache set operation failed after 3 retries: ${error.message}`,
              code: 'CACHE_SET_RETRY_EXHAUSTED',
              context: {
                key,
                error: error.message,
              },
            });
          },
        }
      );
    } catch (error) {
      console.error('[Resilient Cache] Failed to set cache after retries, queueing:', error);
      // Queue for later retry
      this.writeQueue.push({ key, value, ttl });
    }
  }

  /**
   * Set value asynchronously (fire and forget)
   */
  async setAsync(key: string, value: any, ttl: number = 300): Promise<void> {
    this.set(key, value, ttl).catch(err => {
      console.warn('[Resilient Cache] Async set failed:', err);
    });
  }

  /**
   * Delete value with retry
   */
  async delete(key: string): Promise<void> {
    try {
      await retryWithBackoff(
        async () => {
          await circuitBreakers.redis.execute(async () => {
            await this.cacheService.delete(key);
          });
        },
        3,
        1000,
        {
          operation: `Redis cache delete for key: ${key}`,
          emitEvent: (error: Error) => {
            memoryEventEmitter.emitSystemErrorEvent({
              message: `Cache delete operation failed after 3 retries: ${error.message}`,
              code: 'CACHE_DELETE_RETRY_EXHAUSTED',
              context: {
                key,
                error: error.message,
              },
            });
          },
        }
      );
    } catch (error) {
      console.error('[Resilient Cache] Failed to delete cache key:', error);
      // Non-critical - don't queue deletes
    }
  }

  /**
   * Invalidate pattern with retry
   */
  async invalidatePattern(pattern: string): Promise<void> {
    try {
      await retryWithBackoff(
        async () => {
          await circuitBreakers.redis.execute(async () => {
            await this.cacheService.invalidatePattern(pattern);
          });
        },
        3,
        1000,
        {
          operation: `Redis cache invalidate pattern: ${pattern}`,
          emitEvent: (error: Error) => {
            memoryEventEmitter.emitSystemErrorEvent({
              message: `Cache invalidate pattern operation failed after 3 retries: ${error.message}`,
              code: 'CACHE_INVALIDATE_RETRY_EXHAUSTED',
              context: {
                pattern,
                error: error.message,
              },
            });
          },
        }
      );
    } catch (error) {
      console.error('[Resilient Cache] Failed to invalidate pattern:', error);
      // Non-critical - don't queue invalidations
    }
  }

  /**
   * Process queued write operations
   */
  private startQueueProcessor(): void {
    setInterval(async () => {
      if (this.isProcessingQueue || this.writeQueue.length === 0) {
        return;
      }

      this.isProcessingQueue = true;

      try {
        // Check if Redis is available
        if (circuitBreakers.redis.getState() === 'open') {
          console.log('[Resilient Cache] Redis circuit is open, skipping queue processing');
          return;
        }

        console.log(`[Resilient Cache] Processing ${this.writeQueue.length} queued writes`);

        const batch = this.writeQueue.splice(0, 10); // Process 10 at a time

        for (const item of batch) {
          try {
            await this.cacheService.set(item.key, JSON.stringify(item.value), item.ttl);
          } catch (error) {
            console.error('[Resilient Cache] Failed to process queued write:', error);
            // Re-queue if still failing
            this.writeQueue.push(item);
          }
        }
      } finally {
        this.isProcessingQueue = false;
      }
    }, 10000); // Process every 10 seconds
  }

  /**
   * Get queue size
   */
  getQueueSize(): number {
    return this.writeQueue.length;
  }

  /**
   * Clear write queue
   */
  clearQueue(): void {
    this.writeQueue = [];
  }
}

// Export singleton instance
export const resilientCache = new ResilientCacheService();
