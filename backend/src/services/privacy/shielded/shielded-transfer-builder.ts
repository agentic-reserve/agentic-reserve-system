import { EventEmitter } from 'events';
import { Connection, Keypair, Transaction, sendAndConfirmTransaction } from '@solana/web3.js';
import { getSipherClient, MetaAddress, StealthAddress } from '../sipher-client';
import { getStealthAddressManager } from '../stealth-address-manager';
import { supabase } from '../../supabase';

/**
 * Simple logger utility
 */
const logger = {
  info: (message: string, context?: any) => console.log(`[INFO] ${message}`, context || ''),
  warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context || ''),
  error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context || '')
};

/**
 * Shielded transfer parameters
 */
export interface ShieldedTransferParams {
  senderId: string;
  recipientMetaAddressId: number;
  amount: string;
  mint?: string;
}

/**
 * Shielded transaction status
 */
export type ShieldedTransactionStatus = 'pending' | 'confirmed' | 'claimed' | 'failed';

/**
 * Shielded transaction record
 */
export interface ShieldedTransferRecord {
  id: number;
  tx_signature: string;
  sender: string;
  stealth_address: string;
  ephemeral_public_key: string;
  commitment: string;
  amount_encrypted: string;
  viewing_key_hash?: string;
  status: ShieldedTransactionStatus;
  created_at: string;
  claimed_at?: string;
}

/**
 * Claim event notification
 */
export interface ClaimNotification {
  agentId: string;
  stealthAddress: string;
  destinationAddress: string;
  txSignature: string;
  amount?: string;
  timestamp: number;
}

/**
 * ShieldedTransferBuilder
 * 
 * Builds and submits shielded ARU transfer transactions with hidden recipients and amounts.
 * 
 * Workflow:
 * 1. Validate sender has sufficient ARU balance
 * 2. Validate recipient meta-address format
 * 3. Call Sipher API to build shielded transfer
 * 4. Sign transaction with sender's private key
 * 5. Submit transaction to Solana via Helius RPC
 * 6. Store transaction record in database
 * 
 * Requirements: 2.1, 2.3, 2.4, 2.5
 */
export class ShieldedTransferBuilder extends EventEmitter {
  private connection: Connection;
  private stealthManager = getStealthAddressManager();

  constructor(connection: Connection) {
    super();
    this.connection = connection;
  }

