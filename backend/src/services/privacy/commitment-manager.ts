/**
 * Commitment Manager
 * 
 * Manages Pedersen commitments for MEV-protected swaps with homomorphic operations.
 * Stores commitments with encrypted blinding factors for later verification.
 * 
 * Phase 2: MEV-Protected Rebalancing
 * Task 7.2: Implement CommitmentManager class
 * Requirements: 6.1, 6.2, 6.3, 7.1, 7.2
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { SipherClient } from './sipher/sipher-client';
import { EncryptionService, EncryptedData } from './encryption-service';
import { Commitment } from './types';
import { getCachedData, setCachedData } from '../redis';

/**
 * Simple logger utility
 */
const logger = {
  info: (message: string, context?: any) => console.log(`[INFO] ${message}`, context || ''),
  warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context || ''),
  error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context || '')
};

/**
 * Commitment record from database
 */
export interface CommitmentRecord {
  id: number;
  commitment: string;
  encrypted_blinding_factor: string;
  value: string;
  created_at: Date;
  verified_at?: Date;
}

/**
 * Commitment Manager
 * 
 * Provides methods for:
 * - Creating Pedersen commitments
 * - Verifying commitment openings
 * - Homomorphic addition of commitments
 * - Batch commitment creation
 * - Secure storage of blinding factors
 */
export class CommitmentManager {
  private sipherClient: SipherClient;
  private database: SupabaseClient;
  private encryption: EncryptionService;
  private readonly encryptionKey: string;
  private readonly CACHE_TTL = 600; // 10 minutes cache for commitments
  private readonly CACHE_KEY_PREFIX = 'commitment:';

  /**
   * Create a new CommitmentManager
   * 
   * @param sipherClient - Sipher API client
   * @param database - Supabase database client
   * @param encryption - Encryption service
   * @param blindingFactorKey - Encryption key for blinding factors (required)
   */
  constructor(
    sipherClient: SipherClient,
    database: SupabaseClient,
    encryption: EncryptionService,
    blindingFactorKey?: string
  ) {
    this.sipherClient = sipherClient;
    this.database = database;
    this.encryption = encryption;
    
    // SECURITY FIX (VULN-001): Load from secure environment variable
    this.encryptionKey = blindingFactorKey || process.env.BLINDING_FACTOR_ENCRYPTION_KEY || '';
    
    if (!this.encryptionKey) {
      throw new Error(
        'BLINDING_FACTOR_ENCRYPTION_KEY is required. Set environment variable or provide via constructor. ' +
        'For production, use HSM-backed key management.'
      );
    }
    
    if (this.encryptionKey.length < 32) {
      throw new Error('Blinding factor encryption key must be at least 32 characters');
    }
    
    // Validate key is not a common/default value
    const insecureKeys = ['commitment-blinding-factor-key', 'test-key', 'default-key', 'password'];
    if (insecureKeys.includes(this.encryptionKey.toLowerCase())) {
      throw new Error('Blinding factor encryption key appears to be a default/test value. Use a cryptographically secure key.');
    }
    
    logger.info('CommitmentManager initialized with secure encryption key');
  }

