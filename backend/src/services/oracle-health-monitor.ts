import { getOracleAggregator } from './oracles/oracle-aggregator';
import { getRedisClient, setCachedData } from './redis';
import { Redis } from '@upstash/redis';
import { RedisClientType } from 'redis';
import { config } from '../config';

/**
 * Oracle Health Monitoring Service
 * Monitors the health of all oracle sources and stores metrics
 */
export class OracleHealthMonitor {
  private redisClient: RedisClientType | Redis | null = null;
  private aggregator: ReturnType<typeof getOracleAggregator>;
  private monitoringInterval: NodeJS.Timeout | null = null;

  constructor() {
    this.aggregator = getOracleAggregator();
  }

  /**
   * Initialize the health monitor
   */
  async initialize(): Promise<void> {
    this.redisClient = await getRedisClient();
    console.log('✅ Oracle health monitor initialized');
  }

  /**
   * Start monitoring oracle health (every 5 minutes)
   */
  startMonitoring(intervalMs: number = 5 * 60 * 1000): void {
    if (this.monitoringInterval) {
      console.warn('⚠️  Oracle health monitoring already running');
      return;
    }

    console.log(`🔍 Starting oracle health monitoring (interval: ${intervalMs}ms)`);

    // Run immediately
    this.checkHealth();

    // Then run on interval
    this.monitoringInterval = setInterval(() => {
      this.checkHealth();
    }, intervalMs);
  }

