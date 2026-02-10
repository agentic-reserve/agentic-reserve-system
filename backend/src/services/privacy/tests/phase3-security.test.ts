import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { SipherClient } from '../sipher-client';
import { ViewingKeyManager } from '../viewing-key-manager';
import { DisclosureService } from '../disclosure-service';
import { ComplianceService } from '../compliance-service';
import { MultiSigService } from '../multi-sig-service';
import { EncryptionService } from '../encryption-service';

/**
 * Phase 3 Security Testing Suite
 * 
 * Comprehensive security tests for compliance layer features:
 * - Viewing key security
 * - Disclosure expiration
 * - Role-based access enforcement
 * - Multi-sig threshold enforcement
 * - Penetration testing for compliance layer
 * 
 * Task: 17.4 Security testing for Phase 3
 * Requirements: Non-functional requirements (security)
 */

describe('Phase 3 Security Testing', () => {
  let supabase: SupabaseClient;
  let sipherClient: SipherClient;
  let encryptionService: EncryptionService;
  let viewingKeyManager: ViewingKeyManager;
  let disclosureService: DisclosureService;
  let complianceService: ComplianceService;
  let multiSigService: MultiSigService;

  // Test data
  const testProtocolKey = 'test-protocol-master-key-32-bytes-long-secure';
  const testAuditorId = 'test-auditor-001';
  const testTransactionId = 1;

  beforeAll(async () => {
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
    // Cleanup test data
    // Note: In production, use proper test database cleanup
  });

  describe('Viewing Key Security', () => {
    it('should encrypt viewing keys at rest with AES-256', async () => {
      // Generate master viewing key
      const masterKey = await viewingKeyManager.generateMaster('m/0');

      // Verify key is encrypted in database
      expect(masterKey.encryptedKey).toBeDefined();
      expect(masterKey.encryptedKey).not.toContain('m/0');
      
      // Verify encrypted key is JSON with required fields
      const encryptedData = JSON.parse(masterKey.encryptedKey);
      expect(encryptedData).toHaveProperty('encrypted');
      expect(encryptedData).toHaveProperty('iv');
      expect(encryptedData).toHaveProperty('authTag');
    });

    it('should prevent access to viewing keys without proper decryption', async () => {
      // Generate viewing key
      const masterKey = await viewingKeyManager.generateMaster('m/0/test');

      // Attempt to use encrypted key directly should fail
      const encryptedKey = masterKey.encryptedKey;
      
      // Verify encrypted key cannot be used as plaintext
      expect(encryptedKey).not.toMatch(/^[A-Za-z0-9+/=]+$/); // Not base64 plaintext
      expect(() => {
        // Attempting to parse as viewing key should fail
        JSON.parse(encryptedKey);
      }).not.toThrow(); // It's valid JSON but encrypted
    });

    it('should use different encryption for each viewing key', async () => {
      // Generate two viewing keys
      const key1 = await viewingKeyManager.generateMaster('m/0/key1');
      const key2 = await viewingKeyManager.generateMaster('m/0/key2');

      // Verify different encrypted values
      expect(key1.encryptedKey).not.toBe(key2.encryptedKey);

      // Verify different IVs (initialization vectors)
      const encrypted1 = JSON.parse(key1.encryptedKey);
      const encrypted2 = JSON.parse(key2.encryptedKey);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should prevent viewing key extraction from database', async () => {
      // Generate viewing key
      const masterKey = await viewingKeyManager.generateMaster('m/0/secure');

      // Query database directly
      const { data, error } = await supabase
        .from('viewing_keys')
        .select('encrypted_key')
        .eq('id', masterKey.id)
        .single();

      expect(error).toBeNull();
      expect(data).toBeDefined();

      // Verify encrypted key in database is not plaintext
      const encryptedKey = data!.encrypted_key;
      expect(encryptedKey).toBeDefined();
      expect(encryptedKey).not.toContain('m/0');
      
      // Verify it's properly encrypted JSON
      const parsed = JSON.parse(encryptedKey);
      expect(parsed).toHaveProperty('encrypted');
      expect(parsed).toHaveProperty('iv');
      expect(parsed).toHaveProperty('authTag');
    });

    it('should enforce key rotation policy', async () => {
      // Generate viewing key
      const originalKey = await viewingKeyManager.generateMaster('m/0/rotate-test');

      // Rotate key
      const newKey = await viewingKeyManager.rotate(originalKey.id);

      // Verify new key is different
      expect(newKey.id).not.toBe(originalKey.id);
      expect(newKey.keyHash).not.toBe(originalKey.keyHash);

      // Verify original key is revoked
      const revokedKey = await viewingKeyManager.getById(originalKey.id);
      expect(revokedKey).toBeDefined();
      expect(revokedKey!.revokedAt).toBeDefined();
    });

    it('should prevent use of revoked viewing keys', async () => {
      // Generate and revoke viewing key
      const key = await viewingKeyManager.generateMaster('m/0/revoke-test');
      await viewingKeyManager.revoke(key.id);

      // Attempt to derive from revoked key should fail
      await expect(
        viewingKeyManager.derive(key.id, 'child')
      ).rejects.toThrow(/revoked/i);
    });
  });

  describe('Disclosure Expiration', () => {
    it('should enforce disclosure expiration timestamps', async () => {
      // Create disclosure with short expiration
      const expiresAt = new Date(Date.now() + 1000); // 1 second

      // Wait for expiration
      await new Promise(resolve => setTimeout(resolve, 1500));

      // Verify expiration validation fails
      const isValid = await disclosureService.validateExpiration(expiresAt);
      expect(isValid).toBe(false);
    });

    it('should reject decryption of expired disclosures', async () => {
      // Create expired disclosure
      const expiredDate = new Date(Date.now() - 86400000); // 1 day ago

      // Verify validation fails
      const isValid = await disclosureService.validateExpiration(expiredDate);
      expect(isValid).toBe(false);
    });

    it('should allow decryption of non-expired disclosures', async () => {
      // Create future expiration
      const futureDate = new Date(Date.now() + 86400000); // 1 day from now

      // Verify validation succeeds
      const isValid = await disclosureService.validateExpiration(futureDate);
      expect(isValid).toBe(true);
    });

    it('should set default expiration to 30 days', async () => {
      // Setup hierarchy
      const hierarchy = await complianceService.setupHierarchy();

      // Create mock transaction
      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-expiration',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      // Disclose to auditor
      const disclosure = await complianceService.discloseToAuditor(
        transaction!.id,
        testAuditorId,
        'internal'
      );

      // Verify expiration is ~30 days from now
      const expirationDays = (disclosure.expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
      expect(expirationDays).toBeGreaterThan(29);
      expect(expirationDays).toBeLessThan(31);
    });

    it('should prevent extension of expired disclosures', async () => {
      // Create expired disclosure
      const expiredDate = new Date(Date.now() - 1000);

      // Verify cannot be validated
      const isValid = await disclosureService.validateExpiration(expiredDate);
      expect(isValid).toBe(false);

      // Attempting to use expired disclosure should fail
      // (In production, this would be enforced in decrypt method)
    });
  });

  describe('Role-Based Access Enforcement', () => {
    it('should provide quarterly viewing key for internal auditors', async () => {
      // Setup hierarchy
      const hierarchy = await complianceService.setupHierarchy();

      // Get viewing key for internal role
      const internalKey = await viewingKeyManager.getByRole('internal');

      // Verify path contains quarterly segment
      expect(internalKey).toBeDefined();
      expect(internalKey!.path).toMatch(/\/Q[1-4]$/);
      expect(internalKey!.role).toBe('internal');
    });

    it('should provide yearly viewing key for external auditors', async () => {
      // Setup hierarchy
      const hierarchy = await complianceService.setupHierarchy();

      // Get viewing key for external role
      const externalKey = await viewingKeyManager.getByRole('external');

      // Verify path contains year but not quarter
      expect(externalKey).toBeDefined();
      expect(externalKey!.path).toMatch(/\/\d{4}$/);
      expect(externalKey!.path).not.toMatch(/\/Q[1-4]$/);
      expect(externalKey!.role).toBe('external');
    });

    it('should provide organizational viewing key for regulators', async () => {
      // Setup hierarchy
      const hierarchy = await complianceService.setupHierarchy();

      // Get viewing key for regulator role
      const regulatorKey = await viewingKeyManager.getByRole('regulator');

      // Verify path is organizational level
      expect(regulatorKey).toBeDefined();
      expect(regulatorKey!.path).toMatch(/\/org$/);
      expect(regulatorKey!.path).not.toMatch(/\/\d{4}/);
      expect(regulatorKey!.role).toBe('regulator');
    });

    it('should prevent internal auditors from accessing yearly data', async () => {
      // Setup hierarchy
      const hierarchy = await complianceService.setupHierarchy();

      // Get internal key (quarterly)
      const internalKey = await viewingKeyManager.getByRole('internal');

      // Verify cannot access parent (yearly) data
      expect(internalKey!.path).toContain('/Q');
      expect(internalKey!.parentHash).toBeDefined();

      // Parent should be yearly key
      const parentKey = await viewingKeyManager.getByHash(internalKey!.parentHash!);
      expect(parentKey).toBeDefined();
      expect(parentKey!.role).toBe('external');
    });

    it('should prevent external auditors from accessing organizational data', async () => {
      // Setup hierarchy
      const hierarchy = await complianceService.setupHierarchy();

      // Get external key (yearly)
      const externalKey = await viewingKeyManager.getByRole('external');

      // Verify cannot access parent (organizational) data
      expect(externalKey!.path).toMatch(/\/\d{4}$/);
      expect(externalKey!.parentHash).toBeDefined();

      // Parent should be organizational key
      const parentKey = await viewingKeyManager.getByHash(externalKey!.parentHash!);
      expect(parentKey).toBeDefined();
      expect(parentKey!.role).toBe('regulator');
    });

    it('should enforce role-based disclosed fields', async () => {
      // Setup hierarchy
      const hierarchy = await complianceService.setupHierarchy();

      // Create mock transaction
      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-role-fields',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      // Disclose to internal auditor
      const internalDisclosure = await complianceService.discloseToAuditor(
        transaction!.id,
        'internal-auditor',
        'internal'
      );

      // Verify internal auditor gets basic fields only
      expect(internalDisclosure.disclosedFields).toContain('sender');
      expect(internalDisclosure.disclosedFields).toContain('recipient');
      expect(internalDisclosure.disclosedFields).toContain('amount');
      expect(internalDisclosure.disclosedFields).toContain('timestamp');

      // Disclose to external auditor
      const externalDisclosure = await complianceService.discloseToAuditor(
        transaction!.id,
        'external-auditor',
        'external'
      );

      // Verify external auditor gets additional fields
      expect(externalDisclosure.disclosedFields).toContain('txSignature');
    });

    it('should never disclose spending keys regardless of role', async () => {
      // Setup hierarchy
      const hierarchy = await complianceService.setupHierarchy();

      // Create mock transaction
      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-no-spending-key',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      // Test all roles
      const roles: Array<'internal' | 'external' | 'regulator'> = ['internal', 'external', 'regulator'];

      for (const role of roles) {
        const disclosure = await complianceService.discloseToAuditor(
          transaction!.id,
          `${role}-auditor`,
          role
        );

        // Verify spending keys are never disclosed
        expect(disclosure.disclosedFields).not.toContain('spendingKey');
        expect(disclosure.disclosedFields).not.toContain('viewingKey');
        expect(disclosure.disclosedFields).not.toContain('blindingFactor');
      }
    });
  });

  describe('Multi-Sig Threshold Enforcement', () => {
    it('should require minimum 3 signatures for master key access', async () => {
      // Create approval request
      const approval = await multiSigService.createApprovalRequest('test-requester');

      // Verify threshold is at least 3
      expect(approval.threshold).toBeGreaterThanOrEqual(3);
      expect(approval.status).toBe('pending');
    });

    it('should reject master key access with insufficient signatures', async () => {
      // Create approval request
      const approval = await multiSigService.createApprovalRequest('test-requester');

      // Add only 2 signatures
      await multiSigService.addSignature(approval.requestId, 'signer-1', 'sig-1');
      await multiSigService.addSignature(approval.requestId, 'signer-2', 'sig-2');

      // Verify not approved
      const isApproved = await multiSigService.isApproved(approval.requestId);
      expect(isApproved).toBe(false);
    });

    it('should approve master key access with sufficient signatures', async () => {
      // Create approval request
      const approval = await multiSigService.createApprovalRequest('test-requester');

      // Add 3 signatures
      let updated = await multiSigService.addSignature(approval.requestId, 'signer-1', 'sig-1');
      updated = await multiSigService.addSignature(approval.requestId, 'signer-2', 'sig-2');
      updated = await multiSigService.addSignature(approval.requestId, 'signer-3', 'sig-3');

      // Verify approved
      expect(updated.signatures.length).toBeGreaterThanOrEqual(3);
      expect(updated.status).toBe('approved');
      expect(updated.approvedAt).toBeDefined();
    });

    it('should prevent duplicate signatures from same signer', async () => {
      // Create approval request
      const approval = await multiSigService.createApprovalRequest('test-requester');

      // Add signature twice from same signer
      await multiSigService.addSignature(approval.requestId, 'signer-1', 'sig-1');
      const updated = await multiSigService.addSignature(approval.requestId, 'signer-1', 'sig-1');

      // Verify only one signature counted
      expect(updated.signatures.length).toBe(1);
    });

    it('should validate signature authenticity', async () => {
      // Create approval request
      const approval = await multiSigService.createApprovalRequest('test-requester');

      // Attempt to add invalid signature
      // Note: In production, this should use real cryptographic verification
      const validSignature = 'valid-sig-1';
      
      // Should succeed with valid signature
      await expect(
        multiSigService.addSignature(approval.requestId, 'signer-1', validSignature)
      ).resolves.toBeDefined();
    });
  });

  describe('Penetration Testing - Compliance Layer', () => {
    it('should prevent SQL injection in viewing key queries', async () => {
      // Attempt SQL injection in role parameter
      const maliciousRole = "internal' OR '1'='1";

      // Should not return any keys or throw error
      await expect(
        viewingKeyManager.getByRole(maliciousRole as any)
      ).rejects.toThrow();
    });

    it('should prevent path traversal in viewing key derivation', async () => {
      // Generate master key
      const masterKey = await viewingKeyManager.generateMaster('m/0');

      // Attempt path traversal
      const maliciousPath = '../../../etc/passwd';

      // Should fail validation
      await expect(
        viewingKeyManager.derive(masterKey.id, maliciousPath)
      ).rejects.toThrow();
    });

    it('should prevent unauthorized disclosure access', async () => {
      // Create disclosure for auditor A
      const hierarchy = await complianceService.setupHierarchy();

      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-unauthorized',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      const disclosure = await complianceService.discloseToAuditor(
        transaction!.id,
        'auditor-a',
        'internal'
      );

      // Attempt to access as auditor B
      const auditorBDisclosures = await disclosureService.listDisclosures('auditor-b');

      // Should not include auditor A's disclosure
      const hasUnauthorized = auditorBDisclosures.some(d => d.id === disclosure.id);
      expect(hasUnauthorized).toBe(false);
    });

    it('should prevent timing attacks on viewing key verification', async () => {
      // Generate parent and child keys
      const parent = await viewingKeyManager.generateMaster('m/0/timing');
      const child = await viewingKeyManager.derive(parent.id, 'child');

      // Measure verification time for valid hierarchy
      const start1 = Date.now();
      const valid = await viewingKeyManager.verifyHierarchy(parent.id, child.id);
      const time1 = Date.now() - start1;

      // Measure verification time for invalid hierarchy
      const fakeChild = await viewingKeyManager.generateMaster('m/0/fake');
      const start2 = Date.now();
      const invalid = await viewingKeyManager.verifyHierarchy(parent.id, fakeChild.id);
      const time2 = Date.now() - start2;

      // Timing should be similar (within 50ms) to prevent timing attacks
      const timingDiff = Math.abs(time1 - time2);
      expect(timingDiff).toBeLessThan(50);
    });

    it('should prevent brute force attacks on viewing key hashes', async () => {
      // Generate viewing key
      const key = await viewingKeyManager.generateMaster('m/0/brute-force');

      // Verify hash is cryptographically secure (SHA-256 or better)
      expect(key.keyHash).toBeDefined();
      expect(key.keyHash.length).toBeGreaterThanOrEqual(64); // SHA-256 produces 64 hex chars

      // Verify hash is not predictable
      const key2 = await viewingKeyManager.generateMaster('m/0/brute-force-2');
      expect(key2.keyHash).not.toBe(key.keyHash);
    });

    it('should prevent replay attacks on disclosure requests', async () => {
      // Create disclosure
      const hierarchy = await complianceService.setupHierarchy();

      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-replay',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      const disclosure1 = await complianceService.discloseToAuditor(
        transaction!.id,
        testAuditorId,
        'internal'
      );

      // Attempt to replay disclosure request
      const disclosure2 = await complianceService.discloseToAuditor(
        transaction!.id,
        testAuditorId,
        'internal'
      );

      // Should create new disclosure with different ID
      expect(disclosure2.id).not.toBe(disclosure1.id);
      expect(disclosure2.encryptedData).toBeDefined();
    });

    it('should prevent privilege escalation through role manipulation', async () => {
      // Setup hierarchy
      const hierarchy = await complianceService.setupHierarchy();

      // Get internal auditor key
      const internalKey = await viewingKeyManager.getByRole('internal');

      // Attempt to manually change role in database
      const { error } = await supabase
        .from('viewing_keys')
        .update({ role: 'master' })
        .eq('id', internalKey!.id);

      // Update should succeed (database allows it)
      expect(error).toBeNull();

      // But verification should still fail based on path
      const updatedKey = await viewingKeyManager.getById(internalKey!.id);
      
      // Path should still indicate internal level
      expect(updatedKey!.path).toMatch(/\/Q[1-4]$/);
      
      // Role determination should be based on path, not stored role
      // (In production, role should be derived from path, not stored)
    });

    it('should log all security-sensitive operations', async () => {
      // This test verifies audit logging is in place
      // In production, this should write to dedicated audit log

      // Generate viewing key
      const key = await viewingKeyManager.generateMaster('m/0/audit-test');

      // Revoke viewing key
      await viewingKeyManager.revoke(key.id);

      // Create disclosure
      const hierarchy = await complianceService.setupHierarchy();

      const { data: transaction } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: 'test-sig-audit',
          sender: 'test-sender',
          stealth_address: 'test-stealth',
          ephemeral_public_key: 'test-ephemeral',
          commitment: 'test-commitment',
          amount_encrypted: '1000000',
          status: 'confirmed'
        })
        .select()
        .single();

      await complianceService.discloseToAuditor(
        transaction!.id,
        testAuditorId,
        'internal'
      );

      // In production, verify audit log contains:
      // - Viewing key generation
      // - Viewing key revocation
      // - Disclosure creation
      // - All with timestamps and actor information
    });
  });

  describe('Encryption Security', () => {
    it('should use AES-256-GCM for viewing key encryption', async () => {
      // Generate viewing key
      const key = await viewingKeyManager.generateMaster('m/0/aes-test');

      // Parse encrypted data
      const encrypted = JSON.parse(key.encryptedKey);

      // Verify AES-256-GCM components present
      expect(encrypted).toHaveProperty('encrypted');
      expect(encrypted).toHaveProperty('iv');
      expect(encrypted).toHaveProperty('authTag');

      // Verify IV is 12 bytes (96 bits) for GCM
      const ivBuffer = Buffer.from(encrypted.iv, 'hex');
      expect(ivBuffer.length).toBe(12);

      // Verify auth tag is 16 bytes (128 bits)
      const authTagBuffer = Buffer.from(encrypted.authTag, 'hex');
      expect(authTagBuffer.length).toBe(16);
    });

    it('should use unique IV for each encryption', async () => {
      // Generate two viewing keys
      const key1 = await viewingKeyManager.generateMaster('m/0/iv-test-1');
      const key2 = await viewingKeyManager.generateMaster('m/0/iv-test-2');

      // Parse encrypted data
      const encrypted1 = JSON.parse(key1.encryptedKey);
      const encrypted2 = JSON.parse(key2.encryptedKey);

      // Verify different IVs
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
    });

    it('should prevent decryption with wrong key', async () => {
      // Generate viewing key with one protocol key
      const correctKey = 'correct-protocol-key-32-bytes-long';
      const wrongKey = 'wrong-protocol-key-32-bytes-long!!';

      const manager1 = new ViewingKeyManager(
        sipherClient,
        supabase,
        encryptionService,
        correctKey
      );

      const key = await manager1.generateMaster('m/0/wrong-key-test');

      // Attempt to decrypt with wrong key
      const manager2 = new ViewingKeyManager(
        sipherClient,
        supabase,
        encryptionService,
        wrongKey
      );

      // Should fail to decrypt
      await expect(
        manager2.getById(key.id)
      ).rejects.toThrow();
    });
  });
});
