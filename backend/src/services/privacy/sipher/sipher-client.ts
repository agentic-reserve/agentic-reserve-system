/**
 * Sipher API Client
 * 
 * Core client for interacting with the Sipher Privacy-as-a-Skill REST API.
 * Provides authentication, request/response logging, timeout configuration,
 * and idempotency key generation.
 * 
 * @module sipher-client
 */

import { v4 as uuidv4 } from 'uuid';
import axios, { AxiosInstance, AxiosRequestConfig, AxiosResponse } from 'axios';
import {
  SipherConfig,
  MetaAddress,
  StealthAddress,
  ShieldedTransfer,
  DetectedPayment,
  Commitment,
  ViewingKey,
  PrivacyScore,
  SipherAPIError
} from '../types';
import {
  GenerateMetaAddressRequest,
  GenerateMetaAddressResponse,
  DeriveStealthAddressRequest,
  DeriveStealthAddressResponse,
  BatchGenerateStealthRequest,
  BatchGenerateStealthResponse,
  BuildShieldedTransferRequest,
  BuildShieldedTransferResponse,
  ClaimPaymentRequest,
  ClaimPaymentResponse,
  ScanPaymentsRequest,
  ScanPaymentsResponse,
  CreateCommitmentRequest,
  CreateCommitmentResponse,
  VerifyCommitmentRequest,
  VerifyCommitmentResponse,
  AddCommitmentsRequest,
  AddCommitmentsResponse,
  BatchCreateCommitmentsRequest,
  BatchCreateCommitmentsResponse,
  GenerateViewingKeyRequest,
  GenerateViewingKeyResponse,
  DeriveViewingKeyRequest,
  DeriveViewingKeyResponse,
  VerifyHierarchyRequest,
  VerifyHierarchyResponse,
  DiscloseRequest,
  DiscloseResponse,
  DecryptRequest,
  DecryptResponse,
  AnalyzePrivacyRequest,
  AnalyzePrivacyResponse,
  HealthCheckResponse
} from './types';

/**
 * Logger interface for request/response logging
 */
interface Logger {
  info(message: string, meta?: any): void;
  warn(message: string, meta?: any): void;
  error(message: string, meta?: any): void;
  debug(message: string, meta?: any): void;
}

/**
 * Simple console logger implementation
 */
