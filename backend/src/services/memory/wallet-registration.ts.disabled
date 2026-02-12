import { SupabaseClient } from '@supabase/supabase-js';
import { getSupabaseClient } from '../supabase';
import { LYSLabsClient } from './lys-labs-client';
import { TransactionIndexer } from './transaction-indexer';

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
 * Wallet registration parameters
 */
export interface WalletRegistrationParams {
  address: string;
  privacyProtected?: boolean;
  label?: string;
  agentId?: string;
}

/**
 * Wallet registration record
 */
export interface WalletRegistration {
  address: string;
  registeredAt: number;
  indexingStatus: IndexingStatus;
  privacyProtected: boolean;
  label?: string;
  agentId?: string;
}

/**
 * Filter for listing wallet registrations
 */
export interface RegistrationFilter {
  status?: IndexingStatus['status'];
  privacyProtected?: boolean;
  agentId?: string;
}

/**
 * Wallet Registration Manager
 * 
 * Manages the lifecycle of wallet registrations for the Memory Service.
 * Handles wallet registration, unregistration, and status queries.
 * 
 * Features:
 * - Privacy-protected wallet registration (Requirement 11.2)
 * - Historical data retention on unregistration (Requirement 11.7)
 * - Registration status queries (Requirement 11.5, 11.6)
 * - Auto-registration of ARS protocol wallets (Requirement 11.1)
 * - Bulk wallet registration (Requirement 11.8)
 * - Integration with LYS Labs WebSocket for transaction indexing
 * - Integration with Transaction Indexer for historical backfill
 * 
 * Privacy Protection:
 * - Supports privacy flag for stealth addresses (Requirement 8.1)
 * - Privacy-protected wallets are marked in wallet_registrations table
 * - Transaction data for privacy-protected wallets is encrypted
 * 
 * Data Retention:
 * - Unregistered wallets retain all historical data (Requirement 11.7)
 * - Only stops receiving new transaction updates from LYS Labs
 * - Indexing status is updated to 'paused' on unregistration
 * 
 * Requirements: 11.2, 11.5, 11.6, 11.7
 */
export class WalletRegistrationManager {
  private supabase: SupabaseClient;
  private lysLabsClient: LYSLabsClient | null = null;
  private transactionIndexer: TransactionIndexer;

  /**
   * Create a new wallet registration manager
   * @param supabase - Optional Supabase client (defaults to singleton)
   * @param lysLabsClient - Optional LYS Labs WebSocket client
   * @param transactionIndexer - Optional transaction indexer
   */
  constructor(
    supabase?: SupabaseClient,
    lysLabsClient?: LYSLabsClient,
    transactionIndexer?: TransactionIndexer
  ) {
    this.supabase = supabase || getSupabaseClient();
    this.lysLabsClient = lysLabsClient || null;
    this.transactionIndexer = transactionIndexer || new TransactionIndexer(this.supabase);
  }

  /**
   * Set the LYS Labs WebSocket client
   * 
   * This method allows injecting the WebSocket client after construction,
   * which is useful for testing and initialization order management.
   * 
   * @param client - LYS Labs WebSocket client
   */
  public setLYSLabsClient(client: LYSLabsClient): void {
    this.lysLabsClient = client;
  }

