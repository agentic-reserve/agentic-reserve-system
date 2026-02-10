/**
 * Sipher API Client Type Definitions
 * 
 * This file contains type definitions specific to the Sipher API client.
 */

import {
  SipherConfig,
  MetaAddress,
  StealthAddress,
  ShieldedTransfer,
  DetectedPayment,
  Commitment,
  ViewingKey,
  PrivacyScore
} from '../types';

// Re-export common types for convenience
export {
  SipherConfig,
  MetaAddress,
  StealthAddress,
  ShieldedTransfer,
  DetectedPayment,
  Commitment,
  ViewingKey,
  PrivacyScore
};

// ============================================================================
// API Request/Response Types
// ============================================================================

export interface SipherAPIRequest {
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  endpoint: string;
  headers?: Record<string, string>;
  body?: any;
  idempotencyKey?: string;
}

export interface SipherAPIResponse<T = any> {
  data: T;
  status: number;
  headers: Record<string, string>;
}

// ============================================================================
// Stealth Address API Types
// ============================================================================

export interface GenerateMetaAddressRequest {
  label: string;
}

export interface GenerateMetaAddressResponse {
  metaAddress: {
    spendingPublicKey: string;
    viewingPublicKey: string;
  };
  spendingPrivateKey: string;
  viewingPrivateKey: string;
}

export interface DeriveStealthAddressRequest {
  recipientMetaAddress: {
    spendingPublicKey: string;
    viewingPublicKey: string;
  };
}

export interface DeriveStealthAddressResponse {
  address: string;
  ephemeralPublicKey: string;
}

export interface BatchGenerateStealthRequest {
  count: number;
  label: string;
}

export interface BatchGenerateStealthResponse {
  addresses: MetaAddress[];
}

// ============================================================================
// Shielded Transfer API Types
// ============================================================================

export interface BuildShieldedTransferRequest {
  sender: string;
  recipientMetaAddress: {
    spendingPublicKey: string;
    viewingPublicKey: string;
  };
  amount: string;
  mint?: string;
}

export interface BuildShieldedTransferResponse {
  unsignedTransaction: string;
  stealthAddress: {
    address: string;
    ephemeralPublicKey: string;
  };
  commitment: string;
}

export interface ClaimPaymentRequest {
  stealthAddress: string;
  ephemeralPublicKey: string;
  spendingPrivateKey: string;
  viewingPrivateKey: string;
  destinationAddress: string;
  mint?: string;
}

export interface ClaimPaymentResponse {
  txSignature: string;
}

// ============================================================================
// Payment Scanning API Types
// ============================================================================

export interface ScanPaymentsRequest {
  viewingPrivateKey: string;
  spendingPublicKey: string;
  fromSlot?: number;
  limit?: number;
}

export interface ScanPaymentsResponse {
  payments: DetectedPayment[];
}

// ============================================================================
// Commitment API Types
// ============================================================================

export interface CreateCommitmentRequest {
  value: string;
}

export interface CreateCommitmentResponse {
  commitment: string;
  blindingFactor: string;
}

export interface VerifyCommitmentRequest {
  commitment: string;
  value: string;
  blindingFactor: string;
}

export interface VerifyCommitmentResponse {
  valid: boolean;
}

export interface AddCommitmentsRequest {
  commitmentA: string;
  commitmentB: string;
  blindingA: string;
  blindingB: string;
}

export interface AddCommitmentsResponse {
  commitment: string;
  blindingFactor: string;
}

export interface BatchCreateCommitmentsRequest {
  values: string[];
}

export interface BatchCreateCommitmentsResponse {
  commitments: Commitment[];
}

// ============================================================================
// Viewing Key API Types
// ============================================================================

export interface GenerateViewingKeyRequest {
  path: string;
}

export interface GenerateViewingKeyResponse {
  key: string;
  path: string;
  hash: string;
}

export interface DeriveViewingKeyRequest {
  masterKey: string;
  childPath: string;
}

export interface DeriveViewingKeyResponse {
  key: string;
  path: string;
  hash: string;
}

export interface VerifyHierarchyRequest {
  parentKey: string;
  childKey: string;
}

export interface VerifyHierarchyResponse {
  valid: boolean;
}

export interface DiscloseRequest {
  viewingKey: string;
  transactionData: any;
}

export interface DiscloseResponse {
  encrypted: string;
  keyHash: string;
  expiresAt: number;
}

export interface DecryptRequest {
  viewingKey: string;
  encrypted: string;
}

export interface DecryptResponse {
  sender: string;
  recipient: string;
  amount: string;
  timestamp: number;
}

// ============================================================================
// Privacy Score API Types
// ============================================================================

export interface AnalyzePrivacyRequest {
  address: string;
  limit?: number;
}

export interface AnalyzePrivacyResponse {
  address: string;
  score: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  factors: string[];
  recommendations: string[];
  analyzedAt: number;
}

// ============================================================================
// Health Check API Types
// ============================================================================

export interface HealthCheckResponse {
  status: string;
  version: string;
}
