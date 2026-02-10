/**
 * Common Type Definitions for Privacy Services
 * 
 * This file contains shared type definitions used across all privacy modules.
 */

// ============================================================================
// Sipher API Configuration
// ============================================================================

export interface SipherConfig {
  baseUrl: string;              // https://sipher.sip-protocol.org
  apiKey: string;               // X-API-Key header
  timeout?: number;             // Request timeout (default 30000ms)
  retries?: number;             // Retry attempts (default 3)
}

// ============================================================================
// Encryption Types
// ============================================================================

export interface EncryptionConfig {
  algorithm: string;
  keyDerivation: string;
  iterations: number;
  keyLength: number;
  ivLength: number;
  saltLength: number;
}

export interface EncryptedData {
  encrypted: string;    // Hex-encoded ciphertext
  iv: string;          // Hex-encoded initialization vector
  tag: string;         // Hex-encoded authentication tag (GCM)
  salt: string;        // Hex-encoded salt for key derivation
}

// ============================================================================
// Stealth Address Types
// ============================================================================

export interface MetaAddress {
  metaAddress: {
    spendingPublicKey: string;  // Base58 encoded
    viewingPublicKey: string;   // Base58 encoded
  };
  spendingPrivateKey: string;   // Base58 encoded (encrypt before storage)
  viewingPrivateKey: string;    // Base58 encoded (encrypt before storage)
  label: string;
}

export interface StealthAddress {
  address: string;              // One-time Solana address
  ephemeralPublicKey: string;   // For derivation
}

export type StealthAddressStatus = 'active' | 'used' | 'expired';

export interface StealthAddressRecord {
  id: number;
  agentId: string;
  metaAddress: MetaAddress;
  encryptedSpendingKey: string;  // AES-256 encrypted
  encryptedViewingKey: string;   // AES-256 encrypted
  label: string;
  createdAt: Date;
}

export interface StealthAddressDB {
  id: number;
  agent_id: string;
  meta_address: {
    spendingPublicKey: string;
    viewingPublicKey: string;
  };
  encrypted_spending_key: string;
  encrypted_viewing_key: string;
  label: string;
  created_at: Date;
}

// ============================================================================
// Shielded Transfer Types
// ============================================================================

export interface ShieldedTransfer {
  unsignedTransaction: string;  // Base64 encoded transaction
  stealthAddress: StealthAddress;
  commitment: string;           // Pedersen commitment (hex)
}

export interface ShieldedTransferParams {
  senderId: string;
  recipientMetaAddressId: number;
  amount: string;
  mint?: string;
}

export type ShieldedTransactionStatus = 'pending' | 'confirmed' | 'claimed' | 'failed';

export interface ShieldedTransferRecord {
  id: number;
  txSignature: string;
  sender: string;
  stealthAddress: string;
  ephemeralPublicKey: string;
  commitment: string;
  amountEncrypted: string;
  viewingKeyHash?: string;
  status: ShieldedTransactionStatus;
  createdAt: Date;
  claimedAt?: Date;
}

export interface ShieldedTransactionDB {
  id: number;
  tx_signature: string;
  sender: string;
  stealth_address: string;
  ephemeral_public_key: string;
  commitment: string;
  amount_encrypted: string;
  viewing_key_hash?: string;
  status: ShieldedTransactionStatus;
  created_at: Date;
  claimed_at?: Date;
}

// ============================================================================
// Payment Scanning Types
// ============================================================================

export interface DetectedPayment {
  stealthAddress: string;
  ephemeralPublicKey: string;
  commitment: string;
  slot: number;
  timestamp: number;
}

export interface PaymentScanConfig {
  intervalSeconds: number;      // Scan interval (default 60)
  batchSize: number;            // Transactions per scan (default 100)
  retryAttempts: number;        // Retry on failure (default 3)
}

export interface PaymentScanStateDB {
  id: number;
  agent_id: string;
  last_scanned_slot: number;
  last_scan_at: Date;
}

// ============================================================================
// Commitment Types (Phase 2)
// ============================================================================

export interface Commitment {
  commitment: string;           // Hex encoded
  blindingFactor: string;       // Hex encoded (encrypt before storage)
  value: string;                // Original value
}

export interface CommitmentRecord {
  id: number;
  commitment: string;
  encryptedBlindingFactor: string;  // AES-256 encrypted
  value: string;
  createdAt: Date;
  verifiedAt?: Date;
}

export interface CommitmentDB {
  id: number;
  commitment: string;
  encrypted_blinding_factor: string;
  value: string;
  created_at: Date;
  verified_at?: Date;
}

// ============================================================================
// Privacy Score Types (Phase 2)
// ============================================================================

export type PrivacyGrade = 'A' | 'B' | 'C' | 'D' | 'F';

export interface PrivacyScore {
  address: string;
  score: number;                // 0-100
  grade: PrivacyGrade;
  factors: string[];            // Privacy-reducing factors
  recommendations: string[];    // Improvement suggestions
  analyzedAt: number;           // Unix timestamp
}

