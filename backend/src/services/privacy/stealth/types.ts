/**
 * Stealth Address Management Type Definitions
 * 
 * This file contains type definitions specific to stealth address management.
 */

import {
  MetaAddress,
  StealthAddress,
  StealthAddressRecord,
  StealthAddressDB,
  StealthAddressStatus
} from '../types';

// Re-export common types for convenience
export {
  MetaAddress,
  StealthAddress,
  StealthAddressRecord,
  StealthAddressDB,
  StealthAddressStatus
};

// ============================================================================
// Stealth Address Manager Types
// ============================================================================

export interface GenerateStealthAddressParams {
  agentId: string;
  label: string;
}

export interface DeriveStealthAddressParams {
  metaAddressId: number;
}

export interface GetStealthAddressesParams {
  agentId: string;
  status?: StealthAddressStatus;
  limit?: number;
  offset?: number;
}

export interface UpdateStealthAddressStatusParams {
  id: number;
  status: StealthAddressStatus;
}

// ============================================================================
// Encryption Types
// ============================================================================

export interface EncryptedKeys {
  encryptedSpending: string;
  encryptedViewing: string;
}

export interface DecryptedKeys {
  spending: string;
  viewing: string;
}

export interface EncryptionParams {
  agentId: string;
  data: string;
}

export interface DecryptionParams {
  agentId: string;
  encryptedData: string;
}

// ============================================================================
// Database Query Types
// ============================================================================

export interface StealthAddressQuery {
  agentId?: string;
  id?: number;
  status?: StealthAddressStatus;
  createdAfter?: Date;
  createdBefore?: Date;
}

export interface StealthAddressQueryResult {
  addresses: StealthAddressRecord[];
  total: number;
  hasMore: boolean;
}
