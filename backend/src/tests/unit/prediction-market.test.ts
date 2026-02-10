import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { PredictionMarketService } from '../../services/memory/prediction-market';
import { supabase } from '../../services/supabase';
import { getRedisClient } from '../../services/redis';

/**
 * Unit tests for Prediction Market Service
 * 
 * Tests the prediction market service implementation including:
 * - Getting current market data with confidence scores
 * - Getting historical market snapshots
 * - Calculating market confidence scores
 * - Storing market resolutions
 * - Getting market liquidity analysis
 * 
 * Validates Requirements: 5.1, 5.2, 5.3, 5.4, 5.5
 */

describe('PredictionMarketService', () => {
  let service: PredictionMarketService;
  let redisClient: Awaited<ReturnType<typeof getRedisClient>>;
  const testMarketAddress = 'TestMarket1111111111111111111111111111111';
  const testProposalId = 'TestProposal111111111111111111111111111';

  beforeAll(async () => {
    service = new PredictionMarketService();
    redisClient = await getRedisClient();
  });

  afterAll(async () => {
    // Cleanup test data
    await supabase
      .from('market_snapshots')
      .delete()
      .eq('market_address', testMarketAddress);
    
    await supabase
      .from('prediction_markets')
      .delete()
      .eq('market_address', testMarketAddress);
    
    // Clear cache
    await redisClient.del(`market:${testMarketAddress}:current`);
    await redisClient.del(`market:${testMarketAddress}:history:*`);
  });

  beforeEach(async () => {
    // Clear test data before each test
    await supabase
      .from('market_snapshots')
      .delete()
      .eq('market_address', testMarketAddress);
    
    await supabase
      .from('prediction_markets')
      .delete()
      .eq('market_address', testMarketAddress);
    
    // Clear cache
    await redisClient.del(`market:${testMarketAddress}:current`);
    await redisClient.del(`market:${testMarketAddress}:history:*`);
  });

  describe('getPredictionMarket', () => {
    it('should return null for non-existent market', async () => {
      const market = await service.getPredictionMarket('NonExistentMarket111111111111111111111');
      
      expect(market).toBeNull();
    });

    it('should return market data with confidence score', async () => {
      // Insert test market
      await supabase.from('prediction_markets').insert({
        market_address: testMarketAddress,
        proposal_id: testProposalId,
        outcomes: {
          yes: { odds: 0.6, volume: 50000, liquidity: 25000 },
          no: { odds: 0.4, volume: 30000, liquidity: 15000 },
        },
        total_volume: 80000,
        total_liquidity: 40000,
        last_updated: Date.now(),
      });

      const market = await service.getPredictionMarket(testMarketAddress);
      
      expect(market).not.toBeNull();
      expect(market?.marketAddress).toBe(testMarketAddress);
      expect(market?.proposalId).toBe(testProposalId);
      expect(market?.totalVolume).toBe(80000);
      expect(market?.totalLiquidity).toBe(40000);
      expect(market?.confidenceScore).toBeGreaterThanOrEqual(0);
      expect(market?.confidenceScore).toBeLessThanOrEqual(100);
      expect(market?.outcomes).toHaveProperty('yes');
      expect(market?.outcomes).toHaveProperty('no');
    });

    it('should cache market data', async () => {
      // Insert test market
      await supabase.from('prediction_markets').insert({
        market_address: testMarketAddress,
        proposal_id: testProposalId,
        outcomes: {
          yes: { odds: 0.6, volume: 50000, liquidity: 25000 },
          no: { odds: 0.4, volume: 30000, liquidity: 15000 },
        },
        total_volume: 80000,
        total_liquidity: 40000,
        last_updated: Date.now(),
      });

      // First call - should hit database
      const market1 = await service.getPredictionMarket(testMarketAddress);
      
      // Second call - should hit cache
      const market2 = await service.getPredictionMarket(testMarketAddress);
      
      expect(market1).toEqual(market2);
      
      // Verify cache exists
      const cacheKey = `market:${testMarketAddress}:current`;
      const cached = await redisClient.get(cacheKey);
      expect(cached).not.toBeNull();
    });

    it('should calculate higher confidence for high volume markets', async () => {
      // Insert high volume market
      await supabase.from('prediction_markets').insert({
        market_address: testMarketAddress,
        proposal_id: testProposalId,
        outcomes: {
          yes: { odds: 0.6, volume: 500000, liquidity: 250000 },
          no: { odds: 0.4, volume: 300000, liquidity: 150000 },
        },
        total_volume: 800000,
        total_liquidity: 400000,
        last_updated: Date.now(),
      });

      const market = await service.getPredictionMarket(testMarketAddress);
      
      expect(market?.confidenceScore).toBeGreaterThan(50);
    });

    it('should calculate lower confidence for low volume markets', async () => {
      // Insert low volume market
      await supabase.from('prediction_markets').insert({
        market_address: testMarketAddress,
        proposal_id: testProposalId,
        outcomes: {
          yes: { odds: 0.6, volume: 1000, liquidity: 500 },
          no: { odds: 0.4, volume: 600, liquidity: 300 },
        },
        total_volume: 1600,
        total_liquidity: 800,
        last_updated: Date.now(),
      });

      const market = await service.getPredictionMarket(testMarketAddress);
      
      expect(market?.confidenceScore).toBeLessThan(30);
    });
  });

  describe('getPredictionMarketHistory', () => {
    it('should return empty array for market with no snapshots', async () => {
      const fromTimestamp = Date.now() - 24 * 60 * 60 * 1000;
      const history = await service.getPredictionMarketHistory(testMarketAddress, fromTimestamp);
      
      expect(history).toEqual([]);
    });

    it('should return historical snapshots ordered by timestamp', async () => {
      const now = Date.now();
      
      // Insert snapshots at different times
      await supabase.from('market_snapshots').insert([
        {
          market_address: testMarketAddress,
          outcomes: { yes: { odds: 0.5, volume: 10000, liquidity: 5000 }, no: { odds: 0.5, volume: 10000, liquidity: 5000 } },
          total_volume: 20000,
          total_liquidity: 10000,
          snapshot_timestamp: now - 3600000, // 1 hour ago
        },
        {
          market_address: testMarketAddress,
          outcomes: { yes: { odds: 0.55, volume: 15000, liquidity: 7500 }, no: { odds: 0.45, volume: 13500, liquidity: 6750 } },
          total_volume: 28500,
          total_liquidity: 14250,
          snapshot_timestamp: now - 1800000, // 30 minutes ago
        },
        {
          market_address: testMarketAddress,
          outcomes: { yes: { odds: 0.6, volume: 20000, liquidity: 10000 }, no: { odds: 0.4, volume: 16000, liquidity: 8000 } },
          total_volume: 36000,
          total_liquidity: 18000,
          snapshot_timestamp: now, // now
        },
      ]);

      const fromTimestamp = now - 7200000; // 2 hours ago
      const history = await service.getPredictionMarketHistory(testMarketAddress, fromTimestamp);
      
      expect(history).toHaveLength(3);
      expect(history[0].snapshotTimestamp).toBeLessThan(history[1].snapshotTimestamp);
      expect(history[1].snapshotTimestamp).toBeLessThan(history[2].snapshotTimestamp);
    });

    it('should filter snapshots by fromTimestamp', async () => {
      const now = Date.now();
      
      // Insert snapshots at different times
      await supabase.from('market_snapshots').insert([
        {
          market_address: testMarketAddress,
          outcomes: { yes: { odds: 0.5, volume: 10000, liquidity: 5000 }, no: { odds: 0.5, volume: 10000, liquidity: 5000 } },
          total_volume: 20000,
          total_liquidity: 10000,
          snapshot_timestamp: now - 7200000, // 2 hours ago
        },
        {
          market_address: testMarketAddress,
          outcomes: { yes: { odds: 0.55, volume: 15000, liquidity: 7500 }, no: { odds: 0.45, volume: 13500, liquidity: 6750 } },
          total_volume: 28500,
          total_liquidity: 14250,
          snapshot_timestamp: now - 1800000, // 30 minutes ago
        },
      ]);

      const fromTimestamp = now - 3600000; // 1 hour ago
      const history = await service.getPredictionMarketHistory(testMarketAddress, fromTimestamp);
      
      // Should only return the snapshot from 30 minutes ago
      expect(history).toHaveLength(1);
      expect(history[0].snapshotTimestamp).toBe(now - 1800000);
    });

    it('should cache historical data', async () => {
      const now = Date.now();
      
      await supabase.from('market_snapshots').insert({
        market_address: testMarketAddress,
        outcomes: { yes: { odds: 0.6, volume: 20000, liquidity: 10000 }, no: { odds: 0.4, volume: 16000, liquidity: 8000 } },
        total_volume: 36000,
        total_liquidity: 18000,
        snapshot_timestamp: now,
      });

      const fromTimestamp = now - 3600000;
      
      // First call - should hit database
      const history1 = await service.getPredictionMarketHistory(testMarketAddress, fromTimestamp);
      
      // Second call - should hit cache
      const history2 = await service.getPredictionMarketHistory(testMarketAddress, fromTimestamp);
      
      expect(history1).toEqual(history2);
      
      // Verify cache exists
      const cacheKey = `market:${testMarketAddress}:history:${fromTimestamp}`;
      const cached = await redisClient.get(cacheKey);
      expect(cached).not.toBeNull();
    });
  });

  describe('updateMarket', () => {
    it('should create new market entry', async () => {
      const outcomes = {
        yes: { odds: 0.6, volume: 50000, liquidity: 25000 },
        no: { odds: 0.4, volume: 30000, liquidity: 15000 },
      };

      await service.updateMarket(
        testMarketAddress,
        testProposalId,
        outcomes,
        80000,
        40000
      );

      // Verify market was created
      const { data, error } = await supabase
        .from('prediction_markets')
        .select('*')
        .eq('market_address', testMarketAddress)
        .single();

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.proposal_id).toBe(testProposalId);
      expect(parseFloat(data?.total_volume)).toBe(80000);
      expect(parseFloat(data?.total_liquidity)).toBe(40000);
    });

    it('should update existing market entry', async () => {
      // Insert initial market
      await supabase.from('prediction_markets').insert({
        market_address: testMarketAddress,
        proposal_id: testProposalId,
        outcomes: {
          yes: { odds: 0.5, volume: 10000, liquidity: 5000 },
          no: { odds: 0.5, volume: 10000, liquidity: 5000 },
        },
        total_volume: 20000,
        total_liquidity: 10000,
        last_updated: Date.now() - 3600000,
      });

      // Update market
      const newOutcomes = {
        yes: { odds: 0.6, volume: 50000, liquidity: 25000 },
        no: { odds: 0.4, volume: 30000, liquidity: 15000 },
      };

      await service.updateMarket(
        testMarketAddress,
        testProposalId,
        newOutcomes,
        80000,
        40000
      );

      // Verify market was updated
      const { data, error } = await supabase
        .from('prediction_markets')
        .select('*')
        .eq('market_address', testMarketAddress)
        .single();

      expect(error).toBeNull();
      expect(parseFloat(data?.total_volume)).toBe(80000);
      expect(parseFloat(data?.total_liquidity)).toBe(40000);
    });

    it('should create snapshot on update', async () => {
      const outcomes = {
        yes: { odds: 0.6, volume: 50000, liquidity: 25000 },
        no: { odds: 0.4, volume: 30000, liquidity: 15000 },
      };

      await service.updateMarket(
        testMarketAddress,
        testProposalId,
        outcomes,
        80000,
        40000
      );

      // Verify snapshot was created
      const { data, error } = await supabase
        .from('market_snapshots')
        .select('*')
        .eq('market_address', testMarketAddress);

      expect(error).toBeNull();
      expect(data).not.toBeNull();
      expect(data?.length).toBeGreaterThan(0);
    });

    it('should invalidate cache on update', async () => {
      // Insert initial market and cache it
      await supabase.from('prediction_markets').insert({
        market_address: testMarketAddress,
        proposal_id: testProposalId,
        outcomes: {
          yes: { odds: 0.5, volume: 10000, liquidity: 5000 },
          no: { odds: 0.5, volume: 10000, liquidity: 5000 },
        },
        total_volume: 20000,
        total_liquidity: 10000,
        last_updated: Date.now(),
      });

      await service.getPredictionMarket(testMarketAddress); // Cache it

      // Update market
      const newOutcomes = {
        yes: { odds: 0.6, volume: 50000, liquidity: 25000 },
        no: { odds: 0.4, volume: 30000, liquidity: 15000 },
      };

      await service.updateMarket(
        testMarketAddress,
        testProposalId,
        newOutcomes,
        80000,
        40000
      );

      // Verify cache was invalidated
      const cacheKey = `market:${testMarketAddress}:current`;
      const cached = await redisClient.get(cacheKey);
      expect(cached).toBeNull();
    });
  });

  describe('storeMarketResolution', () => {
    it('should store market resolution', async () => {
      // Insert initial market
      await supabase.from('prediction_markets').insert({
        market_address: testMarketAddress,
        proposal_id: testProposalId,
        outcomes: {
          yes: { odds: 0.6, volume: 50000, liquidity: 25000 },
          no: { odds: 0.4, volume: 30000, liquidity: 15000 },
        },
        total_volume: 80000,
        total_liquidity: 40000,
        last_updated: Date.now(),
      });

      const resolution = {
        marketAddress: testMarketAddress,
        proposalId: testProposalId,
        finalOutcome: 'yes',
        settlementData: {
          winningOdds: 0.6,
          totalVolume: 80000,
          totalLiquidity: 40000,
          resolvedAt: Date.now(),
        },
      };

      await service.storeMarketResolution(resolution);

      // Verify market was updated
      const { data, error } = await supabase
        .from('prediction_markets')
        .select('*')
        .eq('market_address', testMarketAddress)
        .single();

      expect(error).toBeNull();
      expect(data?.outcomes).toHaveProperty('finalOutcome');
      expect(data?.outcomes.finalOutcome).toBe('yes');
      expect(data?.outcomes).toHaveProperty('resolved');
      expect(data?.outcomes.resolved).toBe(true);
    });

    it('should create final snapshot on resolution', async () => {
      // Insert initial market
      await supabase.from('prediction_markets').insert({
        market_address: testMarketAddress,
        proposal_id: testProposalId,
        outcomes: {
          yes: { odds: 0.6, volume: 50000, liquidity: 25000 },
          no: { odds: 0.4, volume: 30000, liquidity: 15000 },
        },
        total_volume: 80000,
        total_liquidity: 40000,
        last_updated: Date.now(),
      });

      const resolution = {
        marketAddress: testMarketAddress,
        proposalId: testProposalId,
        finalOutcome: 'yes',
        settlementData: {
          winningOdds: 0.6,
          totalVolume: 80000,
          totalLiquidity: 40000,
          resolvedAt: Date.now(),
        },
      };

      await service.storeMarketResolution(resolution);

      // Verify final snapshot was created
      const { data, error } = await supabase
        .from('market_snapshots')
        .select('*')
        .eq('market_address', testMarketAddress)
        .order('snapshot_timestamp', { ascending: false })
        .limit(1)
        .single();

      expect(error).toBeNull();
      expect(data?.outcomes).toHaveProperty('finalOutcome');
      expect(data?.outcomes.finalOutcome).toBe('yes');
    });

    it('should invalidate cache on resolution', async () => {
      // Insert initial market and cache it
      await supabase.from('prediction_markets').insert({
        market_address: testMarketAddress,
        proposal_id: testProposalId,
        outcomes: {
          yes: { odds: 0.6, volume: 50000, liquidity: 25000 },
          no: { odds: 0.4, volume: 30000, liquidity: 15000 },
        },
        total_volume: 80000,
        total_liquidity: 40000,
        last_updated: Date.now(),
      });

      await service.getPredictionMarket(testMarketAddress); // Cache it

      const resolution = {
        marketAddress: testMarketAddress,
        proposalId: testProposalId,
        finalOutcome: 'yes',
        settlementData: {
          winningOdds: 0.6,
          totalVolume: 80000,
          totalLiquidity: 40000,
          resolvedAt: Date.now(),
        },
      };

      await service.storeMarketResolution(resolution);

      // Verify cache was invalidated
      const cacheKey = `market:${testMarketAddress}:current`;
      const cached = await redisClient.get(cacheKey);
      expect(cached).toBeNull();
    });
  });

  describe('getMarketLiquidity', () => {
    it('should return null for non-existent market', async () => {
      const liquidity = await service.getMarketLiquidity('NonExistentMarket111111111111111111111');
      
      expect(liquidity).toBeNull();
    });

    it('should return liquidity analysis', async () => {
      // Insert test market
      await supabase.from('prediction_markets').insert({
        market_address: testMarketAddress,
        proposal_id: testProposalId,
        outcomes: {
          yes: { odds: 0.6, volume: 50000, liquidity: 25000 },
          no: { odds: 0.4, volume: 30000, liquidity: 15000 },
        },
        total_volume: 80000,
        total_liquidity: 40000,
        last_updated: Date.now(),
      });

      const liquidity = await service.getMarketLiquidity(testMarketAddress);
      
      expect(liquidity).not.toBeNull();
      expect(liquidity?.totalLiquidity).toBe(40000);
      expect(liquidity?.liquidityByOutcome).toHaveProperty('yes');
      expect(liquidity?.liquidityByOutcome).toHaveProperty('no');
      expect(liquidity?.liquidityByOutcome.yes).toBe(25000);
      expect(liquidity?.liquidityByOutcome.no).toBe(15000);
      expect(liquidity?.estimatedSlippage).toHaveProperty('yes');
      expect(liquidity?.estimatedSlippage).toHaveProperty('no');
    });

    it('should calculate slippage estimates', async () => {
      // Insert test market with known liquidity
      await supabase.from('prediction_markets').insert({
        market_address: testMarketAddress,
        proposal_id: testProposalId,
        outcomes: {
          yes: { odds: 0.6, volume: 50000, liquidity: 10000 }, // Low liquidity
          no: { odds: 0.4, volume: 30000, liquidity: 50000 }, // High liquidity
        },
        total_volume: 80000,
        total_liquidity: 60000,
        last_updated: Date.now(),
      });

      const liquidity = await service.getMarketLiquidity(testMarketAddress);
      
      expect(liquidity).not.toBeNull();
      
      // Lower liquidity should have higher slippage
      expect(liquidity?.estimatedSlippage.yes).toBeGreaterThan(liquidity?.estimatedSlippage.no);
    });

    it('should handle zero liquidity', async () => {
      // Insert test market with zero liquidity
      await supabase.from('prediction_markets').insert({
        market_address: testMarketAddress,
        proposal_id: testProposalId,
        outcomes: {
          yes: { odds: 0.6, volume: 50000, liquidity: 0 },
          no: { odds: 0.4, volume: 30000, liquidity: 0 },
        },
        total_volume: 80000,
        total_liquidity: 0,
        last_updated: Date.now(),
      });

      const liquidity = await service.getMarketLiquidity(testMarketAddress);
      
      expect(liquidity).not.toBeNull();
      expect(liquidity?.totalLiquidity).toBe(0);
      // Slippage should be 100% (max) for zero liquidity
      expect(liquidity?.estimatedSlippage.yes).toBe(100);
      expect(liquidity?.estimatedSlippage.no).toBe(100);
    });
  });
});
