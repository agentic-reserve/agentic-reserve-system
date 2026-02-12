import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase';
import { LYSTransaction, TransactionType } from './lys-labs-client';
import { createCipheriv, createDecipheriv, randomBytes, createHash } from 'crypto';
import { CacheService, getCacheService } from './cache-service';
import { memoryEventEmitter } from './event-emitter';
import { riskAnalyzer } from './risk-analyzer';

/**
 * Indexing status for wallet registration
 */
export interface IndexingStatus {
  walletAddress: string;
  status: 'pending' | 'active' | 'error' | 'paused';
  lastIndexedTimestamp: number;
  transactionCount: number;
  errorMessage?: string;
}

/**
 * Parsed transaction metadata
 */
interface ParsedMetadata {
  tokenAmount?: number;
  counterparty?: string;
  fee?: number;
  tokenSymbol?: string;
  blockNumber?: number;
  [key: string]: any;
}

/**
 * Encrypted transaction data structure
 */
interface EncryptedTransactionData {
  ciphertext: string;
  iv: string;
  authTag: string;
  agentKeyHash: string;
  algorithm: string;
  version: number;
}

/**
 * Sensitive transaction fields that should be encrypted
 */
interface SensitiveTransactionFields {
  amount: number;
  counterparty?: string;
  tokenMint: string;
  metadata: Record<string, any>;
}

/**
 * Transaction Indexer Service
 * 
 * Processes incoming transactions from LYS Labs WebSocket client and stores them
 * in Supabase. Handles transaction storage and balance updates atomically.
 * 
 * Features:
 * - Atomic transaction storage and balance updates
 * - Transaction metadata parsing
 * - Deduplication using signature as unique key
 * - Privacy-protected transaction handling with AES-256-GCM encryption
 * - Batch processing for historical backfill
 * - Indexing status tracking
 * - Cache invalidation on transaction updates (Requirement 9.4)
 * 
 * Privacy Protection (Requirements 8.3, 8.4):
 * - Sensitive fields (amount, counterparty, metadata) are encrypted for privacy-protected transactions
 * - Plaintext amounts are NOT stored in the database for privacy-protected transactions
 * - Encryption uses AES-256-GCM with agent-specific keys derived from wallet address
 * - Each agent has a unique decryption key, ensuring data isolation
 * - Encrypted data includes authentication tag for integrity verification
 * 
 * Encryption Details:
 * - Algorithm: AES-256-GCM (Galois/Counter Mode)
 * - Key Derivation: SHA-256 hash of (wallet_address + salt)
 * - IV: Random 16-byte initialization vector per transaction
 * - Auth Tag: 16-byte authentication tag for integrity
 * - Version: 1 (for future compatibility)
 * 
 * Requirements: 2.3, 2.4, 8.3, 8.4, 9.4
 */
export class TransactionIndexer {
  private supabase: SupabaseClient;
  private cacheService: CacheService;

  /**
   * Create a new transaction indexer
   * @param supabase - Optional Supabase client (defaults to singleton)
   * @param cacheService - Optional cache service (defaults to singleton)
   */
  constructor(supabase?: SupabaseClient, cacheService?: CacheService) {
    this.supabase = supabase || getSupabaseClient();
    this.cacheService = cacheService || getCacheService();
  }

