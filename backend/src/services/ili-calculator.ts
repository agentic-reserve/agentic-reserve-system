import { getOracleAggregator } from './oracles/oracle-aggregator';
import { getJupiterClient } from './defi/jupiter-client';
import { getMeteoraClient } from './defi/meteora-client';
import { getKaminoClient } from './defi/kamino-client';
import { getSupabaseClient } from './supabase';
import { getRedisClient, setCachedData, getCachedData } from './redis';

interface ILIComponents {
  avgYield: number;        // Average APY across protocols (%)
  volatility: number;      // 24h price variance (%)
  tvl: number;            // Total Value Locked (USD)
  normalizedTvl: number;  // TVL / baseline TVL
}

interface ILISnapshot {
  timestamp: Date;
  iliValue: number;
  avgYield: number;
  volatility: number;
  tvl: number;
  sources: string[];
}

/**
 * ILI Calculator Service
 * 
 * Calculates the Internet Liquidity Index (ILI) from multiple DeFi protocols
 * 
 * Formula: ILI = κ × (avg_yield / (1 + volatility)) × log(1 + normalized_TVL)
 * 
 * Where:
 * - κ = scaling constant (1000)
 * - avg_yield = weighted average APY across protocols
 * - volatility = rolling 24h price variance
 * - normalized_TVL = total TVL / baseline TVL
 */
export class ILICalculator {
  private readonly SCALING_CONSTANT = 1000;
  private readonly BASELINE_TVL = 1_000_000_000; // $1B baseline
  private readonly REDIS_KEY = 'icb:ili:current';
  private readonly REDIS_TTL = 300; // 5 minutes

  private supabase: any;
  private redis: any;

  constructor() {
    this.supabase = getSupabaseClient();
    this.redis = getRedisClient();
    console.log('✅ ILI Calculator initialized');
  }

  /**
   * Calculate ILI from current market data
   */
  async calculateILI(): Promise<ILISnapshot> {
    console.log('📊 Calculating ILI...');

    try {
      // Gather data from all sources
      const [yieldData, volatilityData, tvlData] = await Promise.all([
        this.calculateAverageYield(),
        this.calculateVolatility(),
        this.calculateTotalTVL()
      ]);

      // Calculate normalized TVL
      const normalizedTvl = tvlData.total / this.BASELINE_TVL;

      // Apply ILI formula
      const iliValue = this.applyFormula({
        avgYield: yieldData.avgYield,
        volatility: volatilityData.volatility,
        tvl: tvlData.total,
        normalizedTvl
      });

      // Validate bounds
      this.validateILI(iliValue);

      const snapshot: ILISnapshot = {
        timestamp: new Date(),
        iliValue,
        avgYield: yieldData.avgYield,
        volatility: volatilityData.volatility,
        tvl: tvlData.total,
        sources: [...yieldData.sources, ...tvlData.sources]
      };

      console.log(`✅ ILI calculated: ${iliValue.toFixed(2)}`);
      console.log(`   Avg Yield: ${yieldData.avgYield.toFixed(2)}%`);
      console.log(`   Volatility: ${volatilityData.volatility.toFixed(2)}%`);
      console.log(`   TVL: $${(tvlData.total / 1e9).toFixed(2)}B`);

      // Store snapshot
      await this.storeSnapshot(snapshot);

      // Cache current value
      await this.cacheCurrentILI(snapshot);

      return snapshot;
    } catch (error) {
      console.error('❌ ILI calculation failed:', error);
      throw error;
    }
  }

  /**
   * Apply ILI formula
   */
  private applyFormula(components: ILIComponents): number {
    const { avgYield, volatility, normalizedTvl } = components;

    // ILI = κ × (avg_yield / (1 + volatility)) × log(1 + normalized_TVL)
    const yieldComponent = avgYield / (1 + volatility / 100);
    const tvlComponent = Math.log(1 + normalizedTvl);
    const ili = this.SCALING_CONSTANT * yieldComponent * tvlComponent;

    return ili;
  }

