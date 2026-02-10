import { SupabaseClient } from '@supabase/supabase-js';
import { SipherClient, ViewingKey } from './sipher-client';
import { ViewingKeyManager, ViewingKeyRecord, ViewingKeyRole } from './viewing-key-manager';
import { DisclosureService, DisclosureRecord } from './disclosure-service';

/**
 * Simple logger utility
 */
const logger = {
  info: (message: string, context?: any) => console.log(`[INFO] ${message}`, context || ''),
  warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context || ''),
  error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context || '')
};

/**
 * AML/CFT Service interface (placeholder)
 */
interface AMLService {
  checkTransaction(txData: any): Promise<{
    compliant: boolean;
    riskScore: number;
    flags: string[];
  }>;
}

/**
 * Viewing key hierarchy
 */
export interface ViewingKeyHierarchy {
  master: ViewingKeyRecord;
  org: ViewingKeyRecord;
  year: ViewingKeyRecord;
  quarter: ViewingKeyRecord;
}

/**
 * Compliance report
 */
export interface ComplianceReport {
  compliant: boolean;
  riskScore: number;
  flags: string[];
  disclosedFields: string[];
  hiddenFields: string[];
}

/**
 * Compliance Service
 * 
 * Manages hierarchical viewing keys and selective disclosure for regulatory compliance.
 * 
 * Features:
 * - Setup hierarchical viewing key structure
 * - Disclose transactions to auditors with role-based access
 * - Verify compliance with AML/CFT checks
 * - Generate compliance reports
 * - Role-based access control
 * 
 * Requirements: 12.1, 12.2, 14.1, 14.2, 16.1, 16.2, 16.3, 16.4, 17.1, 17.2
 */
export class ComplianceService {
  private sipherClient: SipherClient;
  private viewingKeyManager: ViewingKeyManager;
  private disclosureService: DisclosureService;
  private database: SupabaseClient;
  private amlService: AMLService;

  constructor(
    sipherClient: SipherClient,
    viewingKeyManager: ViewingKeyManager,
    disclosureService: DisclosureService,
    database: SupabaseClient,
    amlService: AMLService
  ) {
    this.sipherClient = sipherClient;
    this.viewingKeyManager = viewingKeyManager;
    this.disclosureService = disclosureService;
    this.database = database;
    this.amlService = amlService;
  }

  /**
   * Setup hierarchical viewing key structure
   * 
   * Creates the full hierarchy:
   * - m/0 (master)
   * - m/0/org (organizational)
   * - m/0/org/2026 (yearly)
   * - m/0/org/2026/Q1 (quarterly)
   * 
   * @returns Viewing key hierarchy
   */
  async setupHierarchy(): Promise<ViewingKeyHierarchy> {
    try {
      logger.info('Setting up viewing key hierarchy');

      // Generate master key (m/0)
      const master = await this.viewingKeyManager.generateMaster('m/0');
      logger.info(`Master key created: ${master.keyHash}`);

      // Derive organizational key (m/0/org)
      const org = await this.viewingKeyManager.derive(master.id, 'org');
      logger.info(`Organizational key created: ${org.keyHash}`);

      // Derive yearly key (m/0/org/2026)
      const currentYear = new Date().getFullYear();
      const year = await this.viewingKeyManager.derive(org.id, currentYear.toString());
      logger.info(`Yearly key created: ${year.keyHash}`);

      // Derive quarterly key (m/0/org/2026/Q1)
      const currentQuarter = Math.ceil((new Date().getMonth() + 1) / 3);
      const quarter = await this.viewingKeyManager.derive(year.id, `Q${currentQuarter}`);
      logger.info(`Quarterly key created: ${quarter.keyHash}`);

      const hierarchy = { master, org, year, quarter };

      logger.info('Viewing key hierarchy setup complete');

      return hierarchy;
    } catch (error) {
      logger.error('Failed to setup viewing key hierarchy', { error });
      throw error;
    }
  }

