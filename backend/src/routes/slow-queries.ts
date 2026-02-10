import { Router, Request, Response } from 'express';
import { slowQueryLogger } from '../services/memory/slow-query-logger';
import { logger } from '../services/memory/logger';

const router = Router();

/**
 * GET /api/v1/slow-queries/stats
 * Get slow query statistics
 */
router.get('/stats', (req: Request, res: Response) => {
  try {
    const stats = slowQueryLogger.getSlowQueryStats();
    
    logger.info('Slow query stats requested', {
      requestId: req.requestId,
      totalSlowQueries: stats.totalSlowQueries,
      recentSlowQueries: stats.recentSlowQueries,
    });

    res.json({
      ...stats,
      threshold: slowQueryLogger.getThreshold(),
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to get slow query stats', error, {
      requestId: req.requestId,
    });
    
    res.status(500).json({
      error: 'Failed to get slow query statistics',
      requestId: req.requestId,
    });
  }
});

/**
 * GET /api/v1/slow-queries/recent
 * Get recent slow queries
 */
router.get('/recent', (req: Request, res: Response) => {
  try {
    const limit = parseInt(req.query.limit as string) || 50;
    const recentQueries = slowQueryLogger.getRecentSlowQueries(limit);
    
    logger.info('Recent slow queries requested', {
      requestId: req.requestId,
      limit,
      resultCount: recentQueries.length,
    });

    res.json({
      queries: recentQueries,
      limit,
      count: recentQueries.length,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to get recent slow queries', error, {
      requestId: req.requestId,
    });
    
    res.status(500).json({
      error: 'Failed to get recent slow queries',
      requestId: req.requestId,
    });
  }
});

/**
 * DELETE /api/v1/slow-queries/history
 * Clear slow query history
 */
router.delete('/history', (req: Request, res: Response) => {
  try {
    slowQueryLogger.clearHistory();
    
    logger.info('Slow query history cleared', {
      requestId: req.requestId,
    });

    res.json({
      message: 'Slow query history cleared',
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    logger.error('Failed to clear slow query history', error, {
      requestId: req.requestId,
    });
    
    res.status(500).json({
      error: 'Failed to clear slow query history',
      requestId: req.requestId,
    });
  }
});

export default router;