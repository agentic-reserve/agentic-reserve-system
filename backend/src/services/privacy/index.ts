/**
 * Privacy Services Module
 * 
 * This module provides privacy-preserving features for the Agentic Reserve System (ARS)
 * powered by Sipher's Privacy-as-a-Skill REST API.
 * 
 * Features:
 * - Shielded ARU token transfers using stealth addresses
 * - MEV-protected vault rebalancing with Pedersen commitments
 * - Compliance-friendly selective disclosure through hierarchical viewing keys
 * 
 * @module privacy
 */

// Sipher API Client
export * from './sipher';

// Encryption Service
export {
  EncryptionService,
  getEncryptionService,
  createEncryptionService,
  DEFAULT_ENCRYPTION_CONFIG
} from './encryption-service';

// Stealth Address Management
export * from './stealth';

// Shielded Transfers
export * from './shielded';

// Payment Scanning
export * from './scanning';

// Viewing Key Management
export {
  ViewingKeyManager,
  ViewingKeyRecord,
  ViewingKeyRole,
  initializeViewingKeyManager,
  getViewingKeyManager
} from './viewing-key-manager';

// Disclosure Service
export {
  DisclosureService,
  DisclosureRecord,
  DecryptedTransactionData,
  initializeDisclosureService,
  getDisclosureService
} from './disclosure-service';

// Compliance Service
export {
  ComplianceService,
  ViewingKeyHierarchy,
  ComplianceReport,
  initializeComplianceService,
  getComplianceService
} from './compliance-service';

// Common Types
export * from './types';
