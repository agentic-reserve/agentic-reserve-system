import { SupabaseClient } from '@supabase/supabase-js';
import { SipherClient, ViewingKey } from './sipher-client';

/**
 * Simple logger utility
 */
const logger = {
  info: (message: string, context?: any) => console.log(`[INFO] ${message}`, context || ''),
  warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context || ''),
  error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context || '')
};

/**
 * Audit log entry structure
 */
export interface AuditLogEntry {
  event_type: 'disclosure' | 'decryption' | 'revocation' | 'key_access' | 'encryption';
  actor: string;
  resource_type: 'viewing_key' | 'disclosure' | 'transaction' | 'commitment';
  resource_id: string;
  action: string;
  result: 'success' | 'failure';
  ip_address?: string;
  user_agent?: string;
  metadata: Record<string, any>;
  timestamp: string;
}

/**
 * Disclosure record from database
 */
export interface DisclosureRecord {
  id: number;
  transactionId: number;
  auditorId: string;
  viewingKeyHash: string;
  encryptedData: string;
  disclosedFields: string[];
  expiresAt: Date;
  createdAt: Date;
  revokedAt?: Date;
}

/**
 * Decrypted transaction data
 */
export interface DecryptedTransactionData {
  sender: string;
  recipient: string;
  amount: string;
  timestamp: number;
  txSignature?: string;
}

/**
 * Disclosure Service
 * 
 * Manages selective transaction disclosure to auditors with encrypted data
 * and time-limited access.
 * 
 * Features:
 * - Encrypt transaction data with auditor's public key
 * - Decrypt disclosed data with viewing key
 * - List disclosures for auditor
 * - Revoke disclosures
 * - Enforce expiration validation
 * 
 * Requirements: 14.1, 14.2, 14.3, 14.4, 15.1, 15.2, 15.4
 */
export class DisclosureService {
  private sipherClient: SipherClient;
  private database: SupabaseClient;

  constructor(
    sipherClient: SipherClient,
    database: SupabaseClient
  ) {
    this.sipherClient = sipherClient;
    this.database = database;
  }

