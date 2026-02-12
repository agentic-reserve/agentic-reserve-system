import express, { Application } from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import { config } from './config';
import { metricsMiddleware } from './middleware/metrics-middleware';
import { 
  loggingMiddleware, 
  errorLoggingMiddleware, 
  notFoundLoggingMiddleware 
} from './middleware/logging-middleware';
import { logger } from './services/memory/logger';

// Import routes
import iliRoutes from './routes/ili';
import icrRoutes from './routes/icr';
import proposalRoutes from './routes/proposals';
import reserveRoutes from './routes/reserve';
import revenueRoutes from './routes/revenue';
import agentRoutes from './routes/agents';
// import privacyRoutes from './routes/privacy'; // Disabled for production build
// import complianceRoutes from './routes/compliance'; // Disabled for production build
// import memoryRoutes from './routes/memory'; // Disabled for production build
import healthRoutes from './routes/health';
import metricsRoutes from './routes/metrics';
import slowQueriesRoutes from './routes/slow-queries';

export function createApp(): Application {
  const app = express();

  // Middleware
  app.use(cors());
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  // Logging middleware (must be early in the chain)
  app.use(loggingMiddleware);

  // Metrics tracking middleware
  app.use(metricsMiddleware);

  // Rate limiting
  const limiter = rateLimit({
    windowMs: config.rateLimit.windowMs,
    max: config.rateLimit.maxRequests,
    message: 'Too many requests from this IP, please try again later.',
  });
  app.use('/api/', limiter);

  // Health check
  app.get('/health', (req, res) => {
    logger.info('Health check requested', { requestId: req.requestId });
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  // API routes
  app.use('/api/v1/ili', iliRoutes);
  app.use('/api/v1/icr', icrRoutes);
  app.use('/api/v1/proposals', proposalRoutes);
  app.use('/api/v1/reserve', reserveRoutes);
  app.use('/api/v1/revenue', revenueRoutes);
  app.use('/api/v1/agents', agentRoutes);
  
  // Privacy routes (Phase 1 & 2: Shielded Transfers, MEV Protection) - Disabled for production build
  // if (config.privacy?.enabled) {
  //   app.use('/api/v1/privacy', privacyRoutes);
  // }

  // Compliance routes (Phase 3: Compliance Layer) - Disabled for production build
  // if (config.privacy?.enabled) {
  //   app.use('/api/v1/compliance', complianceRoutes);
  // }

  // Memory routes (Solder Cortex integration) - Disabled for production build
  // app.use('/api/v1/memory', memoryRoutes);

  // Health check routes
  app.use('/api/v1/health', healthRoutes);

  // Metrics endpoint (Prometheus)
  app.use('/metrics', metricsRoutes);

  // Slow queries endpoint
  app.use('/api/v1/slow-queries', slowQueriesRoutes);

  // Error handling middleware (must be after all routes)
  app.use(errorLoggingMiddleware);

  // 404 handler (must be last)
  app.use(notFoundLoggingMiddleware);

  return app;
}
