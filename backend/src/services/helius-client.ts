import { Helius } from 'helius-sdk';
import { Connection, PublicKey, Commitment } from '@solana/web3.js';
import { config } from '../config';

/**
 * Helius RPC Client with retry logic and error handling
 * Provides reliable access to Solana blockchain data
 */
export class HeliusClient {
  private helius: Helius;
  private connection: Connection;
  private maxRetries: number = 3;
  private retryDelay: number = 1000; // 1 second

  constructor() {
    const apiKey = config.heliusApiKey || process.env.HELIUS_API_KEY;
    
    if (!apiKey) {
      throw new Error('HELIUS_API_KEY is required');
    }

    // Initialize Helius SDK
    this.helius = new Helius(apiKey);

    // Create connection with Helius RPC endpoint
    const rpcUrl = `https://rpc.helius.xyz/?api-key=${apiKey}`;
    this.connection = new Connection(rpcUrl, {
      commitment: 'confirmed' as Commitment,
      confirmTransactionInitialTimeout: 60000,
    });

    console.log('✅ Helius client initialized');
  }

  /**
   * Get Solana connection for direct RPC calls
   */
  getConnection(): Connection {
    return this.connection;
  }

  /**
   * Get Helius SDK instance for enhanced APIs
   */
  getHelius(): Helius {
    return this.helius;
  }

  /**
   * Retry wrapper for RPC calls with exponential backoff
   */
  private async retry<T>(
    fn: () => Promise<T>,
    retries: number = this.maxRetries
  ): Promise<T> {
    try {
      return await fn();
    } catch (error) {
      if (retries === 0) {
        throw error;
      }

      const delay = this.retryDelay * (this.maxRetries - retries + 1);
      console.warn(`RPC call failed, retrying in ${delay}ms... (${retries} retries left)`);
      
      await new Promise(resolve => setTimeout(resolve, delay));
      return this.retry(fn, retries - 1);
    }
  }

  /**
   * Get account info with retry logic
   */
  async getAccountInfo(pubkey: PublicKey, commitment?: Commitment) {
    return this.retry(() => 
      this.connection.getAccountInfo(pubkey, commitment)
    );
  }

  /**
   * Get multiple accounts with retry logic
   */
  async getMultipleAccounts(pubkeys: PublicKey[], commitment?: Commitment) {
    return this.retry(() => 
      this.connection.getMultipleAccountsInfo(pubkeys, commitment)
    );
  }

  /**
   * Get program accounts with retry logic
   */
  async getProgramAccounts(programId: PublicKey, commitment?: Commitment) {
    return this.retry(() => 
      this.connection.getProgramAccounts(programId, commitment)
    );
  }

  /**
   * Get balance with retry logic
   */
  async getBalance(pubkey: PublicKey, commitment?: Commitment) {
    return this.retry(() => 
      this.connection.getBalance(pubkey, commitment)
    );
  }

  /**
   * Get token account balance with retry logic
   */
  async getTokenAccountBalance(pubkey: PublicKey, commitment?: Commitment) {
    return this.retry(() => 
      this.connection.getTokenAccountBalance(pubkey, commitment)
    );
  }

  /**
   * Get token accounts by owner with retry logic
   */
  async getTokenAccountsByOwner(
    owner: PublicKey,
    filter: { mint: PublicKey } | { programId: PublicKey },
    commitment?: Commitment
  ) {
    return this.retry(() => 
      this.connection.getTokenAccountsByOwner(owner, filter, commitment)
    );
  }

  /**
   * Get recent prioritization fees (Helius Priority Fee API)
   */
  async getRecentPrioritizationFees(accounts?: string[]) {
    return this.retry(async () => {
      const response = await this.connection.getRecentPrioritizationFees({
        lockedWritableAccounts: accounts,
      });
      return response;
    });
  }

  /**
   * Get transaction with retry logic
   */
  async getTransaction(signature: string, commitment?: Commitment) {
    return this.retry(() => 
      this.connection.getTransaction(signature, {
        commitment,
        maxSupportedTransactionVersion: 0,
      })
    );
  }

  /**
   * Get signatures for address with retry logic
   */
  async getSignaturesForAddress(
    address: PublicKey,
    options?: { limit?: number; before?: string; until?: string },
    commitment?: Commitment
  ) {
    return this.retry(() => 
      this.connection.getSignaturesForAddress(address, options, commitment)
    );
  }

  /**
   * Get latest blockhash with retry logic
   */
  async getLatestBlockhash(commitment?: Commitment) {
    return this.retry(() => 
      this.connection.getLatestBlockhash(commitment)
    );
  }

  /**
   * Get slot with retry logic
   */
  async getSlot(commitment?: Commitment) {
    return this.retry(() => 
      this.connection.getSlot(commitment)
    );
  }

  /**
   * Get block time with retry logic
   */
  async getBlockTime(slot: number) {
    return this.retry(() => 
      this.connection.getBlockTime(slot)
    );
  }

  /**
   * Send transaction with retry logic
   */
  async sendTransaction(
    transaction: any,
    options?: { skipPreflight?: boolean; maxRetries?: number }
  ) {
    return this.retry(() => 
      this.connection.sendRawTransaction(transaction, options)
    );
  }

  /**
   * Simulate transaction with retry logic
   */
  async simulateTransaction(transaction: any, commitment?: Commitment) {
    return this.retry(() => 
      this.connection.simulateTransaction(transaction, { commitment })
    );
  }

  /**
   * Get health status
   */
  async getHealth() {
    try {
      const slot = await this.getSlot();
      return {
        healthy: true,
        slot,
        timestamp: Date.now(),
      };
    } catch (error) {
      return {
        healthy: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now(),
      };
    }
  }

  /**
   * Get enhanced transaction data using Helius SDK
   */
  async getEnhancedTransaction(signature: string) {
    return this.retry(() => 
      this.helius.rpc.getTransaction(signature)
    );
  }

  /**
   * Get parsed transaction history using Helius SDK
   */
  async getParsedTransactionHistory(address: string, options?: any) {
    return this.retry(() => 
      this.helius.rpc.getTransactionHistory({
        address,
        ...options,
      })
    );
  }

  /**
   * Get asset data using Helius DAS API
   */
  async getAsset(assetId: string) {
    return this.retry(() => 
      this.helius.rpc.getAsset({ id: assetId })
    );
  }

  /**
   * Get assets by owner using Helius DAS API
   */
  async getAssetsByOwner(owner: string, options?: any) {
    return this.retry(() => 
      this.helius.rpc.getAssetsByOwner({
        ownerAddress: owner,
        ...options,
      })
    );
  }
}

// Singleton instance
let heliusClient: HeliusClient | null = null;

/**
 * Get or create Helius client instance
 */
export function getHeliusClient(): HeliusClient {
  if (!heliusClient) {
    heliusClient = new HeliusClient();
  }
  return heliusClient;
}

/**
 * Initialize Helius client (call this on app startup)
 */
export function initializeHeliusClient(): HeliusClient {
  heliusClient = new HeliusClient();
  return heliusClient;
}