  /**
   * Disclose transaction to auditor with role-based viewing key
   * 
   * @param transactionId - Transaction ID to disclose
   * @param auditorId - Auditor identifier
   * @param role - Auditor role (internal, external, regulator)
   * @returns Disclosure record
   */
  async discloseToAuditor(
    transactionId: number,
    auditorId: string,
    role: 'internal' | 'external' | 'regulator'
  ): Promise<DisclosureRecord> {
    try {
      logger.info('Disclosing transaction to auditor', {
        transactionId,
        auditorId,
        role
      });

      // Get transaction data
      const transaction = await this.getTransaction(transactionId);
      if (!transaction) {
        throw new Error(`Transaction not found: ${transactionId}`);
      }

      // Get appropriate viewing key for role
      const viewingKey = await this.getViewingKeyForRole(role);
      if (!viewingKey) {
        throw new Error(`No viewing key found for role: ${role}`);
      }

      // Encrypt transaction data with viewing key
      const { encrypted, keyHash, expiresAt } = await this.disclosureService.encrypt(
        transaction,
        {
          key: '', // Will be populated by disclosure service
          path: viewingKey.path,
          hash: viewingKey.keyHash
        },
        auditorId // Using auditorId as public key placeholder
      );

      // Determine disclosed fields based on role
      const disclosedFields = this.getDisclosedFieldsForRole(role);

      // Store disclosure in database
      const { data, error } = await this.database
        .from('disclosures')
        .insert({
          transaction_id: transactionId,
          auditor_id: auditorId,
          viewing_key_hash: keyHash,
          encrypted_data: encrypted,
          disclosed_fields: disclosedFields,
          expires_at: expiresAt.toISOString()
        })
        .select()
        .single();

      if (error) {
        throw error;
      }

      logger.info('Transaction disclosed successfully', {
        disclosureId: data.id,
        auditorId,
        expiresAt
      });

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
    } catch (error) {
      logger.error('Failed to disclose transaction', { error, transactionId, auditorId, role });
      throw error;
    }
  }

  /**
   * Verify compliance for a disclosure
   * 
   * @param disclosureId - Disclosure ID
   * @param viewingKey - Viewing key for decryption
   * @returns Compliance report
   */
  async verifyCompliance(
    disclosureId: number,
    viewingKey: ViewingKey
  ): Promise<ComplianceReport> {
    try {
      logger.info('Verifying compliance for disclosure', { disclosureId });

      // Get disclosure
      const { data: disclosure, error } = await this.database
        .from('disclosures')
        .select('*')
        .eq('id', disclosureId)
        .single();

      if (error || !disclosure) {
        throw new Error(`Disclosure not found: ${disclosureId}`);
      }

      // Check expiration
      const isValid = await this.disclosureService.validateExpiration(
        new Date(disclosure.expires_at)
      );
      if (!isValid) {
        throw new Error(`Disclosure has expired: ${disclosureId}`);
      }

      // Decrypt transaction data
      const decrypted = await this.disclosureService.decrypt(
        disclosure.encrypted_data,
        viewingKey
      );

      // Run AML/CFT checks
      const amlResult = await this.amlService.checkTransaction(decrypted);

      // Determine hidden fields
      const allFields = ['sender', 'recipient', 'amount', 'timestamp', 'txSignature', 'spendingKey', 'viewingKey', 'blindingFactor'];
      const hiddenFields = allFields.filter(
        field => !disclosure.disclosed_fields.includes(field)
      );

      const report: ComplianceReport = {
        compliant: amlResult.compliant,
        riskScore: amlResult.riskScore,
        flags: amlResult.flags,
        disclosedFields: disclosure.disclosed_fields,
        hiddenFields
      };

      logger.info('Compliance verification complete', {
        disclosureId,
        compliant: report.compliant,
        riskScore: report.riskScore
      });

      return report;
    } catch (error) {
      logger.error('Failed to verify compliance', { error, disclosureId });
      throw error;
    }
  }

