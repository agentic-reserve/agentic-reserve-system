import { describe, it, expect, beforeEach } from 'vitest';
import { TransactionIndexer } from '../services/memory/transaction-indexer';
import { LYSTransaction, TransactionType } from '../services/memory/lys-labs-client';

/**
 * Unit tests for Transaction Indexer encryption functionality
 * 
 * Tests privacy-protected transaction handling:
 * - Encryption of sensitive fields (amount, counterparty, metadata)
 * - Decryption with correct agent key
 * - Decryption failure with incorrect agent key
 * - Encrypted data structure validation
 * 
 * **Validates: Requirements 8.3, 8.4**
 */
describe('TransactionIndexer - Privacy Protection Encryption', () => {
  let indexer: TransactionIndexer;

  beforeEach(() => {
    // Create indexer without Supabase connection for unit tests
    indexer = new TransactionIndexer();
  });

  describe('encryptSensitiveData', () => {
    it('should encrypt sensitive transaction fields', () => {
      // Arrange
      const tx: LYSTransaction = {
        signature: '5J8H5zKqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVn',
        walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        timestamp: Date.now(),
        type: TransactionType.TRANSFER,
        amount: 100.5,
        tokenMint: 'So11111111111111111111111111111111111111112',
        metadata: {
          counterparty: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          fee: 0.000005,
          tokenSymbol: 'SOL',
        },
      };

      // Act - Access private method via type assertion for testing
      const encryptedDataJson = (indexer as any).encryptSensitiveData(tx);

      // Assert
      expect(encryptedDataJson).toBeDefined();
      expect(typeof encryptedDataJson).toBe('string');

      // Parse encrypted data structure
      const encryptedData = JSON.parse(encryptedDataJson);
      expect(encryptedData).toHaveProperty('ciphertext');
      expect(encryptedData).toHaveProperty('iv');
      expect(encryptedData).toHaveProperty('authTag');
      expect(encryptedData).toHaveProperty('agentKeyHash');
      expect(encryptedData).toHaveProperty('algorithm');
      expect(encryptedData).toHaveProperty('version');

      // Verify algorithm and version
      expect(encryptedData.algorithm).toBe('aes-256-gcm');
      expect(encryptedData.version).toBe(1);

      // Verify ciphertext is hex string
      expect(encryptedData.ciphertext).toMatch(/^[0-9a-f]+$/);
      expect(encryptedData.iv).toMatch(/^[0-9a-f]+$/);
      expect(encryptedData.authTag).toMatch(/^[0-9a-f]+$/);
      expect(encryptedData.agentKeyHash).toMatch(/^[0-9a-f]+$/);

      // Verify IV is 16 bytes (32 hex chars)
      expect(encryptedData.iv.length).toBe(32);

      // Verify auth tag is 16 bytes (32 hex chars)
      expect(encryptedData.authTag.length).toBe(32);

      // Verify agent key hash is 32 bytes (64 hex chars)
      expect(encryptedData.agentKeyHash.length).toBe(64);
    });

    it('should produce different ciphertexts for same data (due to random IV)', () => {
      // Arrange
      const tx: LYSTransaction = {
        signature: '5J8H5zKqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVn',
        walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        timestamp: Date.now(),
        type: TransactionType.TRANSFER,
        amount: 100.5,
        tokenMint: 'So11111111111111111111111111111111111111112',
        metadata: {},
      };

      // Act - Encrypt same transaction twice
      const encrypted1 = (indexer as any).encryptSensitiveData(tx);
      const encrypted2 = (indexer as any).encryptSensitiveData(tx);

      // Assert - Ciphertexts should be different due to random IV
      expect(encrypted1).not.toBe(encrypted2);

      const data1 = JSON.parse(encrypted1);
      const data2 = JSON.parse(encrypted2);

      expect(data1.ciphertext).not.toBe(data2.ciphertext);
      expect(data1.iv).not.toBe(data2.iv);
      expect(data1.authTag).not.toBe(data2.authTag);

      // But agent key hash should be the same (same wallet)
      expect(data1.agentKeyHash).toBe(data2.agentKeyHash);
    });

    it('should produce different agent key hashes for different wallets', () => {
      // Arrange
      const tx1: LYSTransaction = {
        signature: '5J8H5zKqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVn',
        walletAddress: 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK',
        timestamp: Date.now(),
        type: TransactionType.TRANSFER,
        amount: 100.5,
        tokenMint: 'So11111111111111111111111111111111111111112',
        metadata: {},
      };

      const tx2: LYSTransaction = {
        ...tx1,
        walletAddress: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM', // Different wallet
      };

      // Act
      const encrypted1 = (indexer as any).encryptSensitiveData(tx1);
      const encrypted2 = (indexer as any).encryptSensitiveData(tx2);

      // Assert
      const data1 = JSON.parse(encrypted1);
      const data2 = JSON.parse(encrypted2);

      expect(data1.agentKeyHash).not.toBe(data2.agentKeyHash);
    });
  });

  describe('decryptSensitiveData', () => {
    it('should decrypt data encrypted with same wallet address', () => {
      // Arrange
      const walletAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
      const tx: LYSTransaction = {
        signature: '5J8H5zKqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVn',
        walletAddress,
        timestamp: Date.now(),
        type: TransactionType.TRANSFER,
        amount: 100.5,
        tokenMint: 'So11111111111111111111111111111111111111112',
        metadata: {
          counterparty: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          fee: 0.000005,
          tokenSymbol: 'SOL',
        },
      };

      // Act - Encrypt then decrypt
      const encryptedDataJson = (indexer as any).encryptSensitiveData(tx);
      const decrypted = indexer.decryptSensitiveData(encryptedDataJson, walletAddress);

      // Assert
      expect(decrypted).toBeDefined();
      expect(decrypted.amount).toBe(100.5);
      expect(decrypted.tokenMint).toBe('So11111111111111111111111111111111111111112');
      expect(decrypted.counterparty).toBe('9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM');
      expect(decrypted.metadata).toEqual(tx.metadata);
    });

    it('should fail to decrypt with wrong wallet address', () => {
      // Arrange
      const correctWallet = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
      const wrongWallet = '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM';

      const tx: LYSTransaction = {
        signature: '5J8H5zKqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVn',
        walletAddress: correctWallet,
        timestamp: Date.now(),
        type: TransactionType.TRANSFER,
        amount: 100.5,
        tokenMint: 'So11111111111111111111111111111111111111112',
        metadata: {},
      };

      // Act - Encrypt with correct wallet, try to decrypt with wrong wallet
      const encryptedDataJson = (indexer as any).encryptSensitiveData(tx);

      // Assert - Should throw error
      expect(() => {
        indexer.decryptSensitiveData(encryptedDataJson, wrongWallet);
      }).toThrow('Decryption key mismatch');
    });

    it('should fail to decrypt tampered ciphertext', () => {
      // Arrange
      const walletAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
      const tx: LYSTransaction = {
        signature: '5J8H5zKqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVn',
        walletAddress,
        timestamp: Date.now(),
        type: TransactionType.TRANSFER,
        amount: 100.5,
        tokenMint: 'So11111111111111111111111111111111111111112',
        metadata: {},
      };

      // Act - Encrypt and tamper with ciphertext
      const encryptedDataJson = (indexer as any).encryptSensitiveData(tx);
      const encryptedData = JSON.parse(encryptedDataJson);

      // Tamper with ciphertext (flip a bit)
      const tamperedCiphertext = encryptedData.ciphertext.substring(0, 10) + 
        (encryptedData.ciphertext[10] === '0' ? '1' : '0') +
        encryptedData.ciphertext.substring(11);

      const tamperedData = {
        ...encryptedData,
        ciphertext: tamperedCiphertext,
      };

      // Assert - Should throw error due to auth tag verification failure
      expect(() => {
        indexer.decryptSensitiveData(JSON.stringify(tamperedData), walletAddress);
      }).toThrow();
    });

    it('should fail to decrypt with unsupported version', () => {
      // Arrange
      const walletAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
      const tx: LYSTransaction = {
        signature: '5J8H5zKqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVn',
        walletAddress,
        timestamp: Date.now(),
        type: TransactionType.TRANSFER,
        amount: 100.5,
        tokenMint: 'So11111111111111111111111111111111111111112',
        metadata: {},
      };

      // Act - Encrypt and change version
      const encryptedDataJson = (indexer as any).encryptSensitiveData(tx);
      const encryptedData = JSON.parse(encryptedDataJson);
      encryptedData.version = 999; // Unsupported version

      // Assert
      expect(() => {
        indexer.decryptSensitiveData(JSON.stringify(encryptedData), walletAddress);
      }).toThrow('Unsupported encryption version');
    });

    it('should fail to decrypt with unsupported algorithm', () => {
      // Arrange
      const walletAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
      const tx: LYSTransaction = {
        signature: '5J8H5zKqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVnJ4KqY8xVn',
        walletAddress,
        timestamp: Date.now(),
        type: TransactionType.TRANSFER,
        amount: 100.5,
        tokenMint: 'So11111111111111111111111111111111111111112',
        metadata: {},
      };

      // Act - Encrypt and change algorithm
      const encryptedDataJson = (indexer as any).encryptSensitiveData(tx);
      const encryptedData = JSON.parse(encryptedDataJson);
      encryptedData.algorithm = 'aes-128-cbc'; // Unsupported algorithm

      // Assert
      expect(() => {
        indexer.decryptSensitiveData(JSON.stringify(encryptedData), walletAddress);
      }).toThrow('Unsupported encryption algorithm');
    });
  });

  describe('Round-trip encryption/decryption', () => {
    it('should preserve all sensitive fields through encryption/decryption cycle', () => {
      // Arrange
      const walletAddress = 'DYw8jCTfwHNRJhhmFcbXvVDTqWMEVFBX6ZKUmG5CNSKK';
      const testCases = [
        {
          amount: 0.000001,
          counterparty: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          tokenMint: 'So11111111111111111111111111111111111111112',
          metadata: { fee: 0.000005 },
        },
        {
          amount: 1000000.5,
          counterparty: undefined,
          tokenMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
          metadata: { tokenSymbol: 'USDC', blockNumber: 123456 },
        },
        {
          amount: 0,
          counterparty: '9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM',
          tokenMint: 'So11111111111111111111111111111111111111112',
          metadata: {},
        },
      ];

      testCases.forEach((testCase, index) => {
        // Arrange
        const tx: LYSTransaction = {
          signature: `sig${index}`,
          walletAddress,
          timestamp: Date.now(),
          type: TransactionType.TRANSFER,
          amount: testCase.amount,
          tokenMint: testCase.tokenMint,
          metadata: testCase.metadata,
        };

        if (testCase.counterparty) {
          tx.metadata.counterparty = testCase.counterparty;
        }

        // Act
        const encryptedDataJson = (indexer as any).encryptSensitiveData(tx);
        const decrypted = indexer.decryptSensitiveData(encryptedDataJson, walletAddress);

        // Assert
        expect(decrypted.amount).toBe(testCase.amount);
        expect(decrypted.tokenMint).toBe(testCase.tokenMint);
        expect(decrypted.counterparty).toBe(testCase.counterparty);
        expect(decrypted.metadata).toEqual(testCase.metadata);
      });
    });
  });
});
