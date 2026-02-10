import { Router, Request, Response } from 'express';
import { supabase } from '../services/supabase';
import { redisClient } from '../services/redis';
import { memoryEventEmitter } from '../services/memory/event-emitter';
import { getCapacityUtilization } from '../middleware/capacity-check';
import { logger } from '../services/memory/logger';
import { metricsService } from '../services/memory/metrics';
import { sakService } from '../services/sak';
import { config } from '../config';

const router = Router();

/**
 * GET /api/v1/health
 * Comprehensive health check endpoint
 * 
 * Returns:
 * - Service status
 * - Dependency health (Supabase, Redis)
 * - Query load metrics
 * - Connection pool status
 * - Event emitter status
 * 
 * Requirement 15.6, 13.7
 */
router.get('/', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  const healthStatus: any = {
    status: 'ok',
    timestamp: new Date().toISOString(),
    service: 'ars-memory-service',
    version: '1.0.0',
    dependencies: {},
    metrics: {},
  };

  logger.info('Health check requested', { 
    requestId: req.requestId,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  // Check Supabase connection
  try {
    const { error } = await supabase.from('wallet_registrations').select('address').limit(1);
    healthStatus.dependencies.supabase = {
      status: error ? 'unhealthy' : 'healthy',
      error: error?.message,
      connectionPool: {
        max: 100, // From config
        active: 'unknown', // Would need connection pool monitoring
      },
    };
    
    if (error) {
      logger.warn('Supabase health check failed', { error: error.message, requestId: req.requestId });
    }
  } catch (error: any) {
    healthStatus.dependencies.supabase = {
      status: 'unhealthy',
      error: error.message,
    };
    healthStatus.status = 'degraded';
    logger.error('Supabase health check error', error, { requestId: req.requestId });
  }

  // Check Redis connection
  try {
    if (redisClient) {
      await redisClient.ping();
      healthStatus.dependencies.redis = {
        status: 'healthy',
        connectionPool: {
          max: 50, // From config
          active: 'unknown', // Would need connection pool monitoring
        },
      };
    } else {
      healthStatus.dependencies.redis = {
        status: 'unhealthy',
        error: 'Redis client not initialized',
      };
      healthStatus.status = 'degraded';
    }
  } catch (error: any) {
    healthStatus.dependencies.redis = {
      status: 'unhealthy',
      error: error.message,
    };
    healthStatus.status = 'degraded';
    logger.error('Redis health check error', error, { requestId: req.requestId });
  }

  // LYS Labs WebSocket status (would need to inject the client)
  healthStatus.dependencies.lysLabs = {
    status: 'unknown', // Would need LYS Labs client injection
    message: 'WebSocket status monitoring not implemented',
  };

  // SAK integration status
  if (config.sak.enabled) {
    try {
      const sakStatus = sakService.getStatus();
      const sakHealth = sakService.getHealthStatus();
      
      healthStatus.dependencies.sak = {
        status: sakStatus.healthy ? 'healthy' : (sakStatus.initialized ? 'degraded' : 'unhealthy'),
        enabled: sakStatus.enabled,
        initialized: sakStatus.initialized,
        pluginCount: sakStatus.pluginCount,
        agentCount: sakStatus.agentCount,
        overall: sakHealth?.overall || 'unknown',
        plugins: sakHealth?.plugins ? Object.keys(sakHealth.plugins).length : 0,
        networkConnection: sakHealth?.network?.connection || 'unknown',
      };
      
      if (!sakStatus.healthy) {
        healthStatus.status = 'degraded';
      }
    } catch (error: any) {
      healthStatus.dependencies.sak = {
        status: 'unhealthy',
        error: error.message,
        enabled: config.sak.enabled,
      };
      healthStatus.status = 'degraded';
      logger.error('SAK health check error', error, { requestId: req.requestId });
    }
  } else {
    healthStatus.dependencies.sak = {
      status: 'disabled',
      enabled: false,
      message: 'SAK integration is disabled',
    };
  }

  // Event emitter metrics
  healthStatus.metrics.eventEmitter = {
    subscriptionCount: memoryEventEmitter.getSubscriptionCount(),
  };

  // Capacity metrics
  const capacity = getCapacityUtilization();
  healthStatus.metrics.capacity = {
    concurrentRequests: capacity.concurrentRequests,
    maxConcurrentRequests: capacity.maxConcurrentRequests,
    requestUtilization: `${(capacity.requestUtilization * 100).toFixed(1)}%`,
    supabasePoolUtilization: `${(capacity.supabasePoolUtilization * 100).toFixed(1)}%`,
    redisPoolUtilization: `${(capacity.redisPoolUtilization * 100).toFixed(1)}%`,
    atCapacity: capacity.atCapacity,
  };

  // Performance metrics
  healthStatus.metrics.performance = {
    cacheHitRate: `${(metricsService.getCacheHitRate() * 100).toFixed(1)}%`,
    errorRate: `${(metricsService.getErrorRate() * 100).toFixed(2)}%`,
  };

  // Overall status
  const allHealthy = Object.values(healthStatus.dependencies).every(
    (dep: any) => dep.status === 'healthy'
  );

  if (!allHealthy || capacity.atCapacity) {
    healthStatus.status = 'degraded';
    res.status(503);
  }

  const duration = Date.now() - startTime;
  logger.info('Health check completed', { 
    requestId: req.requestId,
    duration,
    status: healthStatus.status,
    dependencyCount: Object.keys(healthStatus.dependencies).length,
  });

  res.json(healthStatus);
});

/**
 * GET /api/v1/health/sak
 * Detailed SAK integration health check
 * 
 * Returns:
 * - SAK service status
 * - Plugin statuses
 * - Agent instances
 * - Performance metrics
 * - Error rates
 */
router.get('/sak', async (req: Request, res: Response) => {
  const startTime = Date.now();
  
  logger.info('SAK health check requested', { 
    requestId: req.requestId,
    userAgent: req.get('User-Agent'),
    ip: req.ip,
  });

  if (!config.sak.enabled) {
    return res.json({
      status: 'disabled',
      enabled: false,
      message: 'SAK integration is disabled',
      timestamp: new Date().toISOString(),
    });
  }

  try {
    const sakStatus = sakService.getStatus();
    const sakHealth = sakService.getHealthStatus();
    const sakMetrics = sakService.getMetrics();
    const sakConfig = sakService.getConfig();

    const response = {
      status: sakStatus.healthy ? 'healthy' : (sakStatus.initialized ? 'degraded' : 'unhealthy'),
      timestamp: new Date().toISOString(),
      service: {
        enabled: sakStatus.enabled,
        initialized: sakStatus.initialized,
        healthy: sakStatus.healthy,
      },
      plugins: {
        count: sakStatus.pluginCount,
        statuses: sakHealth?.plugins || {},
      },
      agents: {
        count: sakStatus.agentCount,
      },
      network: sakHealth?.network || {},
      metrics: sakMetrics || {},
      configuration: {
        network: sakConfig?.core.network,
        commitment: sakConfig?.core.commitment,
        fallbackEnabled: sakConfig?.integration.fallbackEnabled,
        retryAttempts: sakConfig?.integration.retryAttempts,
        timeoutMs: sakConfig?.integration.timeoutMs,
        enabledPlugins: sakConfig ? Object.entries(sakConfig.plugins)
          .filter(([_, plugin]) => plugin.enabled)
          .map(([name, _]) => name) : [],
      },
    };

    const duration = Date.now() - startTime;
    logger.info('SAK health check completed', { 
      requestId: req.requestId,
      duration,
      status: response.status,
      pluginCount: response.plugins.count,
      agentCount: response.agents.count,
    });

    if (!sakStatus.healthy) {
      res.status(503);
    }

    res.json(response);

  } catch (error: any) {
    logger.error('SAK health check failed', error, { requestId: req.requestId });
    
    res.status(503).json({
      status: 'error',
      timestamp: new Date().toISOString(),
      error: error.message,
      enabled: config.sak.enabled,
    });
  }
});

export default router;