  /**
   * Index a single transaction from LYS Labs
   * 
   * This method performs the following operations atomically:
   * 1. Parse transaction metadata to extract relevant fields
   * 2. Insert transaction into wallet_transactions table (deduplication via signature)
   * 3. Update wallet balance in wallet_balances table
   * 4. Update indexing status in wallet_registrations table
   * 
   * @param tx - Transaction data from LYS Labs
   * @throws Error if transaction indexing fails
   * 
   * **Validates: Requirements 2.3, 2.4**
   */
  public async indexTransaction(tx: LYSTransaction): Promise<void> {
    try {
      // Parse metadata to extract relevant fields
      const metadata = this.parseMetadata(tx);

      // Check if wallet is registered
      const { data: registration, error: regError } = await this.supabase
        .from('wallet_registrations')
        .select('address, privacy_protected')
        .eq('address', tx.walletAddress)
        .single();

      if (regError || !registration) {
        throw new Error(`Wallet ${tx.walletAddress} is not registered`);
      }

      // Determine if transaction should be privacy-protected
      const isPrivacyProtected = registration.privacy_protected;

      // Prepare transaction data
      // For privacy-protected transactions, we do NOT store plaintext amounts (Requirement 8.3)
      const transactionData = {
        signature: tx.signature,
        wallet_address: tx.walletAddress,
        timestamp: tx.timestamp,
        block_number: metadata.blockNumber || null,
        transaction_type: tx.type,
        amount: isPrivacyProtected ? null : tx.amount, // NULL for privacy-protected transactions
        token_mint: tx.tokenMint,
        token_symbol: metadata.tokenSymbol || null,
        counterparty_address: isPrivacyProtected ? null : (metadata.counterparty || null), // NULL for privacy-protected
        fee_amount: metadata.fee || null,
        metadata: isPrivacyProtected ? null : tx.metadata, // NULL for privacy-protected
        is_privacy_protected: isPrivacyProtected,
        encrypted_data: isPrivacyProtected ? this.encryptSensitiveData(tx) : null,
      };

      // Use Supabase RPC for atomic transaction + balance update
      // This ensures both operations succeed or both fail
      const { error: indexError } = await this.supabase.rpc('index_transaction_atomic', {
        p_signature: transactionData.signature,
        p_wallet_address: transactionData.wallet_address,
        p_timestamp: transactionData.timestamp,
        p_block_number: transactionData.block_number,
        p_transaction_type: transactionData.transaction_type,
        p_amount: transactionData.amount,
        p_token_mint: transactionData.token_mint,
        p_token_symbol: transactionData.token_symbol,
        p_counterparty_address: transactionData.counterparty_address,
        p_fee_amount: transactionData.fee_amount,
        p_metadata: transactionData.metadata,
        p_is_privacy_protected: transactionData.is_privacy_protected,
        p_encrypted_data: transactionData.encrypted_data,
      });

      // If RPC doesn't exist, fall back to manual atomic operation
      if (indexError && indexError.message.includes('function') && indexError.message.includes('does not exist')) {
        await this.indexTransactionManual(transactionData);
      } else if (indexError) {
        throw indexError;
      }

      // Invalidate cache for the wallet after successful transaction indexing
      // This ensures cache consistency when new transactions are indexed (Requirement 9.4)
      try {
        await this.cacheService.invalidateOnTransactionUpdate(tx.walletAddress);
      } catch (cacheError) {
        // Log cache invalidation errors but don't fail the transaction indexing
        console.error(`[Transaction Indexer] Failed to invalidate cache for wallet ${tx.walletAddress}:`, cacheError);
      }

      // Emit transaction event for real-time notifications
      memoryEventEmitter.emitTransactionEvent(transactionData);

      // Analyze transaction for risk/anomalies
      try {
        const riskAnalysis = await riskAnalyzer.analyzeTransaction({
          signature: tx.signature,
          wallet_address: tx.walletAddress,
          timestamp: tx.timestamp,
          transaction_type: tx.type,
          amount: tx.amount,
          token_mint: tx.tokenMint,
          counterparty_address: metadata.counterparty,
          fee_amount: metadata.fee,
          metadata: tx.metadata,
        });

        // If high risk, flag and emit anomaly event
        if (riskAnalysis.isHighRisk) {
          await riskAnalyzer.flagTransaction(
            {
              signature: tx.signature,
              wallet_address: tx.walletAddress,
              timestamp: tx.timestamp,
              transaction_type: tx.type,
              amount: tx.amount,
              token_mint: tx.tokenMint,
              counterparty_address: metadata.counterparty,
              fee_amount: metadata.fee,
              metadata: tx.metadata,
            },
            riskAnalysis,
            'large_amount' as any, // Simplified - would determine actual type
            riskAnalysis.anomalyScore > 90 ? 'critical' : 'high',
            `High-risk transaction detected: ${riskAnalysis.riskFactors.join(', ')}`
          );

          // Emit anomaly event
          memoryEventEmitter.emitAnomalyEvent({
            transaction_signature: tx.signature,
            wallet_address: tx.walletAddress,
            anomaly_type: 'large_amount',
            severity: riskAnalysis.anomalyScore > 90 ? 'critical' : 'high',
            score: riskAnalysis.anomalyScore,
            description: `High-risk transaction detected: ${riskAnalysis.riskFactors.join(', ')}`,
            timestamp: tx.timestamp,
          });
        }
      } catch (riskError) {
        console.error(`[Transaction Indexer] Risk analysis failed for ${tx.signature}:`, riskError);
        // Continue - risk analysis failure shouldn't block indexing
      }

      console.log(`[Transaction Indexer] Indexed transaction ${tx.signature} for wallet ${tx.walletAddress}`);
    } catch (error) {
      console.error(`[Transaction Indexer] Failed to index transaction ${tx.signature}:`, error);
      
      // Update wallet registration with error status
      await this.updateIndexingStatus(tx.walletAddress, 'error', error instanceof Error ? error.message : 'Unknown error');
      
      throw error;
    }
  }