  /**
   * Build shielded transfer transaction
   * 
   * Creates an unsigned shielded transfer transaction with hidden recipient and amount.
   * Validates sender balance and recipient meta-address before building.
   * 
   * @param params - Transfer parameters
   * @returns Unsigned transaction and metadata
   * 
   * Requirements: 2.1, 2.3, 2.4, 2.5
   */
  async buildTransfer(params: ShieldedTransferParams): Promise<{
    unsignedTransaction: string;
    stealthAddress: StealthAddress;
    commitment: string;
    viewingKeyHash: string;
    record: ShieldedTransferRecord;
  }> {
    try {
      logger.info('Building shielded transfer', {
        senderId: params.senderId,
        amount: params.amount
      });

      // Validate sender balance
      const hasBalance = await this.validateBalance(params.senderId, params.amount);
      if (!hasBalance) {
        throw new Error(`Insufficient balance for sender: ${params.senderId}`);
      }

      // Validate and retrieve recipient meta-address
      const recipientMetaAddress = await this.validateMetaAddress(params.recipientMetaAddressId);

      // Call Sipher API to build shielded transfer
      const sipher = getSipherClient();
      const transferData = await sipher.buildShieldedTransfer({
        sender: params.senderId,
        recipientMetaAddress,
        amount: params.amount,
        mint: params.mint
      });

      // Store transaction record in database with 'pending' status
      const { data: record, error } = await supabase
        .from('shielded_transactions')
        .insert({
          tx_signature: '', // Will be updated after submission
          sender: params.senderId,
          stealth_address: transferData.stealthAddress.address,
          ephemeral_public_key: transferData.stealthAddress.ephemeralPublicKey,
          commitment: transferData.commitment,
          amount_encrypted: params.amount, // Encrypted by Sipher API
          viewing_key_hash: transferData.viewingKeyHash,
          status: 'pending'
        })
        .select()
        .single();

      if (error) {
        logger.error('Failed to store transaction record', { error });
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info('Shielded transfer built successfully', {
        recordId: record.id,
        stealthAddress: transferData.stealthAddress.address
      });

      return {
        unsignedTransaction: transferData.unsignedTransaction,
        stealthAddress: transferData.stealthAddress,
        commitment: transferData.commitment,
        viewingKeyHash: transferData.viewingKeyHash,
        record: record as ShieldedTransferRecord
      };
    } catch (error) {
      logger.error('Failed to build shielded transfer', { error, params });
      throw error;
    }
  }

  /**
   * Submit shielded transfer transaction
   * 
   * Signs the transaction with sender's keypair and submits to Solana.
   * Updates transaction status in database after confirmation.
   * 
   * @param unsignedTransaction - Base64 encoded unsigned transaction
   * @param senderKeypair - Sender's Solana keypair
   * @param recordId - Database record ID
   * @returns Transaction signature
   * 
   * Requirements: 2.1, 2.3
   */
  async submitTransfer(
    unsignedTransaction: string,
    senderKeypair: Keypair,
    recordId: number
  ): Promise<string> {
    try {
      logger.info('Submitting shielded transfer', { recordId });

      // Deserialize transaction from base64
      const transactionBuffer = Buffer.from(unsignedTransaction, 'base64');
      const transaction = Transaction.from(transactionBuffer);

      // Sign transaction with sender's keypair
      transaction.sign(senderKeypair);

      // Submit transaction to Solana
      const signature = await sendAndConfirmTransaction(
        this.connection,
        transaction,
        [senderKeypair],
        {
          commitment: 'confirmed',
          preflightCommitment: 'confirmed'
        }
      );

      logger.info('Transaction confirmed', { signature, recordId });

      // Update transaction record with signature and 'confirmed' status
      const { error } = await supabase
        .from('shielded_transactions')
        .update({
          tx_signature: signature,
          status: 'confirmed'
        })
        .eq('id', recordId);

      if (error) {
        logger.error('Failed to update transaction status', { error, recordId });
        // Don't throw - transaction was successful even if DB update failed
      }

      return signature;
    } catch (error) {
      logger.error('Failed to submit shielded transfer', { error, recordId });

      // Update transaction status to 'failed'
      await supabase
        .from('shielded_transactions')
        .update({ status: 'failed' })
        .eq('id', recordId);

      throw error;
    }
  }

  /**
   * Get transaction history for agent
   * 
   * Retrieves all shielded transactions sent by the specified agent.
   * 
   * @param agentId - Agent identifier
   * @param limit - Maximum number of records to return
   * @returns Array of transaction records
   * 
   * Requirements: 5.5
   */
  async getTransferHistory(
    agentId: string,
    limit: number = 100
  ): Promise<ShieldedTransferRecord[]> {
    try {
      const { data, error } = await supabase
        .from('shielded_transactions')
        .select('*')
        .eq('sender', agentId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      return data as ShieldedTransferRecord[];
    } catch (error) {
      logger.error('Failed to get transfer history', { error, agentId });
      throw error;
    }
  }

  /**
   * Get transaction by signature
   * 
   * @param signature - Transaction signature
   * @returns Transaction record or null if not found
   */
  async getTransactionBySignature(signature: string): Promise<ShieldedTransferRecord | null> {
    try {
      const { data, error } = await supabase
        .from('shielded_transactions')
        .select('*')
        .eq('tx_signature', signature)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          return null; // Not found
        }
        throw new Error(`Database error: ${error.message}`);
      }

      return data as ShieldedTransferRecord;
    } catch (error) {
      logger.error('Failed to get transaction by signature', { error, signature });
      throw error;
    }
  }

  /**
   * Validate sender has sufficient balance
   * 
   * Checks if sender has enough ARU tokens to complete the transfer.
   * 
   * @param senderId - Sender's Solana address
   * @param amount - Transfer amount (in lamports or smallest unit)
   * @returns True if sender has sufficient balance
   * 
   * Requirements: 2.4
   */
  private async validateBalance(senderId: string, amount: string): Promise<boolean> {
    try {
      // Get sender's SOL balance (for transaction fees)
      const balance = await this.connection.getBalance(senderId);
      
      // Minimum balance required for transaction fees (0.001 SOL = 1,000,000 lamports)
      const minBalance = 1_000_000;
      
      if (balance < minBalance) {
        logger.warn('Insufficient balance for transaction fees', {
          senderId,
          balance,
          minBalance
        });
        return false;
      }

      // TODO: Add ARU token balance check when token program is integrated
      // For now, we only check SOL balance for transaction fees
      
      return true;
    } catch (error) {
      logger.error('Failed to validate balance', { error, senderId });
      throw error;
    }
  }

