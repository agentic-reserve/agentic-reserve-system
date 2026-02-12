/**
 * Connection Pool Monitor
 * 
 * Monitors Supabase and Redis connection pool usage
 * Updates capacity metrics for capacity check middleware
 * 
 * Requirements: 13.2, 13.3, 13.4, 13.7
 */

import { supabase } from '../supabase';
import { redisClient } from '../redis';
import { updateConnectionMetrics } from '../../middleware/capacity-check';
import { metricsService } from './metrics';
import { config } from '../../config';

// Monitoring interval: 5 seconds
const MONITOR_INTERVAL_MS = 5000;

// Connection pool configuration
const SUPABASE_POOL_MIN = config.supabase.pool.min;
const SUPABASE_POOL_MAX = config.supabase.pool.max;
const REDIS_POOL_MIN = config.redis.pool.min;
const REDIS_POOL_MAX = config.redis.pool.max;

// Track monitoring state
let monitoringInterval: NodeJS.Timeout | null = null;
let isMonitoring = false;

// Simulated connection tracking (in production, these would come from actual pool stats)
// For Supabase, we track active queries as a proxy for connections
let activeSupabaseQueries = 0;
let activeRedisConnections = 0;

/**
 * Increment active Supabase query count
 */
export function incrementSupabaseQueries(): void {
  activeSupabaseQueries++;
  updateMetrics();
}

/**
 * Decrement active Supabase query count
 */
export function decrementSupabaseQueries(): void {
  activeSupabaseQueries = Math.max(0, activeSupabaseQueries - 1);
  updateMetrics();
}

/**
 * Increment active Redis connection count
 */
export function incrementRedisConnections(): void {
  activeRedisConnections++;
  updateMetrics();
}

/**
 * Decrement active Redis connection count
 */
export function decrementRedisConnections(): void {
  activeRedisConnections = Math.max(0, activeRedisConnections - 1);
  updateMetrics();
}

/**
 * Update connection metrics
 */
function updateMetrics(): void {
  // Update capacity check middleware
  updateConnectionMetrics(activeSupabaseQueries, activeRedisConnections);
  
  // Update Prometheus metrics
  metricsService.setGauge('memory_db_pool_size', SUPABASE_POOL_MAX);
  metricsService.setGauge('memory_db_active_connections', activeSupabaseQueries);
  metricsService.setGauge('memory_db_pool_utilization', activeSupabaseQueries / SUPABASE_POOL_MAX);
  
  metricsService.setGauge('memory_redis_pool_size', REDIS_POOL_MAX);
  metricsService.setGauge('memory_redis_active_connections', activeRedisConnections);
  metricsService.setGauge('memory_redis_pool_utilization', activeRedisConnections / REDIS_POOL_MAX);
}

/**
 * Monitor connection pools
 * Periodically checks pool status and updates metrics
 */
async function monitorPools(): Promise<void> {
  try {
    // Check Supabase connection health
    const supabaseStart = Date.now();
    try {
      await supabase.from('wallet_registrations').select('address').limit(1);
      const supabaseDuration = Date.now() - supabaseStart;
      metricsService.recordDatabaseMetrics(SUPABASE_POOL_MAX, activeSupabaseQueries, supabaseDuration);
    } catch (error) {
      console.error('Supabase health check failed:', error);
      metricsService.incrementCounter('memory_db_health_check_failures_total', 1);
    }
    
    // Check Redis connection health
    const redisStart = Date.now();
    try {
      if (redisClient) {
        await redisClient.ping();
      }
      const redisDuration = Date.now() - redisStart;
      metricsService.observeHistogram('memory_redis_ping_duration_seconds', redisDuration / 1000);
    } catch (error) {
      console.error('Redis health check failed:', error);
      metricsService.incrementCounter('memory_redis_health_check_failures_total', 1);
    }
    
    // Update metrics
    updateMetrics();
    
    // Log warnings if pool utilization is high
    const supabaseUtilization = activeSupabaseQueries / SUPABASE_POOL_MAX;
    const redisUtilization = activeRedisConnections / REDIS_POOL_MAX;
    
    if (supabaseUtilization > 0.8) {
      console.warn(`High Supabase pool utilization: ${(supabaseUtilization * 100).toFixed(1)}% (${activeSupabaseQueries}/${SUPABASE_POOL_MAX})`);
    }
    
    if (redisUtilization > 0.8) {
      console.warn(`High Redis pool utilization: ${(redisUtilization * 100).toFixed(1)}% (${activeRedisConnections}/${REDIS_POOL_MAX})`);
    }
  } catch (error) {
    console.error('Connection pool monitoring error:', error);
  }
}

/**
 * Start connection pool monitoring
 */
export function startMonitoring(): void {
  if (isMonitoring) {
    console.warn('Connection pool monitoring already started');
    return;
  }
  
  console.log('Starting connection pool monitoring...');
  console.log(`Supabase pool: ${SUPABASE_POOL_MIN}-${SUPABASE_POOL_MAX} connections`);
  console.log(`Redis pool: ${REDIS_POOL_MIN}-${REDIS_POOL_MAX} connections`);
  
  isMonitoring = true;
  
  // Initial metrics update
  updateMetrics();
  
  // Start periodic monitoring
  monitoringInterval = setInterval(monitorPools, MONITOR_INTERVAL_MS);
  
  console.log(`Connection pool monitoring started (interval: ${MONITOR_INTERVAL_MS}ms)`);
}

/**
 * Stop connection pool monitoring
 */
export function stopMonitoring(): void {
  if (!isMonitoring) {
    return;
  }
  
  console.log('Stopping connection pool monitoring...');
  
  if (monitoringInterval) {
    clearInterval(monitoringInterval);
    monitoringInterval = null;
  }
  
  isMonitoring = false;
  
  console.log('Connection pool monitoring stopped');
}

/**
 * Get current pool statistics
 */
export function getPoolStats(): {
  supabase: {
    min: number;
    max: number;
    active: number;
    utilization: number;
  };
  redis: {
    min: number;
    max: number;
    active: number;
    utilization: number;
  };
} {
  return {
    supabase: {
      min: SUPABASE_POOL_MIN,
      max: SUPABASE_POOL_MAX,
      active: activeSupabaseQueries,
      utilization: activeSupabaseQueries / SUPABASE_POOL_MAX,
    },
    redis: {
      min: REDIS_POOL_MIN,
      max: REDIS_POOL_MAX,
      active: activeRedisConnections,
      utilization: activeRedisConnections / REDIS_POOL_MAX,
    },
  };
}

/**
 * Reset connection counters
 * For testing purposes only
 */
export function resetCounters(): void {
  activeSupabaseQueries = 0;
  activeRedisConnections = 0;
  updateMetrics();
}
