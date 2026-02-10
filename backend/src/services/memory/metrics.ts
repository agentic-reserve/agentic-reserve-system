/**
 * Prometheus Metrics Service
 * 
 * Tracks and exposes metrics for monitoring:
 * - Query count and latency
 * - Cache hit rate
 * - Error rate
 * - WebSocket connection status
 * - Database connection pool usage
 * 
 * Requirements: 15.1, 15.2, 15.3, 15.4
 */

interface MetricValue {
  count: number;
  sum: number;
  min: number;
  max: number;
  lastUpdated: number;
}

interface Histogram {
  buckets: Map<number, number>; // bucket upper bound -> count
  sum: number;
  count: number;
}

export class MetricsService {
  private counters: Map<string, number> = new Map();
  private gauges: Map<string, number> = new Map();
  private histograms: Map<string, Histogram> = new Map();
  private summaries: Map<string, MetricValue> = new Map();

  /**
   * Increment a counter
   */
  incrementCounter(name: string, value: number = 1, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    const current = this.counters.get(key) || 0;
    this.counters.set(key, current + value);
  }

  /**
   * Set a gauge value
   */
  setGauge(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    this.gauges.set(key, value);
  }

  /**
   * Observe a value in a histogram
   */
  observeHistogram(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    let histogram = this.histograms.get(key);

    if (!histogram) {
      histogram = {
        buckets: new Map([
          [0.005, 0], // 5ms
          [0.01, 0],  // 10ms
          [0.025, 0], // 25ms
          [0.05, 0],  // 50ms
          [0.1, 0],   // 100ms
          [0.25, 0],  // 250ms
          [0.5, 0],   // 500ms
          [1, 0],     // 1s
          [2.5, 0],   // 2.5s
          [5, 0],     // 5s
          [10, 0],    // 10s
          [Infinity, 0],
        ]),
        sum: 0,
        count: 0,
      };
      this.histograms.set(key, histogram);
    }

    histogram.sum += value;
    histogram.count++;

    // Increment appropriate buckets
    for (const [bucket, count] of histogram.buckets.entries()) {
      if (value <= bucket) {
        histogram.buckets.set(bucket, count + 1);
      }
    }
  }

  /**
   * Observe a value in a summary
   */
  observeSummary(name: string, value: number, labels: Record<string, string> = {}): void {
    const key = this.buildKey(name, labels);
    let summary = this.summaries.get(key);

    if (!summary) {
      summary = {
        count: 0,
        sum: 0,
        min: value,
        max: value,
        lastUpdated: Date.now(),
      };
      this.summaries.set(key, summary);
    }

    summary.count++;
    summary.sum += value;
    summary.min = Math.min(summary.min, value);
    summary.max = Math.max(summary.max, value);
    summary.lastUpdated = Date.now();
  }

  /**
   * Record query metrics
   */
  recordQuery(endpoint: string, duration: number, success: boolean): void {
    this.incrementCounter('memory_queries_total', 1, { endpoint, status: success ? 'success' : 'error' });
    this.observeHistogram('memory_query_duration_seconds', duration / 1000, { endpoint });
    
    if (!success) {
      this.incrementCounter('memory_errors_total', 1, { endpoint });
    }
  }

  /**
   * Record cache hit/miss
   */
  recordCacheAccess(hit: boolean): void {
    this.incrementCounter('memory_cache_requests_total', 1, { result: hit ? 'hit' : 'miss' });
  }

  /**
   * Record WebSocket metrics
   */
  recordWebSocketMetrics(connected: boolean, messageRate: number, reconnections: number): void {
    this.setGauge('memory_websocket_connected', connected ? 1 : 0);
    this.setGauge('memory_websocket_message_rate', messageRate);
    this.setGauge('memory_websocket_reconnections_total', reconnections);
  }

  /**
   * Record database metrics
   */
  recordDatabaseMetrics(poolSize: number, activeConnections: number, queryDuration: number): void {
    this.setGauge('memory_db_pool_size', poolSize);
    this.setGauge('memory_db_active_connections', activeConnections);
    this.observeHistogram('memory_db_query_duration_seconds', queryDuration / 1000);
  }

  /**
   * Record event emitter metrics
   */
  recordEventMetrics(subscriptions: number, eventsEmitted: number, eventsDropped: number): void {
    this.setGauge('memory_event_subscriptions', subscriptions);
    this.incrementCounter('memory_events_emitted_total', eventsEmitted);
    this.incrementCounter('memory_events_dropped_total', eventsDropped);
  }

  /**
   * Export metrics in Prometheus format
   */
  exportPrometheus(): string {
    const lines: string[] = [];

    // Export counters
    for (const [key, value] of this.counters.entries()) {
      lines.push(`${key} ${value}`);
    }

    // Export gauges
    for (const [key, value] of this.gauges.entries()) {
      lines.push(`${key} ${value}`);
    }

    // Export histograms
    for (const [key, histogram] of this.histograms.entries()) {
      for (const [bucket, count] of histogram.buckets.entries()) {
        const bucketLabel = bucket === Infinity ? '+Inf' : bucket.toString();
        lines.push(`${key}_bucket{le="${bucketLabel}"} ${count}`);
      }
      lines.push(`${key}_sum ${histogram.sum}`);
      lines.push(`${key}_count ${histogram.count}`);
    }

    // Export summaries
    for (const [key, summary] of this.summaries.entries()) {
      lines.push(`${key}_sum ${summary.sum}`);
      lines.push(`${key}_count ${summary.count}`);
      lines.push(`${key}_min ${summary.min}`);
      lines.push(`${key}_max ${summary.max}`);
      if (summary.count > 0) {
        lines.push(`${key}_avg ${summary.sum / summary.count}`);
      }
    }

    return lines.join('\n');
  }

  /**
   * Export metrics as JSON
   */
  exportJSON(): any {
    return {
      counters: Object.fromEntries(this.counters),
      gauges: Object.fromEntries(this.gauges),
      histograms: Object.fromEntries(
        Array.from(this.histograms.entries()).map(([key, hist]) => [
          key,
          {
            buckets: Object.fromEntries(hist.buckets),
            sum: hist.sum,
            count: hist.count,
          },
        ])
      ),
      summaries: Object.fromEntries(this.summaries),
    };
  }

  /**
   * Calculate cache hit rate
   */
  getCacheHitRate(): number {
    const hits = this.counters.get('memory_cache_requests_total{result="hit"}') || 0;
    const misses = this.counters.get('memory_cache_requests_total{result="miss"}') || 0;
    const total = hits + misses;
    return total > 0 ? hits / total : 0;
  }

  /**
   * Calculate error rate
   */
  getErrorRate(): number {
    let totalQueries = 0;
    let totalErrors = 0;

    for (const [key, value] of this.counters.entries()) {
      if (key.startsWith('memory_queries_total')) {
        totalQueries += value;
        if (key.includes('status="error"')) {
          totalErrors += value;
        }
      }
    }

    return totalQueries > 0 ? totalErrors / totalQueries : 0;
  }

  /**
   * Build metric key with labels
   */
  private buildKey(name: string, labels: Record<string, string>): string {
    if (Object.keys(labels).length === 0) {
      return name;
    }

    const labelStr = Object.entries(labels)
      .map(([k, v]) => `${k}="${v}"`)
      .join(',');

    return `${name}{${labelStr}}`;
  }

  /**
   * Reset all metrics
   */
  reset(): void {
    this.counters.clear();
    this.gauges.clear();
    this.histograms.clear();
    this.summaries.clear();
  }
}

// Export singleton instance
export const metricsService = new MetricsService();
