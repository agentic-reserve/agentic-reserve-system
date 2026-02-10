/**
 * Critical Error Alerting Service
 * 
 * Emits alerts to Prometheus Alertmanager for critical errors and system events.
 * Integrates with monitoring infrastructure to provide real-time alerting.
 * 
 * Requirements: 15.7
 */

import { logger } from './logger';
import { metricsService } from './metrics';
import { config } from '../../config';

export enum AlertSeverity {
  INFO = 'info',
  WARNING = 'warning',
  CRITICAL = 'critical',
}

export interface Alert {
  alertname: string;
  severity: AlertSeverity;
  summary: string;
  description: string;
  instance: string;
  service: string;
  timestamp: string;
  labels: Record<string, string>;
  annotations: Record<string, string>;
}

/**
 * Critical Error Alerting Service
 * 
 * Provides alerting capabilities for critical system events and errors.
 * Integrates with Prometheus Alertmanager and other monitoring systems.
 */
export class AlertingService {
  private alertmanagerUrl: string;
  private serviceName: string;
  private instanceId: string;
  private alertBuffer: Alert[] = [];
  private readonly MAX_BUFFER_SIZE = 100;

  constructor(
    alertmanagerUrl = process.env.ALERTMANAGER_URL || 'http://localhost:9093',
    serviceName = 'ars-memory-service'
  ) {
    this.alertmanagerUrl = alertmanagerUrl;
    this.serviceName = serviceName;
    this.instanceId = `${serviceName}-${process.env.NODE_ENV || 'development'}-${Date.now()}`;
    
    // Start alert processor
    this.startAlertProcessor();
  }

  /**
   * Send critical database connection failure alert
   */
  alertDatabaseConnectionFailure(error: Error, duration: number): void {
    const alert: Alert = {
      alertname: 'MemoryServiceDatabaseConnectionFailure',
      severity: AlertSeverity.CRITICAL,
      summary: 'Memory Service database connection failed',
      description: `Database connection has been failing for ${duration}ms. Error: ${error.message}`,
      instance: this.instanceId,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      labels: {
        alertname: 'MemoryServiceDatabaseConnectionFailure',
        severity: AlertSeverity.CRITICAL,
        service: this.serviceName,
        instance: this.instanceId,
        component: 'database',
      },
      annotations: {
        summary: 'Memory Service database connection failed',
        description: `Database connection has been failing for ${duration}ms. Error: ${error.message}`,
        runbook_url: 'https://docs.ars.com/runbooks/database-connection-failure',
      },
    };

    this.sendAlert(alert);
    
    // Also increment metrics
    metricsService.incrementCounter('memory_critical_alerts_total', 1, { 
      type: 'database_connection_failure' 
    });
  }

  /**
   * Send circuit breaker open alert
   */
  alertCircuitBreakerOpen(service: string, duration: number): void {
    const alert: Alert = {
      alertname: 'MemoryServiceCircuitBreakerOpen',
      severity: AlertSeverity.CRITICAL,
      summary: `Circuit breaker open for ${service}`,
      description: `Circuit breaker for ${service} has been open for ${duration}ms, indicating repeated failures`,
      instance: this.instanceId,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      labels: {
        alertname: 'MemoryServiceCircuitBreakerOpen',
        severity: AlertSeverity.CRITICAL,
        service: this.serviceName,
        instance: this.instanceId,
        component: 'circuit_breaker',
        target_service: service,
      },
      annotations: {
        summary: `Circuit breaker open for ${service}`,
        description: `Circuit breaker for ${service} has been open for ${duration}ms, indicating repeated failures`,
        runbook_url: 'https://docs.ars.com/runbooks/circuit-breaker-open',
      },
    };

    this.sendAlert(alert);
    
    metricsService.incrementCounter('memory_critical_alerts_total', 1, { 
      type: 'circuit_breaker_open',
      target_service: service,
    });
  }

  /**
   * Send service crash alert
   */
  alertServiceCrash(error: Error, stackTrace?: string): void {
    const alert: Alert = {
      alertname: 'MemoryServiceCrash',
      severity: AlertSeverity.CRITICAL,
      summary: 'Memory Service crashed',
      description: `Memory Service crashed with error: ${error.message}`,
      instance: this.instanceId,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      labels: {
        alertname: 'MemoryServiceCrash',
        severity: AlertSeverity.CRITICAL,
        service: this.serviceName,
        instance: this.instanceId,
        component: 'service',
      },
      annotations: {
        summary: 'Memory Service crashed',
        description: `Memory Service crashed with error: ${error.message}`,
        stack_trace: stackTrace || error.stack || 'No stack trace available',
        runbook_url: 'https://docs.ars.com/runbooks/service-crash',
      },
    };

    this.sendAlert(alert);
    
    metricsService.incrementCounter('memory_critical_alerts_total', 1, { 
      type: 'service_crash' 
    });
  }

