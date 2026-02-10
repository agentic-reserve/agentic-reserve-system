/**
 * Cryptographic Input Validation Utilities
 * 
 * SECURITY FIX (VULN-007): Comprehensive input validation for cryptographic parameters
 * 
 * Validates all cryptographic inputs to prevent:
 * - Invalid cryptographic operations
 * - Injection attacks
 * - System crashes from malformed input
 * - Data corruption
 */

/**
 * Simple logger utility
 */
const logger = {
  warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context || ''),
  error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context || '')
};

/**
 * Cryptographic Input Validator
 * 
 * Provides validation methods for all cryptographic parameters used in the privacy system.
 */
export class CryptoValidator {
  /**
   * Validate commitment value
   * 
   * @param value - Value to validate
   * @throws Error if invalid
   */
  static validateCommitmentValue(value: string): void {
    // Must be a string
    if (typeof value !== 'string') {
      throw new Error('Commitment value must be a string');
    }

    // Must not be empty
    if (value.trim().length === 0) {
      throw new Error('Commitment value cannot be empty');
    }

    // Must be numeric (integer or decimal)
    if (!/^\d+(\.\d+)?$/.test(value)) {
      throw new Error('Commitment value must be a positive number');
    }

    // Must be positive
    const numValue = parseFloat(value);
    if (numValue <= 0) {
      throw new Error('Commitment value must be greater than zero');
    }

    // Must be within reasonable range (prevent overflow)
    if (numValue > Number.MAX_SAFE_INTEGER) {
      throw new Error('Commitment value exceeds maximum safe integer');
    }

    // Check for NaN
    if (isNaN(numValue)) {
      throw new Error('Commitment value is not a valid number');
    }
  }

  /**
   * Validate hex-encoded cryptographic value
   * 
   * @param value - Hex string to validate
   * @param expectedLength - Expected length in hex characters (optional)
   * @param fieldName - Name of field for error messages
   * @throws Error if invalid
   */
  static validateHexString(value: string, expectedLength?: number, fieldName: string = 'Value'): void {
    // Must be a string
    if (typeof value !== 'string') {
      throw new Error(`${fieldName} must be a string`);
    }

    // Must not be empty
    if (value.trim().length === 0) {
      throw new Error(`${fieldName} cannot be empty`);
    }

    // Must be hex-encoded (only 0-9, a-f, A-F)
    if (!/^[0-9a-f]+$/i.test(value)) {
      throw new Error(`${fieldName} must be hex-encoded (0-9, a-f)`);
    }

    // Check expected length if provided
    if (expectedLength && value.length !== expectedLength) {
      throw new Error(`${fieldName} must be ${expectedLength} hex characters (got ${value.length})`);
    }

    // Must be even length (each byte = 2 hex chars)
    if (value.length % 2 !== 0) {
      throw new Error(`${fieldName} must have even length (each byte = 2 hex characters)`);
    }
  }

  /**
   * Validate BIP32 derivation path
   * 
   * @param path - Derivation path to validate
   * @throws Error if invalid
   */
  static validateDerivationPath(path: string): void {
    // Must be a string
    if (typeof path !== 'string') {
      throw new Error('Derivation path must be a string');
    }

    // Must not be empty
    if (path.trim().length === 0) {
      throw new Error('Derivation path cannot be empty');
    }

    // Must start with m/
    if (!path.startsWith('m/')) {
      throw new Error('Derivation path must start with "m/"');
    }

    // Must only contain valid characters (m, /, digits)
    if (!/^m(\/\d+)+$/.test(path)) {
      throw new Error('Invalid derivation path format. Must be m/0/1/2/...');
    }

    // Limit depth to prevent DoS
    const depth = path.split('/').length - 1;
    if (depth > 10) {
      throw new Error('Derivation path too deep (max 10 levels)');
    }

    // Validate each segment is a valid number
    const segments = path.split('/').slice(1); // Skip 'm'
    for (const segment of segments) {
      const num = parseInt(segment, 10);
      if (isNaN(num) || num < 0) {
        throw new Error(`Invalid path segment: ${segment}`);
      }
      // BIP32 hardened keys use values >= 2^31
      if (num > 2147483647) {
        logger.warn('Path segment uses hardened derivation', { segment });
      }
    }
  }

