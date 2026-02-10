/**
 * Monitoring Service
 * 
 * Integrates metrics, logging, and alerting to provide comprehensive monitoring.
 * Monitors system health and triggers alerts when thresholds are exceeded.
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4, 15.5, 15.7
 */

import { logger } from './logger';
import { metricsService } from './metrics';
import { alertingService } from './alerting';
import { config } from '../../config';

interface MonitoringThresholds {
  errorRateThreshold: number;
  cacheHitRateThreshold: number;
  queryLatencyThreshold: number;
  databaseConnectionFailureThreshold: number;
  circuitBreakerOpenThreshold: number;
}

/**
 * Monitoring Service
 * 
 * Provides centralized monitoring, health checking, and alerting.
 * Monitors key metrics and triggers alerts when thresholds are exceeded.
 */
export class MonitoringService {
  private thresholds: MonitoringThresholds;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private readonly MONITORING_INTERVAL_MS = 60000; // 1 minute
  
  // Track failure durations for alerting
  private databaseFailureStart: number | null = null;
  private circuitBreakerOpenStart: Map<string, number> = new Map();

  constructor() {
    this.thresholds = {
      errorRateThreshold: parseFloat(process.env.ERROR_RATE_THRESHOLD || '0.1'), // 10%
      cacheHitRateThreshold: parseFloat(process.env.CACHE_HIT_RATE_THRESHOLD || '0.8'), // 80%
      queryLatencyThreshold: parseInt(process.env.QUERY_LATENCY_THRESHOLD || '1000', 10), // 1 second
      databaseConnectionFailureThreshold: parseInt(process.env.DB_FAILURE_THRESHOLD || '60000', 10), // 1 minute
      circuitBreakerOpenThreshold: parseInt(process.env.CIRCUIT_BREAKER_THRESHOLD || '300000', 10), // 5 minutes
    };

    this.startMonitoring();
    
    logger.info('Monitoring service initialized', {
      thresholds: this.thresholds,
      monitoringInterval: this.MONITORING_INTERVAL_MS,
    });
  }

  /**
   * Start monitoring loop
   */
  private startMonitoring(): void {
    this.monitoringInterval = setInterval(() => {
      this.performHealthChecks();
    }, this.MONITORING_INTERVAL_MS);

    logger.info('Monitoring loop started', {
      intervalMs: this.MONITORING_INTERVAL_MS,
    });
  }

