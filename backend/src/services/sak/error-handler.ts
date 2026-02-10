/**
 * SAK Error Handler - Comprehensive error handling and resilience layer for SAK operations
 */

import { logger } from '../memory/logger';
import {
  SAKErrorHandlingConfig,
  ErrorType,
  ErrorHandlingStrategy,
  RetryPolicy,
  FallbackAction,
  AlertLevel,
  RecoveryProcedure,
  TransactionError
} from './types';

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failureCount: number;
  lastFailureTime: number;
  nextAttemptTime: number;
  successCount: number;
}

export class ErrorHandler {
  private config: SAKErrorHandlingConfig;
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  private retryQueues: Map<string, any[]> = new Map();

  constructor(config: SAKErrorHandlingConfig) {
    this.config = config;
    logger.info('SAK Error Handler initialized');
  }

  /**
   * Handle an error with appropriate strategy
   */
  async handleError(
    error: Error,
    context: {
      operation: string;
      pluginName?: string;
      agentId?: string;
      parameters?: any;
    }
  ): Promise<{
    shouldRetry: boolean;
    fallbackAction?: FallbackAction;
    delay?: number;
    recoveryProcedure?: RecoveryProcedure;
  }> {
    try {
      logger.error('Handling SAK error', {
        error: error.message,
        operation: context.operation,
        pluginName: context.pluginName,
        agentId: context.agentId
      });

      // Classify error type
      const errorType = this.classifyError(error);
      
      // Get error handling strategy
      const strategy = this.getErrorHandlingStrategy(errorType);
      
      // Check circuit breaker
      const circuitBreakerKey = `${context.operation}_${context.pluginName || 'default'}`;
      const circuitBreakerResult = this.checkCircuitBreaker(circuitBreakerKey);
      
      if (!circuitBreakerResult.canProceed) {
        logger.warn('Circuit breaker is open, operation blocked', {
          key: circuitBreakerKey,
          state: circuitBreakerResult.state
        });
        
        return {
          shouldRetry: false,
          fallbackAction: FallbackAction.USE_LEGACY_ARS,
          recoveryProcedure: RecoveryProcedure.RESTART_PLUGIN
        };
      }
      
      // Record failure in circuit breaker
      this.recordFailure(circuitBreakerKey);
      
      // Determine retry strategy
      const shouldRetry = this.shouldRetry(error, strategy.retryPolicy, context);
      
      if (shouldRetry) {
        const delay = this.calculateRetryDelay(strategy.retryPolicy, context);
        
        logger.info('Error will be retried', {
          operation: context.operation,
          delay,
          errorType
        });
        
        return {
          shouldRetry: true,
          delay,
          fallbackAction: strategy.fallbackAction,
          recoveryProcedure: strategy.recoveryProcedure
        };
      } else {
        logger.warn('Error will not be retried, using fallback', {
          operation: context.operation,
          fallbackAction: strategy.fallbackAction,
          errorType
        });
        
        return {
          shouldRetry: false,
          fallbackAction: strategy.fallbackAction,
          recoveryProcedure: strategy.recoveryProcedure
        };
      }
      
    } catch (handlingError) {
      logger.error('Error in error handler', { handlingError });
      
      // Fallback to safe defaults
      return {
        shouldRetry: false,
        fallbackAction: FallbackAction.USE_LEGACY_ARS,
        recoveryProcedure: RecoveryProcedure.MANUAL_INTERVENTION
      };
    }
  }

  /**
   * Execute retry with exponential backoff
   */
  async executeWithRetry<T>(
    operation: () => Promise<T>,
    context: {
      operationName: string;
      pluginName?: string;
      maxAttempts?: number;
    }
  ): Promise<T> {
    const maxAttempts = context.maxAttempts || this.config.exponentialBackoff.initialDelay;
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxAttempts; attempt++) {
      try {
        logger.debug('Executing operation with retry', {
          operation: context.operationName,
          attempt,
          maxAttempts
        });
        
        const result = await operation();
        
        // Record success in circuit breaker
        const circuitBreakerKey = `${context.operationName}_${context.pluginName || 'default'}`;
        this.recordSuccess(circuitBreakerKey);
        
        return result;
        
      } catch (error) {
        lastError = error as Error;
        
        logger.warn('Operation attempt failed', {
          operation: context.operationName,
          attempt,
          error: lastError.message
        });
        
        // If this is the last attempt, don't wait
        if (attempt === maxAttempts) {
          break;
        }
        
        // Calculate delay for next attempt
        const delay = this.calculateExponentialBackoffDelay(attempt);
        
        logger.debug('Waiting before retry', {
          operation: context.operationName,
          attempt,
          delay
        });
        
        await this.sleep(delay);
      }
    }
    