  /**
   * Register a wallet for transaction indexing
   * 
   * This method:
   * 1. Validates the wallet address
   * 2. Creates a registration record in wallet_registrations table
   * 3. Sets indexing status to 'pending'
   * 4. Subscribes to LYS Labs WebSocket for real-time updates
   * 5. Triggers historical backfill (if configured)
   * 
   * Privacy Protection (Requirement 11.2):
   * - Supports privacyProtected flag for stealth addresses
   * - Privacy-protected wallets have encrypted transaction data
   * - Authorization required to query privacy-protected wallet data
   * 
   * @param params - Wallet registration parameters
   * @returns Wallet registration record
   * @throws Error if registration fails or wallet already registered
   * 
   * **Validates: Requirements 11.2**
   */
  public async registerWallet(params: WalletRegistrationParams): Promise<WalletRegistration> {
    try {
      // Validate wallet address
      this.validateWalletAddress(params.address);

      // Check if wallet is already registered
      const existing = await this.getRegistration(params.address);
      if (existing) {
        throw new Error(`Wallet ${params.address} is already registered`);
      }

      // Create registration record
      const registrationData = {
        address: params.address,
        registered_at: new Date().toISOString(),
        indexing_status: 'pending' as const,
        last_indexed_timestamp: null,
        transaction_count: 0,
        privacy_protected: params.privacyProtected || false,
        label: params.label || null,
        agent_id: params.agentId || null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };

      const { data, error } = await this.supabase
        .from('wallet_registrations')
        .insert(registrationData)
        .select()
        .single();

      if (error) {
        throw new Error(`Failed to register wallet: ${error.message}`);
      }

      console.log(`[Wallet Registration] Registered wallet ${params.address} (privacy: ${params.privacyProtected || false})`);

      // Subscribe to LYS Labs WebSocket for real-time updates
      if (this.lysLabsClient && this.lysLabsClient.isConnected()) {
        try {
          await this.lysLabsClient.subscribeWallet(params.address);
          console.log(`[Wallet Registration] Subscribed to LYS Labs for wallet ${params.address}`);
        } catch (error) {
          console.error(`[Wallet Registration] Failed to subscribe to LYS Labs for wallet ${params.address}:`, error);
          // Don't fail registration if subscription fails - it will be retried on reconnect
        }
      }

      // Trigger historical backfill
      // This is done asynchronously to not block registration
      this.transactionIndexer.backfillWallet(params.address).catch((error) => {
        console.error(`[Wallet Registration] Historical backfill failed for wallet ${params.address}:`, error);
      });

      // Construct and return registration record
      const registration: WalletRegistration = {
        address: data.address,
        registeredAt: new Date(data.registered_at).getTime(),
        indexingStatus: {
          walletAddress: data.address,
          status: data.indexing_status,
          lastIndexedTimestamp: data.last_indexed_timestamp || 0,
          transactionCount: data.transaction_count || 0,
          errorMessage: data.error_message || undefined,
        },
        privacyProtected: data.privacy_protected || false,
        label: data.label || undefined,
        agentId: data.agent_id || undefined,
      };

      return registration;
    } catch (error) {
      console.error(`[Wallet Registration] Failed to register wallet ${params.address}:`, error);
      throw error;
    }
  }

  /**
   * Unregister a wallet and stop indexing
   * 
   * This method:
   * 1. Validates the wallet is registered
   * 2. Unsubscribes from LYS Labs WebSocket
   * 3. Updates indexing status to 'paused'
   * 4. RETAINS all historical data in the database
   * 
   * Data Retention (Requirement 11.7):
   * - All historical transaction data is retained
   * - All balance snapshots are retained
   * - All PnL calculations are retained
   * - Only stops receiving new transaction updates
   * - Indexing status is set to 'paused' (not deleted)
   * 
   * @param address - Wallet address to unregister
   * @throws Error if unregistration fails or wallet not registered
   * 
   * **Validates: Requirements 11.7**
   */
  public async unregisterWallet(address: string): Promise<void> {
    try {
      // Validate wallet address
      this.validateWalletAddress(address);

      // Check if wallet is registered
      const existing = await this.getRegistration(address);
      if (!existing) {
        throw new Error(`Wallet ${address} is not registered`);
      }

      // Unsubscribe from LYS Labs WebSocket
      if (this.lysLabsClient && this.lysLabsClient.isConnected()) {
        try {
          await this.lysLabsClient.unsubscribeWallet(address);
          console.log(`[Wallet Registration] Unsubscribed from LYS Labs for wallet ${address}`);
        } catch (error) {
          console.error(`[Wallet Registration] Failed to unsubscribe from LYS Labs for wallet ${address}:`, error);
          // Continue with unregistration even if unsubscription fails
        }
      }

      // Update indexing status to 'paused' (RETAIN historical data)
      const { error } = await this.supabase
        .from('wallet_registrations')
        .update({
          indexing_status: 'paused',
          updated_at: new Date().toISOString(),
        })
        .eq('address', address);

      if (error) {
        throw new Error(`Failed to unregister wallet: ${error.message}`);
      }

      console.log(`[Wallet Registration] Unregistered wallet ${address} (historical data retained)`);
    } catch (error) {
      console.error(`[Wallet Registration] Failed to unregister wallet ${address}:`, error);
      throw error;
    }
  }

  /**
   * Get registration record for a wallet
   * 
   * Retrieves the current registration status and metadata for a wallet.
   * Returns null if the wallet is not registered.
   * 
   * @param address - Wallet address to query
   * @returns Wallet registration record or null if not registered
   * 
   * **Validates: Requirements 11.5**
   */
  public async getRegistration(address: string): Promise<WalletRegistration | null> {
    try {
      // Validate wallet address
      this.validateWalletAddress(address);

      const { data, error } = await this.supabase
        .from('wallet_registrations')
        .select('*')
        .eq('address', address)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          // Not found error
          return null;
        }
        throw new Error(`Failed to get registration: ${error.message}`);
      }

