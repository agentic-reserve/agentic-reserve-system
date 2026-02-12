import { getKaminoClient } from './defi/kamino-client';
import { getSupabaseClient } from './supabase';
import { getRedisClient, setCachedData, getCachedData } from './redis';

interface ICRData {
  protocol: string;
  rate: number;      // Basis points (e.g., 800 = 8%)
  tvl: number;       // USD
  weight: number;    // Weight in calculation
}

interface ICRSnapshot {
  timestamp: Date;
  icrValue: number;           // Weighted average rate (basis points)
  confidenceInterval: number; // ±X basis points
  sources: ICRData[];
}

/**
 * ICR Calculator Service
 * 
 * Calculates the Internet Credit Rate (ICR) from lending protocols
 * 
 * ICR = Weighted average of lending rates across top protocols
 * Weight = Protocol TVL / Total TVL
 * 
 * Confidence interval calculated from standard deviation
 */
export class ICRCalculator {
  private readonly REDIS_KEY = 'icb:icr:current';
  private readonly REDIS_TTL = 600; // 10 minutes
  private readonly MIN_ICR = 0;      // 0%
  private readonly MAX_ICR = 10000;  // 100%

  private supabase: any;
  private redis: any;

  constructor() {
    this.supabase = getSupabaseClient();
    this.redis = getRedisClient();
    console.log('✅ ICR Calculator initialized');
  }

  /**
   * Calculate ICR from current lending rates
   */
  async calculateICR(): Promise<ICRSnapshot> {
    console.log('📊 Calculating ICR...');

    try {
      // Gather lending rates from protocols
      const rates = await this.gatherLendingRates();

      if (rates.length === 0) {
        throw new Error('No lending rate data available');
      }

      // Calculate weighted average
      const totalTvl = rates.reduce((sum, r) => sum + r.tvl, 0);
      
      const weightedRate = rates.reduce((sum, r) => {
        const weight = r.tvl / totalTvl;
        return sum + (r.rate * weight);
      }, 0);

      // Calculate confidence interval
      const confidenceInterval = this.calculateConfidenceInterval(rates, weightedRate, totalTvl);

      // Validate bounds
      this.validateICR(weightedRate);

      const snapshot: ICRSnapshot = {
        timestamp: new Date(),
        icrValue: weightedRate,
        confidenceInterval,
        sources: rates.map(r => ({
          ...r,
          weight: r.tvl / totalTvl
        }))
      };

      console.log(`✅ ICR calculated: ${(weightedRate / 100).toFixed(2)}%`);
      console.log(`   Confidence: ±${(confidenceInterval / 100).toFixed(2)}%`);
      console.log(`   Sources: ${rates.map(r => r.protocol).join(', ')}`);

      // Store snapshot
      await this.storeSnapshot(snapshot);

      // Cache current value
      await this.cacheCurrentICR(snapshot);

      return snapshot;
    } catch (error) {
      console.error('❌ ICR calculation failed:', error);
      throw error;
    }
  }

  /**
   * Gather lending rates from protocols
   */
  private async gatherLendingRates(): Promise<ICRData[]> {
    const rates: ICRData[] = [];

    try {
      // Kamino Finance (prioritized - largest TVL)
      const kamino = getKaminoClient();
      const markets = await kamino.getMarkets();

      for (const market of markets) {
        if (market.borrowAPY > 0 && market.totalBorrow > 0) {
          rates.push({
            protocol: 'kamino',
            rate: market.borrowAPY * 100, // Convert to basis points
            tvl: market.totalBorrow,
            weight: 0 // Will be calculated later
          });
        }
      }

      console.log(`✅ Kamino: ${rates.length} markets`);
    } catch (error) {
      console.warn('⚠️ Kamino data unavailable:', error);
    }

    // TODO: Add more protocols (MarginFi, Solend, Port Finance)
    // For now, using Kamino as primary source

    // If no data, use fallback
    if (rates.length === 0) {
      console.warn('⚠️ No lending data available, using fallback');
      rates.push({
        protocol: 'fallback',
        rate: 500, // 5% default
        tvl: 1000000,
        weight: 1
      });
    }

    return rates;
  }

  /**
   * Calculate confidence interval
   */
  private calculateConfidenceInterval(
    rates: ICRData[],
    weightedRate: number,
    totalTvl: number
  ): number {
    if (rates.length < 2) {
      return 100; // ±1% default for single source
    }

    // Calculate weighted variance
    const variance = rates.reduce((sum, r) => {
      const weight = r.tvl / totalTvl;
      return sum + weight * Math.pow(r.rate - weightedRate, 2);
    }, 0);

    const stdDev = Math.sqrt(variance);

    // 95% confidence interval (±2σ)
    return stdDev * 2;
  }

