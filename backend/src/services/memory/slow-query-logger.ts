/**
 * Slow Query Logging Service
 * 
 * Logs queries exceeding 1 second with full context including:
 * - Query parameters and request details
 * - Stack traces for debugging
 * - Performance metrics and analysis
 * - Query optimization suggestions
 * 
 * Requirements: 13.6
 */

import { logger, LogContext } from './logger';
import { metricsService } from './metrics';
import { config } from '../../config';

export interface SlowQueryDetails {
  endpoint: string;
  method: string;
  duration: number;
  threshold: number;
  queryParams?: Record<string, any>;
  requestBody?: Record<string, any>;
  userAgent?: string;
  ip?: string;
  requestId?: string;
  stackTrace?: string;
  databaseQuery?: string;
  databaseTable?: string;
  cacheHit?: boolean;
  connectionPoolUsage?: number;
}

export interface QueryAnalysis {
  isSlowQuery: boolean;
  performanceIssues: string[];
  optimizationSuggestions: string[];
  severity: 'low' | 'medium' | 'high' | 'critical';
}

/**
 * Slow Query Logging Service
 * 
 * Provides comprehensive logging and analysis of slow queries.
 * Tracks performance patterns and provides optimization insights.
 */
export class SlowQueryLogger {
  private readonly slowQueryThreshold: number;
  private slowQueryHistory: SlowQueryDetails[] = [];
  private readonly MAX_HISTORY_SIZE = 1000;
  
  // Performance pattern tracking
  private endpointPerformance: Map<string, {
    totalQueries: number;
    slowQueries: number;
    averageDuration: number;
    maxDuration: number;
  }> = new Map();

  constructor() {
    this.slowQueryThreshold = config.memoryService.query.slowQueryThresholdMs;
    
    logger.info('Slow Query Logger initialized', {
      threshold: `${this.slowQueryThreshold}ms`,
      historySize: this.MAX_HISTORY_SIZE,
    });
  }

  /**
   * Log a slow query with comprehensive context
   */
  logSlowQuery(details: SlowQueryDetails): void {
    // Capture stack trace for debugging
    const stackTrace = new Error().stack;
    const enhancedDetails = {
      ...details,
      stackTrace,
      timestamp: Date.now(),
    };

    // Add to history
    this.slowQueryHistory.push(enhancedDetails);
    if (this.slowQueryHistory.length > this.MAX_HISTORY_SIZE) {
      this.slowQueryHistory = this.slowQueryHistory.slice(-this.MAX_HISTORY_SIZE);
    }

    // Update performance tracking
    this.updatePerformanceTracking(details);

    // Analyze query performance
    const analysis = this.analyzeQuery(details);

    // Log with full context
    const logContext: LogContext = {
      requestId: details.requestId,
      endpoint: details.endpoint,
      method: details.method,
      duration: details.duration,
      threshold: details.threshold,
      queryParams: details.queryParams,
      requestBody: details.requestBody,
      userAgent: details.userAgent,
      ip: details.ip,
      databaseQuery: details.databaseQuery,
      databaseTable: details.databaseTable,
      cacheHit: details.cacheHit,
      connectionPoolUsage: details.connectionPoolUsage,
      analysis: {
        severity: analysis.severity,
        performanceIssues: analysis.performanceIssues,
        optimizationSuggestions: analysis.optimizationSuggestions,
      },
      type: 'slow_query',
    };

    // Log based on severity
    if (analysis.severity === 'critical') {
      logger.critical(
        `CRITICAL slow query: ${details.method} ${details.endpoint} took ${details.duration}ms`,
        undefined,
        logContext
      );
    } else if (analysis.severity === 'high') {
      logger.error(
        `Slow query: ${details.method} ${details.endpoint} took ${details.duration}ms`,
        undefined,
        logContext
      );
    } else {
      logger.warn(
        `Slow query: ${details.method} ${details.endpoint} took ${details.duration}ms`,
        logContext
      );
    }

    // Update metrics
    metricsService.incrementCounter('memory_slow_queries_total', 1, {
      endpoint: details.endpoint,
      method: details.method,
      severity: analysis.severity,
    });

    metricsService.observeHistogram('memory_slow_query_duration_seconds', details.duration / 1000, {
      endpoint: details.endpoint,
      method: details.method,
    });
  }

  /**
   * Log slow database query
   */
  logSlowDatabaseQuery(
    query: string,
    table: string,
    duration: number,
    context?: LogContext
  ): void {
    const details: SlowQueryDetails = {
      endpoint: context?.endpoint || 'database',
      method: context?.method || 'QUERY',
      duration,
      threshold: this.slowQueryThreshold,
      databaseQuery: query,
      databaseTable: table,
      requestId: context?.requestId,
      userAgent: context?.userAgent,
      ip: context?.ip,
    };

    this.logSlowQuery(details);
  }

