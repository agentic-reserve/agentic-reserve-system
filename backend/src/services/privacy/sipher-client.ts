import axios, { AxiosInstance, AxiosError } from 'axios';
import { createHash, randomUUID } from 'crypto';

/**
 * Simple logger utility
 */
const logger = {
  info: (message: string, context?: any) => console.log(`[INFO] ${message}`, context || ''),
  warn: (message: string, context?: any) => console.warn(`[WARN] ${message}`, context || ''),
  error: (message: string, context?: any) => console.error(`[ERROR] ${message}`, context || '')
};

export interface SipherConfig {
  baseUrl: string;
  apiKey: string;
  timeout?: number;
  retries?: number;
}

export interface MetaAddress {
  spendingKey: string;
  viewingKey: string;
  chain: 'solana';
}

export interface StealthAddress {
  address: string;
  ephemeralPublicKey: string;
  viewTag: number;
}

export interface ViewingKey {
  key: string;
  path: string;
  hash: string;
  derivedFrom?: string;
}

export interface Commitment {
  commitment: string;
  blindingFactor: string;
}

export interface PrivacyScore {
  score: number;
  grade: string;
  factors: {
    addressReuse: number;
    amountPatterns: number;
    timingCorrelation: number;
    counterpartyExposure: number;
  };
  recommendations: string[];
}

export class SipherClient {
  private client: AxiosInstance;
  private config: SipherConfig;
  private requestCache: Map<string, any> = new Map();