  /**
   * Validate Solana address (Base58)
   * 
   * @param address - Solana address to validate
   * @param fieldName - Name of field for error messages
   * @throws Error if invalid
   */
  static validateSolanaAddress(address: string, fieldName: string = 'Address'): void {
    // Must be a string
    if (typeof address !== 'string') {
      throw new Error(`${fieldName} must be a string`);
    }

    // Must not be empty
    if (address.trim().length === 0) {
      throw new Error(`${fieldName} cannot be empty`);
    }

    // Base58 format: 32-44 characters, no 0, O, I, l
    if (!/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(address)) {
      throw new Error(`${fieldName} must be a valid Solana address (Base58, 32-44 characters)`);
    }
  }

  /**
   * Validate ed25519 public key
   * 
   * @param publicKey - Public key to validate (hex)
   * @param fieldName - Name of field for error messages
   * @throws Error if invalid
   */
  static validatePublicKey(publicKey: string, fieldName: string = 'Public key'): void {
    // ed25519 public keys are 32 bytes = 64 hex characters
    this.validateHexString(publicKey, 64, fieldName);
  }

  /**
   * Validate ed25519 signature
   * 
   * @param signature - Signature to validate (hex)
   * @param fieldName - Name of field for error messages
   * @throws Error if invalid
   */
  static validateSignature(signature: string, fieldName: string = 'Signature'): void {
    // ed25519 signatures are 64 bytes = 128 hex characters
    this.validateHexString(signature, 128, fieldName);
  }

  /**
   * Validate blinding factor
   * 
   * @param blindingFactor - Blinding factor to validate (hex)
   * @throws Error if invalid
   */
  static validateBlindingFactor(blindingFactor: string): void {
    // Blinding factors should be hex-encoded
    this.validateHexString(blindingFactor, undefined, 'Blinding factor');

    // Should have reasonable length (typically 32-64 bytes)
    const byteLength = blindingFactor.length / 2;
    if (byteLength < 16 || byteLength > 128) {
      throw new Error(`Blinding factor has unusual length: ${byteLength} bytes`);
    }
  }

  /**
   * Validate Pedersen commitment
   * 
   * @param commitment - Commitment to validate (hex)
   * @throws Error if invalid
   */
  static validateCommitment(commitment: string): void {
    // Commitments should be hex-encoded
    this.validateHexString(commitment, undefined, 'Commitment');

    // Should have reasonable length (typically 32-64 bytes)
    const byteLength = commitment.length / 2;
    if (byteLength < 16 || byteLength > 128) {
      throw new Error(`Commitment has unusual length: ${byteLength} bytes`);
    }
  }

  /**
   * Validate encryption key
   * 
   * @param key - Encryption key to validate
   * @param minLength - Minimum key length in characters
   * @throws Error if invalid
   */
  static validateEncryptionKey(key: string, minLength: number = 32): void {
    // Must be a string
    if (typeof key !== 'string') {
      throw new Error('Encryption key must be a string');
    }

    // Must not be empty
    if (key.trim().length === 0) {
      throw new Error('Encryption key cannot be empty');
    }

    // Must meet minimum length
    if (key.length < minLength) {
      throw new Error(`Encryption key must be at least ${minLength} characters (got ${key.length})`);
    }

    // Check for common weak keys
    const weakKeys = [
      'password', 'test', 'default', 'key', 'secret', 'admin',
      '12345678', 'qwerty', 'abc123', 'master', 'root'
    ];
    
    const lowerKey = key.toLowerCase();
    for (const weakKey of weakKeys) {
      if (lowerKey.includes(weakKey)) {
        throw new Error(`Encryption key appears to contain weak pattern: ${weakKey}`);
      }
    }

    // Check entropy (should have variety of characters)
    const uniqueChars = new Set(key.split('')).size;
    if (uniqueChars < 10) {
      throw new Error('Encryption key has insufficient entropy (too few unique characters)');
    }
  }

