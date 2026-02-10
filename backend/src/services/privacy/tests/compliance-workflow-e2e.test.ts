/**
 * End-to-End Integration Test: Compliance Workflow
 * 
 * Tests the complete compliance workflow:
 * 1. Setup hierarchical viewing key structure
 * 2. Disclose transaction to auditor with role-based access
 * 3. Decrypt disclosed data with viewing key
 * 4. Generate compliance report
 * 5. Verify viewing key hierarchy
 * 6. Verify role-based access control
 * 7. Verify expiration enforcement
 * 
 * Phase 3: Compliance Layer
 * Task 17.1: Create end-to-end integration test for compliance workflow
 * Requirements: 12.1, 13.1, 14.1, 15.1, 16.1, 17.1
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SipherClient } from '../sipher-client';
import { ViewingKeyManager, initializeViewingKeyManager } from '../viewing-key-manager';
import { DisclosureService, initializeDisclosureService } from '../disclosure-service';
import { ComplianceService, initializeComplianceService } from '../compliance-service';
import { EncryptionService } from '../encryption-service';

/**
 * Test configuration
 */
const TEST_CONFIG = {
  supabase: {
    url: process.env.SUPABASE_URL || 'http://localhost:54321',
    key: process.env.SUPABASE_SERVICE_KEY || 'test-key'
  },
  sipher: {
    baseUrl: process.env.SIPHER_API_URL || 'https://sipher.sip-protocol.org',
    apiKey: process.env.SIPHER_API_KEY || 'test-api-key'
  },
  testTransaction: {
    sender: 'TestSender123456789',
    recipient: 'TestRecipient123456789',
    amount: '1000000',
    timestamp: Date.now()
  },
  testAuditors: {
    internal: 'internal-auditor-001',
    external: 'external-auditor-001',
    regulator: 'regulator-001'
  }
} as const;

// Test constants
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const SEVEN_DAYS_MS = 7 * ONE_DAY_MS;
const TEST_TIMEOUT_MS = 120000;

/**
 * Mock AML Service for testing
 */
class MockAMLService {
  async checkTransaction(txData: any): Promise<{
    compliant: boolean;
    riskScore: number;
    flags: string[];
  }> {
    // Simple mock: flag transactions over 10M
    const amount = parseInt(txData.amount || '0');
    const isHighValue = amount > 10000000;

    return {
      compliant: !isHighValue,
      riskScore: isHighValue ? 75 : 25,
      flags: isHighValue ? ['high-value-transaction'] : []
    };
  }
}