  /**
   * Stop monitoring
   */
  stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      console.log('🛑 Oracle health monitoring stopped');
    }
  }

  /**
   * Check health of all oracle sources
   */
  async checkHealth(): Promise<void> {
    try {
      const health = await this.aggregator.getOracleHealth();
      const timestamp = Date.now();

      // Store health metrics in Redis
      await this.storeHealthMetrics(health, timestamp);

      // Log health status
      this.logHealthStatus(health);

      // Check for critical issues
      if (health.overall === 'critical') {
        await this.handleCriticalHealth(health);
      } else if (health.overall === 'degraded') {
        await this.handleDegradedHealth(health);
      }
    } catch (error) {
      console.error('❌ Oracle health check failed:', error);
      await this.handleHealthCheckFailure(error);
    }
  }

  /**
   * Store health metrics in Redis
   */
  private async storeHealthMetrics(
    health: Awaited<ReturnType<typeof this.aggregator.getOracleHealth>>,
    timestamp: number
  ): Promise<void> {
    const key = `oracle:health:${timestamp}`;
    const ttl = 24 * 60 * 60; // 24 hours

    await setCachedData(key, health, ttl);

    // Store current health status
    await setCachedData('oracle:health:current', {
      ...health,
      timestamp,
    }, ttl);

    // Update uptime metrics
    await this.updateUptimeMetrics(health);
  }

  /**
   * Update uptime metrics for each oracle
   */

  /**
   * Update uptime metrics for each oracle
   */
  private async updateUptimeMetrics(
    health: Awaited<ReturnType<typeof this.aggregator.getOracleHealth>>
  ): Promise<void> {
    const sources = ['pyth', 'switchboard', 'birdeye'] as const;

    for (const source of sources) {
      const isHealthy = health[source].healthy;
      const key = `oracle:uptime:${source}`;

      // Increment total checks
      await this.redisClient.hIncrBy(key, 'total_checks', 1);

      // Increment successful checks if healthy
      if (isHealthy) {
        await this.redisClient.hIncrBy(key, 'successful_checks', 1);
      }

      // Store latest latency
      if (health[source].latency) {
        await this.redisClient.hSet(key, 'latest_latency', health[source].latency!.toString());
      }
    }
  }

  /**
   * Log health status to console
   */
  private logHealthStatus(
    health: Awaited<ReturnType<typeof this.aggregator.getOracleHealth>>
  ): void {
    const statusEmoji = {
      healthy: '✅',
      degraded: '⚠️ ',
      critical: '❌',
    };

    console.log(`\n${statusEmoji[health.overall]} Oracle Health: ${health.overall.toUpperCase()}`);
    console.log(`  Pyth:        ${health.pyth.healthy ? '✅' : '❌'} (${health.pyth.latency || 'N/A'}ms)`);
    console.log(`  Switchboard: ${health.switchboard.healthy ? '✅' : '❌'} (${health.switchboard.latency || 'N/A'}ms)`);
    console.log(`  Birdeye:     ${health.birdeye.healthy ? '✅' : '❌'} (${health.birdeye.latency || 'N/A'}ms)\n`);
  }

  /**
   * Handle critical health status
   */
  private async handleCriticalHealth(
    health: Awaited<ReturnType<typeof this.aggregator.getOracleHealth>>
  ): Promise<void> {
    console.error('🚨 CRITICAL: Less than 2 oracle sources are healthy!');

    // Store alert in Redis
    await this.storeAlert('critical', 'Less than 2 oracle sources are healthy', health);

    // TODO: Send webhook/email notification
    // TODO: Trigger circuit breaker if needed
  }

  /**
   * Handle degraded health status
   */
  private async handleDegradedHealth(
    health: Awaited<ReturnType<typeof this.aggregator.getOracleHealth>>
  ): Promise<void> {
    console.warn('⚠️  DEGRADED: Only 2 oracle sources are healthy');

    // Store alert in Redis
    await this.storeAlert('degraded', 'Only 2 oracle sources are healthy', health);

    // TODO: Send warning notification
  }

  /**
   * Handle health check failure
   */
  private async handleHealthCheckFailure(error: unknown): Promise<void> {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';

    await this.storeAlert('error', `Health check failed: ${errorMessage}`, {
      error: errorMessage,
      timestamp: Date.now(),
    });
  }

  /**
   * Store alert in Redis
   */
  private async storeAlert(
    level: 'critical' | 'degraded' | 'error',
    message: string,
    data: any
  ): Promise<void> {
    const alert = {
      level,
      message,
      data,
      timestamp: Date.now(),
    };

    // Store in alerts list (keep last 100)
    await this.redisClient.lPush('oracle:alerts', JSON.stringify(alert));
    await this.redisClient.lTrim('oracle:alerts', 0, 99);

    // Store latest alert
    await this.redisClient.set('oracle:alert:latest', JSON.stringify(alert));
  }

  /**
   * Get current health status
   */
  async getCurrentHealth(): Promise<any> {
    const current = await this.redisClient.get('oracle:health:current');
    return current ? JSON.parse(current) : null;
  }

  /**
   * Get uptime statistics
   */
  async getUptimeStats(): Promise<Record<string, any>> {
    const sources = ['pyth', 'switchboard', 'birdeye'];
    const stats: Record<string, any> = {};

    for (const source of sources) {
      const key = `oracle:uptime:${source}`;
      const data = await this.redisClient.hGetAll(key);

      if (data.total_checks) {
        const totalChecks = parseInt(data.total_checks);
        const successfulChecks = parseInt(data.successful_checks || '0');
        const uptime = (successfulChecks / totalChecks) * 100;

        stats[source] = {
          totalChecks,
          successfulChecks,
          uptime: uptime.toFixed(2) + '%',
          latestLatency: data.latest_latency ? parseInt(data.latest_latency) : null,
        };
      }
    }

    return stats;
  }

  /**
   * Get recent alerts
   */
  async getRecentAlerts(count: number = 10): Promise<any[]> {
    const alerts = await this.redisClient.lRange('oracle:alerts', 0, count - 1);
    return alerts.map(alert => JSON.parse(alert));
  }

  /**
   * Cleanup and disconnect
   */
  async cleanup(): Promise<void> {
    this.stopMonitoring();
    await this.redisClient.quit();
    console.log('✅ Oracle health monitor cleaned up');
  }
}

// Singleton instance
let healthMonitor: OracleHealthMonitor | null = null;

/**
 * Get or create health monitor instance
 */
export function getOracleHealthMonitor(): OracleHealthMonitor {
  if (!healthMonitor) {
    healthMonitor = new OracleHealthMonitor();
  }
  return healthMonitor;
}

/**
 * Initialize and start health monitoring
 */
export async function initializeHealthMonitoring(intervalMs?: number): Promise<OracleHealthMonitor> {
  const monitor = getOracleHealthMonitor();
  await monitor.initialize();
  monitor.startMonitoring(intervalMs);
  return monitor;
}
