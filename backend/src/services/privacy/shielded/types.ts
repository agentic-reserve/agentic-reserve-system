/**
 * Shielded Transfer Type Definitions
 * 
 * This file contains type definitions specific to shielded transfer building.
 */

import {
  ShieldedTransfer,
  ShieldedTransferParams,
  ShieldedTransferRecord,
  ShieldedTransactionDB,
  ShieldedTransactionStatus
} from '../types';

// Re-export common types for convenience
export {
  ShieldedTransfer,
  ShieldedTransferParams,
  ShieldedTransferRecord,
  ShieldedTransactionDB,
  ShieldedTransactionStatus
};

// ============================================================================
// Transfer Builder Types
// ============================================================================

export interface BuildTransferResult {
  transaction: any; // Solana Transaction object
  record: ShieldedTransferRecord;
}

export interface SubmitTransferParams {
  transaction: any; // Solana Transaction object
  recordId: number;
}

export interface SubmitTransferResult {
  txSignature: string;
  confirmedAt: Date;
}

// ============================================================================
// Transfer Validation Types
// ============================================================================

export interface ValidateBalanceParams {
  senderId: string;
  amount: string;
  mint?: string;
}

export interface ValidateBalanceResult {
  valid: boolean;
  balance: string;
  required: string;
  error?: string;
}

export interface ValidateMetaAddressParams {
  metaAddressId: number;
}

export interface ValidateMetaAddressResult {
  valid: boolean;
  metaAddress?: any;
  error?: string;
}

// ============================================================================
// Transfer History Types
// ============================================================================

export interface GetTransferHistoryParams {
  agentId: string;
  status?: ShieldedTransactionStatus;
  limit?: number;
  offset?: number;
  startDate?: Date;
  endDate?: Date;
}

export interface GetTransferHistoryResult {
  transfers: ShieldedTransferRecord[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Claim Payment Types
// ============================================================================

export interface ClaimPaymentParams {
  transactionId: number;
  destinationAddress: string;
}

export interface ClaimPaymentResult {
  txSignature: string;
  claimedAt: Date;
  amount: string;
}

// ============================================================================
// Database Query Types
// ============================================================================

export interface ShieldedTransactionQuery {
  sender?: string;
  stealthAddress?: string;
  status?: ShieldedTransactionStatus;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface ShieldedTransactionQueryResult {
  transactions: ShieldedTransferRecord[];
  total: number;
  hasMore: boolean;
}

// ============================================================================
// Transaction Status Update Types
// ============================================================================

export interface UpdateTransactionStatusParams {
  id: number;
  status: ShieldedTransactionStatus;
  txSignature?: string;
  claimedAt?: Date;
}
