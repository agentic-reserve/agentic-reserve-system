import { EventEmitter } from 'events';
import { getSipherClient } from '../sipher-client';
import { getStealthAddressManager } from '../stealth-address-manager';
import { supabase } from '../../supabase';

/**
 * Simple logger utility
 */
const logger = {
  info: (message: string, context?: any) => console.log(`[INFO] ${message}`, context || ''),
  warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context || ''),
  error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context || '')
};

/**
 * Payment scan configuration
 */
export interface PaymentScanConfig {
  intervalSeconds: number;      // Scan interval (default 60)
  batchSize: number;            // Transactions per scan (default 100)
  retryAttempts: number;        // Retry on failure (default 5)
  retryDelayMs: number;         // Initial retry delay (default 1000)
}

/**
 * Default scan configuration
 */
export const DEFAULT_SCAN_CONFIG: PaymentScanConfig = {
  intervalSeconds: parseInt(process.env.PAYMENT_SCAN_INTERVAL_SECONDS || '60', 10),
  batchSize: parseInt(process.env.PAYMENT_SCAN_BATCH_SIZE || '100', 10),
  retryAttempts: parseInt(process.env.PAYMENT_SCAN_RETRY_ATTEMPTS || '5', 10),
  retryDelayMs: 1000
};

/**
 * Detected payment
 */
export interface DetectedPayment {
  stealthAddress: string;
  ephemeralPublicKey: string;
  amount: string;
  slot: number;
  timestamp: number;
}

/**
 * Payment notification event
 */
export interface PaymentNotification {
  agentId: string;
  payment: DetectedPayment;
  timestamp: number;
}

/**
 * PaymentScannerService
 * 
 * Continuously scans blockchain for incoming shielded payments to agent stealth addresses.
 * 
 * Features:
 * - Runs every 60 seconds via scheduled job
 * - Tracks last scanned slot to avoid duplicates
 * - Stores detected payments in database
 * - Emits payment notification events
 * - Implements exponential backoff for failures
 * 
 * Requirements: 3.1, 3.3, 3.4, 3.5
 */
export class PaymentScannerService extends EventEmitter {
  private config: PaymentScanConfig;
  private scanInterval: NodeJS.Timeout | null = null;
  private isScanning: boolean = false;
  private stealthManager = getStealthAddressManager();

  constructor(config: PaymentScanConfig = DEFAULT_SCAN_CONFIG) {
    super();
    this.config = config;
  }

  /**
   * Start payment scanning service
   * 
   * Begins periodic scanning for all registered agents.
   * 
   * @param config - Optional scan configuration override
   * 
   * Requirements: 3.4
   */
  async start(config?: Partial<PaymentScanConfig>): Promise<void> {
    if (this.scanInterval) {
      logger.warn('Payment scanner already running');
      return;
    }

    // Merge config
    if (config) {
      this.config = { ...this.config, ...config };
    }

    logger.info('Starting payment scanner service', {
      intervalSeconds: this.config.intervalSeconds,
      batchSize: this.config.batchSize
    });

    // Run initial scan
    await this.scanAllAgents();

    // Schedule periodic scans
    this.scanInterval = setInterval(
      () => this.scanAllAgents(),
      this.config.intervalSeconds * 1000
    );

    logger.info('Payment scanner service started');
  }

  /**
   * Stop payment scanning service
   */
  async stop(): Promise<void> {
    if (this.scanInterval) {
      clearInterval(this.scanInterval);
      this.scanInterval = null;
      logger.info('Payment scanner service stopped');
    }
  }

  /**
   * Scan for payments for all registered agents
   */
  private async scanAllAgents(): Promise<void> {
    if (this.isScanning) {
      logger.warn('Scan already in progress, skipping');
      return;
    }

    this.isScanning = true;

    try {
      // Get all agents with stealth addresses
      const { data: agents, error } = await supabase
        .from('stealth_addresses')
        .select('agent_id')
        .eq('active', true);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      // Get unique agent IDs
      const agentIds = [...new Set(agents.map(a => a.agent_id))];

      logger.info(`Scanning for payments for ${agentIds.length} agents`);

      // Scan each agent
      for (const agentId of agentIds) {
        try {
          await this.scanForAgent(agentId);
        } catch (error) {
          logger.error('Failed to scan for agent', { error, agentId });
          // Continue scanning other agents
        }
      }
    } catch (error) {
      logger.error('Failed to scan all agents', { error });
    } finally {
      this.isScanning = false;
    }
  }

  /**
   * Scan for payments for specific agent
   * 
   * Calls Sipher API to detect payments sent to agent's stealth addresses.
   * Tracks last scanned slot to avoid duplicate processing.
   * 
   * @param agentId - Agent identifier
   * @returns Array of detected payments
   * 
   * Requirements: 3.1, 3.2, 3.3, 3.5
   */
  async scanForAgent(agentId: string): Promise<DetectedPayment[]> {
    let attempt = 0;
    let lastError: Error | null = null;

    while (attempt < this.config.retryAttempts) {
      try {
        logger.info(`Scanning for payments (attempt ${attempt + 1}/${this.config.retryAttempts})`, {
          agentId
        });

        // Get agent's private keys
        const keys = await this.stealthManager.getPrivateKeys(agentId);
        if (!keys) {
          throw new Error(`No keys found for agent: ${agentId}`);
        }

        // Get last scanned slot
        const lastScannedSlot = await this.getLastScannedSlot(agentId);

        // Call Sipher API to scan for payments
        const sipher = getSipherClient();
        const payments = await sipher.scanPayments({
          viewingPrivateKey: keys.viewingPrivateKey,
          spendingPublicKey: keys.spendingPrivateKey, // Extract public key from private key
          fromSlot: lastScannedSlot,
          limit: this.config.batchSize
        });

        logger.info(`Found ${payments.length} payments for agent`, { agentId });

        if (payments.length > 0) {
          // Store detected payments
          await this.storeDetectedPayments(agentId, payments);

          // Update last scanned slot
          const maxSlot = Math.max(...payments.map(p => p.slot));
          await this.updateLastScannedSlot(agentId, maxSlot);

          // Emit payment notifications
          await this.emitPaymentNotifications(agentId, payments);
        }

        return payments;
      } catch (error) {
        lastError = error as Error;
        attempt++;

        if (attempt < this.config.retryAttempts) {
          // Exponential backoff
          const delay = this.config.retryDelayMs * Math.pow(2, attempt - 1);
          logger.warn(`Scan failed, retrying in ${delay}ms`, {
            agentId,
            attempt,
            error: lastError.message
          });
          await this.sleep(delay);
        }
      }
    }

    // All retries failed
    logger.error('All scan attempts failed', {
      agentId,
      attempts: this.config.retryAttempts,
      error: lastError?.message
    });

    throw lastError || new Error('Scan failed after all retries');
  }