  /**
   * Validate ICR bounds
   */
  private validateICR(icr: number): void {
    if (icr < this.MIN_ICR) {
      throw new Error(`ICR below minimum (0%), got ${icr / 100}%`);
    }

    if (icr > this.MAX_ICR) {
      throw new Error(`ICR above maximum (100%), got ${icr / 100}%`);
    }

    if (!isFinite(icr) || isNaN(icr)) {
      throw new Error(`ICR must be finite, got ${icr}`);
    }
  }

  /**
   * Store ICR snapshot in Supabase
   */
  private async storeSnapshot(snapshot: ICRSnapshot): Promise<void> {
    try {
      const { error } = await this.supabase
        .from('icr_history')
        .insert({
          timestamp: snapshot.timestamp.toISOString(),
          icr_value: snapshot.icrValue,
          confidence_interval: snapshot.confidenceInterval,
          source_data: {
            sources: snapshot.sources.map(s => ({
              protocol: s.protocol,
              rate: s.rate,
              tvl: s.tvl,
              weight: s.weight
            }))
          }
        });

      if (error) {
        console.error('❌ Failed to store ICR snapshot:', error);
        throw error;
      }

      console.log('✅ ICR snapshot stored in Supabase');
    } catch (error) {
      console.error('❌ Supabase storage failed:', error);
      throw error;
    }
  }

  /**
   * Cache current ICR in Redis
   */
  private async cacheCurrentICR(snapshot: ICRSnapshot): Promise<void> {
    try {
      await setCachedData(
        this.REDIS_KEY,
        {
          icrValue: snapshot.icrValue,
          confidenceInterval: snapshot.confidenceInterval,
          timestamp: snapshot.timestamp.toISOString(),
          sources: snapshot.sources
        },
        this.REDIS_TTL
      );

      console.log('✅ ICR cached in Redis (TTL: 10 min)');
    } catch (error) {
      console.error('❌ Redis caching failed:', error);
      // Don't throw - caching failure shouldn't break ICR calculation
    }
  }

  /**
   * Get current ICR from cache or calculate
   */
  async getCurrentICR(): Promise<ICRSnapshot> {
    try {
      // Try cache first
      const cached = await getCachedData<any>(this.REDIS_KEY, this.REDIS_TTL);
      
      if (cached) {
        console.log('✅ ICR retrieved from cache');
        return {
          timestamp: new Date(cached.timestamp),
          icrValue: cached.icrValue,
          confidenceInterval: cached.confidenceInterval,
          sources: cached.sources
        };
      }
    } catch (error) {
      console.warn('⚠️ Cache retrieval failed:', error);
    }

    // Calculate if not cached
    return await this.calculateICR();
  }

  /**
   * Get ICR history from Supabase
   */
  async getICRHistory(hours: number = 24): Promise<ICRSnapshot[]> {
    try {
      const since = new Date(Date.now() - hours * 60 * 60 * 1000);

      const { data, error } = await this.supabase
        .from('icr_history')
        .select('*')
        .gte('timestamp', since.toISOString())
        .order('timestamp', { ascending: false });

      if (error) {
        console.error('❌ Failed to fetch ICR history:', error);
        throw error;
      }

      return data.map((row: any) => ({
        timestamp: new Date(row.timestamp),
        icrValue: row.icr_value,
        confidenceInterval: row.confidence_interval,
        sources: row.source_data?.sources || []
      }));
    } catch (error) {
      console.error('❌ History fetch failed:', error);
      throw error;
    }
  }

  /**
   * Detect outliers in lending rates
   */
  private detectOutliers(rates: ICRData[], weightedRate: number): ICRData[] {
    const outliers: ICRData[] = [];

    // Calculate standard deviation
    const totalTvl = rates.reduce((sum, r) => sum + r.tvl, 0);
    const variance = rates.reduce((sum, r) => {
      const weight = r.tvl / totalTvl;
      return sum + weight * Math.pow(r.rate - weightedRate, 2);
    }, 0);
    const stdDev = Math.sqrt(variance);

    // Flag rates >2σ from mean
    for (const rate of rates) {
      const deviation = Math.abs(rate.rate - weightedRate);
      if (deviation > 2 * stdDev) {
        outliers.push(rate);
        console.warn(`⚠️ Outlier detected: ${rate.protocol} at ${rate.rate / 100}%`);
      }
    }

    return outliers;
  }
}

/**
 * Get ICR calculator instance
 */
let icrCalculatorInstance: ICRCalculator | null = null;

export function getICRCalculator(): ICRCalculator {
  if (!icrCalculatorInstance) {
    icrCalculatorInstance = new ICRCalculator();
  }
  return icrCalculatorInstance;
}

/**
 * Scheduled ICR update (called by cron every 10 minutes)
 */
export async function updateICR(): Promise<void> {
  console.log('⏰ Scheduled ICR update triggered');
  
  try {
    const calculator = getICRCalculator();
    await calculator.calculateICR();
    console.log('✅ Scheduled ICR update complete');
  } catch (error) {
    console.error('❌ Scheduled ICR update failed:', error);
    throw error;
  }
}