class ConsoleLogger implements Logger {
  info(message: string, meta?: any): void {
    console.log(`[INFO] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }

  warn(message: string, meta?: any): void {
    console.warn(`[WARN] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }

  error(message: string, meta?: any): void {
    console.error(`[ERROR] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }

  debug(message: string, meta?: any): void {
    console.debug(`[DEBUG] ${message}`, meta ? JSON.stringify(meta, null, 2) : '');
  }
}

/**
 * Sipher API Client
 * 
 * Provides methods for interacting with all Sipher API endpoints including:
 * - Stealth address generation and derivation
 * - Shielded transfer building and claiming
 * - Payment scanning
 * - Pedersen commitment operations
 * - Hierarchical viewing key management
 * - Privacy score analysis
 * 
 * Features:
 * - X-API-Key authentication
 * - UUID v4 idempotency keys for safe retries
 * - Configurable request timeout (default 30000ms)
 * - Request/response logging
 * - Comprehensive error handling
 */
export class SipherClient {
  private readonly axiosInstance: AxiosInstance;
  private readonly config: Required<SipherConfig>;
  private readonly logger: Logger;

  /**
   * Create a new Sipher API client
   * 
   * @param config - Client configuration
   * @param logger - Optional logger instance (defaults to console logger)
   */
  constructor(config: SipherConfig, logger?: Logger) {
    // Set default values for optional config parameters
    this.config = {
      baseUrl: config.baseUrl,
      apiKey: config.apiKey,
      timeout: config.timeout ?? 30000,
      retries: config.retries ?? 3
    };

    this.logger = logger ?? new ConsoleLogger();

    // Create axios instance with base configuration
    this.axiosInstance = axios.create({
      baseURL: this.config.baseUrl,
      timeout: this.config.timeout,
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key': this.config.apiKey
      }
    });

    // Add request interceptor for logging
    this.axiosInstance.interceptors.request.use(
      (config) => {
        this.logger.debug('Sipher API Request', {
          method: config.method?.toUpperCase(),
          url: config.url,
          headers: this.sanitizeHeaders(config.headers),
          data: config.data
        });
        return config;
      },
      (error) => {
        this.logger.error('Sipher API Request Error', { error: error.message });
        return Promise.reject(error);
      }
    );

    // Add response interceptor for logging
    this.axiosInstance.interceptors.response.use(
      (response) => {
        this.logger.debug('Sipher API Response', {
          status: response.status,
          statusText: response.statusText,
          headers: response.headers,
          data: response.data
        });
        return response;
      },
      (error) => {
        this.logger.error('Sipher API Response Error', {
          status: error.response?.status,
          statusText: error.response?.statusText,
          data: error.response?.data,
          message: error.message
        });
        return Promise.reject(this.handleError(error));
      }
    );

    this.logger.info('Sipher API Client initialized', {
      baseUrl: this.config.baseUrl,
      timeout: this.config.timeout,
      retries: this.config.retries
    });
  }

  // ============================================================================
  // Utility Methods
  // ============================================================================

  /**
   * Generate a UUID v4 idempotency key
   * 
   * @returns UUID v4 string
   */
  private generateIdempotencyKey(): string {
    return uuidv4();
  }

  /**
   * Sanitize headers for logging (remove sensitive data)
   * 
   * @param headers - Request headers
   * @returns Sanitized headers
   */
  private sanitizeHeaders(headers: any): any {
    if (!headers) return {};
    
    const sanitized = { ...headers };
    if (sanitized['X-API-Key']) {
      sanitized['X-API-Key'] = '***REDACTED***';
    }
    return sanitized;
  }

  /**
   * Handle API errors and convert to SipherAPIError
   * 
   * @param error - Axios error
   * @returns SipherAPIError
   */
  private handleError(error: any): SipherAPIError {
    if (error.response) {
      // Server responded with error status
      return new SipherAPIError(
        error.response.data?.message || error.message,
        error.response.status,
        error.response.headers,
        error.config?.data,
        error.response.data
      );
    } else if (error.request) {
      // Request made but no response received
      return new SipherAPIError(
        'No response received from Sipher API',
        0,
        {},
        error.config?.data
      );
    } else {
      // Error setting up request
      return new SipherAPIError(
        error.message,
        0,
        {}
      );
    }
  }

  /**
   * Make a POST request with idempotency key
   * 
   * @param endpoint - API endpoint
   * @param data - Request body
   * @param includeIdempotencyKey - Whether to include idempotency key (default true)
   * @returns Response data
   */
  private async post<T>(
    endpoint: string,
    data: any,
    includeIdempotencyKey: boolean = true
  ): Promise<T> {
    const headers: Record<string, string> = {};
    
    if (includeIdempotencyKey) {
      headers['Idempotency-Key'] = this.generateIdempotencyKey();
    }

    const response: AxiosResponse<T> = await this.axiosInstance.post(
      endpoint,
      data,
      { headers }
    );

    return response.data;
  }

  /**
   * Make a GET request
   * 
   * @param endpoint - API endpoint
   * @param params - Query parameters
   * @returns Response data
   */
  private async get<T>(endpoint: string, params?: any): Promise<T> {
    const response: AxiosResponse<T> = await this.axiosInstance.get(endpoint, {
      params
    });

    return response.data;
  }

  // ============================================================================
  // Stealth Address Methods
  // ============================================================================

  /**
   * Generate a new stealth meta-address
   * 
   * Creates a meta-address consisting of spending and viewing key pairs.
   * The meta-address can be used to receive multiple unlinkable payments.
   * 
   * @param label - Human-readable label for the meta-address
   * @returns Meta-address with spending and viewing keys
   */
  async generateMetaAddress(label: string): Promise<MetaAddress> {
    this.logger.info('Generating stealth meta-address', { label });

    const request: GenerateMetaAddressRequest = { label };
    const response = await this.post<GenerateMetaAddressResponse>(
      '/v1/stealth/generate',
      request
    );

    return {
      metaAddress: response.metaAddress,
      spendingPrivateKey: response.spendingPrivateKey,
      viewingPrivateKey: response.viewingPrivateKey,
      label
    };
  }

  /**
   * Derive a one-time stealth address from a meta-address
   * 
   * Creates a unique, unlinkable address for receiving a payment.
   * Each derived address is cryptographically unlinkable from other addresses
   * derived from the same meta-address.
   * 
   * @param recipientMetaAddress - Recipient's meta-address
   * @returns One-time stealth address with ephemeral public key
   */
  async deriveStealthAddress(recipientMetaAddress: MetaAddress): Promise<StealthAddress> {
    this.logger.info('Deriving stealth address', {
      spendingPublicKey: recipientMetaAddress.metaAddress.spendingPublicKey
    });

    const request: DeriveStealthAddressRequest = {
      recipientMetaAddress: recipientMetaAddress.metaAddress
    };

    const response = await this.post<DeriveStealthAddressResponse>(
      '/v1/stealth/derive',
      request
    );

    return {
      address: response.address,
      ephemeralPublicKey: response.ephemeralPublicKey
    };
  }

  /**
   * Batch generate multiple stealth meta-addresses
   * 
   * Efficiently generates multiple meta-addresses in a single API call.
   * Useful for preparing addresses for multi-hop swaps or batch operations.
   * 
   * @param count - Number of addresses to generate (max 100)
   * @param label - Base label for the addresses
   * @returns Array of meta-addresses
   */
  async batchGenerateStealth(count: number, label: string): Promise<MetaAddress[]> {
    if (count > 100) {
      throw new Error('Batch size cannot exceed 100 addresses');
    }

    this.logger.info('Batch generating stealth addresses', { count, label });

    const request: BatchGenerateStealthRequest = { count, label };
    const response = await this.post<BatchGenerateStealthResponse>(
      '/v1/stealth/generate/batch',
      request
    );

    return response.addresses;
  }

  // ============================================================================
  // Shielded Transfer Methods
  // ============================================================================

  /**
   * Build a shielded transfer transaction
   * 
   * Creates an unsigned transaction that transfers tokens to a stealth address
   * with a hidden amount (Pedersen commitment). The transaction must be signed
   * and submitted by the caller.
   * 
   * @param params - Transfer parameters
   * @returns Unsigned transaction with stealth address and commitment
   */
  async buildShieldedTransfer(params: {
    sender: string;
    recipientMetaAddress: MetaAddress;
    amount: string;
    mint?: string;
  }): Promise<ShieldedTransfer> {
    this.logger.info('Building shielded transfer', {
      sender: params.sender,
      amount: params.amount,
      mint: params.mint
    });

    const request: BuildShieldedTransferRequest = {
      sender: params.sender,
      recipientMetaAddress: params.recipientMetaAddress.metaAddress,
      amount: params.amount,
      mint: params.mint
    };

    const response = await this.post<BuildShieldedTransferResponse>(
      '/v1/transfer/shield',
      request
    );

    return {
      unsignedTransaction: response.unsignedTransaction,
      stealthAddress: response.stealthAddress,
      commitment: response.commitment
    };
  }

  /**
   * Claim a stealth payment to a real wallet
   * 
   * Builds and returns a transaction that claims funds from a stealth address
   * to a destination address. Requires the spending and viewing private keys.
   * 
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
    this.logger.info('Claiming stealth payment', {
      stealthAddress: params.stealthAddress,
      destinationAddress: params.destinationAddress
    });

    const request: ClaimPaymentRequest = {
      stealthAddress: params.stealthAddress,
      ephemeralPublicKey: params.ephemeralPublicKey,
      spendingPrivateKey: params.spendingPrivateKey,
      viewingPrivateKey: params.viewingPrivateKey,
      destinationAddress: params.destinationAddress,
      mint: params.mint
    };

    const response = await this.post<ClaimPaymentResponse>(
      '/v1/transfer/claim',
      request
    );

    return { txSignature: response.txSignature };
  }

  // ============================================================================
  // Payment Scanning Methods
  // ============================================================================

  /**
   * Scan for incoming shielded payments
   * 
   * Scans the blockchain for payments sent to stealth addresses derivable
   * from the provided viewing and spending keys. Returns all detected payments
   * within the specified slot range.
   * 
   * @param params - Scan parameters
   * @returns Array of detected payments
   */
  async scanPayments(params: {
    viewingPrivateKey: string;
    spendingPublicKey: string;
    fromSlot?: number;
    limit?: number;
  }): Promise<DetectedPayment[]> {
    this.logger.info('Scanning for payments', {
      fromSlot: params.fromSlot,
      limit: params.limit
    });

    const request: ScanPaymentsRequest = {
      viewingPrivateKey: params.viewingPrivateKey,
      spendingPublicKey: params.spendingPublicKey,
      fromSlot: params.fromSlot,
      limit: params.limit
    };

    const response = await this.post<ScanPaymentsResponse>(
      '/v1/scan/payments',
      request,
      false // Don't include idempotency key for read operations
    );

    return response.payments;
  }

  // ============================================================================
  // Commitment Methods
  // ============================================================================

  /**
   * Create a Pedersen commitment
   * 
   * Creates a cryptographic commitment to a value that hides the value
   * while enabling homomorphic operations. Returns the commitment and
   * blinding factor (which must be kept secret).
   * 
   * @param value - Value to commit to
   * @returns Commitment and blinding factor
   */
  async createCommitment(value: string): Promise<Commitment> {
    this.logger.info('Creating Pedersen commitment');

    const request: CreateCommitmentRequest = { value };
    const response = await this.post<CreateCommitmentResponse>(
      '/v1/commitment/create',
      request
    );

    return {
      commitment: response.commitment,
      blindingFactor: response.blindingFactor,
      value
    };
  }

  /**
   * Verify a commitment opening
   * 
   * Verifies that a commitment was created with the specified value and
   * blinding factor. Returns true if valid, false otherwise.
   * 
   * @param params - Verification parameters
   * @returns Whether the commitment is valid
   */
  async verifyCommitment(params: {
    commitment: string;
    value: string;
    blindingFactor: string;
  }): Promise<{ valid: boolean }> {
    this.logger.info('Verifying commitment');

    const request: VerifyCommitmentRequest = {
      commitment: params.commitment,
      value: params.value,
      blindingFactor: params.blindingFactor
    };

    const response = await this.post<VerifyCommitmentResponse>(
      '/v1/commitment/verify',
      request,
      false // Don't include idempotency key for read operations
    );

    return { valid: response.valid };
  }

  /**
   * Add two commitments homomorphically
   * 
   * Combines two Pedersen commitments such that the result is a commitment
   * to the sum of the original values. This enables combining swap amounts
   * without revealing individual values.
   * 
   * @param params - Addition parameters
   * @returns Combined commitment
   */
  async addCommitments(params: {
    commitmentA: string;
    commitmentB: string;
    blindingA: string;
    blindingB: string;
  }): Promise<Commitment> {
    this.logger.info('Adding commitments homomorphically');

    const request: AddCommitmentsRequest = {
      commitmentA: params.commitmentA,
      commitmentB: params.commitmentB,
      blindingA: params.blindingA,
      blindingB: params.blindingB
    };

    const response = await this.post<AddCommitmentsResponse>(
      '/v1/commitment/add',
      request
    );

    // Calculate the sum of values (caller should know both values)
    return {
      commitment: response.commitment,
      blindingFactor: response.blindingFactor,
      value: '' // Sum value not returned by API
    };
  }

  /**
   * Batch create multiple commitments
   * 
   * Efficiently creates multiple Pedersen commitments in a single API call.
   * Useful for preparing commitments for multi-hop swaps.
   * 
   * @param values - Array of values to commit to
   * @returns Array of commitments
   */
  async batchCreateCommitments(values: string[]): Promise<Commitment[]> {
    this.logger.info('Batch creating commitments', { count: values.length });

    const request: BatchCreateCommitmentsRequest = { values };
    const response = await this.post<BatchCreateCommitmentsResponse>(
      '/v1/commitment/create/batch',
      request
    );

    return response.commitments;
  }

  // ============================================================================
  // Viewing Key Methods
  // ============================================================================

  /**
   * Generate a master viewing key
   * 
   * Creates a master viewing key at the specified BIP32 path.
   * The master key can be used to derive child keys for role-based access.
   * 
   * @param path - BIP32 derivation path (e.g., "m/0")
   * @returns Master viewing key
   */
  async generateViewingKey(path: string): Promise<ViewingKey> {
    this.logger.info('Generating viewing key', { path });

    const request: GenerateViewingKeyRequest = { path };
    const response = await this.post<GenerateViewingKeyResponse>(
      '/v1/viewing-key/generate',
      request
    );

    return {
      key: response.key,
      path: response.path,
      hash: response.hash
    };
  }

  /**
   * Derive a child viewing key
   * 
   * Derives a child viewing key from a master key using BIP32-style derivation.
   * Child keys inherit the decryption capabilities of their parent within their scope.
   * 
   * @param masterKey - Master viewing key
   * @param childPath - Child derivation path (e.g., "m/0/org/2026/Q1")
   * @returns Child viewing key
   */
  async deriveViewingKey(masterKey: ViewingKey, childPath: string): Promise<ViewingKey> {
    this.logger.info('Deriving child viewing key', {
      masterPath: masterKey.path,
      childPath
    });

    const request: DeriveViewingKeyRequest = {
      masterKey: masterKey.key,
      childPath
    };

    const response = await this.post<DeriveViewingKeyResponse>(
      '/v1/viewing-key/derive',
      request
    );

    return {
      key: response.key,
      path: response.path,
      hash: response.hash
    };
  }

  /**
   * Verify viewing key hierarchy
   * 
   * Verifies that a child key was properly derived from a parent key.
   * Returns true if the relationship is valid, false otherwise.
   * 
   * @param parentKey - Parent viewing key
   * @param childKey - Child viewing key
   * @returns Whether the hierarchy is valid
   */
  async verifyHierarchy(parentKey: ViewingKey, childKey: ViewingKey): Promise<{ valid: boolean }> {
    this.logger.info('Verifying viewing key hierarchy', {
      parentPath: parentKey.path,
      childPath: childKey.path
    });

    const request: VerifyHierarchyRequest = {
      parentKey: parentKey.key,
      childKey: childKey.key
    };

    const response = await this.post<VerifyHierarchyResponse>(
      '/v1/viewing-key/verify-hierarchy',
      request,
      false // Don't include idempotency key for read operations
    );

    return { valid: response.valid };
  }

  /**
   * Disclose transaction data to an auditor
   * 
   * Encrypts transaction data with a viewing key for selective disclosure
   * to an auditor. The encrypted data can only be decrypted with the
   * corresponding viewing key.
   * 
   * @param params - Disclosure parameters
   * @returns Encrypted data with metadata
   */
  async disclose(params: {
    viewingKey: ViewingKey;
    transactionData: any;
  }): Promise<{ encrypted: string; keyHash: string; expiresAt: number }> {
    this.logger.info('Disclosing transaction data', {
      keyHash: params.viewingKey.hash
    });

    const request: DiscloseRequest = {
      viewingKey: params.viewingKey.key,
      transactionData: params.transactionData
    };

    const response = await this.post<DiscloseResponse>(
      '/v1/viewing-key/disclose',
      request
    );

    return {
      encrypted: response.encrypted,
      keyHash: response.keyHash,
      expiresAt: response.expiresAt
    };
  }

  /**
   * Decrypt disclosed transaction data
   * 
   * Decrypts transaction data that was disclosed with a viewing key.
   * Returns the transaction fields visible to the viewing key holder.
   * 
   * @param params - Decryption parameters
   * @returns Decrypted transaction data
   */
  async decrypt(params: {
    viewingKey: ViewingKey;
    encrypted: string;
  }): Promise<{ sender: string; recipient: string; amount: string; timestamp: number }> {
    this.logger.info('Decrypting disclosed data', {
      keyHash: params.viewingKey.hash
    });

    const request: DecryptRequest = {
      viewingKey: params.viewingKey.key,
      encrypted: params.encrypted
    };

    const response = await this.post<DecryptResponse>(
      '/v1/viewing-key/decrypt',
      request,
      false // Don't include idempotency key for read operations
    );

    return {
      sender: response.sender,
      recipient: response.recipient,
      amount: response.amount,
      timestamp: response.timestamp
    };
  }

  // ============================================================================
  // Privacy Scoring Methods
  // ============================================================================

  /**
   * Analyze wallet privacy score
   * 
   * Analyzes a wallet's privacy posture and returns a score (0-100),
   * grade (A-F), privacy-reducing factors, and recommendations for improvement.
   * 
   * @param address - Wallet address to analyze
   * @param limit - Optional transaction limit for analysis
   * @returns Privacy score analysis
   */
  async analyzePrivacy(address: string, limit?: number): Promise<PrivacyScore> {
    this.logger.info('Analyzing privacy score', { address, limit });

    const request: AnalyzePrivacyRequest = { address, limit };
    const response = await this.post<AnalyzePrivacyResponse>(
      '/v1/privacy/score',
      request,
      false // Don't include idempotency key for read operations
    );

    return {
      address: response.address,
      score: response.score,
      grade: response.grade,
      factors: response.factors,
      recommendations: response.recommendations,
      analyzedAt: response.analyzedAt
    };
  }

  // ============================================================================
  // Health Check Methods
  // ============================================================================

  /**
   * Check API health status
   * 
   * Verifies that the Sipher API is operational and returns version information.
   * 
   * @returns Health status and version
   */
  async checkHealth(): Promise<{ status: string; version: string }> {
    this.logger.info('Checking API health');

    const response = await this.get<HealthCheckResponse>('/v1/health');

    return {
      status: response.status,
      version: response.version
    };
  }
}