  /**
   * Create a Pedersen commitment for a value
   * 
   * Creates a cryptographic commitment that hides the value while enabling
   * homomorphic operations. The blinding factor is encrypted and stored securely.
   * 
   * Requirements: 6.1, 6.3
   * 
   * @param value - Value to commit to (as string)
   * @returns Commitment record with encrypted blinding factor
   */
  async create(value: string): Promise<CommitmentRecord> {
    try {
      logger.info('Creating Pedersen commitment', { value });

      // Call Sipher API to create commitment
      const commitment: Commitment = await this.sipherClient.createCommitment(value);

      // Encrypt blinding factor
      const encryptedBlindingFactor = await this.encryptBlindingFactor(
        commitment.blindingFactor
      );

      // Store in database
      const { data, error } = await this.database
        .from('commitments')
        .insert({
          commitment: commitment.commitment,
          encrypted_blinding_factor: encryptedBlindingFactor,
          value: value,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to store commitment in database', { error });
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info('Commitment created successfully', { id: data.id });

      return {
        id: data.id,
        commitment: data.commitment,
        encrypted_blinding_factor: data.encrypted_blinding_factor,
        value: data.value,
        created_at: new Date(data.created_at),
        verified_at: data.verified_at ? new Date(data.verified_at) : undefined
      };
    } catch (error) {
      logger.error('Failed to create commitment', { error });
      throw error;
    }
  }

  /**
   * Verify a commitment opening
   * 
   * Verifies that a commitment was created with the specified value.
   * Decrypts the stored blinding factor and verifies with Sipher API.
   * 
   * Requirements: 8.1, 8.2
   * 
   * @param commitmentId - ID of the commitment to verify
   * @param value - Value to verify against
   * @returns True if commitment is valid, false otherwise
   */
  async verify(commitmentId: number, value: string): Promise<boolean> {
    try {
      logger.info('Verifying commitment', { commitmentId, value });

      // Retrieve commitment from database
      const record = await this.getById(commitmentId);
      if (!record) {
        logger.error('Commitment not found', { commitmentId });
        return false;
      }

      // Decrypt blinding factor
      const blindingFactor = await this.decryptBlindingFactor(
        record.encrypted_blinding_factor
      );

      // Verify with Sipher API
      const result = await this.sipherClient.verifyCommitment({
        commitment: record.commitment,
        value: value,
        blindingFactor: blindingFactor
      });

      // Update verified_at timestamp if valid
      if (result.valid) {
        await this.database
          .from('commitments')
          .update({ verified_at: new Date().toISOString() })
          .eq('id', commitmentId);

        logger.info('Commitment verified successfully', { commitmentId });
      } else {
        logger.warn('Commitment verification failed', { commitmentId, value });
      }

      return result.valid;
    } catch (error) {
      logger.error('Failed to verify commitment', { error, commitmentId });
      throw error;
    }
  }

  /**
   * Add two commitments homomorphically
   * 
   * Combines two Pedersen commitments such that C(a) + C(b) = C(a+b).
   * This enables combining swap amounts without revealing individual values.
   * 
   * Requirements: 7.1, 7.2, 7.3
   * 
   * @param commitmentIdA - ID of first commitment
   * @param commitmentIdB - ID of second commitment
   * @returns Combined commitment record
   */
  async add(commitmentIdA: number, commitmentIdB: number): Promise<CommitmentRecord> {
    try {
      logger.info('Adding commitments homomorphically', { commitmentIdA, commitmentIdB });

      // Retrieve both commitments from database
      const recordA = await this.getById(commitmentIdA);
      const recordB = await this.getById(commitmentIdB);

      if (!recordA || !recordB) {
        throw new Error('One or both commitments not found');
      }

      // Decrypt blinding factors
      const blindingA = await this.decryptBlindingFactor(recordA.encrypted_blinding_factor);
      const blindingB = await this.decryptBlindingFactor(recordB.encrypted_blinding_factor);

      // Add commitments via Sipher API
      const sumCommitment = await this.sipherClient.addCommitments({
        commitmentA: recordA.commitment,
        commitmentB: recordB.commitment,
        blindingA: blindingA,
        blindingB: blindingB
      });

      // Calculate sum of values
      const valueA = parseFloat(recordA.value);
      const valueB = parseFloat(recordB.value);
      const sumValue = (valueA + valueB).toString();

      // Encrypt combined blinding factor
      const encryptedBlindingFactor = await this.encryptBlindingFactor(
        sumCommitment.blindingFactor
      );

      // Store combined commitment in database
      const { data, error } = await this.database
        .from('commitments')
        .insert({
          commitment: sumCommitment.commitment,
          encrypted_blinding_factor: encryptedBlindingFactor,
          value: sumValue,
          created_at: new Date().toISOString()
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to store combined commitment', { error });
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info('Commitments added successfully', {
        id: data.id,
        valueA: recordA.value,
        valueB: recordB.value,
        sumValue
      });

      return {
        id: data.id,
        commitment: data.commitment,
        encrypted_blinding_factor: data.encrypted_blinding_factor,
        value: data.value,
        created_at: new Date(data.created_at),
        verified_at: data.verified_at ? new Date(data.verified_at) : undefined
      };
    } catch (error) {
      logger.error('Failed to add commitments', { error, commitmentIdA, commitmentIdB });
      throw error;
    }
  }

  /**
   * Batch create multiple commitments
   * 
   * Efficiently creates multiple Pedersen commitments in a single API call.
   * Useful for preparing commitments for multi-hop swaps.
   * 
   * Requirements: 11.1, 11.2, 11.3
   * 
   * @param values - Array of values to commit to
   * @returns Array of commitment records
   */
  async batchCreate(values: string[]): Promise<CommitmentRecord[]> {
    try {
      logger.info('Batch creating commitments', { count: values.length });

      // Call Sipher API to batch create commitments
      const commitments = await this.sipherClient.batchCreateCommitments(values);

      // Prepare records for database insertion
      const records = await Promise.all(
        commitments.map(async (commitment, index) => {
          const encryptedBlindingFactor = await this.encryptBlindingFactor(
            commitment.blindingFactor
          );

          return {
            commitment: commitment.commitment,
            encrypted_blinding_factor: encryptedBlindingFactor,
            value: values[index],
            created_at: new Date().toISOString()
          };
        })
      );

      // Insert all records atomically
      const { data, error } = await this.database
        .from('commitments')
        .insert(records)
        .select();

      if (error) {
        logger.error('Failed to store batch commitments', { error });
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info('Batch commitments created successfully', { count: data.length });

      return data.map(record => ({
        id: record.id,
        commitment: record.commitment,
        encrypted_blinding_factor: record.encrypted_blinding_factor,
        value: record.value,
        created_at: new Date(record.created_at),
        verified_at: record.verified_at ? new Date(record.verified_at) : undefined
      }));
    } catch (error) {
      logger.error('Failed to batch create commitments', { error, count: values.length });
      throw error;
    }
  }

  /**
   * Get commitment by ID
   * 
   * PERFORMANCE OPTIMIZATION: Caches commitment records to reduce database queries.
   * 
   * @param id - Commitment ID
   * @returns Commitment record or null if not found
   */
  async getById(id: number): Promise<CommitmentRecord | null> {
    try {
      // Check cache first
      const cacheKey = `${this.CACHE_KEY_PREFIX}${id}`;
      const cached = await getCachedData<CommitmentRecord>(cacheKey);
      
      if (cached) {
        logger.info('Commitment retrieved from cache', { id });
        // Convert date strings back to Date objects
        return {
          ...cached,
          created_at: new Date(cached.created_at),
          verified_at: cached.verified_at ? new Date(cached.verified_at) : undefined
        };
      }

      const { data, error } = await this.database
        .from('commitments')
        .select('*')
        .eq('id', id)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found
          return null;
        }
        logger.error('Failed to retrieve commitment', { error, id });
        throw new Error(`Database error: ${error.message}`);
      }

      const record: CommitmentRecord = {
        id: data.id,
        commitment: data.commitment,
        encrypted_blinding_factor: data.encrypted_blinding_factor,
        value: data.value,
        created_at: new Date(data.created_at),
        verified_at: data.verified_at ? new Date(data.verified_at) : undefined
      };

      // Cache the result
      await setCachedData(cacheKey, record, this.CACHE_TTL);

      return record;
    } catch (error) {
      logger.error('Failed to get commitment by ID', { error, id });
      throw error;
    }
  }

  /**
   * Encrypt blinding factor using AES-256-GCM
   * 
   * @param blindingFactor - Blinding factor to encrypt
   * @returns Encrypted blinding factor as JSON string
   */
  private async encryptBlindingFactor(blindingFactor: string): Promise<string> {
    try {
      const encrypted: EncryptedData = this.encryption.encrypt(
        blindingFactor,
        this.encryptionKey
      );

      // Store as JSON string
      return JSON.stringify(encrypted);
    } catch (error) {
      logger.error('Failed to encrypt blinding factor', { error });
      throw new Error('Blinding factor encryption failed');
    }
  }

  /**
   * Decrypt blinding factor using AES-256-GCM
   * 
   * @param encryptedBlindingFactor - Encrypted blinding factor as JSON string
   * @returns Decrypted blinding factor
   */
  private async decryptBlindingFactor(encryptedBlindingFactor: string): Promise<string> {
    try {
      const encrypted: EncryptedData = JSON.parse(encryptedBlindingFactor);
      
      const decrypted = this.encryption.decrypt(
        encrypted,
        this.encryptionKey
      );

      return decrypted;
    } catch (error) {
      logger.error('Failed to decrypt blinding factor', { error });
      throw new Error('Blinding factor decryption failed');
    }
  }
}

/**
 * Create CommitmentManager instance
 * 
 * @param sipherClient - Sipher API client
 * @param database - Supabase database client
 * @param encryption - Encryption service
 * @returns CommitmentManager instance
 */
export function createCommitmentManager(
  sipherClient: SipherClient,
  database: SupabaseClient,
  encryption: EncryptionService
): CommitmentManager {
  return new CommitmentManager(sipherClient, database, encryption);
}
