import { createCipheriv, createDecipheriv, randomBytes, pbkdf2Sync } from 'crypto';

/**
 * Simple logger utility
 */
const logger = {
  info: (message: string, context?: any) => console.log(`[INFO] ${message}`, context || ''),
  warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context || ''),
  error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context || '')
};

/**
 * Encryption configuration
 */
export interface EncryptionConfig {
  algorithm: string;
  keyDerivation: string;
  iterations: number;
  keyLength: number;
  ivLength: number;
  saltLength: number;
}

/**
 * Default encryption configuration
 * - Algorithm: AES-256-GCM (authenticated encryption)
 * - Key Derivation: PBKDF2 with SHA-256
 * - Iterations: 100,000 (OWASP recommendation)
 * - Key Length: 32 bytes (256 bits)
 */
export const DEFAULT_ENCRYPTION_CONFIG: EncryptionConfig = {
  algorithm: process.env.ENCRYPTION_ALGORITHM || 'aes-256-gcm',
  keyDerivation: process.env.ENCRYPTION_KEY_DERIVATION || 'pbkdf2',
  iterations: parseInt(process.env.ENCRYPTION_ITERATIONS || '100000', 10),
  keyLength: 32, // 256 bits for AES-256
  ivLength: 16,  // 128 bits for GCM
  saltLength: 32 // 256 bits for salt
};

/**
 * Encrypted data structure
 */
export interface EncryptedData {
  encrypted: string;    // Hex-encoded ciphertext
  iv: string;          // Hex-encoded initialization vector
  tag: string;         // Hex-encoded authentication tag (GCM)
  salt: string;        // Hex-encoded salt for key derivation
}

/**
 * Encryption Service
 * 
 * Provides AES-256-GCM encryption/decryption with PBKDF2 key derivation.
 * Keys are derived from agent public keys to ensure agent-specific encryption.
 * 
 * Requirements: 1.3, 1.4, 12.5
 */
export class EncryptionService {
  private config: EncryptionConfig;

  constructor(config: EncryptionConfig = DEFAULT_ENCRYPTION_CONFIG) {
    this.config = config;
    this.validateConfig();
  }

  /**
   * Validate encryption configuration
   */
  private validateConfig(): void {
    if (this.config.algorithm !== 'aes-256-gcm') {
      throw new Error(`Unsupported encryption algorithm: ${this.config.algorithm}`);
    }
    if (this.config.keyDerivation !== 'pbkdf2') {
      throw new Error(`Unsupported key derivation: ${this.config.keyDerivation}`);
    }
    if (this.config.iterations < 100000) {
      logger.warn('Encryption iterations below recommended minimum (100,000)', {
        iterations: this.config.iterations
      });
    }
    if (this.config.keyLength !== 32) {
      throw new Error(`Invalid key length: ${this.config.keyLength} (must be 32 for AES-256)`);
    }
  }

  /**
   * Derive encryption key from agent public key using PBKDF2
   * 
   * @param agentPublicKey - Agent's public key (used as password)
   * @param salt - Random salt for key derivation
   * @returns Derived encryption key (32 bytes)
   */
  private deriveKey(agentPublicKey: string, salt: Buffer): Buffer {
    try {
      return pbkdf2Sync(
        agentPublicKey,
        salt,
        this.config.iterations,
        this.config.keyLength,
        'sha256'
      );
    } catch (error) {
      logger.error('Key derivation failed', { error });
      throw new Error('Failed to derive encryption key');
    }
  }

  /**
   * Encrypt data using AES-256-GCM
   * 
   * @param plaintext - Data to encrypt (private key)
   * @param agentPublicKey - Agent's public key for key derivation
   * @returns Encrypted data with IV, tag, and salt
   */
  encrypt(plaintext: string, agentPublicKey: string): EncryptedData {
    try {
      // Generate random salt and IV
      const salt = randomBytes(this.config.saltLength);
      const iv = randomBytes(this.config.ivLength);

      // Derive encryption key from agent public key
      const key = this.deriveKey(agentPublicKey, salt);

      // Create cipher
      const cipher = createCipheriv(this.config.algorithm, key, iv);

      // Encrypt data
      let encrypted = cipher.update(plaintext, 'utf8', 'hex');
      encrypted += cipher.final('hex');

      // Get authentication tag (GCM mode)
      const tag = cipher.getAuthTag();

      return {
        encrypted,
        iv: iv.toString('hex'),
        tag: tag.toString('hex'),
        salt: salt.toString('hex')
      };
    } catch (error) {
      logger.error('Encryption failed', { error });
      throw new Error('Failed to encrypt data');
    }
  }

  /**
   * Decrypt data using AES-256-GCM
   * 
   * @param encryptedData - Encrypted data with IV, tag, and salt
   * @param agentPublicKey - Agent's public key for key derivation
   * @returns Decrypted plaintext
   */
  decrypt(encryptedData: EncryptedData, agentPublicKey: string): string {
    try {
      // Convert hex strings to buffers
      const salt = Buffer.from(encryptedData.salt, 'hex');
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const tag = Buffer.from(encryptedData.tag, 'hex');

      // Derive encryption key from agent public key
      const key = this.deriveKey(agentPublicKey, salt);

      // Create decipher
      const decipher = createDecipheriv(this.config.algorithm, key, iv);
      decipher.setAuthTag(tag);

      // Decrypt data
      let decrypted = decipher.update(encryptedData.encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');

      return decrypted;
    } catch (error) {
      logger.error('Decryption failed', { error });
      throw new Error('Failed to decrypt data');
    }
  }

  /**
   * Get encryption configuration
   */
  getConfig(): EncryptionConfig {
    return { ...this.config };
  }
}

/**
 * Singleton instance
 */
let encryptionServiceInstance: EncryptionService | null = null;

/**
 * Get or create EncryptionService singleton
 */
export function getEncryptionService(): EncryptionService {
  if (!encryptionServiceInstance) {
    encryptionServiceInstance = new EncryptionService();
  }
  return encryptionServiceInstance;
}

/**
 * Create EncryptionService with custom config (for testing)
 */
export function createEncryptionService(config?: EncryptionConfig): EncryptionService {
  return new EncryptionService(config);
}