  constructor(config: SipherConfig) {
    this.config = {
      timeout: 30000,
      retries: 3,
      ...config
    };

    this.client = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'X-API-Key': this.config.apiKey,
        'Content-Type': 'application/json',
        'User-Agent': 'ARS-Protocol/1.0'
      }
    });

    // Add response interceptor for error handling
    this.client.interceptors.response.use(
      response => response,
      error => this.handleError(error)
    );
  }

  /**
   * Generate stealth meta-address keypair
   * @param label - Label for the meta-address
   * @returns Meta-address with spending and viewing keys
   */
  async generateMetaAddress(label: string): Promise<{
    metaAddress: MetaAddress;
    spendingPrivateKey: string;
    viewingPrivateKey: string;
  }> {
    try {
      logger.info(`Generating stealth meta-address: ${label}`);
      
      const { data } = await this.client.post('/v1/stealth/generate', { label });
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to generate meta-address');
      }

      logger.info(`Meta-address generated successfully: ${label}`);
      return data.data;
    } catch (error) {
      logger.error('Failed to generate meta-address', { error, label });
      throw error;
    }
  }

  /**
   * Derive one-time stealth address from meta-address
   * @param recipientMetaAddress - Recipient's meta-address
   * @returns Stealth address and shared secret
   */
  async deriveStealthAddress(recipientMetaAddress: MetaAddress): Promise<{
    stealthAddress: StealthAddress;
    sharedSecret: string;
  }> {
    try {
      logger.info('Deriving stealth address');
      
      const { data } = await this.client.post('/v1/stealth/derive', {
        recipientMetaAddress
      });
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to derive stealth address');
      }

      logger.info(`Stealth address derived: ${data.data.stealthAddress.address}`);
      return data.data;
    } catch (error) {
      logger.error('Failed to derive stealth address', { error });
      throw error;
    }
  }

  /**
   * Check if stealth address is owned by given keys
   * @param stealthAddress - Stealth address to check
   * @param spendingPrivateKey - Spending private key
   * @param viewingPrivateKey - Viewing private key
   * @returns Whether the address is owned
   */
  async checkStealthOwnership(
    stealthAddress: StealthAddress,
    spendingPrivateKey: string,
    viewingPrivateKey: string
  ): Promise<boolean> {
    try {
      const { data } = await this.client.post('/v1/stealth/check', {
        stealthAddress,
        spendingPrivateKey,
        viewingPrivateKey
      });
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to check ownership');
      }

      return data.data.isOwner;
    } catch (error) {
      logger.error('Failed to check stealth ownership', { error });
      throw error;
    }
  }

  /**
   * Build unsigned shielded transfer transaction
   * @param params - Transfer parameters
   * @returns Unsigned transaction and metadata
   */
  async buildShieldedTransfer(params: {
    sender: string;
    recipientMetaAddress: MetaAddress;
    amount: string;
    mint?: string;
  }): Promise<{
    unsignedTransaction: string;
    stealthAddress: StealthAddress;
    commitment: string;
    viewingKeyHash: string;
  }> {
    try {
      const idempotencyKey = randomUUID();
      logger.info('Building shielded transfer', { 
        sender: params.sender, 
        amount: params.amount,
        idempotencyKey 
      });
      
      const { data } = await this.client.post('/v1/transfer/shield', params, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to build shielded transfer');
      }

      logger.info('Shielded transfer built successfully', {
        stealthAddress: data.data.stealthAddress.address
      });
      
      return data.data;
    } catch (error) {
      logger.error('Failed to build shielded transfer', { error, params });
      throw error;
    }
  }

  /**
   * Claim stealth payment to destination address
   * @param params - Claim parameters
   * @returns Transaction signature
   */
  async claimPayment(params: {
    stealthAddress: string;
    ephemeralPublicKey: string;
    spendingPrivateKey: string;
    viewingPrivateKey: string;
    destinationAddress: string;
    mint?: string;
  }): Promise<{ txSignature: string }> {
    try {
      const idempotencyKey = randomUUID();
      logger.info('Claiming stealth payment', { 
        stealthAddress: params.stealthAddress,
        destination: params.destinationAddress,
        idempotencyKey
      });
      
      const { data } = await this.client.post('/v1/transfer/claim', params, {
        headers: { 'Idempotency-Key': idempotencyKey }
      });
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to claim payment');
      }

      logger.info('Payment claimed successfully', { 
        txSignature: data.data.txSignature 
      });
      
      return data.data;
    } catch (error) {
      logger.error('Failed to claim payment', { error, params });
      throw error;
    }
  }

  /**
   * Scan for incoming stealth payments
   * @param params - Scan parameters
   * @returns Array of detected payments
   */
  async scanPayments(params: {
    viewingPrivateKey: string;
    spendingPublicKey: string;
    fromSlot?: number;
    limit?: number;
  }): Promise<Array<{
    stealthAddress: string;
    ephemeralPublicKey: string;
    amount: string;
    slot: number;
    timestamp: number;
  }>> {
    try {
      logger.info('Scanning for payments', { 
        fromSlot: params.fromSlot,
        limit: params.limit 
      });
      
      const { data } = await this.client.post('/v1/scan/payments', {
        ...params,
        limit: params.limit || 100
      });
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to scan payments');
      }

      logger.info(`Found ${data.data.length} payments`);
      return data.data;
    } catch (error) {
      logger.error('Failed to scan payments', { error });
      throw error;
    }
  }

  /**
   * Create Pedersen commitment for amount
   * @param value - Amount to commit
   * @returns Commitment and blinding factor
   */
  async createCommitment(value: string): Promise<Commitment> {
    try {
      const { data } = await this.client.post('/v1/commitment/create', { value });
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to create commitment');
      }

      return data.data;
    } catch (error) {
      logger.error('Failed to create commitment', { error, value });
      throw error;
    }
  }

  /**
   * Verify commitment opening
   * @param params - Commitment verification parameters
   * @returns Whether commitment is valid
   */
  async verifyCommitment(params: {
    commitment: string;
    value: string;
    blindingFactor: string;
  }): Promise<boolean> {
    try {
      const { data } = await this.client.post('/v1/commitment/verify', params);
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to verify commitment');
      }

      return data.data.valid;
    } catch (error) {
      logger.error('Failed to verify commitment', { error });
      throw error;
    }
  }

  /**
   * Add two commitments homomorphically
   * @param params - Commitments to add
   * @returns Combined commitment
   */
  async addCommitments(params: {
    commitmentA: string;
    commitmentB: string;
    blindingA: string;
    blindingB: string;
  }): Promise<Commitment> {
    try {
      const { data } = await this.client.post('/v1/commitment/add', params);
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to add commitments');
      }

      return data.data;
    } catch (error) {
      logger.error('Failed to add commitments', { error });
      throw error;
    }
  }

  /**
   * Subtract two commitments homomorphically
   * @param params - Commitments to subtract
   * @returns Combined commitment
   */
  async subtractCommitments(params: {
    commitmentA: string;
    commitmentB: string;
    blindingA: string;
    blindingB: string;
  }): Promise<Commitment> {
    try {
      const { data } = await this.client.post('/v1/commitment/subtract', params);
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to subtract commitments');
      }

      return data.data;
    } catch (error) {
      logger.error('Failed to subtract commitments', { error });
      throw error;
    }
  }

  /**
   * Generate viewing key for compliance
   * @param path - Derivation path (e.g., 'm/0')
   * @returns Viewing key
   */
  async generateViewingKey(path: string = 'm/0'): Promise<ViewingKey> {
    try {
      logger.info(`Generating viewing key: ${path}`);
      
      const { data } = await this.client.post('/v1/viewing-key/generate', { path });
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to generate viewing key');
      }

      logger.info(`Viewing key generated: ${data.data.hash}`);
      return data.data;
    } catch (error) {
      logger.error('Failed to generate viewing key', { error, path });
      throw error;
    }
  }

  /**
   * Derive child viewing key (BIP32-style)
   * @param masterKey - Master viewing key
   * @param childPath - Child path segment
   * @returns Derived viewing key
   */
  async deriveViewingKey(
    masterKey: ViewingKey,
    childPath: string
  ): Promise<ViewingKey> {
    try {
      logger.info(`Deriving viewing key: ${masterKey.path}/${childPath}`);
      
      const { data } = await this.client.post('/v1/viewing-key/derive', {
        masterKey,
        childPath
      });
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to derive viewing key');
      }

      logger.info(`Viewing key derived: ${data.data.path}`);
      return data.data;
    } catch (error) {
      logger.error('Failed to derive viewing key', { error, childPath });
      throw error;
    }
  }

  /**
   * Verify viewing key hierarchy
   * @param params - Hierarchy verification parameters
   * @returns Whether hierarchy is valid
   */
  async verifyKeyHierarchy(params: {
    parentKey: ViewingKey;
    childKey: ViewingKey;
    childPath: string;
  }): Promise<boolean> {
    try {
      const { data } = await this.client.post('/v1/viewing-key/verify-hierarchy', params);
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to verify hierarchy');
      }

      return data.data.valid;
    } catch (error) {
      logger.error('Failed to verify key hierarchy', { error });
      throw error;
    }
  }

  /**
   * Encrypt transaction data for disclosure
   * @param params - Disclosure parameters
   * @returns Encrypted payload
   */
  async disclose(params: {
    viewingKey: ViewingKey;
    transactionData: any;
  }): Promise<{
    ciphertext: string;
    nonce: string;
    viewingKeyHash: string;
  }> {
    try {
      logger.info('Encrypting transaction data for disclosure');
      
      const { data } = await this.client.post('/v1/viewing-key/disclose', params);
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to disclose');
      }

      return data.data;
    } catch (error) {
      logger.error('Failed to disclose', { error });
      throw error;
    }
  }

  /**
   * Decrypt transaction data with viewing key
   * @param params - Decryption parameters
   * @returns Decrypted transaction data
   */
  async decrypt(params: {
    viewingKey: ViewingKey;
    encrypted: {
      ciphertext: string;
      nonce: string;
      viewingKeyHash: string;
    };
  }): Promise<any> {
    try {
      logger.info('Decrypting transaction data');
      
      const { data } = await this.client.post('/v1/viewing-key/decrypt', params);
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to decrypt');
      }

      return data.data;
    } catch (error) {
      logger.error('Failed to decrypt', { error });
      throw error;
    }
  }

  /**
   * Analyze wallet privacy score
   * @param address - Solana address to analyze
   * @param limit - Number of transactions to analyze
   * @returns Privacy score and recommendations
   */
  async analyzePrivacy(address: string, limit: number = 100): Promise<PrivacyScore> {
    try {
      logger.info(`Analyzing privacy for address: ${address}`);
      
      const { data } = await this.client.post('/v1/privacy/score', {
        address,
        limit
      });
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to analyze privacy');
      }

      logger.info(`Privacy score: ${data.data.score} (${data.data.grade})`);
      return data.data;
    } catch (error) {
      logger.error('Failed to analyze privacy', { error, address });
      throw error;
    }
  }

  /**
   * Batch generate stealth meta-addresses
   * @param count - Number of addresses to generate
   * @param label - Label prefix
   * @returns Array of generated addresses
   */
  async batchGenerateStealth(count: number, label: string = 'Batch'): Promise<any[]> {
    try {
      logger.info(`Batch generating ${count} stealth addresses`);
      
      const { data } = await this.client.post('/v1/stealth/generate/batch', {
        count,
        label
      });
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to batch generate');
      }

      logger.info(`Generated ${data.data.summary.succeeded} addresses`);
      return data.data.results;
    } catch (error) {
      logger.error('Failed to batch generate stealth addresses', { error, count });
      throw error;
    }
  }

  /**
   * Batch create commitments
   * @param values - Array of values to commit
   * @returns Array of commitments
   */
  async batchCreateCommitments(values: string[]): Promise<Commitment[]> {
    try {
      logger.info(`Batch creating ${values.length} commitments`);
      
      const { data } = await this.client.post('/v1/commitment/create/batch', {
        items: values.map(value => ({ value }))
      });
      
      if (!data.success) {
        throw new Error(data.error?.message || 'Failed to batch create commitments');
      }

      return data.data.results.map((r: any) => r.data);
    } catch (error) {
      logger.error('Failed to batch create commitments', { error });
      throw error;
    }
  }

  /**
   * Check Sipher API health
   * @returns Health status
   */
  async checkHealth(): Promise<{
    status: string;
    solana: { connected: boolean; latencyMs: number };
    memory: { used: number; total: number };
  }> {
    try {
      const { data } = await this.client.get('/v1/health');
      return data.data;
    } catch (error) {
      logger.error('Health check failed', { error });
      throw error;
    }
  }

  /**
   * Handle API errors with retry logic
   */
  private async handleError(error: AxiosError): Promise<never> {
    if (error.response) {
      const status = error.response.status;
      const data: any = error.response.data;

      // Log error details
      logger.error('Sipher API error', {
        status,
        code: data.error?.code,
        message: data.error?.message,
        details: data.error?.details
      });

      // Handle specific error codes
      if (status === 401) {
        throw new Error('Invalid Sipher API key');
      } else if (status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.');
      } else if (status >= 500) {
        throw new Error('Sipher service unavailable. Please try again later.');
      }

      throw new Error(data.error?.message || 'Sipher API request failed');
    } else if (error.request) {
      logger.error('No response from Sipher API', { error: error.message });
      throw new Error('Unable to reach Sipher API. Please check your connection.');
    } else {
      logger.error('Request setup error', { error: error.message });
      throw error;
    }
  }
}

// Export singleton instance
let sipherClientInstance: SipherClient | null = null;

export function initializeSipherClient(config: SipherConfig): SipherClient {
  sipherClientInstance = new SipherClient(config);
  return sipherClientInstance;
}

export function getSipherClient(): SipherClient {
  if (!sipherClientInstance) {
    throw new Error('Sipher client not initialized. Call initializeSipherClient first.');
  }
  return sipherClientInstance;
}
