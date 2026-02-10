import { Request, Response, NextFunction } from 'express';
import { metricsService } from '../services/memory/metrics';
import { logger } from '../services/memory/logger';
import { slowQueryLogger } from '../services/memory/slow-query-logger';

/**
 * Middleware to track request metrics
 * 
 * Tracks:
 * - Request count by endpoint and status
 * - Request duration
 * - Error rate
 * 
 * Requirements: 15.2, 15.3
 */
export function metricsMiddleware(req: Request, res: Response, next: NextFunction): void {
  const startTime = Date.now();
  const endpoint = req.path;

  // Track response
  res.on('finish', () => {
    const duration = Date.now() - startTime;
    const success = res.statusCode < 400;

    metricsService.recordQuery(endpoint, duration, success);

    // Log slow queries (> 1 second)
    if (duration > 1000) {
      slowQueryLogger.logSlowQuery({
        endpoint,
        method: req.method,
        duration,
        threshold: 1000,
        queryParams: Object.keys(req.query).length > 0 ? req.query : undefined,
        requestBody: req.method !== 'GET' && req.body ? req.body : undefined,
        userAgent: req.get('User-Agent'),
        ip: req.ip,
        requestId: req.requestId,
      });
      
      metricsService.incrementCounter('memory_slow_queries_total', 1, { endpoint });
    }
  });

  next();
}
