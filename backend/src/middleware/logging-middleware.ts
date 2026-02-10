import { Request, Response, NextFunction } from 'express';
import { logger, LogContext } from '../services/memory/logger';
import { v4 as uuidv4 } from 'uuid';

/**
 * Logging middleware for comprehensive request/response logging
 * 
 * Captures:
 * - Request details (method, URL, headers, body)
 * - Response details (status, duration)
 * - Error information with stack traces
 * - User context (IP, user agent, etc.)
 * 
 * Requirements: 15.5
 */

// Extend Express Request to include requestId
declare global {
  namespace Express {
    interface Request {
      requestId?: string;
      startTime?: number;
    }
  }
}

/**
 * Request logging middleware
 * 
 * Logs all incoming requests with context information and tracks response times.
 */
export function loggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  // Generate unique request ID
  req.requestId = uuidv4();
  req.startTime = Date.now();

  // Extract request context
  const context: LogContext = {
    requestId: req.requestId,
    endpoint: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    queryParams: Object.keys(req.query).length > 0 ? req.query : undefined,
    requestBody: req.method !== 'GET' && req.body ? req.body : undefined,
  };

  // Log incoming request
  logger.info(`Incoming request: ${req.method} ${req.path}`, context);

  // Override res.json to capture response
  const originalJson = res.json;
  res.json = function(body: any) {
    const duration = Date.now() - (req.startTime || Date.now());
    const success = res.statusCode < 400;

    // Log response
    logger.logQuery(req.path, req.method, duration, success, {
      ...context,
      statusCode: res.statusCode,
      responseSize: JSON.stringify(body).length,
    });

    return originalJson.call(this, body);
  };

  // Override res.send to capture non-JSON responses
  const originalSend = res.send;
  res.send = function(body: any) {
    const duration = Date.now() - (req.startTime || Date.now());
    const success = res.statusCode < 400;

    // Log response if not already logged by res.json
    if (!res.headersSent || res.get('Content-Type')?.includes('application/json') === false) {
      logger.logQuery(req.path, req.method, duration, success, {
        ...context,
        statusCode: res.statusCode,
        responseSize: typeof body === 'string' ? body.length : JSON.stringify(body).length,
      });
    }

    return originalSend.call(this, body);
  };

  next();
}

/**
 * Error logging middleware
 * 
 * Captures and logs all unhandled errors with full context and stack traces.
 */
export function errorLoggingMiddleware(
  err: any,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  const duration = Date.now() - (req.startTime || Date.now());

  const context: LogContext = {
    requestId: req.requestId,
    endpoint: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
    queryParams: Object.keys(req.query).length > 0 ? req.query : undefined,
    requestBody: req.method !== 'GET' && req.body ? req.body : undefined,
    duration,
    statusCode: err.status || 500,
  };

  // Log error with full context
  logger.error(`Request failed: ${req.method} ${req.path}`, err, context);

  // Send error response
  const statusCode = err.status || 500;
  const errorResponse = {
    error: {
      code: err.code || 'INTERNAL_ERROR',
      message: err.message || 'Internal server error',
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    },
  };

  // Don't expose stack traces in production
  if (process.env.NODE_ENV === 'development') {
    (errorResponse.error as any).stack = err.stack;
  }

  res.status(statusCode).json(errorResponse);
}

/**
 * Async error handler wrapper
 * 
 * Wraps async route handlers to catch and forward errors to error middleware.
 */
export function asyncErrorHandler(
  fn: (req: Request, res: Response, next: NextFunction) => Promise<any>
) {
  return (req: Request, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}

/**
 * 404 logging middleware
 * 
 * Logs requests to non-existent endpoints.
 */
export function notFoundLoggingMiddleware(req: Request, res: Response, next: NextFunction): void {
  const context: LogContext = {
    requestId: req.requestId,
    endpoint: req.path,
    method: req.method,
    userAgent: req.get('User-Agent'),
    ip: req.ip || req.connection.remoteAddress,
  };

  logger.warn(`Endpoint not found: ${req.method} ${req.path}`, context);

  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: 'Endpoint not found',
      requestId: req.requestId,
      timestamp: new Date().toISOString(),
    },
  });
}