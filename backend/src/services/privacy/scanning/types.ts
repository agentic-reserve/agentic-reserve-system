/**
 * Payment Scanning Type Definitions
 * 
 * This file contains type definitions specific to payment scanning.
 */

import {
  DetectedPayment,
  PaymentScanConfig,
  PaymentScanStateDB
} from '../types';

// Re-export common types for convenience
export {
  DetectedPayment,
  PaymentScanConfig,
  PaymentScanStateDB
};

// ============================================================================
// Payment Scanner Types
// ============================================================================

export interface ScanForAgentParams {
  agentId: string;
  fromSlot?: number;
  limit?: number;
}

export interface ScanForAgentResult {
  payments: DetectedPayment[];
  lastScannedSlot: number;
  newPaymentsCount: number;
}

export interface StartScannerParams {
  config: PaymentScanConfig;
}

export interface StopScannerResult {
  stopped: boolean;
  lastScanAt: Date;
}

// ============================================================================
// Scan State Management Types
// ============================================================================

export interface GetLastScannedSlotParams {
  agentId: string;
}

export interface UpdateLastScannedSlotParams {
  agentId: string;
  slot: number;
}

export interface ScanState {
  agentId: string;
  lastScannedSlot: number;
  lastScanAt: Date;
  isScanning: boolean;
}

// ============================================================================
// Payment Storage Types
// ============================================================================

export interface StoreDetectedPaymentsParams {
  agentId: string;
  payments: DetectedPayment[];
}

export interface StoreDetectedPaymentsResult {
  stored: number;
  duplicates: number;
  errors: number;
}

// ============================================================================
// Payment Notification Types
// ============================================================================

export interface PaymentNotificationEvent {
  agentId: string;
  payment: DetectedPayment;
  timestamp: Date;
}

export interface EmitPaymentNotificationsParams {
  agentId: string;
  payments: DetectedPayment[];
}

// ============================================================================
// Scan Error Types
// ============================================================================

export interface ScanError {
  agentId: string;
  error: Error;
  timestamp: Date;
  retryCount: number;
}

export interface ScanRetryParams {
  agentId: string;
  maxRetries: number;
  baseDelay: number;
}

// ============================================================================
// Scan Statistics Types
// ============================================================================

export interface ScanStatistics {
  totalScans: number;
  successfulScans: number;
  failedScans: number;
  totalPaymentsDetected: number;
  averageScanDuration: number;
  lastScanAt: Date;
}

export interface GetScanStatisticsParams {
  agentId?: string;
  startDate?: Date;
  endDate?: Date;
}
