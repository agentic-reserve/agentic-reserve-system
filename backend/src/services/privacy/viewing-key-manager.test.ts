import { describe, it, expect, beforeEach, vi } from 'vitest';
import { ViewingKeyManager, ViewingKeyRole } from './viewing-key-manager';
import { SipherClient } from './sipher-client';
import { EncryptionService } from './encryption-service';
import { SupabaseClient } from '@supabase/supabase-js';

/**
 * Unit tests for ViewingKeyManager
 * 
 * Tests cover:
 * - Master key generation
 * - Child key derivation
 * - Hierarchy verification
 * - Key retrieval (by ID, hash, role)
 * - Key rotation
 * - Key revocation
 * - Role determination
 * - Expiration calculation
 * 
 * Requirements: 12.1, 12.2, 12.3, 12.5, 13.1, 13.2
 */

describe('ViewingKeyManager', () => {
  let manager: ViewingKeyManager;
  let mockSipherClient: any;
  let mockDatabase: any;
  let mockEncryption: any;

  beforeEach(() => {
    // Mock SipherClient
    mockSipherClient = {
      generateViewingKey: vi.fn(),
      deriveViewingKey: vi.fn(),
      verifyKeyHierarchy: vi.fn()
    };

    // Mock Supabase client with proper chaining
    const mockInsertChain = {
      select: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null })
    };
    
    const mockSelectChain = {
      eq: vi.fn().mockReturnThis(),
      single: vi.fn().mockResolvedValue({ data: null, error: null }),
      is: vi.fn().mockReturnThis(),
      order: vi.fn().mockReturnThis(),
      limit: vi.fn().mockReturnThis()
    };
    
    const mockUpdateChain = {
      eq: vi.fn().mockResolvedValue({ error: null })
    };

    mockDatabase = {
      from: vi.fn(() => ({
        insert: vi.fn(() => mockInsertChain),
        select: vi.fn(() => mockSelectChain),
        update: vi.fn(() => mockUpdateChain)
      }))
    };

    // Mock EncryptionService
    mockEncryption = {
      encrypt: vi.fn((plaintext: string) => ({
        encrypted: 'encrypted_' + plaintext,
        iv: 'mock_iv',
        tag: 'mock_tag',
        salt: 'mock_salt'
      })),
      decrypt: vi.fn((encrypted: any) => {
        const parsed = typeof encrypted === 'string' ? JSON.parse(encrypted) : encrypted;
        return parsed.encrypted.replace('encrypted_', '');
      })
    };

    manager = new ViewingKeyManager(
      mockSipherClient as any,
      mockDatabase as any,
      mockEncryption as any,
      'test-master-key'
    );
  });

  describe('generateMaster', () => {
    it('should generate master viewing key with default path', async () => {
      // Mock Sipher API response
      mockSipherClient.generateViewingKey.mockResolvedValue({
        key: 'master_viewing_key_123',
        path: 'm/0',
        hash: 'hash_master_123'
      });

      // Mock database insert
      const mockDbResponse = {
        id: 1,
        key_hash: 'hash_master_123',
        encrypted_key: JSON.stringify({
          encrypted: 'encrypted_master_viewing_key_123',
          iv: 'mock_iv',
          tag: 'mock_tag',
          salt: 'mock_salt'
        }),
        path: 'm/0',
        parent_hash: null,
        role: 'master',
        expires_at: null,
        created_at: new Date().toISOString(),
        revoked_at: null
      };

      // Get the mock chain and set up the response
      const fromResult = mockDatabase.from('viewing_keys');
      const insertResult = fromResult.insert({});
      insertResult.single.mockResolvedValue({
        data: mockDbResponse,
        error: null
      });

      const result = await manager.generateMaster();

      expect(mockSipherClient.generateViewingKey).toHaveBeenCalledWith('m/0');
      expect(mockEncryption.encrypt).toHaveBeenCalledWith('master_viewing_key_123', 'test-master-key');
      expect(result.path).toBe('m/0');
      expect(result.role).toBe('master');
      expect(result.expiresAt).toBeUndefined();
    });

    it('should generate master viewing key with custom path', async () => {
      mockSipherClient.generateViewingKey.mockResolvedValue({
        key: 'custom_key',
        path: 'm/1',
        hash: 'hash_custom'
      });

      const fromResult = mockDatabase.from('viewing_keys');
      const insertResult = fromResult.insert({});
      insertResult.single.mockResolvedValue({
        data: {
          id: 2,
          key_hash: 'hash_custom',
          encrypted_key: '{}',
          path: 'm/1',
          parent_hash: null,
          role: 'internal',
          expires_at: null,
          created_at: new Date().toISOString(),
          revoked_at: null
        },
        error: null
      });

      await manager.generateMaster('m/1');

      expect(mockSipherClient.generateViewingKey).toHaveBeenCalledWith('m/1');
    });

    it('should reject invalid path format', async () => {
      await expect(manager.generateMaster('invalid/path')).rejects.toThrow(
        'Invalid path format: invalid/path. Must start with \'m/\''
      );
    });
  });

  describe('derive', () => {
    it('should derive child viewing key from parent', async () => {
      // Mock parent key retrieval
      const parentRecord = {
        id: 1,
        keyHash: 'hash_parent',
        encryptedKey: JSON.stringify({
          encrypted: 'encrypted_parent_key',
          iv: 'iv',
          tag: 'tag',
          salt: 'salt'
        }),
        path: 'm/0',
        parentHash: undefined,
        role: 'master' as ViewingKeyRole,
        createdAt: new Date(),
        revokedAt: undefined
      };

      vi.spyOn(manager, 'getById').mockResolvedValue(parentRecord);

      // Mock Sipher API derive
      mockSipherClient.deriveViewingKey.mockResolvedValue({
        key: 'child_key',
        path: 'm/0/org',
        hash: 'hash_child'
      });

      // Mock database insert
      const fromResult = mockDatabase.from('viewing_keys');
      const insertResult = fromResult.insert({});
      insertResult.single.mockResolvedValue({
        data: {
          id: 2,
          key_hash: 'hash_child',
          encrypted_key: '{}',
          path: 'm/0/org',
          parent_hash: 'hash_parent',
          role: 'regulator',
          expires_at: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
          created_at: new Date().toISOString(),
          revoked_at: null
        },
        error: null
      });

      const result = await manager.derive(1, 'org');

      expect(mockSipherClient.deriveViewingKey).toHaveBeenCalledWith(
        {
          key: 'parent_key',
          path: 'm/0',
          hash: 'hash_parent'
        },
        'org'
      );
      expect(result.path).toBe('m/0/org');
      expect(result.role).toBe('regulator');
      expect(result.parentHash).toBe('hash_parent');
    });

    it('should reject derivation from revoked parent', async () => {
      const revokedParent = {
        id: 1,
        keyHash: 'hash_revoked',
        encryptedKey: '{}',
        path: 'm/0',
        parentHash: undefined,
        role: 'master' as ViewingKeyRole,
        createdAt: new Date(),
        revokedAt: new Date()
      };

      vi.spyOn(manager, 'getById').mockResolvedValue(revokedParent);

      await expect(manager.derive(1, 'org')).rejects.toThrow(
        'Cannot derive from revoked key: 1'
      );
    });

    it('should reject derivation from non-existent parent', async () => {
      vi.spyOn(manager, 'getById').mockResolvedValue(null);

      await expect(manager.derive(999, 'org')).rejects.toThrow(
        'Parent viewing key not found: 999'
      );
    });
  });

  describe('verifyHierarchy', () => {
    it('should verify valid parent-child hierarchy', async () => {
      const parent = {
        id: 1,
        keyHash: 'hash_parent',
        encryptedKey: JSON.stringify({
          encrypted: 'encrypted_parent_key',
          iv: 'iv',
          tag: 'tag',
          salt: 'salt'
        }),
        path: 'm/0',
        parentHash: undefined,
        role: 'master' as ViewingKeyRole,
        createdAt: new Date(),
        revokedAt: undefined
      };

      const child = {
        id: 2,
        keyHash: 'hash_child',
        encryptedKey: JSON.stringify({
          encrypted: 'encrypted_child_key',
          iv: 'iv',
          tag: 'tag',
          salt: 'salt'
        }),
        path: 'm/0/org',
        parentHash: 'hash_parent',
        role: 'regulator' as ViewingKeyRole,
        createdAt: new Date(),
        revokedAt: undefined
      };

      vi.spyOn(manager, 'getById')
        .mockResolvedValueOnce(parent)
        .mockResolvedValueOnce(child);

      mockSipherClient.verifyKeyHierarchy.mockResolvedValue(true);

      const result = await manager.verifyHierarchy(1, 2);

      expect(result).toBe(true);
      expect(mockSipherClient.verifyKeyHierarchy).toHaveBeenCalledWith({
        parentKey: {
          key: 'parent_key',
          path: 'm/0',
          hash: 'hash_parent'
        },
        childKey: {
          key: 'child_key',
          path: 'm/0/org',
          hash: 'hash_child'
        },
        childPath: 'org'
      });
    });

    it('should reject hierarchy with parent hash mismatch', async () => {
      const parent = {
        id: 1,
        keyHash: 'hash_parent',
        encryptedKey: '{}',
        path: 'm/0',
        parentHash: undefined,
        role: 'master' as ViewingKeyRole,
        createdAt: new Date(),
        revokedAt: undefined
      };

      const child = {
        id: 2,
        keyHash: 'hash_child',
        encryptedKey: '{}',
        path: 'm/0/org',
        parentHash: 'wrong_hash',
        role: 'regulator' as ViewingKeyRole,
        createdAt: new Date(),
        revokedAt: undefined
      };

      vi.spyOn(manager, 'getById')
        .mockResolvedValueOnce(parent)
        .mockResolvedValueOnce(child);

      const result = await manager.verifyHierarchy(1, 2);

      expect(result).toBe(false);
    });

    it('should reject hierarchy with path mismatch', async () => {
      const parent = {
        id: 1,
        keyHash: 'hash_parent',
        encryptedKey: '{}',
        path: 'm/0',
        parentHash: undefined,
        role: 'master' as ViewingKeyRole,
        createdAt: new Date(),
        revokedAt: undefined
      };

      const child = {
        id: 2,
        keyHash: 'hash_child',
        encryptedKey: '{}',
        path: 'm/1/org', // Wrong path
        parentHash: 'hash_parent',
        role: 'regulator' as ViewingKeyRole,
        createdAt: new Date(),
        revokedAt: undefined
      };

      vi.spyOn(manager, 'getById')
        .mockResolvedValueOnce(parent)
        .mockResolvedValueOnce(child);

      const result = await manager.verifyHierarchy(1, 2);

      expect(result).toBe(false);
    });
  });

  describe('getById', () => {
    it('should retrieve viewing key by ID', async () => {
      const mockData = {
        id: 1,
        key_hash: 'hash_123',
        encrypted_key: '{}',
        path: 'm/0',
        parent_hash: null,
        role: 'master',
        expires_at: null,
        created_at: new Date().toISOString(),
        revoked_at: null
      };

      const fromResult = mockDatabase.from('viewing_keys');
      const selectResult = fromResult.select('*');
      selectResult.single.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await manager.getById(1);

      expect(result).toBeDefined();
      expect(result?.id).toBe(1);
      expect(result?.keyHash).toBe('hash_123');
    });

    it('should return null for non-existent ID', async () => {
      const fromResult = mockDatabase.from('viewing_keys');
      const selectResult = fromResult.select('*');
      selectResult.single.mockResolvedValue({
        data: null,
        error: { code: 'PGRST116' }
      });

      const result = await manager.getById(999);

      expect(result).toBeNull();
    });
  });

  describe('getByHash', () => {
    it('should retrieve viewing key by hash', async () => {
      const mockData = {
        id: 1,
        key_hash: 'hash_123',
        encrypted_key: '{}',
        path: 'm/0',
        parent_hash: null,
        role: 'master',
        expires_at: null,
        created_at: new Date().toISOString(),
        revoked_at: null
      };

      const fromResult = mockDatabase.from('viewing_keys');
      const selectResult = fromResult.select('*');
      selectResult.single.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await manager.getByHash('hash_123');

      expect(result).toBeDefined();
      expect(result?.keyHash).toBe('hash_123');
    });
  });

  describe('getByRole', () => {
    it('should retrieve viewing key by role', async () => {
      const mockData = {
        id: 1,
        key_hash: 'hash_internal',
        encrypted_key: '{}',
        path: 'm/0/org/2026/Q1',
        parent_hash: 'hash_parent',
        role: 'internal',
        expires_at: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString(),
        created_at: new Date().toISOString(),
        revoked_at: null
      };

      const fromResult = mockDatabase.from('viewing_keys');
      const selectResult = fromResult.select('*');
      selectResult.single.mockResolvedValue({
        data: mockData,
        error: null
      });

      const result = await manager.getByRole('internal');

      expect(result).toBeDefined();
      expect(result?.role).toBe('internal');
    });
  });

  describe('rotate', () => {
    it('should rotate viewing key', async () => {
      const existingKey = {
        id: 1,
        keyHash: 'hash_old',
        encryptedKey: '{}',
        path: 'm/0',
        parentHash: undefined,
        role: 'master' as ViewingKeyRole,
        createdAt: new Date(),
        revokedAt: undefined
      };

      const newKey = {
        id: 2,
        keyHash: 'hash_new',
        encryptedKey: '{}',
        path: 'm/0',
        parentHash: undefined,
        role: 'master' as ViewingKeyRole,
        createdAt: new Date(),
        revokedAt: undefined
      };

      vi.spyOn(manager, 'getById').mockResolvedValue(existingKey);
      vi.spyOn(manager, 'generateMaster').mockResolvedValue(newKey);
      vi.spyOn(manager, 'revoke').mockResolvedValue(undefined);

      const result = await manager.rotate(1);

      expect(result.id).toBe(2);
      expect(manager.revoke).toHaveBeenCalledWith(1);
    });

    it('should reject rotation of revoked key', async () => {
      const revokedKey = {
        id: 1,
        keyHash: 'hash_revoked',
        encryptedKey: '{}',
        path: 'm/0',
        parentHash: undefined,
        role: 'master' as ViewingKeyRole,
        createdAt: new Date(),
        revokedAt: new Date()
      };

      vi.spyOn(manager, 'getById').mockResolvedValue(revokedKey);

      await expect(manager.rotate(1)).rejects.toThrow(
        'Cannot rotate revoked key: 1'
      );
    });
  });

  describe('revoke', () => {
    it('should revoke viewing key', async () => {
      const fromResult = mockDatabase.from('viewing_keys');
      const updateResult = fromResult.update({ revoked_at: expect.any(String) });
      updateResult.eq.mockResolvedValue({ error: null });

      await manager.revoke(1);

      expect(mockDatabase.from).toHaveBeenCalledWith('viewing_keys');
    });
  });

  describe('role determination', () => {
    it('should determine master role for m/0', async () => {
      mockSipherClient.generateViewingKey.mockResolvedValue({
        key: 'key',
        path: 'm/0',
        hash: 'hash'
      });

      const fromResult = mockDatabase.from('viewing_keys');
      const insertResult = fromResult.insert({});
      insertResult.single.mockResolvedValue({
        data: {
          id: 1,
          key_hash: 'hash',
          encrypted_key: '{}',
          path: 'm/0',
          parent_hash: null,
          role: 'master',
          expires_at: null,
          created_at: new Date().toISOString(),
          revoked_at: null
        },
        error: null
      });

      const result = await manager.generateMaster('m/0');
      expect(result.role).toBe('master');
    });
  });
});