  /**
   * Get last scanned slot for agent
   * 
   * @param agentId - Agent identifier
   * @returns Last scanned slot number
   * 
   * Requirements: 3.2
   */
  private async getLastScannedSlot(agentId: string): Promise<number> {
    try {
      const { data, error } = await supabase
        .from('payment_scan_state')
        .select('last_scanned_slot')
        .eq('agent_id', agentId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // No record found, initialize with slot 0
          await supabase
            .from('payment_scan_state')
            .insert({
              agent_id: agentId,
              last_scanned_slot: 0
            });
          return 0;
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return data.last_scanned_slot;
    } catch (error) {
      logger.error('Failed to get last scanned slot', { error, agentId });
      throw error;
    }
  }

  /**
   * Update last scanned slot for agent
   * 
   * @param agentId - Agent identifier
   * @param slot - New slot number
   * 
   * Requirements: 3.2
   */
  private async updateLastScannedSlot(agentId: string, slot: number): Promise<void> {
    try {
      const { error } = await supabase
        .from('payment_scan_state')
        .upsert({
          agent_id: agentId,
          last_scanned_slot: slot,
          last_scan_at: new Date().toISOString()
        });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info('Updated last scanned slot', { agentId, slot });
    } catch (error) {
      logger.error('Failed to update last scanned slot', { error, agentId, slot });
      throw error;
    }
  }

  /**
   * Store detected payments in database
   * 
   * @param agentId - Agent identifier
   * @param payments - Array of detected payments
   * 
   * Requirements: 3.3
   */
  private async storeDetectedPayments(
    agentId: string,
    payments: DetectedPayment[]
  ): Promise<void> {
    try {
      // Insert payments into shielded_transactions table
      const records = payments.map(payment => ({
        tx_signature: '', // Will be filled when claimed
        sender: '', // Unknown sender (privacy feature)
        stealth_address: payment.stealthAddress,
        ephemeral_public_key: payment.ephemeralPublicKey,
        commitment: '', // Not available from scan
        amount_encrypted: payment.amount,
        status: 'confirmed', // Payment detected on-chain
        created_at: new Date(payment.timestamp * 1000).toISOString()
      }));

      const { error } = await supabase
        .from('shielded_transactions')
        .insert(records);

      if (error) {
        // Ignore duplicate key errors (payment already stored)
        if (error.code !== '23505') {
          throw new Error(`Database error: ${error.message}`);
        }
      }

      logger.info('Stored detected payments', {
        agentId,
        count: payments.length
      });
    } catch (error) {
      logger.error('Failed to store detected payments', { error, agentId });
      throw error;
    }
  }

  /**
   * Emit payment notification events
   * 
   * @param agentId - Agent identifier
   * @param payments - Array of detected payments
   * 
   * Requirements: 3.4
   */
  private async emitPaymentNotifications(
    agentId: string,
    payments: DetectedPayment[]
  ): Promise<void> {
    try {
      for (const payment of payments) {
        const notification: PaymentNotification = {
          agentId,
          payment,
          timestamp: Date.now()
        };

        this.emit('payment', notification);

        logger.info('Payment notification emitted', {
          agentId,
          stealthAddress: payment.stealthAddress,
          amount: payment.amount
        });
      }
    } catch (error) {
      logger.error('Failed to emit payment notifications', { error, agentId });
      // Don't throw - notifications are best-effort
    }
  }

  /**
   * Sleep for specified milliseconds
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Get scan statistics
   */
  async getStats(): Promise<{
    totalAgents: number;
    lastScanTimes: Array<{ agentId: string; lastScanAt: string }>;
  }> {
    try {
      const { data, error } = await supabase
        .from('payment_scan_state')
        .select('agent_id, last_scan_at')
        .order('last_scan_at', { ascending: false });

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return {
        totalAgents: data.length,
        lastScanTimes: data.map(row => ({
          agentId: row.agent_id,
          lastScanAt: row.last_scan_at
        }))
      };
    } catch (error) {
      logger.error('Failed to get scan stats', { error });
      throw error;
    }
  }
}

/**
 * Singleton instance
 */
let paymentScannerServiceInstance: PaymentScannerService | null = null;

/**
 * Get or create PaymentScannerService singleton
 */
export function getPaymentScannerService(): PaymentScannerService {
  if (!paymentScannerServiceInstance) {
    paymentScannerServiceInstance = new PaymentScannerService();
  }
  return paymentScannerServiceInstance;
}

/**
 * Create PaymentScannerService with custom config (for testing)
 */
export function createPaymentScannerService(config?: PaymentScanConfig): PaymentScannerService {
  return new PaymentScannerService(config);
}