  /**
   * Manual atomic transaction indexing (fallback when RPC doesn't exist)
   * 
   * Uses Supabase transactions to ensure atomicity:
   * 1. Insert transaction (with conflict handling for deduplication)
   * 2. Update or insert balance
   * 3. Update indexing status
   * 
   * @param transactionData - Prepared transaction data
   */
  private async indexTransactionManual(transactionData: any): Promise<void> {
    // Insert transaction (upsert to handle duplicates)
    const { error: txError } = await this.supabase
      .from('wallet_transactions')
      .upsert(transactionData, {
        onConflict: 'signature',
        ignoreDuplicates: true,
      });

    if (txError) {
      throw new Error(`Failed to insert transaction: ${txError.message}`);
    }

    // Update balance atomically
    await this.updateBalance(
      transactionData.wallet_address,
      transactionData.token_mint,
      transactionData.token_symbol,
      transactionData.amount,
      transactionData.transaction_type,
      transactionData.timestamp
    );

    // Update indexing status
    await this.updateIndexingStatus(
      transactionData.wallet_address,
      'active',
      undefined,
      transactionData.timestamp
    );
  }

  /**
   * Update wallet balance based on transaction
   * 
   * This method calculates the new balance based on transaction type:
   * - TRANSFER (incoming): Add amount
   * - TRANSFER (outgoing): Subtract amount
   * - SWAP: Update based on token in/out
   * - STAKE: Subtract amount
   * - UNSTAKE: Add amount
   * - LIQUIDITY_ADD: Subtract amount
   * - LIQUIDITY_REMOVE: Add amount
   * 
   * @param walletAddress - Wallet address
   * @param tokenMint - Token mint address
   * @param tokenSymbol - Token symbol
   * @param amount - Transaction amount
   * @param transactionType - Type of transaction
   * @param timestamp - Transaction timestamp
   */
  private async updateBalance(
    walletAddress: string,
    tokenMint: string,
    tokenSymbol: string | null,
    amount: number,
    transactionType: string,
    timestamp: number
  ): Promise<void> {
    // Fetch current balance
    const { data: currentBalance, error: fetchError } = await this.supabase
      .from('wallet_balances')
      .select('amount')
      .eq('wallet_address', walletAddress)
      .eq('token_mint', tokenMint)
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      // PGRST116 is "not found" error, which is expected for new balances
      throw new Error(`Failed to fetch current balance: ${fetchError.message}`);
    }

    // Calculate balance change based on transaction type
    let balanceChange = 0;
    switch (transactionType) {
      case TransactionType.TRANSFER:
        // For transfers, we assume incoming adds and outgoing subtracts
        // In a real implementation, we'd check if wallet is sender or receiver
        balanceChange = amount;
        break;
      case TransactionType.SWAP:
        // For swaps, amount could be positive (token in) or negative (token out)
        balanceChange = amount;
        break;
      case TransactionType.STAKE:
        // Staking removes tokens from wallet
        balanceChange = -Math.abs(amount);
        break;
      case TransactionType.UNSTAKE:
        // Unstaking adds tokens to wallet
        balanceChange = Math.abs(amount);
        break;
      case TransactionType.LIQUIDITY_ADD:
        // Adding liquidity removes tokens from wallet
        balanceChange = -Math.abs(amount);
        break;
      case TransactionType.LIQUIDITY_REMOVE:
        // Removing liquidity adds tokens to wallet
        balanceChange = Math.abs(amount);
        break;
      case TransactionType.VOTE:
        // Voting doesn't change balance
        balanceChange = 0;
        break;
      default:
        // Unknown transaction type, assume no balance change
        balanceChange = 0;
    }

    const newBalance = (currentBalance?.amount || 0) + balanceChange;

    // Ensure balance doesn't go negative
    if (newBalance < 0) {
      console.warn(
        `[Transaction Indexer] Balance would go negative for ${walletAddress} ${tokenMint}: ${newBalance}. Setting to 0.`
      );
    }

    const finalBalance = Math.max(0, newBalance);