  /**
   * Stop monitoring loop
   */
  public stopMonitoring(): void {
    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
      logger.info('Monitoring loop stopped');
    }
  }

  /**
   * Perform comprehensive health checks
   */
  private performHealthChecks(): void {
    try {
      this.checkErrorRate();
      this.checkCacheHitRate();
      this.checkQueryLatency();
      this.checkDatabaseHealth();
      this.checkCircuitBreakers();
      
      logger.debug('Health checks completed', {
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      logger.error('Error during health checks', error as Error);
    }
  }

  /**
   * Check error rate and alert if threshold exceeded
   */
  private checkErrorRate(): void {
    const errorRate = metricsService.getErrorRate();
    
    if (errorRate > this.thresholds.errorRateThreshold) {
      alertingService.alertHighErrorRate(errorRate, this.thresholds.errorRateThreshold);
      
      logger.warn('High error rate detected', {
        currentErrorRate: `${(errorRate * 100).toFixed(2)}%`,
        threshold: `${(this.thresholds.errorRateThreshold * 100).toFixed(2)}%`,
      });
    }
  }

  /**
   * Check cache hit rate and alert if below threshold
   */
  private checkCacheHitRate(): void {
    const hitRate = metricsService.getCacheHitRate();
    
    if (hitRate < this.thresholds.cacheHitRateThreshold) {
      alertingService.alertLowCacheHitRate(hitRate, this.thresholds.cacheHitRateThreshold);
      
      logger.warn('Low cache hit rate detected', {
        currentHitRate: `${(hitRate * 100).toFixed(1)}%`,
        threshold: `${(this.thresholds.cacheHitRateThreshold * 100).toFixed(1)}%`,
      });
    }
  }

  /**
   * Check query latency and alert if threshold exceeded
   */
  private checkQueryLatency(): void {
    // This would need to be implemented in the metrics service
    // For now, we'll use a placeholder
    const metrics = metricsService.exportJSON();
    
    // Look for query duration histogram
    const queryHistogram = metrics.histograms['memory_query_duration_seconds'];
    if (queryHistogram) {
      // Calculate p99 latency (simplified - would need proper percentile calculation)
      const p99Latency = this.calculateP99Latency(queryHistogram);
      
      if (p99Latency > this.thresholds.queryLatencyThreshold) {
        alertingService.alertSlowQueryPerformance(p99Latency, this.thresholds.queryLatencyThreshold);
        
        logger.warn('Slow query performance detected', {
          p99Latency: `${p99Latency}ms`,
          threshold: `${this.thresholds.queryLatencyThreshold}ms`,
        });
      }
    }
  }

  /**
   * Check database health
   */
  private checkDatabaseHealth(): void {
    const metrics = metricsService.exportJSON();
    const dbErrors = metrics.counters['memory_db_errors_total'] || 0;
    
    // If we have recent database errors, track failure duration
    if (dbErrors > 0) {
      if (!this.databaseFailureStart) {
        this.databaseFailureStart = Date.now();
      }
      
      const failureDuration = Date.now() - this.databaseFailureStart;
      
      if (failureDuration > this.thresholds.databaseConnectionFailureThreshold) {
        alertingService.alertDatabaseConnectionFailure(
          new Error('Database connection failures detected'),
          failureDuration
        );
        
        logger.error('Database connection failure threshold exceeded', {
          failureDuration: `${failureDuration}ms`,
          threshold: `${this.thresholds.databaseConnectionFailureThreshold}ms`,
          errorCount: dbErrors,
        });
      }
    } else {
      // Reset failure tracking if no recent errors
      this.databaseFailureStart = null;
    }
  }

  /**
   * Check circuit breaker status
   */
  private checkCircuitBreakers(): void {
    // This would need to be integrated with actual circuit breaker implementations
    // For now, we'll use a placeholder that checks for circuit breaker metrics
    
    const metrics = metricsService.exportJSON();
    const circuitBreakerGauges = Object.keys(metrics.gauges).filter(key => 
      key.includes('circuit_breaker') && key.includes('open')
    );
    
    for (const gauge of circuitBreakerGauges) {
      const isOpen = metrics.gauges[gauge] === 1;
      const serviceName = this.extractServiceNameFromGauge(gauge);
      
      if (isOpen) {
        if (!this.circuitBreakerOpenStart.has(serviceName)) {
          this.circuitBreakerOpenStart.set(serviceName, Date.now());
        }
        
        const openDuration = Date.now() - this.circuitBreakerOpenStart.get(serviceName)!;
        
        if (openDuration > this.thresholds.circuitBreakerOpenThreshold) {
          alertingService.alertCircuitBreakerOpen(serviceName, openDuration);
          
          logger.error('Circuit breaker open threshold exceeded', {
            service: serviceName,
            openDuration: `${openDuration}ms`,
            threshold: `${this.thresholds.circuitBreakerOpenThreshold}ms`,
          });
        }
      } else {
        // Reset tracking if circuit breaker is closed
        this.circuitBreakerOpenStart.delete(serviceName);
      }
    }
  }

  /**
   * Calculate P99 latency from histogram (simplified implementation)
   */
  private calculateP99Latency(histogram: any): number {
    // This is a simplified implementation
    // In a real system, you'd use proper percentile calculation
    
    if (!histogram.buckets || histogram.count === 0) {
      return 0;
    }
    
    const buckets = Object.entries(histogram.buckets)
      .map(([bucket, count]) => ({ bucket: parseFloat(bucket), count: count as number }))
      .sort((a, b) => a.bucket - b.bucket);
    
    const p99Count = histogram.count * 0.99;
    let cumulativeCount = 0;
    
    for (const { bucket, count } of buckets) {
      cumulativeCount += count;
      if (cumulativeCount >= p99Count) {
        return bucket * 1000; // Convert to milliseconds
      }
    }
    
    return 0;
  }

  /**
   * Extract service name from circuit breaker gauge name
   */
  private extractServiceNameFromGauge(gaugeName: string): string {
    // Extract service name from gauge like "memory_circuit_breaker_lys_labs_open"
    const parts = gaugeName.split('_');
    const serviceIndex = parts.indexOf('breaker') + 1;
    const openIndex = parts.indexOf('open');
    
    if (serviceIndex > 0 && openIndex > serviceIndex) {
      return parts.slice(serviceIndex, openIndex).join('_');
    }
    
    return 'unknown';
  }

  /**
   * Get monitoring status
   */
  public getMonitoringStatus(): {
    isRunning: boolean;
    thresholds: MonitoringThresholds;
    lastCheckTime: string;
    alertStats: any;
  } {
    return {
      isRunning: this.monitoringInterval !== null,
      thresholds: this.thresholds,
      lastCheckTime: new Date().toISOString(),
      alertStats: alertingService.getAlertStats(),
    };
  }

  /**
   * Update monitoring thresholds
   */
  public updateThresholds(newThresholds: Partial<MonitoringThresholds>): void {
    this.thresholds = { ...this.thresholds, ...newThresholds };
    
    logger.info('Monitoring thresholds updated', {
      newThresholds: this.thresholds,
    });
  }

  /**
   * Trigger manual health check
   */
  public triggerHealthCheck(): void {
    logger.info('Manual health check triggered');
    this.performHealthChecks();
  }
}

// Export singleton instance
export const monitoringService = new MonitoringService();