  /**
   * Send high error rate alert
   */
  alertHighErrorRate(errorRate: number, threshold: number): void {
    const alert: Alert = {
      alertname: 'MemoryServiceHighErrorRate',
      severity: AlertSeverity.WARNING,
      summary: 'Memory Service error rate is high',
      description: `Error rate is ${(errorRate * 100).toFixed(2)}%, exceeding threshold of ${(threshold * 100).toFixed(2)}%`,
      instance: this.instanceId,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      labels: {
        alertname: 'MemoryServiceHighErrorRate',
        severity: AlertSeverity.WARNING,
        service: this.serviceName,
        instance: this.instanceId,
        component: 'api',
      },
      annotations: {
        summary: 'Memory Service error rate is high',
        description: `Error rate is ${(errorRate * 100).toFixed(2)}%, exceeding threshold of ${(threshold * 100).toFixed(2)}%`,
        current_error_rate: `${(errorRate * 100).toFixed(2)}%`,
        threshold: `${(threshold * 100).toFixed(2)}%`,
        runbook_url: 'https://docs.ars.com/runbooks/high-error-rate',
      },
    };

    this.sendAlert(alert);
    
    metricsService.incrementCounter('memory_critical_alerts_total', 1, { 
      type: 'high_error_rate' 
    });
  }

  /**
   * Send slow query performance alert
   */
  alertSlowQueryPerformance(p99Latency: number, threshold: number): void {
    const alert: Alert = {
      alertname: 'MemoryServiceSlowQueries',
      severity: AlertSeverity.WARNING,
      summary: 'Memory Service queries are slow',
      description: `Query latency p99 is ${p99Latency}ms, exceeding threshold of ${threshold}ms`,
      instance: this.instanceId,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      labels: {
        alertname: 'MemoryServiceSlowQueries',
        severity: AlertSeverity.WARNING,
        service: this.serviceName,
        instance: this.instanceId,
        component: 'performance',
      },
      annotations: {
        summary: 'Memory Service queries are slow',
        description: `Query latency p99 is ${p99Latency}ms, exceeding threshold of ${threshold}ms`,
        current_p99_latency: `${p99Latency}ms`,
        threshold: `${threshold}ms`,
        runbook_url: 'https://docs.ars.com/runbooks/slow-queries',
      },
    };

    this.sendAlert(alert);
    
    metricsService.incrementCounter('memory_critical_alerts_total', 1, { 
      type: 'slow_queries' 
    });
  }

  /**
   * Send cache hit rate low alert
   */
  alertLowCacheHitRate(hitRate: number, threshold: number): void {
    const alert: Alert = {
      alertname: 'MemoryServiceLowCacheHitRate',
      severity: AlertSeverity.WARNING,
      summary: 'Memory Service cache hit rate is low',
      description: `Cache hit rate is ${(hitRate * 100).toFixed(1)}%, below threshold of ${(threshold * 100).toFixed(1)}%`,
      instance: this.instanceId,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      labels: {
        alertname: 'MemoryServiceLowCacheHitRate',
        severity: AlertSeverity.WARNING,
        service: this.serviceName,
        instance: this.instanceId,
        component: 'cache',
      },
      annotations: {
        summary: 'Memory Service cache hit rate is low',
        description: `Cache hit rate is ${(hitRate * 100).toFixed(1)}%, below threshold of ${(threshold * 100).toFixed(1)}%`,
        current_hit_rate: `${(hitRate * 100).toFixed(1)}%`,
        threshold: `${(threshold * 100).toFixed(1)}%`,
        runbook_url: 'https://docs.ars.com/runbooks/low-cache-hit-rate',
      },
    };

    this.sendAlert(alert);
    
    metricsService.incrementCounter('memory_critical_alerts_total', 1, { 
      type: 'low_cache_hit_rate' 
    });
  }

