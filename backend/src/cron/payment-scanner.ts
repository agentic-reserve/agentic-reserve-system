import cron from 'node-cron';
import { getPaymentScannerService } from '../services/privacy/scanning/payment-scanner-service';

/**
 * Simple logger utility
 */
const logger = {
  info: (message: string, context?: any) => console.log(`[INFO] ${message}`, context || ''),
  warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context || ''),
  error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context || '')
};

/**
 * Payment Scanner Cron Job
 * 
 * Runs payment scanner every 60 seconds to detect incoming shielded payments.
 * Implements exponential backoff for failures (up to 5 attempts).
 * 
 * Requirements: 3.4, 3.5
 */
export class PaymentScannerCron {
  private cronJob: cron.ScheduledTask | null = null;
  private scannerService = getPaymentScannerService();

  /**
   * Start payment scanner cron job
   * 
   * Runs every 60 seconds (configurable via PAYMENT_SCAN_INTERVAL_SECONDS env var)
   */
  start(): void {
    if (this.cronJob) {
      logger.warn('Payment scanner cron job already running');
      return;
    }

    const intervalSeconds = parseInt(process.env.PAYMENT_SCAN_INTERVAL_SECONDS || '60', 10);
    
    // Convert seconds to cron expression
    // For 60 seconds: '* * * * *' (every minute)
    // For other intervals, we'll use the service's built-in interval
    const cronExpression = intervalSeconds === 60 ? '* * * * *' : null;

    if (cronExpression) {
      // Use node-cron for standard intervals
      logger.info('Starting payment scanner cron job', { 
        expression: cronExpression,
        intervalSeconds 
      });

      this.cronJob = cron.schedule(cronExpression, async () => {
        try {
          logger.info('Running scheduled payment scan');
          await this.scannerService.scanAllAgents();
        } catch (error) {
          logger.error('Scheduled payment scan failed', { error });
        }
      });

      logger.info('Payment scanner cron job started');
    } else {
      // Use service's built-in interval for non-standard intervals
      logger.info('Starting payment scanner service with custom interval', { 
        intervalSeconds 
      });

      this.scannerService.start({
        intervalSeconds,
        batchSize: parseInt(process.env.PAYMENT_SCAN_BATCH_SIZE || '100', 10),
        retryAttempts: parseInt(process.env.PAYMENT_SCAN_RETRY_ATTEMPTS || '5', 10),
        retryDelayMs: 1000
      });

      logger.info('Payment scanner service started');
    }

    // Listen for payment notifications
    this.scannerService.on('payment', (notification) => {
      logger.info('Payment detected', {
        agentId: notification.agentId,
        stealthAddress: notification.payment.stealthAddress,
        amount: notification.payment.amount
      });
    });
  }

  /**
   * Stop payment scanner cron job
   */
  stop(): void {
    if (this.cronJob) {
      this.cronJob.stop();
      this.cronJob = null;
      logger.info('Payment scanner cron job stopped');
    }

    this.scannerService.stop();
  }

  /**
   * Get scanner statistics
   */
  async getStats() {
    return await this.scannerService.getStats();
  }
}

/**
 * Singleton instance
 */
let paymentScannerCronInstance: PaymentScannerCron | null = null;

/**
 * Get or create PaymentScannerCron singleton
 */
export function getPaymentScannerCron(): PaymentScannerCron {
  if (!paymentScannerCronInstance) {
    paymentScannerCronInstance = new PaymentScannerCron();
  }
  return paymentScannerCronInstance;
}

/**
 * Start payment scanner cron job (convenience function)
 */
export function startPaymentScannerCron(): void {
  const cron = getPaymentScannerCron();
  cron.start();
}

/**
 * Stop payment scanner cron job (convenience function)
 */
export function stopPaymentScannerCron(): void {
  const cron = getPaymentScannerCron();
  cron.stop();
}
