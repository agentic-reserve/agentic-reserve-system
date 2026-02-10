import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { CacheService } from '../services/memory/cache-service';
import { WalletRegistrationManager } from '../services/memory/wallet-registration';
import { getSupabaseClient } from '../services/supabase';

/**
 * Cache Warming Tests
 * 
 * Tests the cache warming functionality that pre-loads data for ARS protocol wallets
 * on service startup.
 * 
 * Test Coverage:
 * - Cache warming for wallet balances
 * - Cache warming for recent transaction history
 * - Cache warming for PnL snapshots
 * - Integration with auto-registration
 * - Error handling for missing data
 * 
 * **Validates: Requirement 9.6**
 */

describe('Cache Warming', () => {
  let cacheService: CacheService;
  let walletManager: WalletRegistrationManager;
  let supabase: any;
  let testWallets: string[] = [];

  beforeAll(async () => {
    // Initialize services
    cacheService = new CacheService();
    await cacheService.initialize();
    
    supabase = getSupabaseClient();
    walletManager = new WalletRegistrationManager(supabase);
  });

  afterAll(async () => {
    // Cleanup test wallets
    for (const wallet of testWallets) {
      try {
        await supabase.from('wallet_registrations').delete().eq('address', wallet);
      } catch (error) {
        console.error('Error cleaning up test wallet:', error);
      }
    }

    // Close cache service
    await cacheService.close();
  });

  beforeEach(async () => {
    // Reset cache stats
    cacheService.resetStats();
  });

  describe('warmCache', () => {
    it('should warm cache for wallets with balances', async () => {
      // Create test wallet with balance
      const testWallet = `test_wallet_warm_${Date.now()}`;
      testWallets.push(testWallet);

      // Register wallet
      await walletManager.registerWallet({
        address: testWallet,
        privacyProtected: false,
        label: 'Test Wallet',
      });

      // Insert test balance
      await supabase.from('wallet_balances').insert({
        wallet_address: testWallet,
        token_mint: 'So11111111111111111111111111111111111111112', // SOL
        token_symbol: 'SOL',
        amount: 100.5,
        usd_value: 10050.0,
        last_updated: Math.floor(Date.now() / 1000),
      });

      // Warm cache
      const result = await cacheService.warmCache([testWallet]);

      // Verify results
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(0);
      expect(result.totalTimeMs).toBeGreaterThan(0);

      // Verify balance is cached
      const cacheKey = cacheService.generateCacheKey(testWallet, 'balances');
      const cachedBalances = await cacheService.get(cacheKey);
      expect(cachedBalances).toBeDefined();
      expect(Array.isArray(cachedBalances)).toBe(true);
      expect((cachedBalances as any[]).length).toBeGreaterThan(0);
    });

    it('should warm cache for wallets with recent transactions', async () => {
      // Create test wallet with transaction
      const testWallet = `test_wallet_tx_${Date.now()}`;
      testWallets.push(testWallet);

      // Register wallet
      await walletManager.registerWallet({
        address: testWallet,
        privacyProtected: false,
        label: 'Test Wallet',
      });

      // Insert test transaction (within last 24 hours)
      const recentTimestamp = Math.floor(Date.now() / 1000) - 3600; // 1 hour ago
      await supabase.from('wallet_transactions').insert({
        signature: `test_sig_${Date.now()}`,
        wallet_address: testWallet,
        timestamp: recentTimestamp,
        transaction_type: 'transfer',
        amount: 10.0,
        token_mint: 'So11111111111111111111111111111111111111112',
        token_symbol: 'SOL',
      });

      // Warm cache
      const result = await cacheService.warmCache([testWallet]);

      // Verify results
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(0);

      // Verify transaction is cached
      const twentyFourHoursAgo = Math.floor(Date.now() / 1000) - 24 * 60 * 60;
      const params = {
        fromTimestamp: twentyFourHoursAgo,
        page: 1,
        pageSize: 100,
      };
      const cacheKey = cacheService.generateCacheKey(testWallet, 'transactions', params);
      const cachedTxs = await cacheService.get(cacheKey);
      expect(cachedTxs).toBeDefined();
      expect((cachedTxs as any).transactions).toBeDefined();
      expect(Array.isArray((cachedTxs as any).transactions)).toBe(true);
    });

    it('should warm cache for wallets with PnL snapshots', async () => {
      // Create test wallet with PnL data
      const testWallet = `test_wallet_pnl_${Date.now()}`;
      testWallets.push(testWallet);

      // Register wallet
      await walletManager.registerWallet({
        address: testWallet,
        privacyProtected: false,
        label: 'Test Wallet',
      });

      // Insert test PnL snapshots
      const calculatedAt = Math.floor(Date.now() / 1000);
      const periods = ['24h', '7d', '30d', 'all'];
      
      for (const period of periods) {
        await supabase.from('wallet_pnl').insert({
          wallet_address: testWallet,
          period,
          realized_pnl: 100.0,
          unrealized_pnl: 50.0,
          total_pnl: 150.0,
          return_percentage: 15.0,
          calculated_at: calculatedAt,
        });
      }

      // Warm cache
      const result = await cacheService.warmCache([testWallet]);

      // Verify results
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(0);

      // Verify PnL snapshots are cached
      for (const period of periods) {
        const cacheKey = cacheService.generateCacheKey(testWallet, `pnl:${period}`);
        const cachedPnL = await cacheService.get(cacheKey);
        expect(cachedPnL).toBeDefined();
        expect((cachedPnL as any).period).toBe(period);
      }
    });

    it('should handle wallets with no data gracefully', async () => {
      // Create test wallet with no data
      const testWallet = `test_wallet_empty_${Date.now()}`;
      testWallets.push(testWallet);

      // Register wallet (but don't insert any data)
      await walletManager.registerWallet({
        address: testWallet,
        privacyProtected: false,
        label: 'Test Wallet',
      });

      // Warm cache
      const result = await cacheService.warmCache([testWallet]);

      // Should succeed even with no data
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(0);
    });

    it('should handle multiple wallets in batch', async () => {
      // Create multiple test wallets
      const wallet1 = `test_wallet_batch1_${Date.now()}`;
      const wallet2 = `test_wallet_batch2_${Date.now()}`;
      testWallets.push(wallet1, wallet2);

      // Register wallets
      await walletManager.registerWallet({
        address: wallet1,
        privacyProtected: false,
        label: 'Test Wallet 1',
      });
      await walletManager.registerWallet({
        address: wallet2,
        privacyProtected: false,
        label: 'Test Wallet 2',
      });

      // Insert test data for wallet1
      await supabase.from('wallet_balances').insert({
        wallet_address: wallet1,
        token_mint: 'So11111111111111111111111111111111111111112',
        token_symbol: 'SOL',
        amount: 50.0,
        usd_value: 5000.0,
        last_updated: Math.floor(Date.now() / 1000),
      });

      // Warm cache for both wallets
      const result = await cacheService.warmCache([wallet1, wallet2]);

      // Both should succeed (even wallet2 with no data)
      expect(result.successCount).toBe(2);
      expect(result.errorCount).toBe(0);
    });

    it('should continue warming cache even if one wallet fails', async () => {
      // Create test wallets
      const validWallet = `test_wallet_valid_${Date.now()}`;
      const invalidWallet = 'invalid_wallet_not_registered';
      testWallets.push(validWallet);

      // Register only the valid wallet
      await walletManager.registerWallet({
        address: validWallet,
        privacyProtected: false,
        label: 'Valid Wallet',
      });

      // Warm cache for both (invalid wallet should fail)
      const result = await cacheService.warmCache([validWallet, invalidWallet]);

      // Valid wallet should succeed, invalid should fail
      expect(result.successCount).toBe(1);
      expect(result.errorCount).toBe(1);
    });
  });

  describe('autoRegisterAndWarmCache', () => {
    it('should auto-register and warm cache for protocol wallets', async () => {
      // Note: This test requires MEMORY_AUTO_REGISTER=true and MEMORY_PROTOCOL_WALLETS
      // to be set in environment. For unit testing, we'll skip if not configured.
      
      const autoRegisterEnabled = process.env.MEMORY_AUTO_REGISTER === 'true';
      const protocolWallets = (process.env.MEMORY_PROTOCOL_WALLETS || '')
        .split(',')
        .map((addr) => addr.trim())
        .filter(Boolean);

      if (!autoRegisterEnabled || protocolWallets.length === 0) {
        console.log('Skipping auto-register test: not configured');
        return;
      }

      // Call auto-register and warm cache
      const result = await walletManager.autoRegisterAndWarmCache(cacheService);

      // Verify results
      expect(result.registeredCount).toBeGreaterThanOrEqual(0);
      expect(result.cacheWarmingResults.successCount).toBeGreaterThanOrEqual(0);
      expect(result.cacheWarmingResults.totalTimeMs).toBeGreaterThan(0);

      console.log('Auto-register and cache warming results:', result);
    });
  });

  describe('Cache Performance', () => {
    it('should improve query performance after cache warming', async () => {
      // Create test wallet with data
      const testWallet = `test_wallet_perf_${Date.now()}`;
      testWallets.push(testWallet);

      // Register wallet
      await walletManager.registerWallet({
        address: testWallet,
        privacyProtected: false,
        label: 'Test Wallet',
      });

      // Insert test balance
      await supabase.from('wallet_balances').insert({
        wallet_address: testWallet,
        token_mint: 'So11111111111111111111111111111111111111112',
        token_symbol: 'SOL',
        amount: 100.0,
        usd_value: 10000.0,
        last_updated: Math.floor(Date.now() / 1000),
      });

      // Warm cache
      await cacheService.warmCache([testWallet]);

      // Query from cache (should be fast)
      const startTime = Date.now();
      const cacheKey = cacheService.generateCacheKey(testWallet, 'balances');
      const cachedData = await cacheService.get(cacheKey);
      const queryTime = Date.now() - startTime;

      // Verify data is cached and query is fast
      expect(cachedData).toBeDefined();
      expect(queryTime).toBeLessThan(200); // Should be under 200ms (Requirement 9.2)

      // Verify cache hit
      const stats = cacheService.getStats();
      expect(stats.hits).toBeGreaterThan(0);
      expect(stats.hitRate).toBeGreaterThan(0);
    });
  });
});
