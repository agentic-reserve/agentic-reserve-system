import { describe, it, expect, beforeEach } from 'vitest';
import { EncryptionService, createEncryptionService, DEFAULT_ENCRYPTION_CONFIG } from './encryption-service';

describe('EncryptionService', () => {
  let encryptionService: EncryptionService;
  const testAgentPublicKey = 'test-agent-public-key-12345';
  const testPrivateKey = 'test-private-key-secret-data';

  beforeEach(() => {
    encryptionService = createEncryptionService();
  });

  describe('Configuration', () => {
    it('should use default configuration', () => {
      const config = encryptionService.getConfig();
      expect(config.algorithm).toBe('aes-256-gcm');
      expect(config.keyDerivation).toBe('pbkdf2');
      expect(config.iterations).toBe(100000);
      expect(config.keyLength).toBe(32);
    });

    it('should accept custom configuration', () => {
      const customConfig = {
        ...DEFAULT_ENCRYPTION_CONFIG,
        iterations: 150000
      };
      const customService = createEncryptionService(customConfig);
      const config = customService.getConfig();
      expect(config.iterations).toBe(150000);
    });

    it('should reject invalid algorithm', () => {
      const invalidConfig = {
        ...DEFAULT_ENCRYPTION_CONFIG,
        algorithm: 'aes-128-cbc'
      };
      expect(() => createEncryptionService(invalidConfig)).toThrow('Unsupported encryption algorithm');
    });

    it('should reject invalid key derivation', () => {
      const invalidConfig = {
        ...DEFAULT_ENCRYPTION_CONFIG,
        keyDerivation: 'scrypt'
      };
      expect(() => createEncryptionService(invalidConfig)).toThrow('Unsupported key derivation');
    });

    it('should reject invalid key length', () => {
      const invalidConfig = {
        ...DEFAULT_ENCRYPTION_CONFIG,
        keyLength: 16
      };
      expect(() => createEncryptionService(invalidConfig)).toThrow('Invalid key length');
    });
  });

  describe('Encryption and Decryption', () => {
    it('should encrypt data successfully', () => {
      const encrypted = encryptionService.encrypt(testPrivateKey, testAgentPublicKey);
      
      expect(encrypted.encrypted).toBeDefined();
      expect(encrypted.iv).toBeDefined();
      expect(encrypted.tag).toBeDefined();
      expect(encrypted.salt).toBeDefined();
      
      // Verify hex encoding
      expect(encrypted.encrypted).toMatch(/^[0-9a-f]+$/);
      expect(encrypted.iv).toMatch(/^[0-9a-f]+$/);
      expect(encrypted.tag).toMatch(/^[0-9a-f]+$/);
      expect(encrypted.salt).toMatch(/^[0-9a-f]+$/);
    });

    it('should decrypt data successfully', () => {
      const encrypted = encryptionService.encrypt(testPrivateKey, testAgentPublicKey);
      const decrypted = encryptionService.decrypt(encrypted, testAgentPublicKey);
      
      expect(decrypted).toBe(testPrivateKey);
    });

    it('should produce different ciphertext for same plaintext (different salt/iv)', () => {
      const encrypted1 = encryptionService.encrypt(testPrivateKey, testAgentPublicKey);
      const encrypted2 = encryptionService.encrypt(testPrivateKey, testAgentPublicKey);
      
      expect(encrypted1.encrypted).not.toBe(encrypted2.encrypted);
      expect(encrypted1.iv).not.toBe(encrypted2.iv);
      expect(encrypted1.salt).not.toBe(encrypted2.salt);
    });

    it('should fail decryption with wrong agent public key', () => {
      const encrypted = encryptionService.encrypt(testPrivateKey, testAgentPublicKey);
      const wrongAgentKey = 'wrong-agent-public-key';
      
      expect(() => {
        encryptionService.decrypt(encrypted, wrongAgentKey);
      }).toThrow('Failed to decrypt data');
    });

    it('should fail decryption with corrupted ciphertext', () => {
      const encrypted = encryptionService.encrypt(testPrivateKey, testAgentPublicKey);
      const corrupted = {
        ...encrypted,
        encrypted: 'corrupted' + encrypted.encrypted
      };
      
      expect(() => {
        encryptionService.decrypt(corrupted, testAgentPublicKey);
      }).toThrow('Failed to decrypt data');
    });

    it('should fail decryption with corrupted tag', () => {
      const encrypted = encryptionService.encrypt(testPrivateKey, testAgentPublicKey);
      const corrupted = {
        ...encrypted,
        tag: '0'.repeat(32) // Invalid tag
      };
      
      expect(() => {
        encryptionService.decrypt(corrupted, testAgentPublicKey);
      }).toThrow('Failed to decrypt data');
    });
  });

  describe('Key Derivation', () => {
    it('should derive same key from same agent public key and salt', () => {
      const encrypted1 = encryptionService.encrypt(testPrivateKey, testAgentPublicKey);
      const decrypted1 = encryptionService.decrypt(encrypted1, testAgentPublicKey);
      
      const encrypted2 = encryptionService.encrypt(testPrivateKey, testAgentPublicKey);
      const decrypted2 = encryptionService.decrypt(encrypted2, testAgentPublicKey);
      
      expect(decrypted1).toBe(testPrivateKey);
      expect(decrypted2).toBe(testPrivateKey);
    });

    it('should derive different keys for different agent public keys', () => {
      const agentKey1 = 'agent-1-public-key';
      const agentKey2 = 'agent-2-public-key';
      
      const encrypted1 = encryptionService.encrypt(testPrivateKey, agentKey1);
      const encrypted2 = encryptionService.encrypt(testPrivateKey, agentKey2);
      
      // Should not be able to decrypt with wrong agent key
      expect(() => {
        encryptionService.decrypt(encrypted1, agentKey2);
      }).toThrow('Failed to decrypt data');
      
      expect(() => {
        encryptionService.decrypt(encrypted2, agentKey1);
      }).toThrow('Failed to decrypt data');
    });
  });

  describe('Edge Cases', () => {
    it('should handle empty string encryption', () => {
      const encrypted = encryptionService.encrypt('', testAgentPublicKey);
      const decrypted = encryptionService.decrypt(encrypted, testAgentPublicKey);
      
      expect(decrypted).toBe('');
    });

    it('should handle long string encryption', () => {
      const longString = 'a'.repeat(10000);
      const encrypted = encryptionService.encrypt(longString, testAgentPublicKey);
      const decrypted = encryptionService.decrypt(encrypted, testAgentPublicKey);
      
      expect(decrypted).toBe(longString);
    });

    it('should handle special characters', () => {
      const specialChars = '!@#$%^&*()_+-=[]{}|;:,.<>?/~`\'"\\';
      const encrypted = encryptionService.encrypt(specialChars, testAgentPublicKey);
      const decrypted = encryptionService.decrypt(encrypted, testAgentPublicKey);
      
      expect(decrypted).toBe(specialChars);
    });

    it('should handle unicode characters', () => {
      const unicode = '你好世界 🌍 مرحبا العالم';
      const encrypted = encryptionService.encrypt(unicode, testAgentPublicKey);
      const decrypted = encryptionService.decrypt(encrypted, testAgentPublicKey);
      
      expect(decrypted).toBe(unicode);
    });
  });

  describe('Security Properties', () => {
    it('should use different IV for each encryption', () => {
      const ivs = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        const encrypted = encryptionService.encrypt(testPrivateKey, testAgentPublicKey);
        ivs.add(encrypted.iv);
      }
      
      // All IVs should be unique
      expect(ivs.size).toBe(100);
    });

    it('should use different salt for each encryption', () => {
      const salts = new Set<string>();
      
      for (let i = 0; i < 100; i++) {
        const encrypted = encryptionService.encrypt(testPrivateKey, testAgentPublicKey);
        salts.add(encrypted.salt);
      }
      
      // All salts should be unique
      expect(salts.size).toBe(100);
    });

    it('should produce authentication tag for integrity', () => {
      const encrypted = encryptionService.encrypt(testPrivateKey, testAgentPublicKey);
      
      // Tag should be 32 hex characters (16 bytes)
      expect(encrypted.tag).toHaveLength(32);
      expect(encrypted.tag).toMatch(/^[0-9a-f]{32}$/);
    });
  });
});