export interface PrivacyScoreDB {
  id: number;
  address: string;
  score: number;
  grade: PrivacyGrade;
  factors: string[];
  recommendations?: string[];
  analyzed_at: Date;
}

// ============================================================================
// MEV Protection Types (Phase 2)
// ============================================================================

export interface MEVProtectionConfig {
  privacyScoreThreshold: number;  // Minimum score (default 70)
  batchSize: number;              // Stealth addresses per batch (default 10)
  measurementEnabled: boolean;    // Track MEV reduction (default true)
}

export interface ProtectedSwapParams {
  inputMint: string;
  outputMint: string;
  amount: string;
  slippageBps: number;
}

export interface MEVMetrics {
  mevBeforeIntegration: number;   // Baseline MEV extracted (USD)
  mevAfterIntegration: number;    // Current MEV extracted (USD)
  reductionPercentage: number;    // Reduction % (target >80%)
  privacyScoreTrend: number[];    // Historical scores
}

export interface MEVMetricsDB {
  id: number;
  vault_id: string;
  tx_signature: string;
  mev_extracted: number;
  privacy_score: number;
  timestamp: Date;
}

// ============================================================================
// Viewing Key Types (Phase 3)
// ============================================================================

export type ViewingKeyRole = 'internal' | 'external' | 'regulator' | 'master';

export interface ViewingKey {
  key: string;                  // Base58 encoded
  path: string;                 // BIP32 path (e.g., m/0/org/2026/Q1)
  hash: string;                 // SHA256 hash for verification
}

export interface ViewingKeyRecord {
  id: number;
  keyHash: string;
  path: string;
  parentHash?: string;
  role: ViewingKeyRole;
  expiresAt?: Date;
  createdAt: Date;
}

export interface ViewingKeyDB {
  id: number;
  key_hash: string;
  encrypted_key: string;
  path: string;
  parent_hash?: string;
  role: ViewingKeyRole;
  expires_at?: Date;
  created_at: Date;
  revoked_at?: Date;
}

// ============================================================================
// Compliance Types (Phase 3)
// ============================================================================

export interface DisclosureRecord {
  id: number;
  transactionId: number;
  auditorId: string;
  viewingKeyHash: string;
  encryptedData: string;
  disclosedFields: string[];
  expiresAt: Date;
  createdAt: Date;
}

export interface DisclosureDB {
  id: number;
  transaction_id: number;
  auditor_id: string;
  viewing_key_hash: string;
  encrypted_data: string;
  disclosed_fields: string[];
  expires_at: Date;
  created_at: Date;
  revoked_at?: Date;
}

export interface ComplianceReport {
  compliant: boolean;
  riskScore: number;            // 0-100 (lower = better)
  flags: string[];              // AML/CFT flags
  disclosedFields: string[];    // Visible fields
  hiddenFields: string[];       // Hidden fields
}

// ============================================================================
// Error Types
// ============================================================================

export class SipherAPIError extends Error {
  constructor(
    message: string,
    public statusCode: number,
    public headers: Record<string, string>,
    public requestParams?: any,
    public details?: any
  ) {
    super(message);
    this.name = 'SipherAPIError';
  }
}

export class AuthenticationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'AuthenticationError';
  }
}

export class RateLimitError extends Error {
  constructor(message: string, public retryAfter: number) {
    super(message);
    this.name = 'RateLimitError';
  }
}

export class ValidationError extends Error {
  constructor(message: string, public details?: any) {
    super(message);
    this.name = 'ValidationError';
  }
}

export class ServerError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ServerError';
  }
}

export class UnknownError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UnknownError';
  }
}

export class EncryptionError extends Error {
  constructor(message: string, public context?: any) {
    super(message);
    this.name = 'EncryptionError';
  }
}

export class DatabaseError extends Error {
  constructor(message: string, public code?: string, public query?: string) {
    super(message);
    this.name = 'DatabaseError';
  }
}

export class DuplicateRecordError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'DuplicateRecordError';
  }
}

export class InvalidReferenceError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'InvalidReferenceError';
  }
}

export class TimeoutError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'TimeoutError';
  }
}

export class InsufficientPrivacyError extends Error {
  constructor(message: string, public vaultId?: string, public privacyScore?: number) {
    super(message);
    this.name = 'InsufficientPrivacyError';
  }
}

export class CommitmentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CommitmentError';
  }
}

export class ClaimError extends Error {
  constructor(message: string, public stealthAddress?: string) {
    super(message);
    this.name = 'ClaimError';
  }
}

export interface MEVProtectionError {
  type: 'INSUFFICIENT_PRIVACY' | 'COMMITMENT_FAILURE' | 'CLAIM_FAILURE';
  vaultId?: string;
  privacyScore?: number;
  stealthAddress?: string;
  message: string;
}
