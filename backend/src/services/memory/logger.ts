/**
 * Comprehensive Error Logging Service
 * 
 * Provides structured logging with context information for the Memory Service.
 * Logs all errors with stack traces, request parameters, timestamps, and severity levels.
 * 
 * Requirements: 15.5
 */

export enum LogLevel {
  DEBUG = 'debug',
  INFO = 'info',
  WARN = 'warn',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface LogContext {
  requestId?: string;
  userId?: string;
  agentId?: string;
  walletAddress?: string;
  endpoint?: string;
  method?: string;
  userAgent?: string;
  ip?: string;
  queryParams?: Record<string, any>;
  requestBody?: Record<string, any>;
  duration?: number;
  [key: string]: any;
}

export interface LogEntry {
  timestamp: string;
  level: LogLevel;
  message: string;
  context?: LogContext;
  error?: {
    name: string;
    message: string;
    stack?: string;
    code?: string | number;
  };
  service: string;
  version: string;
}

/**
 * Memory Service Logger
 * 
 * Provides structured logging with context information and error tracking.
 * All logs are formatted as JSON for easy parsing by log aggregation systems.
 */
export class MemoryLogger {
  private serviceName: string;
  private serviceVersion: string;
  private minLogLevel: LogLevel;

  constructor(serviceName = 'ars-memory-service', serviceVersion = '1.0.0') {
    this.serviceName = serviceName;
    this.serviceVersion = serviceVersion;
    this.minLogLevel = this.getMinLogLevel();
  }

  /**
   * Log debug message
   */
  debug(message: string, context?: LogContext): void {
    this.log(LogLevel.DEBUG, message, context);
  }

  /**
   * Log info message
   */
  info(message: string, context?: LogContext): void {
    this.log(LogLevel.INFO, message, context);
  }

  /**
   * Log warning message
   */
  warn(message: string, context?: LogContext): void {
    this.log(LogLevel.WARN, message, context);
  }

  /**
   * Log error message
   */
  error(message: string, error?: Error, context?: LogContext): void {
    const errorInfo = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    } : undefined;

    this.log(LogLevel.ERROR, message, context, errorInfo);
  }

  /**
   * Log critical error message
   */
  critical(message: string, error?: Error, context?: LogContext): void {
    const errorInfo = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    } : undefined;