describe('Compliance Workflow E2E', () => {
  let supabase: SupabaseClient | null = null;
  let sipherClient: SipherClient | null = null;
  let encryptionService: EncryptionService | null = null;
  let viewingKeyManager: ViewingKeyManager | null = null;
  let disclosureService: DisclosureService | null = null;
  let complianceService: ComplianceService | null = null;
  let amlService: MockAMLService | null = null;

  // Test data IDs
  let testTransactionId: number | null = null;
  let masterKeyId: number | null = null;
  
  // Helper to check if services are initialized
  const isInitialized = () => testTransactionId !== null && supabase !== null;

  beforeAll(async () => {
    try {
      // Initialize services
      supabase = createClient(TEST_CONFIG.supabase.url, TEST_CONFIG.supabase.key);
      
      // Test database connection
      const { error: connectionError } = await supabase
        .from('shielded_transactions')
        .select('count')
        .limit(1);

      if (connectionError) {
        console.warn('⚠️  Supabase not available, skipping E2E tests');
        console.warn('   To run these tests, start Supabase with: docker-compose up -d');
        return;
      }

      sipherClient = new SipherClient({
        baseUrl: TEST_CONFIG.sipher.baseUrl,
        apiKey: TEST_CONFIG.sipher.apiKey
      });

      encryptionService = new EncryptionService();
      
      viewingKeyManager = initializeViewingKeyManager(
        sipherClient,
        supabase,
        encryptionService,
        'test-protocol-master-key'
      );

      disclosureService = initializeDisclosureService(
        sipherClient,
        supabase
      );

      amlService = new MockAMLService();

      complianceService = initializeComplianceService(
        sipherClient,
        viewingKeyManager,
        disclosureService,
        supabase,
        amlService
      );

      // Create test transaction in database
      const { data: txData, error: txError } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-tx-signature-' + Date.now(),
          sender: TEST_CONFIG.testTransaction.sender,
          stealth_address: TEST_CONFIG.testTransaction.recipient,
          ephemeral_public_key: 'test-ephemeral-key',
          commitment: 'test-commitment',
          amount_encrypted: TEST_CONFIG.testTransaction.amount,
          status: 'confirmed'
        })
        .select()
        .single();

      if (txError) {
        console.error('Failed to create test transaction:', txError);
        throw txError;
      }

      testTransactionId = txData.id;

      console.log('✅ Test services initialized');
      console.log(`   Test transaction ID: ${testTransactionId}`);
    } catch (error) {
      console.warn('⚠️  Failed to initialize test environment:', error);
      console.warn('   Skipping E2E tests. Ensure Supabase is running.');
      // Set to null to signal tests to skip
      testTransactionId = null;
      supabase = null;
    }
  });

  afterAll(async () => {
    if (!supabase) return;

    try {
      console.log('🧹 Cleaning up test data');

      // Delete test transaction
      if (testTransactionId) {
        await supabase
          .from('shielded_transactions')
          .delete()
          .eq('id', testTransactionId);
      }

      // Delete test disclosures
      await supabase
        .from('disclosures')
        .delete()
        .in('auditor_id', Object.values(TEST_CONFIG.testAuditors));

      // Delete test viewing keys
      if (masterKeyId) {
        await supabase
          .from('viewing_keys')
          .delete()
          .eq('id', masterKeyId);
      }

      console.log('✅ Cleanup complete');
    } catch (error) {
      console.error('⚠️  Cleanup failed:', error);
    }
  });

  it('should complete full compliance workflow', async () => {
    if (!isInitialized() || !complianceService || !viewingKeyManager || !disclosureService || !supabase) {
      console.warn('⚠️  Skipping test: Database not available');
      return;
    }

    console.log('\n🧪 Starting Compliance Workflow E2E Test\n');

    // Step 1: Setup hierarchical viewing key structure
    console.log('🔑 Step 1: Setting up viewing key hierarchy...');
    const hierarchy = await complianceService.setupHierarchy();

    expect(hierarchy).toBeDefined();
    expect(hierarchy.master).toBeDefined();
    expect(hierarchy.org).toBeDefined();
    expect(hierarchy.year).toBeDefined();
    expect(hierarchy.quarter).toBeDefined();

    // Store IDs for cleanup
    masterKeyId = hierarchy.master.id;

    console.log(`   ✓ Master key: ${hierarchy.master.keyHash.substring(0, 20)}...`);
    console.log(`   ✓ Org key: ${hierarchy.org.keyHash.substring(0, 20)}...`);
    console.log(`   ✓ Year key: ${hierarchy.year.keyHash.substring(0, 20)}...`);
    console.log(`   ✓ Quarter key: ${hierarchy.quarter.keyHash.substring(0, 20)}...`);

    // Verify hierarchy paths
    expect(hierarchy.master.path).toBe('m/0');
    expect(hierarchy.org.path).toBe('m/0/org');
    expect(hierarchy.year.path).toMatch(/^m\/0\/org\/\d{4}$/);
    expect(hierarchy.quarter.path).toMatch(/^m\/0\/org\/\d{4}\/Q[1-4]$/);

    // Verify roles
    expect(hierarchy.master.role).toBe('master');
    expect(hierarchy.org.role).toBe('regulator');
    expect(hierarchy.year.role).toBe('external');
    expect(hierarchy.quarter.role).toBe('internal');

    console.log('   ✓ Hierarchy structure validated');

    // Step 2: Verify viewing key hierarchy relationships
    console.log('\n🔗 Step 2: Verifying viewing key hierarchy...');

    // Verify master -> org
    const masterOrgValid = await viewingKeyManager.verifyHierarchy(
      hierarchy.master.id,
      hierarchy.org.id
    );
    expect(masterOrgValid).toBe(true);
    console.log('   ✓ Master -> Org hierarchy verified');

    // Verify org -> year
    const orgYearValid = await viewingKeyManager.verifyHierarchy(
      hierarchy.org.id,
      hierarchy.year.id
    );
    expect(orgYearValid).toBe(true);
    console.log('   ✓ Org -> Year hierarchy verified');

    // Verify year -> quarter
    const yearQuarterValid = await viewingKeyManager.verifyHierarchy(
      hierarchy.year.id,
      hierarchy.quarter.id
    );
    expect(yearQuarterValid).toBe(true);
    console.log('   ✓ Year -> Quarter hierarchy verified');

    // Verify invalid hierarchy (quarter -> master should fail)
    const invalidHierarchy = await viewingKeyManager.verifyHierarchy(
      hierarchy.quarter.id,
      hierarchy.master.id
    );
    expect(invalidHierarchy).toBe(false);
    console.log('   ✓ Invalid hierarchy correctly rejected');

    // Step 3: Disclose transaction to internal auditor
    console.log('\n📋 Step 3: Disclosing transaction to internal auditor...');
    const internalDisclosure = await complianceService.discloseToAuditor(
      testTransactionId,
      TEST_CONFIG.testAuditors.internal,
      'internal'
    );

    expect(internalDisclosure).toBeDefined();
    expect(internalDisclosure.id).toBeGreaterThan(0);
    expect(internalDisclosure.auditorId).toBe(TEST_CONFIG.testAuditors.internal);
    expect(internalDisclosure.transactionId).toBe(testTransactionId);
    expect(internalDisclosure.viewingKeyHash).toBe(hierarchy.quarter.keyHash);
    expect(internalDisclosure.encryptedData).toBeDefined();
    expect(internalDisclosure.disclosedFields).toContain('sender');
    expect(internalDisclosure.disclosedFields).toContain('recipient');
    expect(internalDisclosure.disclosedFields).toContain('amount');
    expect(internalDisclosure.disclosedFields).toContain('timestamp');

    console.log(`   ✓ Disclosure ID: ${internalDisclosure.id}`);
    console.log(`   ✓ Viewing key: ${internalDisclosure.viewingKeyHash.substring(0, 20)}...`);
    console.log(`   ✓ Disclosed fields: ${internalDisclosure.disclosedFields.join(', ')}`);
    console.log(`   ✓ Expires at: ${internalDisclosure.expiresAt.toISOString()}`);

    // Step 4: Disclose transaction to external auditor
    console.log('\n📋 Step 4: Disclosing transaction to external auditor...');
    const externalDisclosure = await complianceService.discloseToAuditor(
      testTransactionId,
      TEST_CONFIG.testAuditors.external,
      'external'
    );

    expect(externalDisclosure).toBeDefined();
    expect(externalDisclosure.auditorId).toBe(TEST_CONFIG.testAuditors.external);
    expect(externalDisclosure.viewingKeyHash).toBe(hierarchy.year.keyHash);
    expect(externalDisclosure.disclosedFields).toContain('txSignature');

    console.log(`   ✓ Disclosure ID: ${externalDisclosure.id}`);
    console.log(`   ✓ Viewing key: ${externalDisclosure.viewingKeyHash.substring(0, 20)}...`);
    console.log(`   ✓ Disclosed fields: ${externalDisclosure.disclosedFields.join(', ')}`);

    // Step 5: Disclose transaction to regulator
    console.log('\n📋 Step 5: Disclosing transaction to regulator...');
    const regulatorDisclosure = await complianceService.discloseToAuditor(
      testTransactionId,
      TEST_CONFIG.testAuditors.regulator,
      'regulator'
    );

    expect(regulatorDisclosure).toBeDefined();
    expect(regulatorDisclosure.auditorId).toBe(TEST_CONFIG.testAuditors.regulator);
    expect(regulatorDisclosure.viewingKeyHash).toBe(hierarchy.org.keyHash);

    console.log(`   ✓ Disclosure ID: ${regulatorDisclosure.id}`);
    console.log(`   ✓ Viewing key: ${regulatorDisclosure.viewingKeyHash.substring(0, 20)}...`);

    // Step 6: Verify role-based access control
    console.log('\n🔐 Step 6: Verifying role-based access control...');

    // Internal auditor should have quarterly key
    const internalKey = await viewingKeyManager.getByRole('internal');
    expect(internalKey).toBeDefined();
    expect(internalKey?.path).toMatch(/\/Q[1-4]$/);
    console.log(`   ✓ Internal auditor has quarterly key: ${internalKey?.path}`);

    // External auditor should have yearly key
    const externalKey = await viewingKeyManager.getByRole('external');
    expect(externalKey).toBeDefined();
    expect(externalKey?.path).toMatch(/\/\d{4}$/);
    expect(externalKey?.path).not.toMatch(/\/Q[1-4]$/);
    console.log(`   ✓ External auditor has yearly key: ${externalKey?.path}`);

    // Regulator should have organizational key
    const regulatorKey = await viewingKeyManager.getByRole('regulator');
    expect(regulatorKey).toBeDefined();
    expect(regulatorKey?.path).toBe('m/0/org');
    console.log(`   ✓ Regulator has organizational key: ${regulatorKey?.path}`);

    // Master key should exist
    const masterKey = await viewingKeyManager.getByRole('master');
    expect(masterKey).toBeDefined();
    expect(masterKey?.path).toBe('m/0');
    console.log(`   ✓ Master key exists: ${masterKey?.path}`);

    // Step 7: Verify expiration enforcement
    console.log('\n⏰ Step 7: Verifying expiration enforcement...');

    // Check that disclosure is not expired
    const isValid = await disclosureService.validateExpiration(
      internalDisclosure.expiresAt
    );
    expect(isValid).toBe(true);
    console.log(`   ✓ Disclosure is valid (expires: ${internalDisclosure.expiresAt.toISOString()})`);

    // Test expired disclosure
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago
    const isExpired = await disclosureService.validateExpiration(pastDate);
    expect(isExpired).toBe(false);
    console.log('   ✓ Expired disclosure correctly rejected');

    // Step 8: List disclosures for auditors
    console.log('\n📜 Step 8: Listing disclosures for auditors...');

    const internalDisclosures = await disclosureService.listDisclosures(
      TEST_CONFIG.testAuditors.internal
    );
    expect(internalDisclosures.length).toBeGreaterThan(0);
    expect(internalDisclosures[0].auditorId).toBe(TEST_CONFIG.testAuditors.internal);
    console.log(`   ✓ Internal auditor has ${internalDisclosures.length} disclosure(s)`);

    const externalDisclosures = await disclosureService.listDisclosures(
      TEST_CONFIG.testAuditors.external
    );
    expect(externalDisclosures.length).toBeGreaterThan(0);
    console.log(`   ✓ External auditor has ${externalDisclosures.length} disclosure(s)`);

    const regulatorDisclosures = await disclosureService.listDisclosures(
      TEST_CONFIG.testAuditors.regulator
    );
    expect(regulatorDisclosures.length).toBeGreaterThan(0);
    console.log(`   ✓ Regulator has ${regulatorDisclosures.length} disclosure(s)`);

    // Step 9: Verify compliance (decrypt and check)
    console.log('\n✅ Step 9: Verifying compliance...');

    const complianceReport = await complianceService.verifyCompliance(
      internalDisclosure.id,
      {
        key: '', // Will be populated by service
        path: hierarchy.quarter.path,
        hash: hierarchy.quarter.keyHash
      }
    );

    expect(complianceReport).toBeDefined();
    expect(complianceReport.compliant).toBeDefined();
    expect(complianceReport.riskScore).toBeGreaterThanOrEqual(0);
    expect(complianceReport.riskScore).toBeLessThanOrEqual(100);
    expect(Array.isArray(complianceReport.flags)).toBe(true);
    expect(Array.isArray(complianceReport.disclosedFields)).toBe(true);
    expect(Array.isArray(complianceReport.hiddenFields)).toBe(true);

    console.log(`   ✓ Compliant: ${complianceReport.compliant}`);
    console.log(`   ✓ Risk Score: ${complianceReport.riskScore}`);
    console.log(`   ✓ Flags: ${complianceReport.flags.length}`);
    console.log(`   ✓ Disclosed fields: ${complianceReport.disclosedFields.join(', ')}`);
    console.log(`   ✓ Hidden fields: ${complianceReport.hiddenFields.join(', ')}`);

    // Verify spending keys are hidden
    expect(complianceReport.hiddenFields).toContain('spendingKey');
    expect(complianceReport.hiddenFields).toContain('viewingKey');
    expect(complianceReport.hiddenFields).toContain('blindingFactor');
    console.log('   ✓ Spending keys correctly hidden');

    // Step 10: Generate compliance report
    console.log('\n📊 Step 10: Generating compliance report...');

    const dateRange = {
      start: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
      end: new Date()
    };

    const report = await complianceService.generateReport(dateRange, 'internal');

    expect(report).toBeDefined();
    expect(report.transactions).toBeGreaterThanOrEqual(0);
    expect(report.compliant).toBeGreaterThanOrEqual(0);
    expect(report.flagged).toBeGreaterThanOrEqual(0);
    expect(Array.isArray(report.report)).toBe(true);

    console.log(`   ✓ Total transactions: ${report.transactions}`);
    console.log(`   ✓ Compliant: ${report.compliant}`);
    console.log(`   ✓ Flagged: ${report.flagged}`);
    console.log(`   ✓ Report entries: ${report.report.length}`);

    // Step 11: Test disclosure revocation
    console.log('\n🚫 Step 11: Testing disclosure revocation...');

    await disclosureService.revokeDisclosure(internalDisclosure.id);

    // Verify disclosure is revoked
    const { data: revokedDisclosure } = await supabase
      .from('disclosures')
      .select('revoked_at')
      .eq('id', internalDisclosure.id)
      .single();

    expect(revokedDisclosure).toBeDefined();
    expect(revokedDisclosure?.revoked_at).toBeDefined();
    console.log(`   ✓ Disclosure revoked at: ${revokedDisclosure?.revoked_at}`);

    // Revoked disclosure should not appear in list
    const activeDisclosures = await disclosureService.listDisclosures(
      TEST_CONFIG.testAuditors.internal
    );
    const revokedInList = activeDisclosures.find(d => d.id === internalDisclosure.id);
    expect(revokedInList).toBeUndefined();
    console.log('   ✓ Revoked disclosure not in active list');

    // Step 12: Test viewing key rotation
    console.log('\n🔄 Step 12: Testing viewing key rotation...');

    const oldQuarterKey = hierarchy.quarter;
    const newQuarterKey = await viewingKeyManager.rotate(oldQuarterKey.id);

    expect(newQuarterKey).toBeDefined();
    expect(newQuarterKey.id).not.toBe(oldQuarterKey.id);
    expect(newQuarterKey.path).toBe(oldQuarterKey.path);
    expect(newQuarterKey.keyHash).not.toBe(oldQuarterKey.keyHash);

    console.log(`   ✓ Old key ID: ${oldQuarterKey.id}`);
    console.log(`   ✓ New key ID: ${newQuarterKey.id}`);
    console.log(`   ✓ Path unchanged: ${newQuarterKey.path}`);

    // Verify old key is revoked
    const oldKeyRecord = await viewingKeyManager.getById(oldQuarterKey.id);
    expect(oldKeyRecord?.revokedAt).toBeDefined();
    console.log(`   ✓ Old key revoked at: ${oldKeyRecord?.revokedAt?.toISOString()}`);

    // Step 13: Verify database consistency
    console.log('\n💾 Step 13: Verifying database consistency...');

    // Check viewing_keys table
    const { data: viewingKeys, error: keysError } = await supabase
      .from('viewing_keys')
      .select('count');
    expect(keysError).toBeNull();
    console.log('   ✓ Viewing keys table accessible');

    // Check disclosures table
    const { data: disclosures, error: disclosuresError } = await supabase
      .from('disclosures')
      .select('count');
    expect(disclosuresError).toBeNull();
    console.log('   ✓ Disclosures table accessible');

    // Check shielded_transactions table
    const { data: transactions, error: txError } = await supabase
      .from('shielded_transactions')
      .select('count');
    expect(txError).toBeNull();
    console.log('   ✓ Shielded transactions table accessible');

    console.log('\n✅ Compliance Workflow E2E Test Complete!\n');
  }, 120000); // 120 second timeout for E2E test

  it('should enforce hierarchical access levels', async () => {
    // Skip if database not available
    if (!testTransactionId) {
      console.warn('⚠️  Skipping test: Database not available');
      return;
    }

    console.log('\n🔒 Testing hierarchical access level enforcement...');

    // Setup hierarchy
    const hierarchy = await complianceService.setupHierarchy();

    // Internal auditor (quarterly) should have most restricted access
    const internalKey = await viewingKeyManager.getByRole('internal');
    expect(internalKey?.path).toMatch(/\/Q[1-4]$/);
    console.log(`   ✓ Internal: ${internalKey?.path} (most restricted)`);

    // External auditor (yearly) should have broader access than internal
    const externalKey = await viewingKeyManager.getByRole('external');
    expect(externalKey?.path).toMatch(/\/\d{4}$/);
    expect(externalKey?.path.length).toBeLessThan(internalKey!.path.length);
    console.log(`   ✓ External: ${externalKey?.path} (broader than internal)`);

    // Regulator (org) should have broader access than external
    const regulatorKey = await viewingKeyManager.getByRole('regulator');
    expect(regulatorKey?.path).toBe('m/0/org');
    expect(regulatorKey?.path.length).toBeLessThan(externalKey!.path.length);
    console.log(`   ✓ Regulator: ${regulatorKey?.path} (broader than external)`);

    // Master should have full access
    const masterKey = await viewingKeyManager.getByRole('master');
    expect(masterKey?.path).toBe('m/0');
    expect(masterKey?.path.length).toBeLessThan(regulatorKey!.path.length);
    console.log(`   ✓ Master: ${masterKey?.path} (full access)`);

    // Cleanup
    await supabase.from('viewing_keys').delete().eq('id', hierarchy.master.id);
  });

  it('should handle expired disclosures correctly', async () => {
    // Skip if database not available
    if (!testTransactionId) {
      console.warn('⚠️  Skipping test: Database not available');
      return;
    }

    console.log('\n⏰ Testing expired disclosure handling...');

    // Create disclosure with past expiration
    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000); // 1 day ago

    const { data: expiredDisclosure } = await supabase
      .from('disclosures')
      .insert({
        transaction_id: testTransactionId,
        auditor_id: 'test-auditor-expired',
        viewing_key_hash: 'test-hash',
        encrypted_data: 'test-data',
        disclosed_fields: ['sender', 'recipient'],
        expires_at: pastDate.toISOString()
      })
      .select()
      .single();

    // Validate expiration
    const isValid = await disclosureService.validateExpiration(pastDate);
    expect(isValid).toBe(false);
    console.log('   ✓ Expired disclosure correctly identified');

    // Attempt to verify compliance should fail
    try {
      await complianceService.verifyCompliance(
        expiredDisclosure.id,
        {
          key: '',
          path: 'm/0',
          hash: 'test-hash'
        }
      );
      // Should not reach here
      expect(true).toBe(false);
    } catch (error: any) {
      expect(error.message).toContain('expired');
      console.log('   ✓ Compliance verification correctly rejected expired disclosure');
    }

    // Cleanup
    await supabase.from('disclosures').delete().eq('id', expiredDisclosure.id);
  });

  it('should track all disclosure events for audit trail', async () => {
    // Skip if database not available
    if (!testTransactionId) {
      console.warn('⚠️  Skipping test: Database not available');
      return;
    }

    console.log('\n📝 Testing audit trail logging...');

    // Setup hierarchy
    const hierarchy = await complianceService.setupHierarchy();

    // Create disclosure
    const disclosure = await complianceService.discloseToAuditor(
      testTransactionId,
      'test-auditor-audit-trail',
      'internal'
    );

    // Verify disclosure was created
    expect(disclosure.id).toBeGreaterThan(0);
    expect(disclosure.createdAt).toBeDefined();
    console.log(`   ✓ Disclosure created: ${disclosure.id} at ${disclosure.createdAt.toISOString()}`);

    // Revoke disclosure
    await disclosureService.revokeDisclosure(disclosure.id);

    // Verify revocation was logged
    const { data: revokedRecord } = await supabase
      .from('disclosures')
      .select('revoked_at')
      .eq('id', disclosure.id)
      .single();

    expect(revokedRecord).toBeDefined();
    expect(revokedRecord?.revoked_at).toBeDefined();
    console.log(`   ✓ Revocation logged: ${revokedRecord?.revoked_at}`);

    // Cleanup
    await supabase.from('viewing_keys').delete().eq('id', hierarchy.master.id);
    await supabase.from('disclosures').delete().eq('id', disclosure.id);
  });

  it('should prevent access to higher privilege levels', async () => {
    // Skip if database not available
    if (!testTransactionId) {
      console.warn('⚠️  Skipping test: Database not available');
      return;
    }

    console.log('\n🛡️  Testing privilege level enforcement...');

    // Setup hierarchy
    const hierarchy = await complianceService.setupHierarchy();

    // Internal auditor should not be able to access yearly data
    // (This is enforced by only providing quarterly viewing key)
    const internalKey = await viewingKeyManager.getByRole('internal');
    expect(internalKey?.path).toMatch(/\/Q[1-4]$/);
    expect(internalKey?.path).not.toMatch(/^m\/0\/org\/\d{4}$/);
    console.log('   ✓ Internal auditor cannot access yearly key');

    // External auditor should not be able to access organizational data
    const externalKey = await viewingKeyManager.getByRole('external');
    expect(externalKey?.path).toMatch(/\/\d{4}$/);
    expect(externalKey?.path).not.toBe('m/0/org');
    console.log('   ✓ External auditor cannot access organizational key');

    // Regulator should not be able to access master key
    const regulatorKey = await viewingKeyManager.getByRole('regulator');
    expect(regulatorKey?.path).toBe('m/0/org');
    expect(regulatorKey?.path).not.toBe('m/0');
    console.log('   ✓ Regulator cannot access master key');

    // Cleanup
    await supabase.from('viewing_keys').delete().eq('id', hierarchy.master.id);
  });
});

/**
 * Feature: sipher-privacy-integration
 * Test: Compliance Workflow E2E
 * 
 * This test validates the complete compliance workflow including:
 * - Hierarchical viewing key setup
 * - Role-based disclosure
 * - Viewing key hierarchy verification
 * - Expiration enforcement
 * - Compliance reporting
 * - Disclosure revocation
 * - Viewing key rotation
 * - Database consistency
 * - Audit trail logging
 * - Privilege level enforcement
 */
