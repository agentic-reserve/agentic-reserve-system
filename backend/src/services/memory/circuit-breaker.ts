/**
 * Circuit Breaker Pattern Implementation
 * 
 * Prevents cascading failures by opening the circuit after consecutive failures.
 * Provides graceful degradation when external dependencies fail.
 * 
 * States:
 * - CLOSED: Normal operation, requests pass through
 * - OPEN: Circuit is open, requests fail fast
 * - HALF_OPEN: Testing if service has recovered
 * 
 * Requirements: 14.6, 14.7
 */

enum CircuitState {
  CLOSED = 'closed',
  OPEN = 'open',
  HALF_OPEN = 'half_open',
}

interface CircuitBreakerOptions {
  failureThreshold: number; // Number of failures before opening
  successThreshold: number; // Number of successes to close from half-open
  timeout: number; // Time in ms to wait before trying half-open
  name: string; // Circuit breaker name for logging
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.CLOSED;
  private failureCount: number = 0;
  private successCount: number = 0;
  private nextAttempt: number = Date.now();
  private options: CircuitBreakerOptions;

  constructor(options: Partial<CircuitBreakerOptions> = {}) {
    this.options = {
      failureThreshold: options.failureThreshold || 5,
      successThreshold: options.successThreshold || 2,
      timeout: options.timeout || 5 * 60 * 1000, // 5 minutes default
      name: options.name || 'unnamed',
    };
  }

  /**
   * Execute a function with circuit breaker protection
   * 
   * @param fn - Async function to execute
   * @returns Promise with function result or degraded response
   */
  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.OPEN) {
      if (Date.now() < this.nextAttempt) {
        throw new Error(
          `Circuit breaker [${this.options.name}] is OPEN. Next attempt at ${new Date(this.nextAttempt).toISOString()}`
        );
      }
      // Try half-open
      this.state = CircuitState.HALF_OPEN;
      console.log(`[Circuit Breaker] ${this.options.name} entering HALF_OPEN state`);
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Execute with fallback for degraded mode
   * 
   * @param fn - Primary function to execute
   * @param fallback - Fallback function for degraded mode
   * @returns Promise with result or fallback result
   */
  async executeWithFallback<T>(fn: () => Promise<T>, fallback: () => Promise<T>): Promise<T> {
    try {
      return await this.execute(fn);
    } catch (error) {
      console.warn(`[Circuit Breaker] ${this.options.name} failed, using fallback:`, error);
      return await fallback();
    }
  }

  /**
   * Handle successful execution
   */
  private onSuccess(): void {
    this.failureCount = 0;

    if (this.state === CircuitState.HALF_OPEN) {
      this.successCount++;
      if (this.successCount >= this.options.successThreshold) {
        this.state = CircuitState.CLOSED;
        this.successCount = 0;
        console.log(`[Circuit Breaker] ${this.options.name} closed after successful recovery`);
      }
    }
  }

  /**
   * Handle failed execution
   */
  private onFailure(): void {
    this.failureCount++;
    this.successCount = 0;

    if (this.failureCount >= this.options.failureThreshold) {
      this.state = CircuitState.OPEN;
      this.nextAttempt = Date.now() + this.options.timeout;
      console.error(
        `[Circuit Breaker] ${this.options.name} opened after ${this.failureCount} failures. Will retry at ${new Date(this.nextAttempt).toISOString()}`
      );
    }
  }

  /**
   * Get current circuit state
   */
  getState(): CircuitState {
    return this.state;
  }

  /**
   * Get circuit breaker stats
   */
  getStats(): {
    state: CircuitState;
    failureCount: number;
    successCount: number;
    nextAttempt: number | null;
  } {
    return {
      state: this.state,
      failureCount: this.failureCount,
      successCount: this.successCount,
      nextAttempt: this.state === CircuitState.OPEN ? this.nextAttempt : null,
    };
  }

  /**
   * Manually reset the circuit breaker
   */
  reset(): void {
    this.state = CircuitState.CLOSED;
    this.failureCount = 0;
    this.successCount = 0;
    this.nextAttempt = Date.now();
    console.log(`[Circuit Breaker] ${this.options.name} manually reset`);
  }
}

/**
 * Retry with exponential backoff
 * 
 * @param fn - Function to retry
 * @param maxAttempts - Maximum number of attempts (default: 3)
 * @param baseDelay - Base delay in ms (default: 1000)
 * @param context - Optional context for error logging and event emission
 * @returns Promise with function result
 * 
 * Requirements: 14.4, 14.5
 */
export async function retryWithBackoff<T>(
  fn: () => Promise<T>,
  maxAttempts: number = 3,
  baseDelay: number = 1000,
  context?: { operation?: string; emitEvent?: (error: Error) => void }
): Promise<T> {
  let lastError: Error | undefined;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (error) {
      lastError = error as Error;
      
      if (attempt === maxAttempts) {
        // Log error with full context (Requirement 14.5)
        const errorContext = context?.operation ? ` for operation: ${context.operation}` : '';
        console.error(`[Retry] All ${maxAttempts} attempts failed${errorContext}:`, lastError);
        
        // Emit system.error event on retry exhaustion (Requirement 14.5)
        if (context?.emitEvent) {
          context.emitEvent(lastError);
        }
        
        throw lastError;
      }

      const delay = baseDelay * Math.pow(2, attempt - 1); // Exponential backoff: 1s, 2s, 4s
      console.warn(`[Retry] Attempt ${attempt}/${maxAttempts} failed, retrying in ${delay}ms:`, lastError.message);
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }

  throw lastError;
}

/**
 * Global circuit breakers for external dependencies
 */
export const circuitBreakers = {
  lysLabs: new CircuitBreaker({
    name: 'LYS Labs WebSocket',
    failureThreshold: 5,
    timeout: 5 * 60 * 1000, // 5 minutes
  }),
  supabase: new CircuitBreaker({
    name: 'Supabase',
    failureThreshold: 5,
    timeout: 2 * 60 * 1000, // 2 minutes
  }),
  redis: new CircuitBreaker({
    name: 'Redis',
    failureThreshold: 3,
    timeout: 1 * 60 * 1000, // 1 minute
  }),
  oracleAggregator: new CircuitBreaker({
    name: 'Oracle Aggregator',
    failureThreshold: 5,
    timeout: 5 * 60 * 1000, // 5 minutes
  }),
};