    this.log(LogLevel.CRITICAL, message, context, errorInfo);
  }

  /**
   * Log query performance
   */
  logQuery(
    endpoint: string,
    method: string,
    duration: number,
    success: boolean,
    context?: LogContext
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `Query ${success ? 'completed' : 'failed'}: ${method} ${endpoint}`;
    
    this.log(level, message, {
      ...context,
      endpoint,
      method,
      duration,
      success,
      type: 'query_performance',
    });
  }

  /**
   * Log slow query
   */
  logSlowQuery(
    endpoint: string,
    method: string,
    duration: number,
    threshold: number,
    context?: LogContext
  ): void {
    this.warn(`Slow query detected: ${method} ${endpoint} took ${duration}ms (threshold: ${threshold}ms)`, {
      ...context,
      endpoint,
      method,
      duration,
      threshold,
      type: 'slow_query',
    });
  }

  /**
   * Log WebSocket events
   */
  logWebSocket(
    event: 'connected' | 'disconnected' | 'error' | 'message',
    message: string,
    context?: LogContext
  ): void {
    const level = event === 'error' ? LogLevel.ERROR : LogLevel.INFO;
    
    this.log(level, `WebSocket ${event}: ${message}`, {
      ...context,
      event,
      type: 'websocket',
    });
  }

  /**
   * Log database operations
   */
  logDatabase(
    operation: string,
    table: string,
    duration: number,
    success: boolean,
    error?: Error,
    context?: LogContext
  ): void {
    const level = success ? LogLevel.INFO : LogLevel.ERROR;
    const message = `Database ${operation} on ${table} ${success ? 'completed' : 'failed'} in ${duration}ms`;
    
    const errorInfo = error ? {
      name: error.name,
      message: error.message,
      stack: error.stack,
      code: (error as any).code,
    } : undefined;

    this.log(level, message, {
      ...context,
      operation,
      table,
      duration,
      success,
      type: 'database',
    }, errorInfo);
  }

  /**
   * Log cache operations
   */
  logCache(
    operation: 'hit' | 'miss' | 'set' | 'delete' | 'evict',
    key: string,
    duration?: number,
    context?: LogContext
  ): void {
    this.debug(`Cache ${operation}: ${key}${duration ? ` (${duration}ms)` : ''}`, {
      ...context,
      operation,
      key,
      duration,
      type: 'cache',
    });
  }

  /**
   * Log security events
   */
  logSecurity(
    event: 'anomaly_detected' | 'unauthorized_access' | 'rate_limit_exceeded' | 'privacy_violation',
    message: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    context?: LogContext
  ): void {
    const level = severity === 'critical' ? LogLevel.CRITICAL : 
                  severity === 'high' ? LogLevel.ERROR :
                  severity === 'medium' ? LogLevel.WARN : LogLevel.INFO;

    this.log(level, `Security event: ${message}`, {
      ...context,
      event,
      severity,
      type: 'security',
    });
  }

  /**
   * Log system events
   */
  logSystem(
    event: 'startup' | 'shutdown' | 'health_check' | 'circuit_breaker' | 'dependency_failure',
    message: string,
    context?: LogContext
  ): void {
    const level = event === 'dependency_failure' || event === 'circuit_breaker' ? 
                  LogLevel.ERROR : LogLevel.INFO;

    this.log(level, `System event: ${message}`, {
      ...context,
      event,
      type: 'system',
    });
  }

  /**
   * Core logging method
   */
  private log(
    level: LogLevel,
    message: string,
    context?: LogContext,
    error?: { name: string; message: string; stack?: string; code?: string | number }
  ): void {
    // Check if log level meets minimum threshold
    if (!this.shouldLog(level)) {
      return;
    }

    const logEntry: LogEntry = {
      timestamp: new Date().toISOString(),
      level,
      message,
      context: this.sanitizeContext(context),
      error,
      service: this.serviceName,
      version: this.serviceVersion,
    };

    // Output to console (in production, this would go to a log aggregation system)
    const output = JSON.stringify(logEntry, null, level === LogLevel.DEBUG ? 2 : 0);
    
    switch (level) {
      case LogLevel.DEBUG:
        console.debug(output);
        break;
      case LogLevel.INFO:
        console.info(output);
        break;
      case LogLevel.WARN:
        console.warn(output);
        break;
      case LogLevel.ERROR:
      case LogLevel.CRITICAL:
        console.error(output);
        break;
    }
  }

  /**
   * Check if log level should be logged
   */
  private shouldLog(level: LogLevel): boolean {
    const levels = [LogLevel.DEBUG, LogLevel.INFO, LogLevel.WARN, LogLevel.ERROR, LogLevel.CRITICAL];
    const currentIndex = levels.indexOf(this.minLogLevel);
    const logIndex = levels.indexOf(level);
    
    return logIndex >= currentIndex;
  }

  /**
   * Get minimum log level from environment
   */
  private getMinLogLevel(): LogLevel {
    const envLevel = process.env.LOG_LEVEL?.toLowerCase();
    
    switch (envLevel) {
      case 'debug':
        return LogLevel.DEBUG;
      case 'info':
        return LogLevel.INFO;
      case 'warn':
        return LogLevel.WARN;
      case 'error':
        return LogLevel.ERROR;
      case 'critical':
        return LogLevel.CRITICAL;
      default:
        return process.env.NODE_ENV === 'development' ? LogLevel.DEBUG : LogLevel.INFO;
    }
  }

  /**
   * Sanitize context to remove sensitive information
   */
  private sanitizeContext(context?: LogContext): LogContext | undefined {
    if (!context) {
      return undefined;
    }

    const sanitized = { ...context };

    // Remove sensitive fields
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];
    
    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    // Sanitize nested objects
    if (sanitized.requestBody) {
      sanitized.requestBody = this.sanitizeObject(sanitized.requestBody);
    }

    if (sanitized.queryParams) {
      sanitized.queryParams = this.sanitizeObject(sanitized.queryParams);
    }

    return sanitized;
  }

  /**
   * Sanitize object to remove sensitive information
   */
  private sanitizeObject(obj: Record<string, any>): Record<string, any> {
    const sanitized = { ...obj };
    const sensitiveFields = ['password', 'token', 'apiKey', 'secret', 'authorization'];

    for (const field of sensitiveFields) {
      if (sanitized[field]) {
        sanitized[field] = '[REDACTED]';
      }
    }

    return sanitized;
  }
}

// Export singleton instance
export const logger = new MemoryLogger();