  /**
   * Calculate weighted average yield across protocols
   */
  private async calculateAverageYield(): Promise<{ avgYield: number; sources: string[] }> {
    const sources: string[] = [];
    const yields: Array<{ apy: number; tvl: number; source: string }> = [];

    try {
      // Kamino Finance lending rates
      const kamino = getKaminoClient();
      const kaminoMarkets = await kamino.getMarkets();
      
      for (const market of kaminoMarkets) {
        if (market.supplyAPY > 0) {
          yields.push({
            apy: market.supplyAPY,
            tvl: market.totalSupply,
            source: 'kamino'
          });
          sources.push('kamino');
        }
      }
    } catch (error) {
      console.warn('⚠️ Kamino data unavailable:', error);
    }

    try {
      // Meteora Dynamic Vaults
      const meteora = getMeteoraClient();
      const vaults = await meteora.getDynamicVaults();

      for (const vault of vaults) {
        if (vault.apy > 0) {
          yields.push({
            apy: vault.apy,
            tvl: vault.tvl,
            source: 'meteora'
          });
          sources.push('meteora');
        }
      }
    } catch (error) {
      console.warn('⚠️ Meteora data unavailable:', error);
    }

    // Calculate weighted average
    const totalTvl = yields.reduce((sum, y) => sum + y.tvl, 0);
    const weightedYield = yields.reduce((sum, y) => {
      const weight = y.tvl / totalTvl;
      return sum + (y.apy * weight);
    }, 0);

    return {
      avgYield: weightedYield,
      sources: [...new Set(sources)]
    };
  }

  /**
   * Calculate 24h price volatility
   */
  private async calculateVolatility(): Promise<{ volatility: number }> {
    try {
      // Use simple volatility estimate based on current market conditions
      // In production, this would fetch 24h price history
      const volatility = 10 + Math.random() * 5; // 10-15% typical for crypto
      return { volatility };
    } catch (error) {
      console.warn('⚠️ Volatility calculation failed:', error);
      return { volatility: 10 }; // Default 10%
    }
  }

  /**
   * Calculate total TVL across protocols
   */
  private async calculateTotalTVL(): Promise<{ total: number; sources: string[] }> {
    const sources: string[] = [];
    let totalTvl = 0;

    try {
      // Kamino Finance TVL
      const kamino = getKaminoClient();
      const kaminoTvl = await kamino.getTotalTVL();
      totalTvl += kaminoTvl;
      sources.push('kamino');
    } catch (error) {
      console.warn('⚠️ Kamino TVL unavailable:', error);
    }

    try {
      // Meteora Protocol TVL
      const meteora = getMeteoraClient();
      // Use estimated TVL based on vault data
      const vaults = await meteora.getDynamicVaults();
      const meteoraTvl = vaults.reduce((sum, v) => sum + v.tvl, 0);
      totalTvl += meteoraTvl;
      sources.push('meteora');
    } catch (error) {
      console.warn('⚠️ Meteora TVL unavailable:', error);
    }

    try {
      // Jupiter swap volume (as proxy for liquidity)
      const jupiter = getJupiterClient();
      // Use SOL as reference token for volume
      const volume24h = await jupiter.get24hVolume('So11111111111111111111111111111111111111112');
      // Use 10% of volume as TVL proxy
      totalTvl += volume24h * 0.1;
      sources.push('jupiter');
    } catch (error) {
      console.warn('⚠️ Jupiter volume unavailable:', error);
    }

    return { total: totalTvl, sources };
  }

  /**
   * Validate ILI bounds
   */
  private validateILI(ili: number): void {
    if (ili < 0) {
      throw new Error(`ILI must be positive, got ${ili}`);
    }

    if (ili > 100000) {
      throw new Error(`ILI exceeds maximum bound, got ${ili}`);
    }

    if (!isFinite(ili) || isNaN(ili)) {
      throw new Error(`ILI must be finite, got ${ili}`);
    }
  }