    // All attempts failed
    throw lastError || new Error('Operation failed after all retry attempts');
  }

  /**
   * Queue operation for later execution
   */
  queueForLater(
    operation: any,
    context: {
      operationName: string;
      pluginName?: string;
      priority?: number;
    }
  ): void {
    const queueKey = `${context.operationName}_${context.pluginName || 'default'}`;
    
    if (!this.retryQueues.has(queueKey)) {
      this.retryQueues.set(queueKey, []);
    }
    
    const queue = this.retryQueues.get(queueKey)!;
    queue.push({
      operation,
      context,
      queuedAt: Date.now(),
      priority: context.priority || 0
    });
    
    // Sort by priority (higher priority first)
    queue.sort((a, b) => b.priority - a.priority);
    
    logger.info('Operation queued for later execution', {
      operation: context.operationName,
      queueSize: queue.length
    });
  }

  /**
   * Process queued operations
   */
  async processQueuedOperations(queueKey: string): Promise<void> {
    const queue = this.retryQueues.get(queueKey);
    if (!queue || queue.length === 0) {
      return;
    }
    
    logger.info('Processing queued operations', {
      queueKey,
      queueSize: queue.length
    });
    
    const operations = [...queue];
    queue.length = 0; // Clear the queue
    
    for (const item of operations) {
      try {
        await item.operation();
        logger.debug('Queued operation executed successfully', {
          operation: item.context.operationName
        });
      } catch (error) {
        logger.error('Queued operation failed', {
          operation: item.context.operationName,
          error
        });
        
        // Re-queue if appropriate
        const shouldRequeue = this.shouldRequeueFailedOperation(error as Error);
        if (shouldRequeue) {
          queue.push(item);
        }
      }
    }
  }

  /**
   * Get circuit breaker status
   */
  getCircuitBreakerStatus(key: string): CircuitBreakerState | null {
    return this.circuitBreakers.get(key) || null;
  }

  /**
   * Reset circuit breaker
   */
  resetCircuitBreaker(key: string): void {
    this.circuitBreakers.delete(key);
    logger.info('Circuit breaker reset', { key });
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private classifyError(error: Error): ErrorType {
    const message = error.message.toLowerCase();
    
    if (message.includes('network') || message.includes('connection')) {
      return ErrorType.NETWORK_ERROR;
    }
    
    if (message.includes('timeout')) {
      return ErrorType.TIMEOUT_ERROR;
    }
    
    if (message.includes('insufficient') || message.includes('balance')) {
      return ErrorType.INSUFFICIENT_FUNDS;
    }
    
    if (message.includes('slippage')) {
      return ErrorType.SLIPPAGE_EXCEEDED;
    }
    
    if (message.includes('plugin') || message.includes('module')) {
      return ErrorType.PLUGIN_FAILURE;
    }
    
    if (message.includes('config') || message.includes('parameter')) {
      return ErrorType.CONFIGURATION_ERROR;
    }
    
    // Default to transaction failure
    return ErrorType.TRANSACTION_FAILURE;
  }

  private getErrorHandlingStrategy(errorType: ErrorType): ErrorHandlingStrategy {
    // Define strategies for different error types
    const strategies: Record<ErrorType, ErrorHandlingStrategy> = {
      [ErrorType.SAK_UNAVAILABLE]: {
        errorType,
        retryPolicy: {
          maxAttempts: 3,
          delays: [1000, 2000, 4000],
          backoffMultiplier: 2,
          jitter: true
        },
        fallbackAction: FallbackAction.USE_LEGACY_ARS,
        alertLevel: AlertLevel.ERROR,
        recoveryProcedure: RecoveryProcedure.RECONNECT_NETWORK
      },
      [ErrorType.PLUGIN_FAILURE]: {
        errorType,
        retryPolicy: {
          maxAttempts: 2,
          delays: [500, 1000],
          backoffMultiplier: 2,
          jitter: false
        },
        fallbackAction: FallbackAction.TRY_ALTERNATIVE_PLUGIN,
        alertLevel: AlertLevel.WARNING,
        recoveryProcedure: RecoveryProcedure.RESTART_PLUGIN
      },
      [ErrorType.NETWORK_ERROR]: {
        errorType,
        retryPolicy: {
          maxAttempts: 5,
          delays: [1000, 2000, 4000, 8000, 16000],
          backoffMultiplier: 2,
          jitter: true
        },
        fallbackAction: FallbackAction.QUEUE_FOR_LATER,
        alertLevel: AlertLevel.WARNING,
        recoveryProcedure: RecoveryProcedure.RECONNECT_NETWORK
      },
      [ErrorType.TIMEOUT_ERROR]: {
        errorType,
        retryPolicy: {
          maxAttempts: 3,
          delays: [2000, 4000, 8000],
          backoffMultiplier: 2,
          jitter: true
        },
        fallbackAction: FallbackAction.QUEUE_FOR_LATER,
        alertLevel: AlertLevel.INFO,
        recoveryProcedure: RecoveryProcedure.CLEAR_CACHE
      },
      [ErrorType.TRANSACTION_FAILURE]: {
        errorType,
        retryPolicy: {
          maxAttempts: 2,
          delays: [1000, 2000],
          backoffMultiplier: 2,
          jitter: false
        },
        fallbackAction: FallbackAction.USE_LEGACY_ARS,
        alertLevel: AlertLevel.ERROR,
        recoveryProcedure: RecoveryProcedure.MANUAL_INTERVENTION
      },
      [ErrorType.CONFIGURATION_ERROR]: {
        errorType,
        retryPolicy: {
          maxAttempts: 1,
          delays: [0],
          backoffMultiplier: 1,
          jitter: false
        },
        fallbackAction: FallbackAction.ABORT_OPERATION,
        alertLevel: AlertLevel.CRITICAL,
        recoveryProcedure: RecoveryProcedure.MANUAL_INTERVENTION
      },
      [ErrorType.INSUFFICIENT_FUNDS]: {
        errorType,
        retryPolicy: {
          maxAttempts: 1,
          delays: [0],
          backoffMultiplier: 1,
          jitter: false
        },
        fallbackAction: FallbackAction.ABORT_OPERATION,
        alertLevel: AlertLevel.WARNING,
        recoveryProcedure: RecoveryProcedure.MANUAL_INTERVENTION
      },
      [ErrorType.SLIPPAGE_EXCEEDED]: {
        errorType,
        retryPolicy: {
          maxAttempts: 2,
          delays: [500, 1000],
          backoffMultiplier: 2,
          jitter: false
        },
        fallbackAction: FallbackAction.TRY_ALTERNATIVE_PLUGIN,
        alertLevel: AlertLevel.INFO,
        recoveryProcedure: RecoveryProcedure.CLEAR_CACHE
      },
      [ErrorType.MARKET_CLOSED]: {
        errorType,
        retryPolicy: {
          maxAttempts: 1,
          delays: [0],
          backoffMultiplier: 1,
          jitter: false
        },
        fallbackAction: FallbackAction.QUEUE_FOR_LATER,
        alertLevel: AlertLevel.INFO,
        recoveryProcedure: RecoveryProcedure.MANUAL_INTERVENTION
      }
    };
    
    return strategies[errorType];
  }

  private checkCircuitBreaker(key: string): {
    canProceed: boolean;
    state: 'closed' | 'open' | 'half-open';
  } {
    const breaker = this.circuitBreakers.get(key);
    
    if (!breaker) {
      // Initialize circuit breaker
      this.circuitBreakers.set(key, {
        state: 'closed',
        failureCount: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
        successCount: 0
      });
      
      return { canProceed: true, state: 'closed' };
    }
    
    const now = Date.now();
    
    switch (breaker.state) {
      case 'closed':
        return { canProceed: true, state: 'closed' };
        
      case 'open':
        if (now >= breaker.nextAttemptTime) {
          // Transition to half-open
          breaker.state = 'half-open';
          breaker.successCount = 0;
          return { canProceed: true, state: 'half-open' };
        }
        return { canProceed: false, state: 'open' };
        
      case 'half-open':
        return { canProceed: true, state: 'half-open' };
        
      default:
        return { canProceed: true, state: 'closed' };
    }
  }

  private recordFailure(key: string): void {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) return;
    
    breaker.failureCount++;
    breaker.lastFailureTime = Date.now();
    
    if (breaker.state === 'closed' && 
        breaker.failureCount >= this.config.circuitBreaker.failureThreshold) {
      // Open the circuit breaker
      breaker.state = 'open';
      breaker.nextAttemptTime = Date.now() + this.config.circuitBreaker.openDurationMs;
      
      logger.warn('Circuit breaker opened', {
        key,
        failureCount: breaker.failureCount,
        nextAttemptTime: new Date(breaker.nextAttemptTime)
      });
    } else if (breaker.state === 'half-open') {
      // Failed in half-open state, go back to open
      breaker.state = 'open';
      breaker.nextAttemptTime = Date.now() + this.config.circuitBreaker.openDurationMs;
      
      logger.warn('Circuit breaker reopened from half-open state', { key });
    }
  }

  private recordSuccess(key: string): void {
    const breaker = this.circuitBreakers.get(key);
    if (!breaker) return;
    
    if (breaker.state === 'half-open') {
      breaker.successCount++;
      
      if (breaker.successCount >= this.config.circuitBreaker.halfOpenMaxCalls) {
        // Close the circuit breaker
        breaker.state = 'closed';
        breaker.failureCount = 0;
        breaker.successCount = 0;
        
        logger.info('Circuit breaker closed after successful recovery', { key });
      }
    } else if (breaker.state === 'closed') {
      // Reset failure count on success
      breaker.failureCount = Math.max(0, breaker.failureCount - 1);
    }
  }

  private shouldRetry(
    error: Error,
    retryPolicy: RetryPolicy,
    context: { operation: string; [key: string]: any }
  ): boolean {
    // Don't retry configuration errors
    if (this.classifyError(error) === ErrorType.CONFIGURATION_ERROR) {
      return false;
    }
    
    // Don't retry insufficient funds errors
    if (this.classifyError(error) === ErrorType.INSUFFICIENT_FUNDS) {
      return false;
    }
    
    // Check if we have retry attempts left
    const currentAttempt = context.attempt || 1;
    return currentAttempt < retryPolicy.maxAttempts;
  }

  private calculateRetryDelay(
    retryPolicy: RetryPolicy,
    context: { operation: string; [key: string]: any }
  ): number {
    const attempt = context.attempt || 1;
    const baseDelay = retryPolicy.delays[Math.min(attempt - 1, retryPolicy.delays.length - 1)];
    
    if (!retryPolicy.jitter) {
      return baseDelay;
    }
    
    // Add jitter (±25%)
    const jitterRange = baseDelay * 0.25;
    const jitter = (Math.random() - 0.5) * 2 * jitterRange;
    
    return Math.max(0, baseDelay + jitter);
  }

  private calculateExponentialBackoffDelay(attempt: number): number {
    const baseDelay = this.config.exponentialBackoff.initialDelay;
    const multiplier = this.config.exponentialBackoff.multiplier;
    const maxDelay = this.config.exponentialBackoff.maxDelay;
    const jitter = this.config.exponentialBackoff.jitter;
    
    let delay = baseDelay * Math.pow(multiplier, attempt - 1);
    delay = Math.min(delay, maxDelay);
    
    if (jitter > 0) {
      const jitterRange = delay * jitter;
      const jitterAmount = (Math.random() - 0.5) * 2 * jitterRange;
      delay = Math.max(0, delay + jitterAmount);
    }
    
    return Math.floor(delay);
  }

  private shouldRequeueFailedOperation(error: Error): boolean {
    const errorType = this.classifyError(error);
    
    // Requeue network errors and timeouts
    return errorType === ErrorType.NETWORK_ERROR || 
           errorType === ErrorType.TIMEOUT_ERROR;
  }

  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}