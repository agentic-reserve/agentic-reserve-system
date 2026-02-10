/**
 * Graceful Degradation Service
 * 
 * Handles dependency failures with fallback mechanisms:
 * - LYS Labs WebSocket disconnection: Continue serving cached data
 * - Supabase connection failure: Queue write operations for retry
 * - Redis connection failure: Fall back to direct Supabase queries
 * 
 * Requirements: 14.1, 14.2, 14.3
 */

import { circuitBreakers, retryWithBackoff } from './circuit-breaker';
import { CacheService, getCacheService } from './cache-service';
import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase';
import { memoryEventEmitter } from './event-emitter';

/**
 * Write operation to be queued when Supabase fails
 */
interface QueuedWriteOperation {
  id: string;
  type: 'insert' | 'update' | 'upsert' | 'delete';
  table: string;
  data: any;
  filter?: Record<string, any>;
  timestamp: number;
  retryCount: number;
}

/**
 * Service status for monitoring
 */
export interface ServiceStatus {
  lysLabs: {
    connected: boolean;
    lastDisconnect?: number;
    reconnectAttempts: number;
  };
  supabase: {
    available: boolean;
    queuedOperations: number;
    lastFailure?: number;
  };
  redis: {
    available: boolean;
    fallbackMode: boolean;
    lastFailure?: number;
  };
}

/**
 * Graceful Degradation Service
 * 
 * Provides fallback mechanisms when external dependencies fail.
 * Ensures the Memory Service continues operating in degraded mode.
 */
export class GracefulDegradationService {
  private supabase: SupabaseClient;
  private cacheService: CacheService;
  private writeQueue: QueuedWriteOperation[] = [];
  private isProcessingQueue: boolean = false;
  private maxQueueSize: number = 10000;
  private queueProcessInterval: NodeJS.Timeout | null = null;

  // Service status tracking
  private status: ServiceStatus = {
    lysLabs: {
      connected: false,
      reconnectAttempts: 0,
    },
    supabase: {
      available: true,
      queuedOperations: 0,
    },
    redis: {
      available: true,
      fallbackMode: false,
    },
  };

  constructor(supabase?: SupabaseClient, cacheService?: CacheService) {
    this.supabase = supabase || getSupabaseClient();
    this.cacheService = cacheService || getCacheService();
    this.startQueueProcessor();
  }

  /**
   * Execute a database write operation with queueing on failure
   * 
   * Requirement 14.2: Queue write operations when Supabase fails
   * 
   * @param operation - Write operation to execute
   * @returns Promise that resolves when operation completes or is queued
   */
  async executeWrite(operation: Omit<QueuedWriteOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    try {
      // Try to execute with circuit breaker and retry
      await circuitBreakers.supabase.execute(async () => {
        await retryWithBackoff(
          async () => {
            await this.performWrite(operation);
          },
          3,
          1000,
          {
            operation: `Supabase write to ${operation.table}`,
            emitEvent: (error: Error) => {
              memoryEventEmitter.emitSystemErrorEvent({
                message: `Write operation failed after 3 retries: ${error.message}`,
                code: 'WRITE_RETRY_EXHAUSTED',
                context: {
                  table: operation.table,
                  type: operation.type,
                  error: error.message,
                },
              });
            },
          }
        );
      });

      // Mark Supabase as available
      this.status.supabase.available = true;
    } catch (error) {
      console.error('[Graceful Degradation] Write operation failed, queueing:', error);
      
      // Mark Supabase as unavailable
      this.status.supabase.available = false;
      this.status.supabase.lastFailure = Date.now();

      // Queue the operation for later retry
      this.queueWriteOperation(operation);
    }
  }

  /**
   * Perform the actual write operation
   */
  private async performWrite(operation: Omit<QueuedWriteOperation, 'id' | 'timestamp' | 'retryCount'>): Promise<void> {
    let query: any;

    switch (operation.type) {
      case 'insert':
        query = this.supabase.from(operation.table).insert(operation.data);
        break;
      
      case 'update':
        query = this.supabase.from(operation.table).update(operation.data);
        if (operation.filter) {
          Object.entries(operation.filter).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }
        break;
      
      case 'upsert':
        query = this.supabase.from(operation.table).upsert(operation.data);
        break;
      
      case 'delete':
        query = this.supabase.from(operation.table).delete();
        if (operation.filter) {
          Object.entries(operation.filter).forEach(([key, value]) => {
            query = query.eq(key, value);
          });
        }
        break;
      
      default:
        throw new Error(`Unknown operation type: ${operation.type}`);
    }

    const { error } = await query;
    if (error) {
      throw new Error(`Database operation failed: ${error.message}`);
    }
  }

  /**
   * Queue a write operation for later retry
   * 
   * Requirement 14.2: Queue write operations when Supabase fails
   */
  private queueWriteOperation(operation: Omit<QueuedWriteOperation, 'id' | 'timestamp' | 'retryCount'>): void {
    // Check queue size limit
    if (this.writeQueue.length >= this.maxQueueSize) {
      console.error('[Graceful Degradation] Write queue full, dropping oldest operation');
      this.writeQueue.shift(); // Remove oldest operation
    }

    const queuedOp: QueuedWriteOperation = {
      ...operation,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      timestamp: Date.now(),
      retryCount: 0,
    };

    this.writeQueue.push(queuedOp);
    this.status.supabase.queuedOperations = this.writeQueue.length;

    console.log(`[Graceful Degradation] Queued write operation: ${queuedOp.id} (queue size: ${this.writeQueue.length})`);
  }

