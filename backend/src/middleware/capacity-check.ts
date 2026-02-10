import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/memory/metrics';
import { config } from '../config';

/**
 * Capacity Check Middleware
 * 
 * Monitors service capacity and returns HTTP 503 when at capacity:
 * - Tracks concurrent requests
 * - Monitors connection pool usage
 * - Returns retry-after header with suggested wait time
 * 
 * Requirement 13.4: Return HTTP 503 with retry-after header when at capacity
 */

// Track concurrent requests
let concurrentRequests = 0;
const MAX_CONCURRENT_REQUESTS = 1000; // Support 1000 concurrent queries (Requirement 13.1)

// Connection pool thresholds
const SUPABASE_POOL_MAX = config.supabase.pool.max;
const REDIS_POOL_MAX = config.redis.pool.max;
const POOL_CAPACITY_THRESHOLD = 0.9; // 90% utilization triggers capacity response

// Track active connections (updated by connection pool monitoring)
let activeSupabaseConnections = 0;
let activeRedisConnections = 0;

/**
 * Update active connection counts
 * Called by connection pool monitoring
 */
export function updateConnectionMetrics(supabase: number, redis: number): void {
  activeSupabaseConnections = supabase;
  activeRedisConnections = redis;
  
  // Update metrics
  metricsService.setGauge('memory_db_active_connections', supabase);
  metricsService.setGauge('memory_redis_active_connections', redis);
}

/**
 * Get current capacity utilization
 */
export function getCapacityUtilization(): {
  concurrentRequests: number;
  maxConcurrentRequests: number;
  requestUtilization: number;
  supabasePoolUtilization: number;
  redisPoolUtilization: number;
  atCapacity: boolean;
} {
  const requestUtilization = concurrentRequests / MAX_CONCURRENT_REQUESTS;
  const supabasePoolUtilization = activeSupabaseConnections / SUPABASE_POOL_MAX;
  const redisPoolUtilization = activeRedisConnections / REDIS_POOL_MAX;
  
  // At capacity if any resource exceeds threshold
  const atCapacity = 
    requestUtilization >= 1.0 || // At max concurrent requests
    supabasePoolUtilization >= POOL_CAPACITY_THRESHOLD || // Supabase pool near capacity
    redisPoolUtilization >= POOL_CAPACITY_THRESHOLD; // Redis pool near capacity
  
  return {
    concurrentRequests,
    maxConcurrentRequests: MAX_CONCURRENT_REQUESTS,
    requestUtilization,
    supabasePoolUtilization,
    redisPoolUtilization,
    atCapacity,
  };
}

/**
 * Calculate retry-after time based on current load
 * Returns suggested wait time in seconds
 */
function calculateRetryAfter(): number {
  const utilization = getCapacityUtilization();
  
  // Base retry time on highest utilization
  const maxUtilization = Math.max(
    utilization.requestUtilization,
    utilization.supabasePoolUtilization,
    utilization.redisPoolUtilization
  );
  
  // Scale retry time based on utilization:
  // 90-95%: 5 seconds
  // 95-100%: 10 seconds
  // >100%: 30 seconds
  if (maxUtilization >= 1.0) {
    return 30;
  } else if (maxUtilization >= 0.95) {
    return 10;
  } else {
    return 5;
  }
}

/**
 * Capacity check middleware
 * Returns HTTP 503 when service is at capacity
 */
export async function capacityCheck(
  req: Request,
  res: Response,
  next: NextFunction
): Promise<void> {
  const utilization = getCapacityUtilization();
  
  // Check if at capacity
  if (utilization.atCapacity) {
    const retryAfter = calculateRetryAfter();
    
    // Record capacity overload metric
    metricsService.incrementCounter('memory_capacity_overload_total', 1);
    
    // Log capacity overload
    console.warn('Service at capacity:', {
      concurrentRequests: utilization.concurrentRequests,
      maxConcurrentRequests: utilization.maxConcurrentRequests,
      requestUtilization: `${(utilization.requestUtilization * 100).toFixed(1)}%`,
      supabasePoolUtilization: `${(utilization.supabasePoolUtilization * 100).toFixed(1)}%`,
      redisPoolUtilization: `${(utilization.redisPoolUtilization * 100).toFixed(1)}%`,
      retryAfter,
    });
    
    // Return HTTP 503 with retry-after header
    res.status(503)
      .setHeader('Retry-After', retryAfter.toString())
      .json({
        error: 'Service at capacity',
        message: 'The service is currently at capacity. Please retry after the suggested wait time.',
        retryAfter,
        capacity: {
          requestUtilization: `${(utilization.requestUtilization * 100).toFixed(1)}%`,
          supabasePoolUtilization: `${(utilization.supabasePoolUtilization * 100).toFixed(1)}%`,
          redisPoolUtilization: `${(utilization.redisPoolUtilization * 100).toFixed(1)}%`,
        },
      });
    
    return;
  }
  
  // Increment concurrent request counter
  concurrentRequests++;
  metricsService.setGauge('memory_concurrent_requests', concurrentRequests);
  
  // Track request start time for metrics
  const startTime = Date.now();
  
  // Decrement counter when request completes
  const cleanup = () => {
    concurrentRequests--;
    metricsService.setGauge('memory_concurrent_requests', concurrentRequests);
    
    // Record request duration
    const duration = Date.now() - startTime;
    metricsService.observeHistogram('memory_request_duration_seconds', duration / 1000);
  };
  
  // Ensure cleanup happens on response finish or error
  res.on('finish', cleanup);
  res.on('close', cleanup);
  res.on('error', cleanup);
  
  next();
}

/**
 * Get current concurrent request count
 * Exported for testing and monitoring
 */
export function getConcurrentRequests(): number {
  return concurrentRequests;
}

/**
 * Reset concurrent request counter
 * For testing purposes only
 */
export function resetConcurrentRequests(): void {
  concurrentRequests = 0;
}
