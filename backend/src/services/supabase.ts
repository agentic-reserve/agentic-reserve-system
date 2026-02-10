import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { config } from '../config';
import { metricsService } from './memory/metrics';
import { slowQueryLogger } from './memory/slow-query-logger';

let supabaseClient: SupabaseClient | null = null;

// Connection pool tracking
let activeConnections = 0;
const maxConnections = config.supabase.pool.max;

/**
 * Enhanced Supabase client with metrics tracking
 */
class MetricsSupabaseClient {
  private client: SupabaseClient;

  constructor(client: SupabaseClient) {
    this.client = client;
  }

  /**
   * Execute a query with metrics tracking
   */
  async query(queryFn: (client: SupabaseClient) => Promise<any>): Promise<any> {
    const startTime = Date.now();
    activeConnections++;
    
    try {
      // Update connection pool metrics
      metricsService.recordDatabaseMetrics(maxConnections, activeConnections, 0);
      
      const result = await queryFn(this.client);
      
      const duration = Date.now() - startTime;
      metricsService.recordDatabaseMetrics(maxConnections, activeConnections, duration);
      
      // Log slow queries
      if (duration > config.memoryService.query.slowQueryThresholdMs) {
        slowQueryLogger.logSlowDatabaseQuery(
          'Database query', // Would need actual query text
          'unknown', // Would need actual table name
          duration
        );
      }
      
      return result;
    } catch (error) {
      const duration = Date.now() - startTime;
      metricsService.recordDatabaseMetrics(maxConnections, activeConnections, duration);
      metricsService.incrementCounter('memory_db_errors_total', 1);
      throw error;
    } finally {
      activeConnections--;
    }
  }

  /**
   * Get the underlying Supabase client
   */
  get raw(): SupabaseClient {
    return this.client;
  }

  /**
   * Proxy all other methods to the underlying client
   */
  from(table: string) {
    return this.client.from(table);
  }

  rpc(fn: string, args?: any) {
    return this.client.rpc(fn, args);
  }

  get storage() {
    return this.client.storage;
  }

  get auth() {
    return this.client.auth;
  }

  get realtime() {
    return this.client.realtime;
  }
}

export function getSupabaseClient(): MetricsSupabaseClient {
  if (!supabaseClient) {
    const rawClient = createClient(
      config.supabase.url,
      config.supabase.serviceKey,
      {
        db: {
          schema: 'public',
        },
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          headers: {
            'x-application-name': 'ars-memory-service',
          },
        },
      }
    );
    supabaseClient = rawClient;
  }
  
  return new MetricsSupabaseClient(supabaseClient);
}

export const supabase = getSupabaseClient();