  /**
   * Start background queue processor
   * 
   * Processes queued write operations every 10 seconds
   */
  private startQueueProcessor(): void {
    // Process queue every 10 seconds
    this.queueProcessInterval = setInterval(async () => {
      await this.processWriteQueue();
    }, 10000);

    console.log('[Graceful Degradation] Queue processor started');
  }

  /**
   * Process queued write operations
   * 
   * Attempts to execute queued operations when Supabase becomes available
   */
  private async processWriteQueue(): Promise<void> {
    if (this.isProcessingQueue || this.writeQueue.length === 0) {
      return;
    }

    // Check if Supabase circuit is open
    if (circuitBreakers.supabase.getState() === 'open') {
      console.log('[Graceful Degradation] Supabase circuit is open, skipping queue processing');
      return;
    }

    this.isProcessingQueue = true;

    try {
      console.log(`[Graceful Degradation] Processing ${this.writeQueue.length} queued write operations`);

      // Process up to 10 operations at a time
      const batch = this.writeQueue.splice(0, 10);

      for (const operation of batch) {
        try {
          await this.performWrite(operation);
          console.log(`[Graceful Degradation] Successfully processed queued operation: ${operation.id}`);
        } catch (error) {
          console.error(`[Graceful Degradation] Failed to process queued operation: ${operation.id}`, error);
          
          // Increment retry count
          operation.retryCount++;

          // Re-queue if retry count is below limit (max 5 retries)
          if (operation.retryCount < 5) {
            this.writeQueue.push(operation);
          } else {
            console.error(`[Graceful Degradation] Dropping operation after 5 failed retries: ${operation.id}`);
          }
        }
      }

      this.status.supabase.queuedOperations = this.writeQueue.length;
    } finally {
      this.isProcessingQueue = false;
    }
  }

  /**
   * Execute a cache operation with fallback to direct database query
   * 
   * Requirement 14.3: Fall back to Supabase when Redis fails
   * 
   * @param cacheKey - Cache key
   * @param dbQuery - Database query function to execute on cache miss
   * @param ttl - Cache TTL in seconds
   * @returns Query result
   */
  async executeQuery<T>(
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
            this.status.redis.available = true;
            this.status.redis.fallbackMode = false;
            return JSON.parse(value) as T;
          }
          return null;
        },
        async () => {
          // Redis failed, mark as unavailable and use fallback mode
          this.status.redis.available = false;
          this.status.redis.fallbackMode = true;
          this.status.redis.lastFailure = Date.now();
          return null;
        }
      );

      if (cached !== null) {
        return cached;
      }
    } catch (error) {
      console.warn('[Graceful Degradation] Cache read failed, falling back to database:', error);
      this.status.redis.available = false;
      this.status.redis.fallbackMode = true;
      this.status.redis.lastFailure = Date.now();
    }

    // Cache miss or Redis unavailable - query database
    try {
      const result = await circuitBreakers.supabase.execute(dbQuery);

      // Try to cache the result (best effort)
      if (this.status.redis.available) {
        this.cacheService.set(cacheKey, JSON.stringify(result), ttl).catch(err => {
          console.warn('[Graceful Degradation] Failed to cache result:', err);
        });
      }

      return result;
    } catch (error) {
      console.error('[Graceful Degradation] Database query failed:', error);
      throw error;
    }
  }

  /**
   * Update LYS Labs connection status
   * 
   * Requirement 14.1: Continue serving cached data when LYS Labs disconnects
   * 
   * @param connected - Whether LYS Labs is connected
   * @param reconnectAttempts - Number of reconnection attempts
   */
  updateLYSLabsStatus(connected: boolean, reconnectAttempts: number = 0): void {
    this.status.lysLabs.connected = connected;
    this.status.lysLabs.reconnectAttempts = reconnectAttempts;

    if (!connected) {
      this.status.lysLabs.lastDisconnect = Date.now();
      console.warn('[Graceful Degradation] LYS Labs disconnected - serving cached data only');
    } else {
      console.log('[Graceful Degradation] LYS Labs reconnected');
    }
  }

  /**
   * Get current service status
   * 
   * @returns Service status for all dependencies
   */
  getStatus(): ServiceStatus {
    return {
      ...this.status,
      supabase: {
        ...this.status.supabase,
        queuedOperations: this.writeQueue.length,
      },
    };
  }

  /**
   * Check if service is in degraded mode
   * 
   * @returns True if any dependency is unavailable
   */
  isDegraded(): boolean {
    return !this.status.lysLabs.connected ||
           !this.status.supabase.available ||
           !this.status.redis.available;
  }

  /**
   * Get degraded mode details
   * 
   * @returns Array of degraded services
   */
  getDegradedServices(): string[] {
    const degraded: string[] = [];

    if (!this.status.lysLabs.connected) {
      degraded.push('LYS Labs WebSocket (real-time indexing unavailable)');
    }

    if (!this.status.supabase.available) {
      degraded.push(`Supabase (${this.writeQueue.length} operations queued)`);
    }

    if (!this.status.redis.available) {
      degraded.push('Redis (cache unavailable, using direct database queries)');
    }

    return degraded;
  }

  /**
   * Clear write queue (for testing or manual intervention)
   */
  clearWriteQueue(): void {
    const count = this.writeQueue.length;
    this.writeQueue = [];
    this.status.supabase.queuedOperations = 0;
    console.log(`[Graceful Degradation] Cleared ${count} queued write operations`);
  }

  /**
   * Stop queue processor (for cleanup)
   */
  stop(): void {
    if (this.queueProcessInterval) {
      clearInterval(this.queueProcessInterval);
      this.queueProcessInterval = null;
      console.log('[Graceful Degradation] Queue processor stopped');
    }
  }
}

// Export singleton instance
export const gracefulDegradation = new GracefulDegradationService();