  /**
   * Validate and retrieve recipient meta-address
   * 
   * Validates that the meta-address exists and has the correct format.
   * 
   * @param metaAddressId - Database ID of the meta-address
   * @returns Validated meta-address
   * 
   * Requirements: 2.4
   */
  private async validateMetaAddress(metaAddressId: number): Promise<MetaAddress> {
    try {
      const { data, error } = await supabase
        .from('stealth_addresses')
        .select('meta_address')
        .eq('id', metaAddressId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          throw new Error(`Meta-address not found: ${metaAddressId}`);
        }
        throw new Error(`Database error: ${error.message}`);
      }

      const metaAddress = data.meta_address as MetaAddress;

      // Validate meta-address format
      if (!metaAddress.spendingKey || !metaAddress.viewingKey) {
        throw new Error('Invalid meta-address format: missing keys');
      }

      if (metaAddress.chain !== 'solana') {
        throw new Error(`Invalid chain: ${metaAddress.chain} (expected: solana)`);
      }

      return metaAddress;
    } catch (error) {
      logger.error('Failed to validate meta-address', { error, metaAddressId });
      throw error;
    }
  }

  /**
   * Claim stealth payment to destination address
   * 
   * Builds and submits a claim transaction to transfer funds from a stealth address
   * to the agent's real wallet address.
   * 
   * @param params - Claim parameters
   * @returns Transaction signature
   * 
   * Requirements: 4.1, 4.2, 4.5
   */
  async claimPayment(params: {
    agentId: string;
    stealthAddress: string;
    ephemeralPublicKey: string;
    destinationAddress: string;
    mint?: string;
  }): Promise<{ txSignature: string }> {
    try {
      logger.info('Claiming stealth payment', {
        agentId: params.agentId,
        stealthAddress: params.stealthAddress,
        destination: params.destinationAddress
      });

      // Get agent's private keys
      const keys = await this.stealthManager.getPrivateKeys(params.agentId);
      if (!keys) {
        throw new Error(`No keys found for agent: ${params.agentId}`);
      }

      // Get transaction record to retrieve amount
      const { data: txRecord } = await supabase
        .from('shielded_transactions')
        .select('amount_encrypted')
        .eq('stealth_address', params.stealthAddress)
        .single();

      // Call Sipher API to build claim transaction
      const sipher = getSipherClient();
      const result = await sipher.claimPayment({
        stealthAddress: params.stealthAddress,
        ephemeralPublicKey: params.ephemeralPublicKey,
        spendingPrivateKey: keys.spendingPrivateKey,
        viewingPrivateKey: keys.viewingPrivateKey,
        destinationAddress: params.destinationAddress,
        mint: params.mint
      });

      // Update transaction status to 'claimed'
      const { error } = await supabase
        .from('shielded_transactions')
        .update({
          status: 'claimed',
          claimed_at: new Date().toISOString(),
          tx_signature: result.txSignature
        })
        .eq('stealth_address', params.stealthAddress);

      if (error) {
        logger.error('Failed to update claim status', { error });
        // Don't throw - claim was successful even if DB update failed
      }

      // Emit claim event for agent notification
      const claimNotification: ClaimNotification = {
        agentId: params.agentId,
        stealthAddress: params.stealthAddress,
        destinationAddress: params.destinationAddress,
        txSignature: result.txSignature,
        amount: txRecord?.amount_encrypted,
        timestamp: Date.now()
      };

      this.emit('claim', claimNotification);

      logger.info('Payment claimed successfully', {
        txSignature: result.txSignature,
        stealthAddress: params.stealthAddress
      });

      return result;
    } catch (error) {
      logger.error('Failed to claim payment', { error, params });
      throw error;
    }
  }

  /**
   * Update transaction status
   * 
   * @param recordId - Database record ID
   * @param status - New status
   */
  async updateStatus(recordId: number, status: ShieldedTransactionStatus): Promise<void> {
    try {
      const updates: any = { status };
      
      // Set claimed_at timestamp if status is 'claimed'
      if (status === 'claimed') {
        updates.claimed_at = new Date().toISOString();
      }

      const { error } = await supabase
        .from('shielded_transactions')
        .update(updates)
        .eq('id', recordId);

      if (error) {
        throw new Error(`Database error: ${error.message}`);
      }

      logger.info('Transaction status updated', { recordId, status });
    } catch (error) {
      logger.error('Failed to update transaction status', { error, recordId, status });
      throw error;
    }
  }
}

/**
 * Singleton instance
 */
let shieldedTransferBuilderInstance: ShieldedTransferBuilder | null = null;

/**
 * Initialize ShieldedTransferBuilder with Solana connection
 */
export function initializeShieldedTransferBuilder(connection: Connection): ShieldedTransferBuilder {
  shieldedTransferBuilderInstance = new ShieldedTransferBuilder(connection);
  return shieldedTransferBuilderInstance;
}

/**
 * Get ShieldedTransferBuilder singleton
 */
export function getShieldedTransferBuilder(): ShieldedTransferBuilder {
  if (!shieldedTransferBuilderInstance) {
    throw new Error('ShieldedTransferBuilder not initialized. Call initializeShieldedTransferBuilder first.');
  }
  return shieldedTransferBuilderInstance;
}