  /**
   * Encrypt transaction data for disclosure to auditor
   * 
   * @param transactionData - Transaction data to disclose
   * @param viewingKey - Viewing key for disclosure
   * @param auditorPublicKey - Auditor's public key for encryption
   * @returns Encrypted data, key hash, and expiration
   */
  async encrypt(
    transactionData: any,
    viewingKey: ViewingKey,
    auditorPublicKey: string
  ): Promise<{
    encrypted: string;
    keyHash: string;
    expiresAt: Date;
  }> {
    try {
      logger.info('Encrypting transaction data for disclosure', {
        viewingKeyHash: viewingKey.hash,
        auditorPublicKey: auditorPublicKey.substring(0, 10) + '...'
      });

      // Call Sipher API to encrypt data with viewing key
      const result = await this.sipherClient.disclose({
        viewingKey,
        transactionData
      });

      // Calculate expiration (default 30 days)
      const expirationDays = parseInt(
        process.env.VIEWING_KEY_EXPIRATION_DAYS || '30',
        10
      );
      const expiresAt = new Date(Date.now() + expirationDays * 24 * 60 * 60 * 1000);

      // Log audit event
      await this.logDisclosureEvent({
        event_type: 'encryption',
        actor: auditorPublicKey,
        resource_type: 'disclosure',
        resource_id: result.keyHash,
        action: 'encrypt_transaction_data',
        result: 'success',
        metadata: {
          viewingKeyHash: viewingKey.hash,
          expiresAt: expiresAt.toISOString(),
          transactionFields: Object.keys(transactionData)
        },
        timestamp: new Date().toISOString()
      });

      logger.info('Transaction data encrypted successfully', {
        keyHash: result.keyHash,
        expiresAt
      });

      return {
        encrypted: result.encrypted,
        keyHash: result.keyHash,
        expiresAt: new Date(result.expiresAt)
      };
    } catch (error) {
      // Log failed encryption attempt
      await this.logDisclosureEvent({
        event_type: 'encryption',
        actor: auditorPublicKey,
        resource_type: 'disclosure',
        resource_id: viewingKey.hash,
        action: 'encrypt_transaction_data',
        result: 'failure',
        metadata: {
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString()
      });
      
      logger.error('Failed to encrypt transaction data', { error });
      throw error;
    }
  }

  /**
   * Decrypt disclosed transaction data with viewing key
   * 
   * @param encrypted - Encrypted transaction data
   * @param viewingKey - Viewing key for decryption
   * @returns Decrypted transaction data
   */
  async decrypt(
    encrypted: string,
    viewingKey: ViewingKey
  ): Promise<DecryptedTransactionData> {
    try {
      logger.info('Decrypting disclosed transaction data', {
        viewingKeyHash: viewingKey.hash
      });

      // Call Sipher API to decrypt data with viewing key
      const decrypted = await this.sipherClient.decrypt({
        viewingKey,
        encrypted
      });

      // Log successful decryption
      await this.logDisclosureEvent({
        event_type: 'decryption',
        actor: viewingKey.hash,
        resource_type: 'disclosure',
        resource_id: encrypted.substring(0, 20) + '...',
        action: 'decrypt_transaction_data',
        result: 'success',
        metadata: {
          viewingKeyHash: viewingKey.hash,
          viewingKeyPath: viewingKey.path,
          decryptedFields: ['sender', 'recipient', 'amount', 'timestamp']
        },
        timestamp: new Date().toISOString()
      });

      logger.info('Transaction data decrypted successfully');

      return {
        sender: decrypted.sender,
        recipient: decrypted.recipient,
        amount: decrypted.amount,
        timestamp: decrypted.timestamp,
        txSignature: decrypted.txSignature
      };
    } catch (error) {
      // Log failed decryption attempt
      await this.logDisclosureEvent({
        event_type: 'decryption',
        actor: viewingKey.hash,
        resource_type: 'disclosure',
        resource_id: encrypted.substring(0, 20) + '...',
        action: 'decrypt_transaction_data',
        result: 'failure',
        metadata: {
          viewingKeyHash: viewingKey.hash,
          error: error instanceof Error ? error.message : 'Unknown error'
        },
        timestamp: new Date().toISOString()
      });
      
      logger.error('Failed to decrypt transaction data', { error });
      throw error;
    }
  }

  /**
   * List all disclosures for an auditor
   * 
   * @param auditorId - Auditor identifier
   * @returns Array of disclosure records
   */
  async listDisclosures(auditorId: string): Promise<DisclosureRecord[]> {
    try {
      logger.info(`Listing disclosures for auditor: ${auditorId}`);

      const { data, error } = await this.database
        .from('disclosures')
        .select('*')
        .eq('auditor_id', auditorId)
        .is('revoked_at', null)
        .order('created_at', { ascending: false });

      if (error) {
        throw error;
      }

      const records = (data || []).map(this.mapToRecord);

      logger.info(`Found ${records.length} disclosures for auditor ${auditorId}`);

      return records;
    } catch (error) {
      logger.error('Failed to list disclosures', { error, auditorId });
      throw error;
    }
  }

  /**
   * Revoke a disclosure
   * 
   * @param disclosureId - Disclosure ID to revoke
   */
  async revokeDisclosure(disclosureId: number): Promise<void> {
    try {
      logger.info(`Revoking disclosure: ${disclosureId}`);

      const { error } = await this.database
        .from('disclosures')
        .update({ revoked_at: new Date().toISOString() })
        .eq('id', disclosureId);

      if (error) {
        throw error;
      }

      // Log revocation event
      await this.logDisclosureEvent({
        type: 'revocation',
        disclosureId,
        timestamp: new Date()
      });

      logger.info(`Disclosure revoked: ${disclosureId}`);
    } catch (error) {
      logger.error('Failed to revoke disclosure', { error, disclosureId });
      throw error;
    }
  }

  /**
   * Validate disclosure expiration
   * 
   * @param expiresAt - Expiration timestamp
   * @returns True if not expired
   */
  async validateExpiration(expiresAt: Date): Promise<boolean> {
    const now = new Date();
    const isValid = expiresAt > now;

    if (!isValid) {
      logger.warn('Disclosure has expired', {
        expiresAt,
        now
      });
    }

    return isValid;
  }

  /**
   * Log disclosure event to immutable audit log
   * 
   * SECURITY FIX (VULN-004): Implement proper audit logging
   * 
   * @param event - Audit log entry
   */
  private async logDisclosureEvent(event: AuditLogEntry): Promise<void> {
    try {
      // Write to dedicated audit log table (append-only)
      const { error } = await this.database
        .from('audit_log')
        .insert({
          event_type: event.event_type,
          actor: event.actor,
          resource_type: event.resource_type,
          resource_id: event.resource_id,
          action: event.action,
          result: event.result,
          ip_address: event.ip_address,
          user_agent: event.user_agent,
          metadata: event.metadata,
          timestamp: event.timestamp
        });

      if (error) {
        // Audit logging failure is CRITICAL - must not be silent
        logger.error('CRITICAL: Audit log write failed', { error, event });
        
        // Alert security team
        await this.alertSecurityTeam('Audit log write failure', { error, event });
        
        // In production, consider failing the operation if audit log fails
        // For now, we'll log the error but not throw to avoid breaking operations
        // Uncomment the following line for strict audit enforcement:
        // throw new Error('Audit logging failed - operation aborted for compliance');
      } else {
        logger.info('Audit event logged successfully', {
          eventType: event.event_type,
          actor: event.actor,
          resourceType: event.resource_type
        });
      }
    } catch (error) {
      logger.error('Failed to log audit event', { error, event });
      // In production with strict compliance, re-throw the error
      // throw error;
    }
  }

  /**
   * Alert security team of critical events
   * 
   * @param message - Alert message
   * @param context - Alert context
   */
  private async alertSecurityTeam(message: string, context: any): Promise<void> {
    // Implement alerting (PagerDuty, Slack, email, etc.)
    logger.error(`SECURITY ALERT: ${message}`, context);
    
    // TODO: Integrate with alerting system
    // Examples:
    // - Send to PagerDuty
    // - Post to Slack security channel
    // - Send email to security team
    // - Trigger incident response workflow
  }

  /**
   * Map database row to DisclosureRecord
   * 
   * @param data - Database row
   * @returns Disclosure record
   */
  private mapToRecord(data: any): DisclosureRecord {
    return {
      id: data.id,
      transactionId: data.transaction_id,
      auditorId: data.auditor_id,
      viewingKeyHash: data.viewing_key_hash,
      encryptedData: data.encrypted_data,
      disclosedFields: data.disclosed_fields,
      expiresAt: new Date(data.expires_at),
      createdAt: new Date(data.created_at),
      revokedAt: data.revoked_at ? new Date(data.revoked_at) : undefined
    };
  }
}

/**
 * Singleton instance
 */
let disclosureServiceInstance: DisclosureService | null = null;

/**
 * Initialize DisclosureService singleton
 * 
 * @param sipherClient - Sipher API client
 * @param database - Supabase client
 * @returns DisclosureService instance
 */
export function initializeDisclosureService(
  sipherClient: SipherClient,
  database: SupabaseClient
): DisclosureService {
  disclosureServiceInstance = new DisclosureService(
    sipherClient,
    database
  );
  return disclosureServiceInstance;
}

/**
 * Get DisclosureService singleton
 * 
 * @returns DisclosureService instance
 * @throws Error if not initialized
 */
export function getDisclosureService(): DisclosureService {
  if (!disclosureServiceInstance) {
    throw new Error('DisclosureService not initialized. Call initializeDisclosureService first.');
  }
  return disclosureServiceInstance;
}
