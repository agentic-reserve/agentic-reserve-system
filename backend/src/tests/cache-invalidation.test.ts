import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { CacheService } from '../services/memory/cache-service';
import { createClient } from 'redis';

/**
 * Cache Invalidation Tests
 * 
 * Tests cache invalidation logic for the Memory Service.
 * Validates that cache entries are properly invalidated when data changes.
 * 
 * **Validates: Requirement 9.4**
 */

describe('Cache Invalidation', () => {
  let cacheService: CacheService;
  const testWalletAddress = 'TestWallet123456789';
  const testMarketAddress = 'TestMarket123456789';

  beforeEach(async () => {
    // Create a test cache service with custom config
    cacheService = new CacheService({
      url: process.env.REDIS_URL || 'redis://localhost:6379',
      poolMin: 2,
      poolMax: 5,
      ttl: 300,
      memoryThreshold: 0.8,
    });

    await cacheService.initialize();

    // Seed cache with test data
    await cacheService.set(`wallet:${testWalletAddress}:transactions:abc123`, { data: 'test1' });
    await cacheService.set(`wallet:${testWalletAddress}:transactions:def456`, { data: 'test2' });
    await cacheService.set(`wallet:${testWalletAddress}:balances`, { data: 'balance' });
    await cacheService.set(`wallet:${testWalletAddress}:pnl:24h`, { data: 'pnl24h' });
    await cacheService.set(`wallet:${testWalletAddress}:pnl:7d`, { data: 'pnl7d' });
    await cacheService.set(`wallet:${testWalletAddress}:risk`, { data: 'risk' });
    await cacheService.set(`wallet:${testWalletAddress}:portfolio`, { data: 'portfolio' });
    await cacheService.set(`market:${testMarketAddress}:current`, { data: 'market' });
    await cacheService.set(`market:${testMarketAddress}:history:123`, { data: 'history' });
  });

  afterEach(async () => {
    // Clean up test data
    await cacheService.deletePattern(`wallet:${testWalletAddress}:*`);
    await cacheService.deletePattern(`market:${testMarketAddress}:*`);
    await cacheService.close();
  });

  describe('invalidateWalletCache', () => {
    it('should invalidate all cache entries for a wallet', async () => {
      // Verify cache entries exist before invalidation
      const txBefore = await cacheService.get(`wallet:${testWalletAddress}:transactions:abc123`);
      const balanceBefore = await cacheService.get(`wallet:${testWalletAddress}:balances`);
      const pnlBefore = await cacheService.get(`wallet:${testWalletAddress}:pnl:24h`);
      
      expect(txBefore).toBeDefined();
      expect(balanceBefore).toBeDefined();
      expect(pnlBefore).toBeDefined();

      // Invalidate wallet cache
      const deletedCount = await cacheService.invalidateWalletCache(testWalletAddress);

      // Verify all entries were deleted
      expect(deletedCount).toBeGreaterThan(0);

      const txAfter = await cacheService.get(`wallet:${testWalletAddress}:transactions:abc123`);
      const balanceAfter = await cacheService.get(`wallet:${testWalletAddress}:balances`);
      const pnlAfter = await cacheService.get(`wallet:${testWalletAddress}:pnl:24h`);
      
      expect(txAfter).toBeNull();
      expect(balanceAfter).toBeNull();
      expect(pnlAfter).toBeNull();
    });

    it('should support wildcard pattern invalidation', async () => {
      // Verify multiple transaction cache entries exist
      const tx1Before = await cacheService.get(`wallet:${testWalletAddress}:transactions:abc123`);
      const tx2Before = await cacheService.get(`wallet:${testWalletAddress}:transactions:def456`);
      
      expect(tx1Before).toBeDefined();
      expect(tx2Before).toBeDefined();

      // Invalidate all wallet cache entries
      await cacheService.invalidateWalletCache(testWalletAddress);

      // Verify both transaction entries were deleted
      const tx1After = await cacheService.get(`wallet:${testWalletAddress}:transactions:abc123`);
      const tx2After = await cacheService.get(`wallet:${testWalletAddress}:transactions:def456`);
      
      expect(tx1After).toBeNull();
      expect(tx2After).toBeNull();
    });
  });

  describe('invalidateBalanceCache', () => {
    it('should invalidate balance cache for a wallet', async () => {
      // Verify balance cache exists
      const balanceBefore = await cacheService.get(`wallet:${testWalletAddress}:balances`);
      expect(balanceBefore).toBeDefined();

      // Invalidate balance cache
      const deletedCount = await cacheService.invalidateBalanceCache(testWalletAddress);

      // Verify balance cache was deleted
      expect(deletedCount).toBeGreaterThan(0);

      const balanceAfter = await cacheService.get(`wallet:${testWalletAddress}:balances`);
      expect(balanceAfter).toBeNull();
    });

    it('should not affect other cache entries', async () => {
      // Verify other cache entries exist
      const txBefore = await cacheService.get(`wallet:${testWalletAddress}:transactions:abc123`);
      const pnlBefore = await cacheService.get(`wallet:${testWalletAddress}:pnl:24h`);
      
      expect(txBefore).toBeDefined();
      expect(pnlBefore).toBeDefined();

      // Invalidate only balance cache
      await cacheService.invalidateBalanceCache(testWalletAddress);

      // Verify other cache entries still exist
      const txAfter = await cacheService.get(`wallet:${testWalletAddress}:transactions:abc123`);
      const pnlAfter = await cacheService.get(`wallet:${testWalletAddress}:pnl:24h`);
      
      expect(txAfter).toBeDefined();
      expect(pnlAfter).toBeDefined();
    });
  });

  describe('invalidatePnLCache', () => {
    it('should invalidate all PnL cache entries for a wallet', async () => {
      // Verify PnL cache entries exist
      const pnl24hBefore = await cacheService.get(`wallet:${testWalletAddress}:pnl:24h`);
      const pnl7dBefore = await cacheService.get(`wallet:${testWalletAddress}:pnl:7d`);
      
      expect(pnl24hBefore).toBeDefined();
      expect(pnl7dBefore).toBeDefined();

      // Invalidate PnL cache
      const deletedCount = await cacheService.invalidatePnLCache(testWalletAddress);

      // Verify all PnL entries were deleted
      expect(deletedCount).toBeGreaterThan(0);

      const pnl24hAfter = await cacheService.get(`wallet:${testWalletAddress}:pnl:24h`);
      const pnl7dAfter = await cacheService.get(`wallet:${testWalletAddress}:pnl:7d`);
      
      expect(pnl24hAfter).toBeNull();
      expect(pnl7dAfter).toBeNull();
    });
  });

  describe('invalidateRiskCache', () => {
    it('should invalidate risk cache for a wallet', async () => {
      // Verify risk cache exists
      const riskBefore = await cacheService.get(`wallet:${testWalletAddress}:risk`);
      expect(riskBefore).toBeDefined();

      // Invalidate risk cache
      const deletedCount = await cacheService.invalidateRiskCache(testWalletAddress);

      // Verify risk cache was deleted
      expect(deletedCount).toBeGreaterThan(0);

      const riskAfter = await cacheService.get(`wallet:${testWalletAddress}:risk`);
      expect(riskAfter).toBeNull();
    });
  });

  describe('invalidatePortfolioCache', () => {
    it('should invalidate portfolio cache for a wallet', async () => {
      // Verify portfolio cache exists
      const portfolioBefore = await cacheService.get(`wallet:${testWalletAddress}:portfolio`);
      expect(portfolioBefore).toBeDefined();

      // Invalidate portfolio cache
      const deletedCount = await cacheService.invalidatePortfolioCache(testWalletAddress);

      // Verify portfolio cache was deleted
      expect(deletedCount).toBeGreaterThan(0);

      const portfolioAfter = await cacheService.get(`wallet:${testWalletAddress}:portfolio`);
      expect(portfolioAfter).toBeNull();
    });
  });

  describe('invalidateMarketCache', () => {
    it('should invalidate all market cache entries', async () => {
      // Verify market cache entries exist
      const currentBefore = await cacheService.get(`market:${testMarketAddress}:current`);
      const historyBefore = await cacheService.get(`market:${testMarketAddress}:history:123`);
      
      expect(currentBefore).toBeDefined();
      expect(historyBefore).toBeDefined();

      // Invalidate market cache
      const deletedCount = await cacheService.invalidateMarketCache(testMarketAddress);

      // Verify all market entries were deleted
      expect(deletedCount).toBeGreaterThan(0);

      const currentAfter = await cacheService.get(`market:${testMarketAddress}:current`);
      const historyAfter = await cacheService.get(`market:${testMarketAddress}:history:123`);
      
      expect(currentAfter).toBeNull();
      expect(historyAfter).toBeNull();
    });
  });

  describe('invalidateTransactionCache', () => {
    it('should invalidate transaction cache entries for a wallet', async () => {
      // Verify transaction cache entries exist
      const tx1Before = await cacheService.get(`wallet:${testWalletAddress}:transactions:abc123`);
      const tx2Before = await cacheService.get(`wallet:${testWalletAddress}:transactions:def456`);
      
      expect(tx1Before).toBeDefined();
      expect(tx2Before).toBeDefined();

      // Invalidate transaction cache
      const deletedCount = await cacheService.invalidateTransactionCache(testWalletAddress);

      // Verify transaction entries were deleted
      expect(deletedCount).toBeGreaterThan(0);

      const tx1After = await cacheService.get(`wallet:${testWalletAddress}:transactions:abc123`);
      const tx2After = await cacheService.get(`wallet:${testWalletAddress}:transactions:def456`);
      
      expect(tx1After).toBeNull();
      expect(tx2After).toBeNull();
    });

    it('should not affect balance or PnL cache', async () => {
      // Verify other cache entries exist
      const balanceBefore = await cacheService.get(`wallet:${testWalletAddress}:balances`);
      const pnlBefore = await cacheService.get(`wallet:${testWalletAddress}:pnl:24h`);
      
      expect(balanceBefore).toBeDefined();
      expect(pnlBefore).toBeDefined();

      // Invalidate only transaction cache
      await cacheService.invalidateTransactionCache(testWalletAddress);

      // Verify other cache entries still exist
      const balanceAfter = await cacheService.get(`wallet:${testWalletAddress}:balances`);
      const pnlAfter = await cacheService.get(`wallet:${testWalletAddress}:pnl:24h`);
      
      expect(balanceAfter).toBeDefined();
      expect(pnlAfter).toBeDefined();
    });
  });

  describe('invalidateOnTransactionUpdate', () => {
    it('should invalidate all wallet cache entries on transaction update', async () => {
      // Verify all cache entries exist
      const txBefore = await cacheService.get(`wallet:${testWalletAddress}:transactions:abc123`);
      const balanceBefore = await cacheService.get(`wallet:${testWalletAddress}:balances`);
      const pnlBefore = await cacheService.get(`wallet:${testWalletAddress}:pnl:24h`);
      const riskBefore = await cacheService.get(`wallet:${testWalletAddress}:risk`);
      const portfolioBefore = await cacheService.get(`wallet:${testWalletAddress}:portfolio`);
      
      expect(txBefore).toBeDefined();
      expect(balanceBefore).toBeDefined();
      expect(pnlBefore).toBeDefined();
      expect(riskBefore).toBeDefined();
      expect(portfolioBefore).toBeDefined();

      // Invalidate on transaction update (should invalidate all wallet cache)
      const deletedCount = await cacheService.invalidateOnTransactionUpdate(testWalletAddress);

      // Verify all entries were deleted
      expect(deletedCount).toBeGreaterThan(0);

      const txAfter = await cacheService.get(`wallet:${testWalletAddress}:transactions:abc123`);
      const balanceAfter = await cacheService.get(`wallet:${testWalletAddress}:balances`);
      const pnlAfter = await cacheService.get(`wallet:${testWalletAddress}:pnl:24h`);
      const riskAfter = await cacheService.get(`wallet:${testWalletAddress}:risk`);
      const portfolioAfter = await cacheService.get(`wallet:${testWalletAddress}:portfolio`);
      
      expect(txAfter).toBeNull();
      expect(balanceAfter).toBeNull();
      expect(pnlAfter).toBeNull();
      expect(riskAfter).toBeNull();
      expect(portfolioAfter).toBeNull();
    });
  });

  describe('invalidateOnBalanceUpdate', () => {
    it('should invalidate balance and portfolio cache on balance update', async () => {
      // Verify balance and portfolio cache exist
      const balanceBefore = await cacheService.get(`wallet:${testWalletAddress}:balances`);
      const portfolioBefore = await cacheService.get(`wallet:${testWalletAddress}:portfolio`);
      
      expect(balanceBefore).toBeDefined();
      expect(portfolioBefore).toBeDefined();

      // Invalidate on balance update
      const deletedCount = await cacheService.invalidateOnBalanceUpdate(testWalletAddress);

      // Verify balance and portfolio were deleted
      expect(deletedCount).toBeGreaterThan(0);

      const balanceAfter = await cacheService.get(`wallet:${testWalletAddress}:balances`);
      const portfolioAfter = await cacheService.get(`wallet:${testWalletAddress}:portfolio`);
      
      expect(balanceAfter).toBeNull();
      expect(portfolioAfter).toBeNull();
    });

    it('should not affect transaction or PnL cache', async () => {
      // Verify other cache entries exist
      const txBefore = await cacheService.get(`wallet:${testWalletAddress}:transactions:abc123`);
      const pnlBefore = await cacheService.get(`wallet:${testWalletAddress}:pnl:24h`);
      
      expect(txBefore).toBeDefined();
      expect(pnlBefore).toBeDefined();

      // Invalidate on balance update
      await cacheService.invalidateOnBalanceUpdate(testWalletAddress);

      // Verify other cache entries still exist
      const txAfter = await cacheService.get(`wallet:${testWalletAddress}:transactions:abc123`);
      const pnlAfter = await cacheService.get(`wallet:${testWalletAddress}:pnl:24h`);
      
      expect(txAfter).toBeDefined();
      expect(pnlAfter).toBeDefined();
    });
  });

  describe('Cache Invalidation Patterns', () => {
    it('should follow the pattern wallet:{address}:* for transaction updates', async () => {
      // This test verifies the cache invalidation pattern matches the design document
      const pattern = `wallet:${testWalletAddress}:*`;
      
      // Set various cache entries
      await cacheService.set(`wallet:${testWalletAddress}:custom:data`, { test: 'data' });
      
      // Invalidate using the pattern
      const deletedCount = await cacheService.deletePattern(pattern);
      
      // Verify all matching entries were deleted
      expect(deletedCount).toBeGreaterThan(0);
      
      const customAfter = await cacheService.get(`wallet:${testWalletAddress}:custom:data`);
      expect(customAfter).toBeNull();
    });

    it('should follow the pattern wallet:{address}:balances for balance updates', async () => {
      // This test verifies the balance cache key pattern
      const key = `wallet:${testWalletAddress}:balances`;
      
      // Verify the key exists
      const exists = await cacheService.exists(key);
      expect(exists).toBe(true);
      
      // Invalidate using the specific key
      await cacheService.delete(key);
      
      // Verify the key was deleted
      const existsAfter = await cacheService.exists(key);
      expect(existsAfter).toBe(false);
    });
  });
});