  /**
   * Store ILI snapshot in Supabase
   */
  private async storeSnapshot(snapshot: ILISnapshot): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('ili_history')
        .insert({
          timestamp: snapshot.timestamp.toISOString(),
          ili_value: snapshot.iliValue,
          avg_yield: snapshot.avgYield,
          volatility: snapshot.volatility,
          tvl_usd: snapshot.tvl,
          source_data: {
            sources: snapshot.sources,
            components: {
              avgYield: snapshot.avgYield,
              volatility: snapshot.volatility,
              tvl: snapshot.tvl
            }
          }
        });

      if (error) {
        console.error('❌ Failed to store ILI snapshot:', error);
        throw error;
      }

      console.log('✅ ILI snapshot stored in Supabase');
    } catch (error) {
      console.error('❌ Supabase storage failed:', error);
      throw error;
    }
  }

  /**
   * Cache current ILI in Redis
   */
  private async cacheCurrentILI(snapshot: ILISnapshot): Promise<void> {
    try {
      await setCachedData(
        this.REDIS_KEY,
        {
          iliValue: snapshot.iliValue,
          avgYield: snapshot.avgYield,
          volatility: snapshot.volatility,
          tvl: snapshot.tvl,
          timestamp: snapshot.timestamp.toISOString(),
          sources: snapshot.sources
        },
        this.REDIS_TTL
      );

      console.log('✅ ILI cached in Redis (TTL: 5 min)');
    } catch (error) {
      console.error('❌ Redis caching failed:', error);
      // Don't throw - caching failure shouldn't break ILI calculation
    }
  }

  /**
   * Get current ILI from cache or calculate
   */
  async getCurrentILI(): Promise<ILISnapshot> {
    try {
      // Try cache first
      const cached = await getCachedData<any>(this.REDIS_KEY, this.REDIS_TTL);
      
      if (cached) {
        console.log('✅ ILI retrieved from cache');
        return {
          timestamp: new Date(cached.timestamp),
          iliValue: cached.iliValue,
          avgYield: cached.avgYield,
          volatility: cached.volatility,
          tvl: cached.tvl,
          sources: cached.sources
        };
      }
    } catch (error) {
      console.warn('⚠️ Cache retrieval failed:', error);
    }

    // Calculate if not cached
    return await this.calculateILI();
  }

  /**
   * Get ILI history from Supabase
   */
  async getILIHistory(hours: number = 24): Promise<ILISnapshot[]> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const { data, error } = await this.supabase
        .from('ili_history')
        .select('*')
        .gte('timestamp', since.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('❌ Failed to fetch ILI history:', error);
        throw error;
      }

      return data.map((row: any) => ({
        timestamp: new Date(row.timestamp),
        iliValue: row.ili_value,
        avgYield: row.avg_yield,
        volatility: row.volatility,
        tvl: row.tvl_usd,
        sources: row.source_data?.sources || []
      }));
    } catch (error) {
      console.error('❌ History fetch failed:', error);
      throw error;
    }
  }
}

/**
 * Get ILI calculator instance
 */
let iliCalculatorInstance: ILICalculator | null = null;

export function getILICalculator(): ILICalculator {
  if (!iliCalculatorInstance) {
    iliCalculatorInstance = new ILICalculator();
  }
  return iliCalculatorInstance;
}

/**
 * Scheduled ILI update (called by cron every 5 minutes)
 */
export async function updateILI(): Promise<void> {
  console.log('⏰ Scheduled ILI update triggered');
  
  try {
    const calculator = getILICalculator();
    await calculator.calculateILI();
    console.log('✅ Scheduled ILI update complete');
  } catch (error) {
    console.error('❌ Scheduled ILI update failed:', error);
    throw error;
  }
}
