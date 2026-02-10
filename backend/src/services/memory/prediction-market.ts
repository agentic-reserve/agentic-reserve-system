import { supabase } from '../supabase';
import { getRedisClient } from '../redis';

/**
 * Prediction Market Service
 * 
 * Provides access to futarchy prediction market data for governance proposals.
 * Calculates market confidence scores based on volume, liquidity, and odds stability.
 * 
 * Requirements: 5.1, 5.2, 5.4
 */

interface PredictionMarket {
  marketAddress: string;
  proposalId: string;
  outcomes: Record<string, {
    odds: number;
    volume: number;
    liquidity: number;
  }>;
  totalVolume: number;
  totalLiquidity: number;
  confidenceScore: number;
  lastUpdated: number;
}

interface MarketSnapshot {
  id: number;
  marketAddress: string;
  outcomes: Record<string, {
    odds: number;
    volume: number;
    liquidity: number;
  }>;
  totalVolume: number;
  totalLiquidity: number;
  snapshotTimestamp: number;
}

interface MarketResolution {
  marketAddress: string;
  proposalId: string;
  finalOutcome: string;
  settlementData: {
    winningOdds: number;
    totalVolume: number;
    totalLiquidity: number;
    resolvedAt: number;
  };
}

export class PredictionMarketService {
  /**
   * Get current prediction market data with confidence score
   * 
   * @param marketAddress - The on-chain address of the prediction market
   * @returns Current market data including odds, volume, liquidity, and confidence score
   * 
   * Requirements: 5.1, 5.4
   */
  async getPredictionMarket(marketAddress: string): Promise<PredictionMarket | null> {
    // Check cache first
    const redisClient = await getRedisClient();
    const cacheKey = `market:${marketAddress}:current`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Query from database
    const { data, error } = await supabase
      .from('prediction_markets')
      .select('*')
      .eq('market_address', marketAddress)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        // Not found
        return null;
      }
      throw error;
    }

    if (!data) {
      return null;
    }

    // Calculate confidence score
    const confidenceScore = await this.calculateConfidenceScore(
      marketAddress,
      data.total_volume,
      data.total_liquidity,
      data.outcomes
    );

    const market: PredictionMarket = {
      marketAddress: data.market_address,
      proposalId: data.proposal_id,
      outcomes: data.outcomes,
      totalVolume: parseFloat(data.total_volume),
      totalLiquidity: parseFloat(data.total_liquidity),
      confidenceScore,
      lastUpdated: data.last_updated,
    };

    // Cache for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(market));

    return market;
  }

  /**
   * Get historical snapshots of prediction market odds
   * 
   * @param marketAddress - The on-chain address of the prediction market
   * @param fromTimestamp - Start timestamp for historical data (Unix milliseconds)
   * @returns Array of market snapshots ordered by timestamp
   * 
   * Requirements: 5.2
   */
  async getPredictionMarketHistory(
    marketAddress: string,
    fromTimestamp: number
  ): Promise<MarketSnapshot[]> {
    // Check cache first
    const cacheKey = `market:${marketAddress}:history:${fromTimestamp}`;
    const cached = await redisClient.get(cacheKey);
    
    if (cached) {
      return JSON.parse(cached);
    }

    // Query from database
    const { data, error } = await supabase
      .from('market_snapshots')
      .select('*')
      .eq('market_address', marketAddress)
      .gte('snapshot_timestamp', fromTimestamp)
      .order('snapshot_timestamp', { ascending: true });

    if (error) throw error;

    const snapshots: MarketSnapshot[] = (data || []).map(snapshot => ({
      id: snapshot.id,
      marketAddress: snapshot.market_address,
      outcomes: snapshot.outcomes,
      totalVolume: parseFloat(snapshot.total_volume),
      totalLiquidity: parseFloat(snapshot.total_liquidity),
      snapshotTimestamp: snapshot.snapshot_timestamp,
    }));

    // Cache for 5 minutes
    await redisClient.setex(cacheKey, 300, JSON.stringify(snapshots));

    return snapshots;
  }

  /**
   * Calculate market confidence score based on volume, liquidity, and odds stability
   * 
   * The confidence score is a weighted function that considers:
   * - Total volume (40% weight): Higher volume indicates more market participation
   * - Total liquidity (30% weight): Higher liquidity indicates market depth
   * - Odds stability (30% weight): Lower variance in odds over time indicates consensus
   * 
   * Score ranges from 0-100, where:
   * - 0-30: Low confidence (thin market, high volatility)
   * - 31-60: Medium confidence (moderate activity)
   * - 61-100: High confidence (deep market, stable odds)
   * 
   * @param marketAddress - The market address
   * @param totalVolume - Total trading volume
   * @param totalLiquidity - Total liquidity in the market
   * @param currentOutcomes - Current outcome odds
   * @returns Confidence score (0-100)
   * 
   * Requirements: 5.4
   */
  private async calculateConfidenceScore(
    marketAddress: string,
    totalVolume: number,
    totalLiquidity: number,
    currentOutcomes: Record<string, any>
  ): Promise<number> {
    // Volume score (0-40 points)
    // Normalize volume to 0-40 scale (assuming max volume of 1M)
    const volumeScore = Math.min(40, (totalVolume / 1000000) * 40);

    // Liquidity score (0-30 points)
    // Normalize liquidity to 0-30 scale (assuming max liquidity of 500K)
    const liquidityScore = Math.min(30, (totalLiquidity / 500000) * 30);

    // Odds stability score (0-30 points)
    // Calculate variance in odds over the last 24 hours
    const stabilityScore = await this.calculateOddsStability(marketAddress);

    // Total confidence score
    const confidenceScore = volumeScore + liquidityScore + stabilityScore;

    return Math.round(Math.min(100, confidenceScore));
  }

  /**
   * Calculate odds stability score based on historical variance
   * 
   * Lower variance = higher stability = higher score
   * 
   * @param marketAddress - The market address
   * @returns Stability score (0-30)
   */
  private async calculateOddsStability(marketAddress: string): Promise<number> {
    const twentyFourHoursAgo = Date.now() - 24 * 60 * 60 * 1000;

    // Get snapshots from last 24 hours
    const { data: snapshots, error } = await supabase
      .from('market_snapshots')
      .select('outcomes')
      .eq('market_address', marketAddress)
      .gte('snapshot_timestamp', twentyFourHoursAgo)
      .order('snapshot_timestamp', { ascending: true });

    if (error || !snapshots || snapshots.length < 2) {
      // Not enough data, return neutral score
      return 15;
    }

    // Calculate variance for each outcome
    const outcomeKeys = Object.keys(snapshots[0].outcomes);
    let totalVariance = 0;

    for (const outcomeKey of outcomeKeys) {
      const odds = snapshots.map(s => s.outcomes[outcomeKey]?.odds || 0);
      const mean = odds.reduce((a, b) => a + b, 0) / odds.length;
      const variance = odds.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / odds.length;
      totalVariance += variance;
    }

    const avgVariance = totalVariance / outcomeKeys.length;

    // Convert variance to stability score (inverse relationship)
    // Lower variance = higher score
    // Assuming variance range of 0-0.1 (odds are typically 0-1)
    const stabilityScore = Math.max(0, 30 - (avgVariance * 300));

    return Math.round(stabilityScore);
  }

  /**
   * Store market resolution data when a prediction market resolves
   * 
   * @param resolution - Market resolution data including final outcome
   * 
   * Requirements: 5.5
   */
  async storeMarketResolution(resolution: MarketResolution): Promise<void> {
    // Update the prediction_markets table with final outcome
    const { error: updateError } = await supabase
      .from('prediction_markets')
      .update({
        outcomes: {
          ...resolution.settlementData,
          finalOutcome: resolution.finalOutcome,
          resolved: true,
        },
        last_updated: resolution.settlementData.resolvedAt,
      })
      .eq('market_address', resolution.marketAddress);

    if (updateError) throw updateError;

    // Create a final snapshot
    const { error: snapshotError } = await supabase
      .from('market_snapshots')
      .insert({
        market_address: resolution.marketAddress,
        outcomes: {
          finalOutcome: resolution.finalOutcome,
          winningOdds: resolution.settlementData.winningOdds,
        },
        total_volume: resolution.settlementData.totalVolume,
        total_liquidity: resolution.settlementData.totalLiquidity,
        snapshot_timestamp: resolution.settlementData.resolvedAt,
      });

    if (snapshotError) throw snapshotError;

    // Invalidate cache
    await redisClient.del(`market:${resolution.marketAddress}:current`);
    await redisClient.del(`market:${resolution.marketAddress}:history:*`);

    console.log(`Market ${resolution.marketAddress} resolved with outcome: ${resolution.finalOutcome}`);
  }

  /**
   * Update prediction market data (called by market indexer)
   * 
   * @param marketAddress - The market address
   * @param proposalId - The associated proposal ID
   * @param outcomes - Current outcome odds, volume, and liquidity
   * @param totalVolume - Total trading volume
   * @param totalLiquidity - Total liquidity
   */
  async updateMarket(
    marketAddress: string,
    proposalId: string,
    outcomes: Record<string, { odds: number; volume: number; liquidity: number }>,
    totalVolume: number,
    totalLiquidity: number
  ): Promise<void> {
    const now = Date.now();

    // Calculate confidence score
    const confidenceScore = await this.calculateConfidenceScore(
      marketAddress,
      totalVolume,
      totalLiquidity,
      outcomes
    );

    // Upsert market data
    const { error: upsertError } = await supabase
      .from('prediction_markets')
      .upsert({
        market_address: marketAddress,
        proposal_id: proposalId,
        outcomes,
        total_volume: totalVolume,
        total_liquidity: totalLiquidity,
        confidence_score: confidenceScore,
        last_updated: now,
      });

    if (upsertError) throw upsertError;

    // Create snapshot
    const { error: snapshotError } = await supabase
      .from('market_snapshots')
      .insert({
        market_address: marketAddress,
        outcomes,
        total_volume: totalVolume,
        total_liquidity: totalLiquidity,
        snapshot_timestamp: now,
      });

    if (snapshotError) throw snapshotError;

    // Invalidate cache
    await redisClient.del(`market:${marketAddress}:current`);

    console.log(`Market ${marketAddress} updated with confidence score: ${confidenceScore}`);
  }

  /**
   * Get market liquidity analysis
   * 
   * @param marketAddress - The market address
   * @returns Liquidity depth and slippage estimates
   * 
   * Requirements: 5.3
   */
  async getMarketLiquidity(marketAddress: string): Promise<{
    totalLiquidity: number;
    liquidityByOutcome: Record<string, number>;
    estimatedSlippage: Record<string, number>;
  } | null> {
    const market = await this.getPredictionMarket(marketAddress);
    
    if (!market) {
      return null;
    }

    const liquidityByOutcome: Record<string, number> = {};
    const estimatedSlippage: Record<string, number> = {};

    for (const [outcome, data] of Object.entries(market.outcomes)) {
      liquidityByOutcome[outcome] = data.liquidity;
      
      // Estimate slippage for a 1000 USDC trade
      // Simplified model: slippage = tradeSize / (2 * liquidity)
      const tradeSize = 1000;
      const slippage = data.liquidity > 0 ? (tradeSize / (2 * data.liquidity)) * 100 : 100;
      estimatedSlippage[outcome] = Math.min(100, slippage);
    }

    return {
      totalLiquidity: market.totalLiquidity,
      liquidityByOutcome,
      estimatedSlippage,
    };
  }
}

// Export singleton instance
export const predictionMarketService = new PredictionMarketService();