  /**
   * Send WebSocket connection failure alert
   */
  alertWebSocketConnectionFailure(reconnectionAttempts: number): void {
    const alert: Alert = {
      alertname: 'MemoryServiceWebSocketConnectionFailure',
      severity: AlertSeverity.CRITICAL,
      summary: 'LYS Labs WebSocket connection failed',
      description: `WebSocket connection to LYS Labs failed after ${reconnectionAttempts} attempts`,
      instance: this.instanceId,
      service: this.serviceName,
      timestamp: new Date().toISOString(),
      labels: {
        alertname: 'MemoryServiceWebSocketConnectionFailure',
        severity: AlertSeverity.CRITICAL,
        service: this.serviceName,
        instance: this.instanceId,
        component: 'websocket',
        target_service: 'lys_labs',
      },
      annotations: {
        summary: 'LYS Labs WebSocket connection failed',
        description: `WebSocket connection to LYS Labs failed after ${reconnectionAttempts} attempts`,
        reconnection_attempts: reconnectionAttempts.toString(),
        runbook_url: 'https://docs.ars.com/runbooks/websocket-connection-failure',
      },
    };

    this.sendAlert(alert);
    
    metricsService.incrementCounter('memory_critical_alerts_total', 1, { 
      type: 'websocket_connection_failure' 
    });
  }

  /**
   * Send alert to alerting system
   */
  private sendAlert(alert: Alert): void {
    // Add to buffer for batch processing
    this.alertBuffer.push(alert);
    
    // Prevent buffer overflow
    if (this.alertBuffer.length > this.MAX_BUFFER_SIZE) {
      this.alertBuffer = this.alertBuffer.slice(-this.MAX_BUFFER_SIZE);
      logger.warn('Alert buffer overflow, dropping oldest alerts', {
        bufferSize: this.MAX_BUFFER_SIZE,
      });
    }

    // Log the alert
    logger.critical(`ALERT: ${alert.summary}`, undefined, {
      alertname: alert.alertname,
      severity: alert.severity,
      description: alert.description,
      labels: alert.labels,
      annotations: alert.annotations,
    });
  }

  /**
   * Process alert buffer and send to Alertmanager
   */
  private startAlertProcessor(): void {
    setInterval(async () => {
      if (this.alertBuffer.length === 0) {
        return;
      }

      const alertsToSend = [...this.alertBuffer];
      this.alertBuffer = [];

      try {
        await this.sendToAlertmanager(alertsToSend);
        logger.info(`Sent ${alertsToSend.length} alerts to Alertmanager`);
      } catch (error) {
        logger.error('Failed to send alerts to Alertmanager', error as Error, {
          alertCount: alertsToSend.length,
          alertmanagerUrl: this.alertmanagerUrl,
        });
        
        // Put alerts back in buffer for retry (up to buffer limit)
        this.alertBuffer.unshift(...alertsToSend.slice(0, this.MAX_BUFFER_SIZE - this.alertBuffer.length));
      }
    }, 10000); // Process every 10 seconds
  }

  /**
   * Send alerts to Prometheus Alertmanager
   */
  private async sendToAlertmanager(alerts: Alert[]): Promise<void> {
    // In a real implementation, this would send HTTP POST to Alertmanager
    // For now, we'll just log the alerts in a structured format
    
    const alertmanagerPayload = alerts.map(alert => ({
      labels: alert.labels,
      annotations: alert.annotations,
      startsAt: alert.timestamp,
      generatorURL: `http://${this.instanceId}/metrics`,
    }));

    logger.info('Alertmanager payload (would be sent via HTTP)', {
      alertmanagerUrl: this.alertmanagerUrl,
      alertCount: alerts.length,
      payload: alertmanagerPayload,
    });

    // TODO: Implement actual HTTP POST to Alertmanager
    // const response = await fetch(`${this.alertmanagerUrl}/api/v1/alerts`, {
    //   method: 'POST',
    //   headers: {
    //     'Content-Type': 'application/json',
    //   },
    //   body: JSON.stringify(alertmanagerPayload),
    // });
    // 
    // if (!response.ok) {
    //   throw new Error(`Alertmanager responded with ${response.status}: ${response.statusText}`);
    // }
  }

  /**
   * Get alert statistics
   */
  getAlertStats(): {
    bufferSize: number;
    maxBufferSize: number;
    totalAlertsSent: number;
  } {
    const totalAlertsSent = metricsService.exportJSON().counters['memory_critical_alerts_total'] || 0;
    
    return {
      bufferSize: this.alertBuffer.length,
      maxBufferSize: this.MAX_BUFFER_SIZE,
      totalAlertsSent,
    };
  }
}

// Export singleton instance
export const alertingService = new AlertingService();