  /**
   * Validate viewing key hash
   * 
   * @param hash - Hash to validate
   * @throws Error if invalid
   */
  static validateViewingKeyHash(hash: string): void {
    // SHA-256 hashes are 32 bytes = 64 hex characters
    this.validateHexString(hash, 64, 'Viewing key hash');
  }

  /**
   * Validate timestamp
   * 
   * @param timestamp - Timestamp to validate (Unix timestamp in seconds or milliseconds)
   * @throws Error if invalid
   */
  static validateTimestamp(timestamp: number): void {
    // Must be a number
    if (typeof timestamp !== 'number') {
      throw new Error('Timestamp must be a number');
    }

    // Must be positive
    if (timestamp <= 0) {
      throw new Error('Timestamp must be positive');
    }

    // Must not be NaN or Infinity
    if (!isFinite(timestamp)) {
      throw new Error('Timestamp must be a finite number');
    }

    // Check if reasonable (between 2020 and 2100)
    const minTimestamp = 1577836800; // 2020-01-01 in seconds
    const maxTimestamp = 4102444800; // 2100-01-01 in seconds
    
    // Handle both seconds and milliseconds
    const timestampSeconds = timestamp > 10000000000 ? timestamp / 1000 : timestamp;
    
    if (timestampSeconds < minTimestamp || timestampSeconds > maxTimestamp) {
      throw new Error('Timestamp is outside reasonable range (2020-2100)');
    }
  }

  /**
   * Validate amount (for transfers, swaps, etc.)
   * 
   * @param amount - Amount to validate (string or number)
   * @throws Error if invalid
   */
  static validateAmount(amount: string | number): void {
    // Convert to string if number
    const amountStr = typeof amount === 'number' ? amount.toString() : amount;

    // Must be a valid number
    if (!/^\d+(\.\d+)?$/.test(amountStr)) {
      throw new Error('Amount must be a positive number');
    }

    const numAmount = parseFloat(amountStr);

    // Must be positive
    if (numAmount <= 0) {
      throw new Error('Amount must be greater than zero');
    }

    // Must be finite
    if (!isFinite(numAmount)) {
      throw new Error('Amount must be a finite number');
    }

    // Check for reasonable maximum (prevent overflow)
    if (numAmount > 1e18) {
      throw new Error('Amount exceeds maximum allowed value');
    }
  }

  /**
   * Sanitize string for logging (remove sensitive data)
   * 
   * @param value - String to sanitize
   * @param showLength - Number of characters to show (default 10)
   * @returns Sanitized string
   */
  static sanitizeForLogging(value: string, showLength: number = 10): string {
    if (!value || value.length <= showLength) {
      return '***REDACTED***';
    }
    return value.substring(0, showLength) + '...***REDACTED***';
  }
}

/**
 * Validate multiple commitment values in batch
 * 
 * @param values - Array of values to validate
 * @throws Error if any value is invalid
 */
export function validateCommitmentBatch(values: string[]): void {
  if (!Array.isArray(values)) {
    throw new Error('Values must be an array');
  }

  if (values.length === 0) {
    throw new Error('Values array cannot be empty');
  }

  if (values.length > 100) {
    throw new Error('Batch size cannot exceed 100 values');
  }

  for (let i = 0; i < values.length; i++) {
    try {
      CryptoValidator.validateCommitmentValue(values[i]);
    } catch (error) {
      throw new Error(`Invalid value at index ${i}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }
}

/**
 * Validate stealth address generation parameters
 * 
 * @param label - Label for the stealth address
 * @throws Error if invalid
 */
export function validateStealthAddressLabel(label: string): void {
  if (typeof label !== 'string') {
    throw new Error('Label must be a string');
  }

  if (label.trim().length === 0) {
    throw new Error('Label cannot be empty');
  }

  if (label.length > 255) {
    throw new Error('Label cannot exceed 255 characters');
  }

  // Check for potentially malicious characters
  if (/[<>\"'`]/.test(label)) {
    throw new Error('Label contains invalid characters');
  }
}