  /**
   * Generate compliance report for date range
   * 
   * @param dateRange - Start and end dates
   * @param role - Auditor role
   * @returns Compliance report summary
   */
  async generateReport(
    dateRange: { start: Date; end: Date },
    role: string
  ): Promise<{
    transactions: number;
    compliant: number;
    flagged: number;
    report: ComplianceReport[];
  }> {
    try {
      logger.info('Generating compliance report', { dateRange, role });

      // Get viewing key for role
      const viewingKey = await this.getViewingKeyForRole(role as ViewingKeyRole);
      if (!viewingKey) {
        throw new Error(`No viewing key found for role: ${role}`);
      }

      // Get disclosures in date range
      const { data: disclosures, error } = await this.database
        .from('disclosures')
        .select('*')
        .gte('created_at', dateRange.start.toISOString())
        .lte('created_at', dateRange.end.toISOString())
        .eq('viewing_key_hash', viewingKey.keyHash)
        .is('revoked_at', null);

      if (error) {
        throw error;
      }

      // Verify compliance for each disclosure
      const reports: ComplianceReport[] = [];
      let compliantCount = 0;
      let flaggedCount = 0;

      for (const disclosure of disclosures || []) {
        try {
          const report = await this.verifyCompliance(
            disclosure.id,
            {
              key: '', // Will be populated by service
              path: viewingKey.path,
              hash: viewingKey.keyHash
            }
          );

          reports.push(report);

          if (report.compliant) {
            compliantCount++;
          }
          if (report.flags.length > 0) {
            flaggedCount++;
          }
        } catch (error) {
          logger.warn('Failed to verify disclosure in report', {
            disclosureId: disclosure.id,
            error
          });
        }
      }

      const summary = {
        transactions: disclosures?.length || 0,
        compliant: compliantCount,
        flagged: flaggedCount,
        report: reports
      };

      logger.info('Compliance report generated', summary);

      return summary;
    } catch (error) {
      logger.error('Failed to generate compliance report', { error, dateRange, role });
      throw error;
    }
  }

  /**
   * Get viewing key for role
   * 
   * @param role - Auditor role
   * @returns Viewing key record
   */
  private async getViewingKeyForRole(role: ViewingKeyRole): Promise<ViewingKeyRecord | null> {
    try {
      return await this.viewingKeyManager.getByRole(role);
    } catch (error) {
      logger.error('Failed to get viewing key for role', { error, role });
      throw error;
    }
  }

  /**
   * Get transaction by ID
   * 
   * @param transactionId - Transaction ID
   * @returns Transaction data
   */
  private async getTransaction(transactionId: number): Promise<any> {
    try {
      const { data, error } = await this.database
        .from('shielded_transactions')
        .select('*')
        .eq('id', transactionId)
        .single();

      if (error) {
        throw error;
      }

      return {
        sender: data.sender,
        recipient: data.stealth_address,
        amount: data.amount_encrypted,
        timestamp: new Date(data.created_at).getTime(),
        txSignature: data.tx_signature
      };
    } catch (error) {
      logger.error('Failed to get transaction', { error, transactionId });
      throw error;
    }
  }

  /**
   * Get disclosed fields for role
   * 
   * @param role - Auditor role
   * @returns Array of disclosed field names
   */
  private getDisclosedFieldsForRole(role: ViewingKeyRole): string[] {
    switch (role) {
      case 'internal':
        // Internal auditors see basic transaction info
        return ['sender', 'recipient', 'amount', 'timestamp'];

      case 'external':
        // External auditors see more details
        return ['sender', 'recipient', 'amount', 'timestamp', 'txSignature'];

      case 'regulator':
        // Regulators see all transaction data (but not spending keys)
        return ['sender', 'recipient', 'amount', 'timestamp', 'txSignature'];

      case 'master':
        // Master key has full access (emergency only)
        return ['sender', 'recipient', 'amount', 'timestamp', 'txSignature'];

      default:
        return ['sender', 'recipient', 'amount', 'timestamp'];
    }
  }
}

/**
 * Singleton instance
 */
let complianceServiceInstance: ComplianceService | null = null;

/**
 * Initialize ComplianceService singleton
 * 
 * @param sipherClient - Sipher API client
 * @param viewingKeyManager - Viewing key manager
 * @param disclosureService - Disclosure service
 * @param database - Supabase client
 * @param amlService - AML/CFT service
 * @returns ComplianceService instance
 */
export function initializeComplianceService(
  sipherClient: SipherClient,
  viewingKeyManager: ViewingKeyManager,
  disclosureService: DisclosureService,
  database: SupabaseClient,
  amlService: AMLService
): ComplianceService {
  complianceServiceInstance = new ComplianceService(
    sipherClient,
    viewingKeyManager,
    disclosureService,
    database,
    amlService
  );
  return complianceServiceInstance;
}

/**
 * Get ComplianceService singleton
 * 
 * @returns ComplianceService instance
 * @throws Error if not initialized
 */
export function getComplianceService(): ComplianceService {
  if (!complianceServiceInstance) {
    throw new Error('ComplianceService not initialized. Call initializeComplianceService first.');
  }
  return complianceServiceInstance;
}