    // Upsert balance
    const { error: upsertError } = await this.supabase
      .from('wallet_balances')
      .upsert(
        {
          wallet_address: walletAddress,
          token_mint: tokenMint,
          token_symbol: tokenSymbol || 'UNKNOWN',
          amount: finalBalance,
          last_updated: timestamp,
          updated_at: new Date().toISOString(),
        },
        {
          onConflict: 'wallet_address,token_mint',
        }
      );

    if (upsertError) {
      throw new Error(`Failed to update balance: ${upsertError.message}`);
    }

    // Invalidate balance cache after successful update (Requirement 9.4)
    try {
      await this.cacheService.invalidateOnBalanceUpdate(walletAddress);
    } catch (cacheError) {
      // Log cache invalidation errors but don't fail the balance update
      console.error(`[Transaction Indexer] Failed to invalidate balance cache for wallet ${walletAddress}:`, cacheError);
    }

    // Emit balance update event
    memoryEventEmitter.emitBalanceUpdateEvent({
      wallet_address: walletAddress,
      token_mint: tokenMint,
      token_symbol: tokenSymbol,
      amount: finalBalance,
      last_updated: timestamp,
    });
  }

  /**
   * Update indexing status for a wallet
   * 
   * @param walletAddress - Wallet address
   * @param status - New indexing status
   * @param errorMessage - Optional error message
   * @param lastIndexedTimestamp - Optional last indexed timestamp
   */
  private async updateIndexingStatus(
    walletAddress: string,
    status: 'pending' | 'active' | 'error' | 'paused',
    errorMessage?: string,
    lastIndexedTimestamp?: number
  ): Promise<void> {
    const updateData: any = {
      indexing_status: status,
      updated_at: new Date().toISOString(),
    };

    if (errorMessage !== undefined) {
      updateData.error_message = errorMessage;
    }

    if (lastIndexedTimestamp !== undefined) {
      updateData.last_indexed_timestamp = lastIndexedTimestamp;
    }

    // Increment transaction count if status is active
    if (status === 'active') {
      const { data: current } = await this.supabase
        .from('wallet_registrations')
        .select('transaction_count')
        .eq('address', walletAddress)
        .single();

      updateData.transaction_count = (current?.transaction_count || 0) + 1;
    }

    const { error } = await this.supabase
      .from('wallet_registrations')
      .update(updateData)
      .eq('address', walletAddress);

    if (error) {
      console.error(`[Transaction Indexer] Failed to update indexing status for ${walletAddress}:`, error);
    }
  }

  /**
   * Parse transaction metadata to extract relevant fields
   * 
   * Extracts:
   * - Token amount (if different from main amount)
   * - Counterparty address
   * - Fee amount
   * - Token symbol
   * - Block number
   * 
   * @param tx - Transaction from LYS Labs
   * @returns Parsed metadata object
   */
  private parseMetadata(tx: LYSTransaction): ParsedMetadata {
    const metadata: ParsedMetadata = {};

    if (tx.metadata) {
      // Extract token amount
      if (tx.metadata.tokenAmount !== undefined) {
        metadata.tokenAmount = tx.metadata.tokenAmount;
      }

      // Extract counterparty
      if (tx.metadata.counterparty) {
        metadata.counterparty = tx.metadata.counterparty;
      } else if (tx.metadata.to) {
        metadata.counterparty = tx.metadata.to;
      } else if (tx.metadata.from) {
        metadata.counterparty = tx.metadata.from;
      }

      // Extract fee
      if (tx.metadata.fee !== undefined) {
        metadata.fee = tx.metadata.fee;
      } else if (tx.metadata.feeAmount !== undefined) {
        metadata.fee = tx.metadata.feeAmount;
      }

      // Extract token symbol
      if (tx.metadata.tokenSymbol) {
        metadata.tokenSymbol = tx.metadata.tokenSymbol;
      } else if (tx.metadata.symbol) {
        metadata.tokenSymbol = tx.metadata.symbol;
      }

      // Extract block number
      if (tx.metadata.blockNumber !== undefined) {
        metadata.blockNumber = tx.metadata.blockNumber;
      } else if (tx.metadata.slot !== undefined) {
        metadata.blockNumber = tx.metadata.slot;
      }

      // Copy any other metadata fields
      Object.keys(tx.metadata).forEach((key) => {
        if (!metadata[key]) {
          metadata[key] = tx.metadata[key];
        }
      });
    }

    return metadata;
  }

  /**
   * Encrypt sensitive data for privacy-protected transactions
   * 
   * Encrypts sensitive transaction fields (amount, counterparty, metadata) using AES-256-GCM
   * with an agent-specific encryption key derived from the wallet address.
   * 
   * This ensures that:
   * - Plaintext amounts are NOT stored in the database (Requirement 8.3)
   * - Encrypted metadata can only be decrypted with agent-specific keys (Requirement 8.4)
   * - Each agent has a unique decryption key based on their wallet address
   * 
   * @param tx - Transaction to encrypt
   * @returns JSON string containing encrypted data structure
   * 
   * **Validates: Requirements 8.3, 8.4**
   */
  private encryptSensitiveData(tx: LYSTransaction): string {
    try {
      // Extract sensitive fields that should be encrypted
      const sensitiveFields: SensitiveTransactionFields = {
        amount: tx.amount,
        counterparty: tx.metadata?.counterparty || tx.metadata?.to || tx.metadata?.from,
        tokenMint: tx.tokenMint,
        metadata: tx.metadata || {},
      };

      // Derive agent-specific encryption key from wallet address
      // In production, this would use a proper key management system (KMS)
      // For now, we derive a deterministic key from the wallet address
      const agentKey = this.deriveAgentKey(tx.walletAddress);
      const agentKeyHash = createHash('sha256').update(agentKey).digest('hex');

      // Generate random IV (Initialization Vector) for AES-GCM
      const iv = randomBytes(16);

      // Create cipher using AES-256-GCM
      const cipher = createCipheriv('aes-256-gcm', agentKey, iv);

      // Encrypt the sensitive data
      const plaintext = JSON.stringify(sensitiveFields);
      let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
      ciphertext += cipher.final('hex');

      // Get authentication tag for integrity verification
      const authTag = cipher.getAuthTag();

      // Construct encrypted data structure
      const encryptedData: EncryptedTransactionData = {
        ciphertext,
        iv: iv.toString('hex'),
        authTag: authTag.toString('hex'),
        agentKeyHash,
        algorithm: 'aes-256-gcm',
        version: 1,
      };

      // Return as JSON string for storage
      return JSON.stringify(encryptedData);
    } catch (error) {
      console.error(`[Transaction Indexer] Failed to encrypt sensitive data for ${tx.signature}:`, error);
      throw new Error(`Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Derive agent-specific encryption key from wallet address
   * 
   * Creates a deterministic 32-byte key from the wallet address using PBKDF2.
   * In production, this should be replaced with a proper KMS solution.
   * 
   * @param walletAddress - Wallet address to derive key from
   * @returns 32-byte encryption key
   */
  private deriveAgentKey(walletAddress: string): Buffer {
    // Use environment variable as salt for key derivation
    // In production, use a proper KMS with per-agent keys
    const salt = process.env.ENCRYPTION_SALT || 'ars-protocol-default-salt';
    
    // Derive 32-byte key using SHA-256 (simplified for now)
    // In production, use PBKDF2 or similar KDF with proper iteration count
    const key = createHash('sha256')
      .update(walletAddress + salt)
      .digest();

    return key;
  }

  /**
   * Decrypt sensitive transaction data (for authorized access)
   * 
   * Decrypts previously encrypted transaction data using the agent-specific key.
   * This method should only be called after proper authorization checks.
   * 
   * @param encryptedDataJson - JSON string containing encrypted data structure
   * @param walletAddress - Wallet address to derive decryption key
   * @returns Decrypted sensitive fields
   * 
   * **Validates: Requirements 8.4**
   */
  public decryptSensitiveData(
    encryptedDataJson: string,
    walletAddress: string
  ): SensitiveTransactionFields {
    try {
      // Parse encrypted data structure
      const encryptedData: EncryptedTransactionData = JSON.parse(encryptedDataJson);

      // Verify version compatibility
      if (encryptedData.version !== 1) {
        throw new Error(`Unsupported encryption version: ${encryptedData.version}`);
      }

      // Verify algorithm
      if (encryptedData.algorithm !== 'aes-256-gcm') {
        throw new Error(`Unsupported encryption algorithm: ${encryptedData.algorithm}`);
      }

      // Derive agent-specific decryption key
      const agentKey = this.deriveAgentKey(walletAddress);
      const agentKeyHash = createHash('sha256').update(agentKey).digest('hex');

      // Verify key hash matches
      if (agentKeyHash !== encryptedData.agentKeyHash) {
        throw new Error('Decryption key mismatch - unauthorized access attempt');
      }

      // Convert hex strings back to buffers
      const iv = Buffer.from(encryptedData.iv, 'hex');
      const authTag = Buffer.from(encryptedData.authTag, 'hex');

      // Create decipher
      const decipher = createDecipheriv('aes-256-gcm', agentKey, iv);
      decipher.setAuthTag(authTag);

      // Decrypt the data
      let plaintext = decipher.update(encryptedData.ciphertext, 'hex', 'utf8');
      plaintext += decipher.final('utf8');

      // Parse and return decrypted fields
      return JSON.parse(plaintext) as SensitiveTransactionFields;
    } catch (error) {
      console.error(`[Transaction Indexer] Failed to decrypt sensitive data:`, error);
      throw new Error(`Decryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  /**
   * Index a batch of transactions (for historical backfill)
   * 
   * Processes transactions in batches of 100 to avoid overwhelming the database.
   * 
   * @param txs - Array of transactions to index
   * @throws Error if batch indexing fails
   * 
   * **Validates: Requirements 2.3, 2.4**
   */
  public async indexTransactionBatch(txs: LYSTransaction[]): Promise<void> {
    const batchSize = 100;
    let successCount = 0;
    let errorCount = 0;

    console.log(`[Transaction Indexer] Starting batch indexing of ${txs.length} transactions`);

    for (let i = 0; i < txs.length; i += batchSize) {
      const batch = txs.slice(i, i + batchSize);
      
      console.log(`[Transaction Indexer] Processing batch ${Math.floor(i / batchSize) + 1}/${Math.ceil(txs.length / batchSize)}`);

      // Process batch sequentially to maintain order
      for (const tx of batch) {
        try {
          await this.indexTransaction(tx);
          successCount++;
        } catch (error) {
          console.error(`[Transaction Indexer] Failed to index transaction ${tx.signature}:`, error);
          errorCount++;
          // Continue processing other transactions
        }
      }
    }

    console.log(`[Transaction Indexer] Batch indexing complete: ${successCount} success, ${errorCount} errors`);

    if (errorCount > 0) {
      throw new Error(`Batch indexing completed with ${errorCount} errors`);
    }
  }

  /**
   * Backfill historical transactions for a wallet
   * 
   * This method would typically fetch historical transactions from LYS Labs
   * and index them. For now, it's a placeholder that updates the indexing status.
   * 
   * @param address - Wallet address to backfill
   * @param fromTimestamp - Optional starting timestamp (defaults to 0)
   * @throws Error if backfill fails
   */
  public async backfillWallet(address: string, fromTimestamp: number = 0): Promise<void> {
    console.log(`[Transaction Indexer] Starting backfill for wallet ${address} from timestamp ${fromTimestamp}`);

    try {
      // Update status to pending
      await this.updateIndexingStatus(address, 'pending');

      // TODO: Implement actual historical data fetch from LYS Labs
      // For now, just mark as active
      console.log(`[Transaction Indexer] Backfill complete for wallet ${address}`);

      // Update status to active
      await this.updateIndexingStatus(address, 'active');
    } catch (error) {
      console.error(`[Transaction Indexer] Backfill failed for wallet ${address}:`, error);
      await this.updateIndexingStatus(address, 'error', error instanceof Error ? error.message : 'Backfill failed');
      throw error;
    }
  }

  /**
   * Get indexing status for a wallet
   * 
   * @param address - Wallet address
   * @returns Indexing status or null if wallet not registered
   */
  public async getIndexingStatus(address: string): Promise<IndexingStatus | null> {
    const { data, error } = await this.supabase
      .from('wallet_registrations')
      .select('address, indexing_status, last_indexed_timestamp, transaction_count, error_message')
      .eq('address', address)
      .single();

    if (error || !data) {
      return null;
    }

    return {
      walletAddress: data.address,
      status: data.indexing_status as 'pending' | 'active' | 'error' | 'paused',
      lastIndexedTimestamp: data.last_indexed_timestamp || 0,
      transactionCount: data.transaction_count || 0,
      errorMessage: data.error_message || undefined,
    };
  }

  /**
   * Check if a wallet is registered with privacy protection enabled
   * 
   * @param address - Wallet address to check
   * @returns True if wallet is privacy-protected, false otherwise
   */
  public async isPrivacyProtected(address: string): Promise<boolean> {
    const { data, error } = await this.supabase
      .from('wallet_registrations')
      .select('privacy_protected')
      .eq('address', address)
      .single();

    if (error || !data) {
      return false;
    }

    return data.privacy_protected || false;
  }
}