  /**
   * Analyze query performance and provide insights
   */
  private analyzeQuery(details: SlowQueryDetails): QueryAnalysis {
    const performanceIssues: string[] = [];
    const optimizationSuggestions: string[] = [];
    let severity: 'low' | 'medium' | 'high' | 'critical' = 'low';

    // Determine severity based on duration
    if (details.duration > 10000) { // > 10 seconds
      severity = 'critical';
      performanceIssues.push('Extremely slow query (>10s)');
    } else if (details.duration > 5000) { // > 5 seconds
      severity = 'high';
      performanceIssues.push('Very slow query (>5s)');
    } else if (details.duration > 2000) { // > 2 seconds
      severity = 'medium';
      performanceIssues.push('Slow query (>2s)');
    }

    // Analyze cache usage
    if (details.cacheHit === false) {
      performanceIssues.push('Cache miss - query hit database');
      optimizationSuggestions.push('Consider cache warming or longer TTL');
    }

    // Analyze connection pool usage
    if (details.connectionPoolUsage && details.connectionPoolUsage > 0.8) {
      performanceIssues.push('High connection pool usage');
      optimizationSuggestions.push('Consider connection pool optimization');
    }

    // Analyze query patterns
    const endpointStats = this.endpointPerformance.get(details.endpoint);
    if (endpointStats) {
      const slowQueryRate = endpointStats.slowQueries / endpointStats.totalQueries;
      if (slowQueryRate > 0.1) { // > 10% slow queries
        performanceIssues.push(`High slow query rate for endpoint (${(slowQueryRate * 100).toFixed(1)}%)`);
        optimizationSuggestions.push('Investigate endpoint-specific performance issues');
      }
    }

    // Database-specific analysis
    if (details.databaseQuery) {
      if (details.databaseQuery.toLowerCase().includes('select *')) {
        performanceIssues.push('Query uses SELECT *');
        optimizationSuggestions.push('Use specific column selection instead of SELECT *');
      }

      if (!details.databaseQuery.toLowerCase().includes('limit')) {
        performanceIssues.push('Query without LIMIT clause');
        optimizationSuggestions.push('Add LIMIT clause to prevent large result sets');
      }

      if (details.databaseQuery.toLowerCase().includes('order by') && 
          !details.databaseQuery.toLowerCase().includes('index')) {
        optimizationSuggestions.push('Consider adding index for ORDER BY clause');
      }
    }

    // Request size analysis
    if (details.requestBody && JSON.stringify(details.requestBody).length > 10000) {
      performanceIssues.push('Large request body');
      optimizationSuggestions.push('Consider request payload optimization');
    }

    // Query parameter analysis
    if (details.queryParams) {
      const paramCount = Object.keys(details.queryParams).length;
      if (paramCount > 20) {
        performanceIssues.push('Many query parameters');
        optimizationSuggestions.push('Consider request structure optimization');
      }
    }

    return {
      isSlowQuery: true,
      performanceIssues,
      optimizationSuggestions,
      severity,
    };
  }

  /**
   * Update performance tracking for endpoints
   */
  private updatePerformanceTracking(details: SlowQueryDetails): void {
    const key = `${details.method} ${details.endpoint}`;
    const stats = this.endpointPerformance.get(key) || {
      totalQueries: 0,
      slowQueries: 0,
      averageDuration: 0,
      maxDuration: 0,
    };

    stats.totalQueries++;
    stats.slowQueries++;
    stats.averageDuration = (stats.averageDuration * (stats.totalQueries - 1) + details.duration) / stats.totalQueries;
    stats.maxDuration = Math.max(stats.maxDuration, details.duration);

    this.endpointPerformance.set(key, stats);
  }

  /**
   * Get slow query statistics
   */
  getSlowQueryStats(): {
    totalSlowQueries: number;
    recentSlowQueries: number;
    slowestQuery: SlowQueryDetails | null;
    topSlowEndpoints: Array<{
      endpoint: string;
      slowQueries: number;
      slowQueryRate: number;
      averageDuration: number;
      maxDuration: number;
    }>;
  } {
    const now = Date.now();
    const oneHourAgo = now - (60 * 60 * 1000);
    
    const recentSlowQueries = this.slowQueryHistory.filter(
      query => (query as any).timestamp > oneHourAgo
    ).length;

    const slowestQuery = this.slowQueryHistory.reduce((slowest, current) => {
      return !slowest || current.duration > slowest.duration ? current : slowest;
    }, null as SlowQueryDetails | null);

    const topSlowEndpoints = Array.from(this.endpointPerformance.entries())
      .map(([endpoint, stats]) => ({
        endpoint,
        slowQueries: stats.slowQueries,
        slowQueryRate: stats.slowQueries / stats.totalQueries,
        averageDuration: stats.averageDuration,
        maxDuration: stats.maxDuration,
      }))
      .sort((a, b) => b.slowQueryRate - a.slowQueryRate)
      .slice(0, 10);

    return {
      totalSlowQueries: this.slowQueryHistory.length,
      recentSlowQueries,
      slowestQuery,
      topSlowEndpoints,
    };
  }

  /**
   * Get recent slow queries
   */
  getRecentSlowQueries(limit = 50): SlowQueryDetails[] {
    return this.slowQueryHistory
      .slice(-limit)
      .reverse(); // Most recent first
  }

  /**
   * Clear slow query history
   */
  clearHistory(): void {
    this.slowQueryHistory = [];
    this.endpointPerformance.clear();
    
    logger.info('Slow query history cleared');
  }

  /**
   * Check if a query duration is considered slow
   */
  isSlowQuery(duration: number): boolean {
    return duration > this.slowQueryThreshold;
  }

  /**
   * Get slow query threshold
   */
  getThreshold(): number {
    return this.slowQueryThreshold;
  }
}

// Export singleton instance
export const slowQueryLogger = new SlowQueryLogger();