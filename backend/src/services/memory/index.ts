/**
 * Solder Cortex Memory Service - Main Entry Point
 * 
 * This module initializes and exports all memory service components:
 * - LYS Labs WebSocket client for real-time transaction indexing
 * - Transaction indexer for storing and processing transactions
 * - Wallet registration manager for managing indexed wallets
 * - Cache service for Redis-based caching
 * - PnL calculator for profit/loss analytics
 * - Risk analyzer for anomaly detection
 * - Event emitter for real-time agent notifications
 * 
 * Usage:
 * import { initializeMemoryService } from './services/memory';
 * await initializeMemoryService();
 */

export { LYSLabsClient, LYSTransaction, TransactionType } from './lys-labs-client';
export { TransactionIndexer, IndexingStatus } from './transaction-indexer';
export { WalletRegistrationManager } from './wallet-registration';
export { CacheService, getCacheService } from './cache-service';
export { PnLCalculator, pnlCalculator } from './pnl-calculator';
export { RiskAnalyzer, riskAnalyzer } from './risk-analyzer';
export { MemoryEventEmitter, memoryEventEmitter, EventType } from './event-emitter';
export { PredictionMarketService, predictionMarketService } from './prediction-market';
export { 
  startMonitoring as startConnectionPoolMonitoring,
  stopMonitoring as stopConnectionPoolMonitoring,
  getPoolStats
} from './connection-pool-monitor';

import { LYSLabsClient } from './lys-labs-client';
import { TransactionIndexer } from './transaction-indexer';
import { WalletRegistrationManager } from './wallet-registration';
import { startPnLUpdater } from '../../cron/pnl-updater';
import { startMonitoring as startConnectionPoolMonitoring, stopMonitoring as stopConnectionPoolMonitoring } from './connection-pool-monitor';

/**
 * Initialize the memory service
 * 
 * This function:
 * 1. Initializes the LYS Labs WebSocket client
 * 2. Sets up transaction indexing
 * 3. Auto-registers ARS protocol wallets
 * 4. Starts the PnL calculation cron job
 * 
 * @returns Promise that resolves when initialization is complete
 */
export async function initializeMemoryService(): Promise<void> {
  console.log('[Memory Service] Initializing Solder Cortex memory layer...');

  try {
    // Initialize components
    const lysClient = new LYSLabsClient();
    const indexer = new TransactionIndexer();
    const registrationManager = new WalletRegistrationManager();

    // Auto-register ARS protocol wallets
    console.log('[Memory Service] Auto-registering ARS protocol wallets...');
    await registrationManager.autoRegisterProtocolWallets();

    // Connect to LYS Labs WebSocket
    console.log('[Memory Service] Connecting to LYS Labs WebSocket...');
    await lysClient.connect();

    // Set up transaction handler
    lysClient.onTransaction(async (tx) => {
      try {
        await indexer.indexTransaction(tx);
      } catch (error) {
        console.error('[Memory Service] Failed to index transaction:', error);
      }
    });

    // Set up error handler
    lysClient.onError((error) => {
      console.error('[Memory Service] LYS Labs WebSocket error:', error);
    });

    // Set up reconnect handler
    lysClient.onReconnect(() => {
      console.log('[Memory Service] LYS Labs WebSocket reconnected');
    });

    // Start PnL updater cron job
    console.log('[Memory Service] Starting PnL updater cron job...');
    startPnLUpdater();

    // Start connection pool monitoring
    console.log('[Memory Service] Starting connection pool monitoring...');
    startConnectionPoolMonitoring();

    console.log('[Memory Service] Solder Cortex memory layer initialized successfully');
  } catch (error) {
    console.error('[Memory Service] Failed to initialize memory service:', error);
    throw error;
  }
}

/**
 * Shutdown the memory service gracefully
 */
export async function shutdownMemoryService(): Promise<void> {
  console.log('[Memory Service] Shutting down Solder Cortex memory layer...');
  
  // Stop connection pool monitoring
  stopConnectionPoolMonitoring();
  
  // Add cleanup logic here (close WebSocket, flush caches, etc.)
  console.log('[Memory Service] Shutdown complete');
}