      if (!data) {
        return null;
      }

      // Construct registration record
      const registration: WalletRegistration = {
        address: data.address,
        registeredAt: new Date(data.registered_at).getTime(),
        indexingStatus: {
          walletAddress: data.address,
          status: data.indexing_status,
          lastIndexedTimestamp: data.last_indexed_timestamp || 0,
          transactionCount: data.transaction_count || 0,
          errorMessage: data.error_message || undefined,
        },
        privacyProtected: data.privacy_protected || false,
        label: data.label || undefined,
        agentId: data.agent_id || undefined,
      };

      return registration;
    } catch (error) {
      console.error(`[Wallet Registration] Failed to get registration for wallet ${address}:`, error);
      throw error;
    }
  }

  /**
   * List wallet registrations with optional filtering
   * 
   * Retrieves all wallet registrations that match the specified filter criteria.
   * If no filter is provided, returns all registrations.
   * 
   * Filter Options:
   * - status: Filter by indexing status (pending, active, error, paused)
   * - privacyProtected: Filter by privacy protection flag
   * - agentId: Filter by agent ID
   * 
   * @param filter - Optional filter criteria
   * @returns Array of wallet registration records
   * 
   * **Validates: Requirements 11.6**
   */
  public async listRegistrations(filter?: RegistrationFilter): Promise<WalletRegistration[]> {
    try {
      let query = this.supabase.from('wallet_registrations').select('*');

      // Apply filters
      if (filter) {
        if (filter.status) {
          query = query.eq('indexing_status', filter.status);
        }
        if (filter.privacyProtected !== undefined) {
          query = query.eq('privacy_protected', filter.privacyProtected);
        }
        if (filter.agentId) {
          query = query.eq('agent_id', filter.agentId);
        }
      }

      const { data, error } = await query;

      if (error) {
        throw new Error(`Failed to list registrations: ${error.message}`);
      }

      if (!data || data.length === 0) {
        return [];
      }

      // Construct registration records
      const registrations: WalletRegistration[] = data.map((row) => ({
        address: row.address,
        registeredAt: new Date(row.registered_at).getTime(),
        indexingStatus: {
          walletAddress: row.address,
          status: row.indexing_status,
          lastIndexedTimestamp: row.last_indexed_timestamp || 0,
          transactionCount: row.transaction_count || 0,
          errorMessage: row.error_message || undefined,
        },
        privacyProtected: row.privacy_protected || false,
        label: row.label || undefined,
        agentId: row.agent_id || undefined,
      }));

      return registrations;
    } catch (error) {
      console.error('[Wallet Registration] Failed to list registrations:', error);
      throw error;
    }
  }

  /**
   * Register multiple wallets in bulk
   * 
   * Registers multiple wallets atomically - either all succeed or all fail.
   * This is useful for CSV uploads or batch operations.
   * 
   * Atomicity:
   * - Uses Supabase transaction to ensure all-or-nothing behavior
   * - If any registration fails, all registrations are rolled back
   * - Subscriptions to LYS Labs are done after successful registration
   * 
   * @param addresses - Array of wallet addresses to register
   * @returns Array of wallet registration records
   * @throws Error if any registration fails
   * 
   * **Validates: Requirements 11.8**
   */
  public async registerWalletsBulk(addresses: string[]): Promise<WalletRegistration[]> {
    try {
      // Validate all addresses first
      addresses.forEach((address) => this.validateWalletAddress(address));

      // Check for duplicates in input
      const uniqueAddresses = [...new Set(addresses)];
      if (uniqueAddresses.length !== addresses.length) {
        throw new Error('Duplicate addresses in bulk registration request');
      }

      // Check if any wallets are already registered
      const existingRegistrations = await Promise.all(
        uniqueAddresses.map((address) => this.getRegistration(address))
      );

      const alreadyRegistered = existingRegistrations
        .filter((reg) => reg !== null)
        .map((reg) => reg!.address);

      if (alreadyRegistered.length > 0) {
        throw new Error(`Wallets already registered: ${alreadyRegistered.join(', ')}`);
      }

      // Prepare registration data
      const registrationData = uniqueAddresses.map((address) => ({
        address,
        registered_at: new Date().toISOString(),
        indexing_status: 'pending' as const,
        last_indexed_timestamp: null,
        transaction_count: 0,
        privacy_protected: false, // Default to false for bulk registration
        label: null,
        agent_id: null,
        error_message: null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      }));

      // Insert all registrations atomically
      const { data, error } = await this.supabase
        .from('wallet_registrations')
        .insert(registrationData)
        .select();

      if (error) {
        throw new Error(`Failed to register wallets in bulk: ${error.message}`);
      }

      console.log(`[Wallet Registration] Registered ${uniqueAddresses.length} wallets in bulk`);

      // Subscribe to LYS Labs WebSocket for all wallets
      if (this.lysLabsClient && this.lysLabsClient.isConnected()) {
        for (const address of uniqueAddresses) {
          try {
            await this.lysLabsClient.subscribeWallet(address);
            console.log(`[Wallet Registration] Subscribed to LYS Labs for wallet ${address}`);
          } catch (error) {
            console.error(`[Wallet Registration] Failed to subscribe to LYS Labs for wallet ${address}:`, error);
            // Continue with other subscriptions
          }
        }
      }

      // Trigger historical backfill for all wallets (asynchronously)
      uniqueAddresses.forEach((address) => {
        this.transactionIndexer.backfillWallet(address).catch((error) => {
          console.error(`[Wallet Registration] Historical backfill failed for wallet ${address}:`, error);
        });
      });

      // Construct and return registration records
      const registrations: WalletRegistration[] = data.map((row) => ({
        address: row.address,
        registeredAt: new Date(row.registered_at).getTime(),
        indexingStatus: {
          walletAddress: row.address,
          status: row.indexing_status,
          lastIndexedTimestamp: row.last_indexed_timestamp || 0,
          transactionCount: row.transaction_count || 0,
          errorMessage: row.error_message || undefined,
        },
        privacyProtected: row.privacy_protected || false,
        label: row.label || undefined,
        agentId: row.agent_id || undefined,
      }));

      return registrations;
    } catch (error) {
      console.error('[Wallet Registration] Failed to register wallets in bulk:', error);
      throw error;
    }
  }

  /**
   * Auto-register ARS protocol wallets on service startup
   * 
   * Reads wallet addresses from environment configuration and registers them
   * automatically. This ensures that core protocol wallets are always indexed.
   * 
   * Configuration:
   * - MEMORY_AUTO_REGISTER: Enable/disable auto-registration
   * - MEMORY_PROTOCOL_WALLETS: Comma-separated list of wallet addresses
   * 
   * Behavior:
   * - Skips wallets that are already registered
   * - Logs errors but doesn't fail if some registrations fail
   * - Returns count of successfully registered wallets
   * 
   * @returns Number of wallets successfully registered
   * 
   * **Validates: Requirements 11.1**
   */
  public async autoRegisterProtocolWallets(): Promise<number> {
    try {
      // Read configuration from environment
      const autoRegisterEnabled = process.env.MEMORY_AUTO_REGISTER === 'true';
      const protocolWallets = (process.env.MEMORY_PROTOCOL_WALLETS || '')
        .split(',')
        .map((addr) => addr.trim())
        .filter(Boolean);

      if (!autoRegisterEnabled) {
        console.log('[Wallet Registration] Auto-registration is disabled');
        return 0;
      }

      if (protocolWallets.length === 0) {
        console.log('[Wallet Registration] No protocol wallets configured for auto-registration');
        return 0;
      }

      console.log(`[Wallet Registration] Auto-registering ${protocolWallets.length} protocol wallets`);

      let successCount = 0;
      let skipCount = 0;
      let errorCount = 0;

      for (const address of protocolWallets) {
        try {
          // Check if already registered
          const existing = await this.getRegistration(address);
          if (existing) {
            console.log(`[Wallet Registration] Wallet ${address} already registered, skipping`);
            skipCount++;
            continue;
          }

          // Register wallet
          await this.registerWallet({
            address,
            privacyProtected: false,
            label: 'ARS Protocol Wallet',
            agentId: 'system',
          });

          successCount++;
        } catch (error) {
          console.error(`[Wallet Registration] Failed to auto-register wallet ${address}:`, error);
          errorCount++;
          // Continue with other wallets
        }
      }

      console.log(
        `[Wallet Registration] Auto-registration complete: ${successCount} registered, ${skipCount} skipped, ${errorCount} errors`
      );

      return successCount;
    } catch (error) {
      console.error('[Wallet Registration] Auto-registration failed:', error);
      return 0;
    }
  }

  /**
   * Auto-register ARS protocol wallets and warm cache on service startup
   * 
   * This method combines auto-registration with cache warming to ensure that
   * ARS protocol wallets are registered and their data is pre-loaded into cache
   * for optimal initial query performance.
   * 
   * Process:
   * 1. Auto-register ARS protocol wallets (if not already registered)
   * 2. Get list of all registered protocol wallets (including previously registered)
   * 3. Warm cache for all protocol wallets
   * 
   * This ensures that even if wallets were registered in a previous session,
   * their cache is warmed on every startup.
   * 
   * @param cacheService - Optional cache service instance (defaults to singleton)
   * @returns Object with registration count and cache warming results
   * 
   * **Validates: Requirements 11.1, 9.6**
   */
  public async autoRegisterAndWarmCache(cacheService?: any): Promise<{
    registeredCount: number;
    cacheWarmingResults: {
      successCount: number;
      errorCount: number;
      totalTimeMs: number;
    };
  }> {
    try {
      // Step 1: Auto-register protocol wallets
      const registeredCount = await this.autoRegisterProtocolWallets();

      // Step 2: Get all protocol wallet addresses (including previously registered)
      const protocolWallets = (process.env.MEMORY_PROTOCOL_WALLETS || '')
        .split(',')
        .map((addr) => addr.trim())
        .filter(Boolean);

      if (protocolWallets.length === 0) {
        console.log('[Wallet Registration] No protocol wallets to warm cache for');
        return {
          registeredCount,
          cacheWarmingResults: {
            successCount: 0,
            errorCount: 0,
            totalTimeMs: 0,
          },
        };
      }

      // Step 3: Warm cache for all protocol wallets
      console.log(`[Wallet Registration] Warming cache for ${protocolWallets.length} protocol wallets...`);

      // Import cache service if not provided
      if (!cacheService) {
        const { getCacheService } = await import('./cache-service');
        cacheService = getCacheService();
      }

      const cacheWarmingResults = await cacheService.warmCache(protocolWallets);

      console.log(
        `[Wallet Registration] Auto-registration and cache warming complete: ${registeredCount} registered, ${cacheWarmingResults.successCount} caches warmed`
      );

      return {
        registeredCount,
        cacheWarmingResults,
      };
    } catch (error) {
      console.error('[Wallet Registration] Auto-registration and cache warming failed:', error);
      throw error;
    }
  }

  /**
   * Validate wallet address format
   * 
   * Performs basic validation on Solana wallet addresses:
   * - Must be a non-empty string
   * - Must be between 32 and 44 characters (base58 encoding)
   * - Must contain only valid base58 characters
   * 
   * @param address - Wallet address to validate
   * @throws Error if address is invalid
   */
  private validateWalletAddress(address: string): void {
    if (!address || typeof address !== 'string') {
      throw new Error('Wallet address must be a non-empty string');
    }

    // Solana addresses are base58 encoded and typically 32-44 characters
    if (address.length < 32 || address.length > 44) {
      throw new Error('Invalid wallet address length (must be 32-44 characters)');
    }

    // Check for valid base58 characters (no 0, O, I, l)
    const base58Regex = /^[1-9A-HJ-NP-Za-km-z]+$/;
    if (!base58Regex.test(address)) {
      throw new Error('Invalid wallet address format (must be base58 encoded)');
    }
  }

  /**
   * Get count of registered wallets by status
   * 
   * Returns a summary of wallet registrations grouped by indexing status.
   * Useful for monitoring and dashboard displays.
   * 
   * @returns Object with counts by status
   */
  public async getRegistrationStats(): Promise<{
    total: number;
    pending: number;
    active: number;
    error: number;
    paused: number;
    privacyProtected: number;
  }> {
    try {
      const { data, error } = await this.supabase
        .from('wallet_registrations')
        .select('indexing_status, privacy_protected');

      if (error) {
        throw new Error(`Failed to get registration stats: ${error.message}`);
      }

      const stats = {
        total: data?.length || 0,
        pending: 0,
        active: 0,
        error: 0,
        paused: 0,
        privacyProtected: 0,
      };

      if (data) {
        data.forEach((row) => {
          switch (row.indexing_status) {
            case 'pending':
              stats.pending++;
              break;
            case 'active':
              stats.active++;
              break;
            case 'error':
              stats.error++;
              break;
            case 'paused':
              stats.paused++;
              break;
          }

          if (row.privacy_protected) {
            stats.privacyProtected++;
          }
        });
      }

      return stats;
    } catch (error) {
      console.error('[Wallet Registration] Failed to get registration stats:', error);
      throw error;
    }
  }
}
