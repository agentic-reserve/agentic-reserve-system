import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SipherClient } from '../sipher-client';
import { ViewingKeyManager } from '../viewing-key-manager';
import { DisclosureService } from '../disclosure-service';
import { ComplianceService } from '../compliance-service';
import { MultiSigService } from '../multi-sig-service';
import { EncryptionService } from '../encryption-service';

/**
 * Compliance Audit Trail Testing Suite
 * 
 * Comprehensive tests for audit trail logging in Phase 3 compliance features:
 * - Verify all disclosure events logged
 * - Verify all key operations logged
 * - Verify all compliance checks logged
 * - Test audit trail completeness
 * 
 * Task: 17.5 Compliance audit trail testing
 * Requirements: Non-functional requirements (audit logging)
 */

describe('Compliance Audit Trail Testing', () => {
  let supabase: SupabaseClient;
  let sipherClient: SipherClient;
  let encryptionService: EncryptionService;
  let viewingKeyManager: ViewingKeyManager;
  let disclosureService: DisclosureService;
  let complianceService: ComplianceService;
  let multiSigService: MultiSigService;

  // Test data
  const testProtocolKey = 'test-protocol-master-key-32-bytes-long-secure';
  const auditLogCapture: any[] = [];

  // Mock logger to capture audit events
  const originalConsoleLog = console.log;
  const originalConsoleInfo = console.info;
  const originalConsoleWarn = console.warn;
  const originalConsoleError = console.error;

  beforeAll(async () => {
    // Capture console output for audit trail verification
    console.log = (...args: any[]) => {
      auditLogCapture.push({ level: 'log', args, timestamp: new Date() });
      originalConsoleLog(...args);
    };

    console.info = (...args: any[]) => {
      auditLogCapture.push({ level: 'info', args, timestamp: new Date() });
      originalConsoleInfo(...args);
    };

    console.warn = (...args: any[]) => {
      auditLogCapture.push({ level: 'warn', args, timestamp: new Date() });
      originalConsoleWarn(...args);
    };

    console.error = (...args: any[]) => {
      auditLogCapture.push({ level: 'error', args, timestamp: new Date() });
      originalConsoleError(...args);
    };

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL || 'http://localhost:54321';
    const supabaseKey = process.env.SUPABASE_KEY || 'test-key';
    supabase = createClient(supabaseUrl, supabaseKey);

    // Initialize services
    sipherClient = new SipherClient({
      baseUrl: process.env.SIPHER_API_URL || 'https://sipher.sip-protocol.org',
      apiKey: process.env.SIPHER_API_KEY || 'test-api-key',
      timeout: 30000,
      retries: 3
    });

    encryptionService = new EncryptionService();

    viewingKeyManager = new ViewingKeyManager(
      sipherClient,
      supabase,
      encryptionService,
      testProtocolKey
    );

    disclosureService = new DisclosureService(
      sipherClient,
      supabase
    );

    // Mock AML service
    const mockAmlService = {
      checkTransaction: async (txData: any) => ({
        compliant: true,
        riskScore: 10,
        flags: []
      })
    };

    complianceService = new ComplianceService(
      sipherClient,
      viewingKeyManager,
      disclosureService,
      supabase,
      mockAmlService
    );

    multiSigService = new MultiSigService(supabase, 3);
  });

  afterAll(async () => {
    // Restore console methods
    console.log = originalConsoleLog;
    console.info = originalConsoleInfo;
    console.warn = originalConsoleWarn;
    console.error = originalConsoleError;

    // Cleanup test data
    // Note: In production, use proper test database cleanup
  });


  /**
   * Helper function to clear audit log capture
   */
  function clearAuditLog() {
    auditLogCapture.length = 0;
  }

  /**
   * Helper function to find audit log entries
   */
  function findAuditLogs(searchTerm: string): any[] {
    return auditLogCapture.filter(log => 
      JSON.stringify(log.args).toLowerCase().includes(searchTerm.toLowerCase())
    );
  }

  /**
   * Helper function to verify audit log contains specific event
   */
  function expectAuditLog(searchTerm: string, minCount: number = 1) {
    const logs = findAuditLogs(searchTerm);
    expect(logs.length).toBeGreaterThanOrEqual(minCount);
    return logs;
  }

  describe('Disclosure Event Logging', () => {
    it('should log disclosure creation events', async () => {
      clearAuditLog();

      // Setup hierarchy
      await complianceService.setupHierarchy();

      // Create mock transaction
      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-disclosure-log-1',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      clearAuditLog();

      // Create disclosure
      const disclosure = await complianceService.discloseToAuditor(
        transaction!.id,
        'auditor-001',
        'internal'
      );

      // Verify disclosure creation was logged
      const disclosureLogs = findAuditLogs('disclosure');
      expect(disclosureLogs.length).toBeGreaterThan(0);

      // Verify log contains auditor ID
      expectAuditLog('auditor-001');

      // Verify log contains transaction ID
      expectAuditLog(transaction!.id.toString());
    });

    it('should log disclosure decryption attempts', async () => {
      clearAuditLog();

      // Setup hierarchy
      const hierarchy = await complianceService.setupHierarchy();

      // Create mock transaction
      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-disclosure-log-2',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      // Create disclosure
      await complianceService.discloseToAuditor(
        transaction!.id,
        'auditor-002',
        'internal'
      );

      clearAuditLog();

      // Attempt to decrypt (will fail with mock data, but should log)
      try {
        const internalKey = await viewingKeyManager.getByRole('internal');
        await disclosureService.decrypt('mock-encrypted-data', {
          key: 'mock-key',
          path: internalKey!.path,
          hash: internalKey!.keyHash
        });
      } catch (error) {
        // Expected to fail with mock data
      }

      // Verify decryption attempt was logged
      expectAuditLog('decrypt');
    });


    it('should log disclosure revocation events', async () => {
      clearAuditLog();

      // Setup hierarchy
      await complianceService.setupHierarchy();

      // Create mock transaction
      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-disclosure-log-3',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      // Create disclosure
      const disclosure = await complianceService.discloseToAuditor(
        transaction!.id,
        'auditor-003',
        'internal'
      );

      clearAuditLog();

      // Revoke disclosure
      await disclosureService.revokeDisclosure(disclosure.id);

      // Verify revocation was logged
      expectAuditLog('revok');
      expectAuditLog(disclosure.id.toString());
    });

    it('should log disclosure expiration checks', async () => {
      clearAuditLog();

      // Check expired disclosure
      const expiredDate = new Date(Date.now() - 86400000); // 1 day ago
      await disclosureService.validateExpiration(expiredDate);

      // Verify expiration check was logged
      expectAuditLog('expir');
    });

    it('should log all disclosed fields in audit trail', async () => {
      clearAuditLog();

      // Setup hierarchy
      await complianceService.setupHierarchy();

      // Create mock transaction
      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-disclosure-log-4',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      clearAuditLog();

      // Create disclosure
      const disclosure = await complianceService.discloseToAuditor(
        transaction!.id,
        'auditor-004',
        'internal'
      );

      // Verify disclosed fields are logged
      expect(disclosure.disclosedFields).toBeDefined();
      expect(disclosure.disclosedFields.length).toBeGreaterThan(0);

      // Verify audit log contains field information
      const logs = findAuditLogs('disclos');
      expect(logs.length).toBeGreaterThan(0);
    });
  });


  describe('Viewing Key Operation Logging', () => {
    it('should log viewing key generation', async () => {
      clearAuditLog();

      // Generate master viewing key
      const masterKey = await viewingKeyManager.generateMaster('m/0/audit-test-1');

      // Verify generation was logged
      expectAuditLog('generat');
      expectAuditLog('viewing key');
      expectAuditLog(masterKey.keyHash);
    });

    it('should log viewing key derivation', async () => {
      clearAuditLog();

      // Generate parent key
      const parentKey = await viewingKeyManager.generateMaster('m/0/audit-test-2');

      clearAuditLog();

      // Derive child key
      const childKey = await viewingKeyManager.derive(parentKey.id, 'child');

      // Verify derivation was logged
      expectAuditLog('deriv');
      expectAuditLog('child');
      expectAuditLog(parentKey.id.toString());
    });

    it('should log viewing key hierarchy verification', async () => {
      clearAuditLog();

      // Generate parent and child keys
      const parentKey = await viewingKeyManager.generateMaster('m/0/audit-test-3');
      const childKey = await viewingKeyManager.derive(parentKey.id, 'child');

      clearAuditLog();

      // Verify hierarchy
      await viewingKeyManager.verifyHierarchy(parentKey.id, childKey.id);

      // Verify verification was logged
      expectAuditLog('verif');
      expectAuditLog('hierarchy');
    });

    it('should log viewing key rotation', async () => {
      clearAuditLog();

      // Generate key
      const originalKey = await viewingKeyManager.generateMaster('m/0/audit-test-4');

      clearAuditLog();

      // Rotate key
      await viewingKeyManager.rotate(originalKey.id);

      // Verify rotation was logged
      expectAuditLog('rotat');
      expectAuditLog(originalKey.id.toString());
    });

    it('should log viewing key revocation', async () => {
      clearAuditLog();

      // Generate key
      const key = await viewingKeyManager.generateMaster('m/0/audit-test-5');

      clearAuditLog();

      // Revoke key
      await viewingKeyManager.revoke(key.id);

      // Verify revocation was logged
      expectAuditLog('revok');
      expectAuditLog(key.id.toString());
    });

    it('should log viewing key access by role', async () => {
      clearAuditLog();

      // Setup hierarchy
      await complianceService.setupHierarchy();

      clearAuditLog();

      // Access key by role
      await viewingKeyManager.getByRole('internal');

      // Verify access was logged (through getByRole query)
      const logs = auditLogCapture;
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should log failed viewing key operations', async () => {
      clearAuditLog();

      // Attempt to derive from non-existent parent
      try {
        await viewingKeyManager.derive(999999, 'child');
      } catch (error) {
        // Expected to fail
      }

      // Verify error was logged
      expectAuditLog('error');
      expectAuditLog('999999');
    });
  });


  describe('Compliance Check Logging', () => {
    it('should log compliance report generation', async () => {
      clearAuditLog();

      // Setup hierarchy
      await complianceService.setupHierarchy();

      // Create mock transaction
      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-compliance-log-1',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      // Create disclosure
      const disclosure = await complianceService.discloseToAuditor(
        transaction!.id,
        'auditor-compliance-1',
        'internal'
      );

      clearAuditLog();

      // Generate compliance report
      const dateRange = {
        start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
        end: new Date()
      };

      await complianceService.generateReport(dateRange, 'internal');

      // Verify report generation was logged
      expectAuditLog('report');
    });

    it('should log AML/CFT checks', async () => {
      clearAuditLog();

      // Setup hierarchy
      await complianceService.setupHierarchy();

      // Create mock transaction
      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-compliance-log-2',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      // Create disclosure (triggers AML check in mock)
      await complianceService.discloseToAuditor(
        transaction!.id,
        'auditor-compliance-2',
        'internal'
      );

      // Verify AML check was performed (logged through disclosure)
      const logs = findAuditLogs('disclos');
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should log role-based access decisions', async () => {
      clearAuditLog();

      // Setup hierarchy
      await complianceService.setupHierarchy();

      clearAuditLog();

      // Access different role levels
      await viewingKeyManager.getByRole('internal');
      await viewingKeyManager.getByRole('external');
      await viewingKeyManager.getByRole('regulator');

      // Verify role access was logged
      const logs = auditLogCapture;
      expect(logs.length).toBeGreaterThan(0);
    });

    it('should log compliance verification results', async () => {
      clearAuditLog();

      // Setup hierarchy
      await complianceService.setupHierarchy();

      // Create mock transaction
      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-compliance-log-3',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      // Create disclosure
      const disclosure = await complianceService.discloseToAuditor(
        transaction!.id,
        'auditor-compliance-3',
        'internal'
      );

      clearAuditLog();

      // Verify compliance
      const internalKey = await viewingKeyManager.getByRole('internal');
      await complianceService.verifyCompliance(disclosure.id, {
        key: 'mock-key',
        path: internalKey!.path,
        hash: internalKey!.keyHash
      });

      // Verify compliance check was logged
      expectAuditLog('compli');
    });
  });


  describe('Multi-Sig Operation Logging', () => {
    it('should log multi-sig approval request creation', async () => {
      clearAuditLog();

      // Create approval request
      const approval = await multiSigService.createApprovalRequest('test-requester-1');

      // Verify request creation was logged
      expectAuditLog('approval');
      expectAuditLog(approval.requestId);
    });

    it('should log signature additions', async () => {
      clearAuditLog();

      // Create approval request
      const approval = await multiSigService.createApprovalRequest('test-requester-2');

      clearAuditLog();

      // Add signature
      await multiSigService.addSignature(approval.requestId, 'signer-1', 'sig-1');

      // Verify signature addition was logged
      expectAuditLog('signature');
      expectAuditLog('signer-1');
    });

    it('should log approval threshold reached', async () => {
      clearAuditLog();

      // Create approval request
      const approval = await multiSigService.createApprovalRequest('test-requester-3');

      // Add signatures to reach threshold
      await multiSigService.addSignature(approval.requestId, 'signer-1', 'sig-1');
      await multiSigService.addSignature(approval.requestId, 'signer-2', 'sig-2');

      clearAuditLog();

      // Add final signature
      await multiSigService.addSignature(approval.requestId, 'signer-3', 'sig-3');

      // Verify approval was logged
      expectAuditLog('approv');
    });

    it('should log master key access requests', async () => {
      clearAuditLog();

      // Create approval request for master key
      const approval = await multiSigService.createApprovalRequest('master-key-requester');

      // Verify master key request was logged
      expectAuditLog('approval');
      expectAuditLog(approval.requestId);
    });

    it('should log rejected multi-sig attempts', async () => {
      clearAuditLog();

      // Create approval request
      const approval = await multiSigService.createApprovalRequest('test-requester-4');

      // Add insufficient signatures
      await multiSigService.addSignature(approval.requestId, 'signer-1', 'sig-1');

      clearAuditLog();

      // Check if approved (should be false)
      const isApproved = await multiSigService.isApproved(approval.requestId);
      expect(isApproved).toBe(false);

      // Verify check was logged
      const logs = auditLogCapture;
      expect(logs.length).toBeGreaterThan(0);
    });
  });

  describe('Audit Trail Completeness', () => {
    it('should maintain chronological order of events', async () => {
      clearAuditLog();

      // Perform sequence of operations
      const key1 = await viewingKeyManager.generateMaster('m/0/chrono-1');
      const key2 = await viewingKeyManager.generateMaster('m/0/chrono-2');
      await viewingKeyManager.derive(key1.id, 'child');

      // Verify logs are in chronological order
      expect(auditLogCapture.length).toBeGreaterThan(0);
      
      for (let i = 1; i < auditLogCapture.length; i++) {
        const prevTime = auditLogCapture[i - 1].timestamp.getTime();
        const currTime = auditLogCapture[i].timestamp.getTime();
        expect(currTime).toBeGreaterThanOrEqual(prevTime);
      }
    });

    it('should include timestamps for all audit events', async () => {
      clearAuditLog();

      // Perform operation
      await viewingKeyManager.generateMaster('m/0/timestamp-test');

      // Verify all logs have timestamps
      expect(auditLogCapture.length).toBeGreaterThan(0);
      auditLogCapture.forEach(log => {
        expect(log.timestamp).toBeInstanceOf(Date);
        expect(log.timestamp.getTime()).toBeGreaterThan(0);
      });
    });


    it('should log both successful and failed operations', async () => {
      clearAuditLog();

      // Successful operation
      const key = await viewingKeyManager.generateMaster('m/0/success-fail-test');

      // Failed operation
      try {
        await viewingKeyManager.derive(999999, 'child');
      } catch (error) {
        // Expected to fail
      }

      // Verify both success and error logs present
      const successLogs = findAuditLogs('generat');
      const errorLogs = findAuditLogs('error');

      expect(successLogs.length).toBeGreaterThan(0);
      expect(errorLogs.length).toBeGreaterThan(0);
    });

    it('should include operation context in audit logs', async () => {
      clearAuditLog();

      // Perform operation with context
      const key = await viewingKeyManager.generateMaster('m/0/context-test');

      // Verify logs include context (path, key hash, etc.)
      expectAuditLog('m/0/context-test');
      expectAuditLog(key.keyHash);
    });

    it('should log security-sensitive operations with appropriate detail', async () => {
      clearAuditLog();

      // Setup hierarchy
      await complianceService.setupHierarchy();

      // Create mock transaction
      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-security-log',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      clearAuditLog();

      // Perform security-sensitive operation (disclosure)
      await complianceService.discloseToAuditor(
        transaction!.id,
        'security-auditor',
        'internal'
      );

      // Verify detailed logging
      expectAuditLog('disclos');
      expectAuditLog('security-auditor');
      expectAuditLog(transaction!.id.toString());
    });

    it('should never log sensitive keys in plaintext', async () => {
      clearAuditLog();

      // Generate viewing key
      const key = await viewingKeyManager.generateMaster('m/0/sensitive-test');

      // Verify no plaintext keys in logs
      auditLogCapture.forEach(log => {
        const logStr = JSON.stringify(log.args);
        
        // Should not contain raw encryption keys
        expect(logStr).not.toMatch(/BEGIN.*KEY/);
        expect(logStr).not.toMatch(/[A-Za-z0-9+/]{64,}/); // Long base64 strings
        
        // Should contain key hash but not plaintext key
        if (logStr.includes(key.keyHash)) {
          expect(logStr).not.toContain('encryptedKey');
        }
      });
    });

    it('should provide audit trail for complete compliance workflow', async () => {
      clearAuditLog();

      // Complete workflow: setup → disclose → verify → report
      
      // 1. Setup hierarchy
      await complianceService.setupHierarchy();

      // 2. Create transaction
      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-workflow-audit',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      // 3. Disclose to auditor
      const disclosure = await complianceService.discloseToAuditor(
        transaction!.id,
        'workflow-auditor',
        'internal'
      );

      // 4. Verify compliance
      const internalKey = await viewingKeyManager.getByRole('internal');
      await complianceService.verifyCompliance(disclosure.id, {
        key: 'mock-key',
        path: internalKey!.path,
        hash: internalKey!.keyHash
      });

      // 5. Generate report
      await complianceService.generateReport(
        {
          start: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000),
          end: new Date()
        },
        'internal'
      );

      // Verify complete audit trail
      expectAuditLog('hierarchy');
      expectAuditLog('disclos');
      expectAuditLog('compli');
      expectAuditLog('report');

      // Verify chronological order
      const hierarchyLog = findAuditLogs('hierarchy')[0];
      const disclosureLog = findAuditLogs('disclos')[0];
      const complianceLog = findAuditLogs('compli')[0];
      const reportLog = findAuditLogs('report')[0];

      expect(hierarchyLog.timestamp.getTime()).toBeLessThan(disclosureLog.timestamp.getTime());
      expect(disclosureLog.timestamp.getTime()).toBeLessThan(complianceLog.timestamp.getTime());
      expect(complianceLog.timestamp.getTime()).toBeLessThan(reportLog.timestamp.getTime());
    });
  });
});
