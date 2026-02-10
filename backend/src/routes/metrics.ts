import { Router, Request, Response } from 'express';
import { metricsService } from '../services/memory/metrics';
import { circuitBreakers } from '../services/memory/circuit-breaker';
import { memoryEventEmitter } from '../services/memory/event-emitter';

const router = Router();

/**
 * GET /metrics
 * Prometheus metrics endpoint
 * 
 * Returns metrics in Prometheus text format
 * Requirement 15.1
 */
router.get('/', (req: Request, res: Response) => {
  try {
    const prometheusFormat = metricsService.exportPrometheus();
    res.set('Content-Type', 'text/plain; version=0.0.4');
    res.send(prometheusFormat);
  } catch (error: any) {
    console.error('[Metrics] Failed to export Prometheus metrics:', error);
    res.status(500).send('# Error exporting metrics\n');
  }
});

/**
 * GET /metrics/json
 * JSON metrics endpoint (for debugging)
 */
router.get('/json', (req: Request, res: Response) => {
  try {
    const metrics = metricsService.exportJSON();
    
    // Add additional runtime metrics
    const runtimeMetrics = {
      ...metrics,
      runtime: {
        cacheHitRate: metricsService.getCacheHitRate(),
        errorRate: metricsService.getErrorRate(),
        eventSubscriptions: memoryEventEmitter.getSubscriptionCount(),
        circuitBreakers: {
          lysLabs: circuitBreakers.lysLabs.getStats(),
          supabase: circuitBreakers.supabase.getStats(),
          redis: circuitBreakers.redis.getStats(),
          oracleAggregator: circuitBreakers.oracleAggregator.getStats(),
        },
      },
    };

    res.json(runtimeMetrics);
  } catch (error: any) {
    console.error('[Metrics] Failed to export JSON metrics:', error);
    res.status(500).json({ error: 'Failed to export metrics' });
  }
});

export default router;
