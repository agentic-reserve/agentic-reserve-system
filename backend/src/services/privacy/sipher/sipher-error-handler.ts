/**
 * Sipher API Error Handler
 * 
 * Provides comprehensive error handling for Sipher API interactions including
 * authentication errors, rate limiting, validation errors, and server errors.
 * 
 * @module sipher-error-handler
 */

import {
  SipherAPIError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  ServerError,
  UnknownError
} from '../types';

/**
 * Logger interface for error logging
 */
interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

/**
 * Simple console logger implementation
 */
class ConsoleLogger implements Logger {
  info(message: string, meta?: any): void {
    console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }

  warn(message: string, meta?: any): void {
    console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }

  error(message: string, meta?: any): void {
    console.error(`[ERROR] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }

  debug(message: string, meta?: any): void {
    console.debug(`[DEBUG] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }
}

/**
 * Sipher API Error Handler
 * 
 * Handles different types of API errors with appropriate strategies:
 * - Authentication errors (401): Log and alert operations team
 * - Rate limiting errors (429): Exponential backoff with retry-after header
 * - Validation errors (400): Log and return descriptive error
 * - Server errors (500, 502, 503): Retry with exponential backoff
 * - Timeout errors: Retry with exponential backoff
 */
export class SipherErrorHandler {
  private readonly logger: Logger;

  /**
   * Create a new error handler
   * 
   * @param logger - Optional logger instance (defaults to console logger)
   */
  constructor(logger?: Logger) {
    this.logger = logger ?? new ConsoleLogger();
  }

  /**
   * Handle a Sipher API error
   * 
   * Analyzes the error and applies the appropriate handling strategy.
   * Throws a specific error type based on the error category.
   * 
   * @param error - Sipher API error
   * @throws {AuthenticationError} For 401 errors
   * @throws {RateLimitError} For 429 errors
   * @throws {ValidationError} For 400 errors
   * @throws {ServerError} For 500, 502, 503 errors
   * @throws {UnknownError} For other errors
   */
  async handleError(error: SipherAPIError): Promise<void> {
    switch (error.statusCode) {
      case 401:
        // Authentication error - log and alert
        this.logger.error('Sipher API authentication failed', { error });
        await this.alertOps('Sipher API key invalid or expired');
        throw new AuthenticationError('Invalid Sipher API credentials');

      case 429:
        // Rate limiting - exponential backoff
        const retryAfter = parseInt(error.headers['retry-after'] || '60', 10);
        this.logger.warn('Sipher API rate limit hit', { retryAfter });
        await this.sleep(retryAfter * 1000);
        throw new RateLimitError('Sipher API rate limit exceeded', retryAfter);

      case 400:
        // Validation error - log and return descriptive error
        this.logger.error('Sipher API validation error', {
          error,
          params: error.requestParams
        });
        throw new ValidationError(error.message, error.details);

      case 500:
      case 502:
      case 503:
        // Server error - retry with exponential backoff
        this.logger.error('Sipher API server error', { error });
        throw new ServerError('Sipher API temporarily unavailable');

      default:
        // Unknown error - log and throw
        this.logger.error('Unknown Sipher API error', { error });
        throw new UnknownError('Unexpected Sipher API error');
    }
  }

  /**
   * Retry an operation with exponential backoff
   * 
   * Attempts to execute an operation multiple times with increasing delays
   * between attempts. Useful for handling transient failures.
   * 
   * @param operation - Async operation to retry
   * @param maxRetries - Maximum number of retry attempts (default 3)
   * @param baseDelay - Base delay in milliseconds (default 1000ms)
   * @returns Result of the operation
   * @throws {Error} If all retry attempts fail
   */
  async retryWithBackoff<T>(
    operation: () => Promise<T>,
    maxRetries: number = 3,
    baseDelay: number = 1000
  ): Promise<T> {
    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        return await operation();
      } catch (error) {
        // If this is the last attempt, throw the error
        if (attempt === maxRetries - 1) {
          this.logger.error('Max retries exceeded', {
            attempt: attempt + 1,
            maxRetries,
            error: error instanceof Error ? error.message : String(error)
          });
          throw error;
        }

        // Calculate delay with exponential backoff
        const delay = baseDelay * Math.pow(2, attempt);
        this.logger.warn('Retrying operation', {
          attempt: attempt + 1,
          maxRetries,
          delay,
          error: error instanceof Error ? error.message : String(error)
        });

        // Wait before retrying
        await this.sleep(delay);
      }
    }

    // This should never be reached, but TypeScript requires it
    throw new Error('Max retries exceeded');
  }

  /**
   * Sleep for a specified duration
   * 
   * @param ms - Duration in milliseconds
   * @returns Promise that resolves after the duration
   */
  private async sleep(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * Alert operations team
   * 
   * Sends an alert to the operations team about a critical error.
   * In production, this would integrate with Slack, PagerDuty, etc.
   * 
   * @param message - Alert message
   */
  private async alertOps(message: string): Promise<void> {
    // TODO: Integrate with alerting system (Slack, PagerDuty, etc.)
    this.logger.error('OPERATIONS ALERT', { message });
  }
}
