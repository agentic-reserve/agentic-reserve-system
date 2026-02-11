import { getPythClient, PythPriceData } from './pyth-client';
import { getSwitchboardClient, SwitchboardPrice } from './switchboard-client';
import { getBirdeyeClient, BirdeyeTokenPrice } from './birdeye-client';

export interface AggregatedPrice {
  symbol: string;
  price: number;
  median: number;
  mean: number;
  stdDev: number;
  confidenceInterval: number;
  sources: {
    pyth?: PythPriceData;
    switchboard?: SwitchboardPrice;
    birdeye?: BirdeyeTokenPrice;
  };
  outliers: string[];
  quality: 'excellent' | 'good' | 'fair' | 'poor';
  timestamp: number;
}

/**
 * Oracle Aggregator Service
 * Implements tri-source median aggregation with outlier detection (>2σ)
 * Provides manipulation-resistant price data for ILI calculation
 */
export class OracleAggregator {
  private pythClient: ReturnType<typeof getPythClient>;
  private switchboardClient: ReturnType<typeof getSwitchboardClient>;
  private birdeyeClient: ReturnType<typeof getBirdeyeClient>;

  constructor() {
    this.pythClient = getPythClient();
    this.switchboardClient = getSwitchboardClient();
    this.birdeyeClient = getBirdeyeClient();

    console.log('✅ Oracle aggregator initialized');
  }

  /**
   * Calculate median of an array
   */
  private calculateMedian(values: number[]): number {
    if (values.length === 0) return 0;

    const sorted = [...values].sort((a, b) => a - b);
    const mid = Math.floor(sorted.length / 2);

    if (sorted.length % 2 === 0) {
      return (sorted[mid - 1] + sorted[mid]) / 2;
    }
    return sorted[mid];
  }

  /**
   * Calculate mean (average) of an array
   */
  private calculateMean(values: number[]): number {
    if (values.length === 0) return 0;
    return values.reduce((sum, val) => sum + val, 0) / values.length;
  }

  /**
   * Calculate standard deviation
   */
  private calculateStdDev(values: number[], mean: number): number {
    if (values.length === 0) return 0;

    const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
    const variance = squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    return Math.sqrt(variance);
  }

  /**
   * Detect outliers using 2-sigma rule
   * Values more than 2 standard deviations from the mean are considered outliers
   */
  private detectOutliers(
    values: { source: string; price: number }[],
    mean: number,
    stdDev: number
  ): string[] {
    const outliers: string[] = [];

    for (const { source, price } of values) {
      const deviation = Math.abs(price - mean);
      if (deviation > 2 * stdDev) {
        outliers.push(source);
      }
    }

    return outliers;
  }

  /**
   * Determine price quality based on confidence intervals and outliers
   */
  private determineQuality(
    confidenceInterval: number,
    outliers: string[],
    sourceCount: number
  ): 'excellent' | 'good' | 'fair' | 'poor' {
    // If we have outliers, quality is degraded
    if (outliers.length > 0) {
      return 'fair';
    }

    // If we don't have all 3 sources, quality is degraded
    if (sourceCount < 3) {
      return 'fair';
    }

    // Based on confidence interval
    if (confidenceInterval < 0.5) {
      return 'excellent';
    } else if (confidenceInterval < 1.0) {
      return 'good';
    } else if (confidenceInterval < 2.0) {
      return 'fair';
    } else {
      return 'poor';
    }
  }

  /**
   * Aggregate price from all three oracle sources
   * Returns median price with outlier detection
   */
  async aggregatePrice(symbol: string): Promise<AggregatedPrice> {
    const sources: {
      pyth?: PythPriceData;
      switchboard?: SwitchboardPrice;
      birdeye?: BirdeyeTokenPrice;
    } = {};

    const prices: { source: string; price: number }[] = [];

    // Fetch from Pyth
    try {
      if (symbol === 'SOL/USD') {
        sources.pyth = await this.pythClient.getSOLPrice();
      } else if (symbol === 'USDC/USD') {
        sources.pyth = await this.pythClient.getUSDCPrice();
      } else if (symbol === 'mSOL/USD') {
        sources.pyth = await this.pythClient.getMSOLPrice();
      }

      if (sources.pyth) {
        prices.push({ source: 'pyth', price: sources.pyth.price });
      }
    } catch (error) {
      console.warn(`Pyth oracle failed for ${symbol}:`, error);
    }

    // Fetch from Switchboard
    try {
      if (symbol === 'SOL/USD') {
        sources.switchboard = await this.switchboardClient.getSOLPrice();
      } else if (symbol === 'USDC/USD') {
        sources.switchboard = await this.switchboardClient.getUSDCPrice();
      } else if (symbol === 'mSOL/USD') {
        sources.switchboard = await this.switchboardClient.getMSOLPrice();
      }

      if (sources.switchboard) {
        prices.push({ source: 'switchboard', price: sources.switchboard.price });
      }
    } catch (error) {
      console.warn(`Switchboard oracle failed for ${symbol}:`, error);
    }

    // Fetch from Birdeye
    try {
      if (symbol === 'SOL/USD') {
        sources.birdeye = await this.birdeyeClient.getSOLPrice();
      } else if (symbol === 'USDC/USD') {
        sources.birdeye = await this.birdeyeClient.getUSDCPrice();
      } else if (symbol === 'mSOL/USD') {
        sources.birdeye = await this.birdeyeClient.getMSOLPrice();
      }

      if (sources.birdeye) {
        prices.push({ source: 'birdeye', price: sources.birdeye.price });
      }
    } catch (error) {
      console.warn(`Birdeye oracle failed for ${symbol}:`, error);
    }

    // Require at least 2 sources
    if (prices.length < 2) {
      throw new Error(`Insufficient oracle sources for ${symbol}: only ${prices.length} available`);
    }

    // Calculate statistics
    const priceValues = prices.map(p => p.price);
    const median = this.calculateMedian(priceValues);
    const mean = this.calculateMean(priceValues);
    const stdDev = this.calculateStdDev(priceValues, mean);

    // Detect outliers (>2σ from mean)
    const outliers = this.detectOutliers(prices, mean, stdDev);

    // Calculate confidence interval as percentage
    const confidenceInterval = median > 0 ? (stdDev / median) * 100 : 0;

    // Determine quality
    const quality = this.determineQuality(confidenceInterval, outliers, prices.length);

    return {
      symbol,
      price: median, // Use median as the final price (manipulation-resistant)
      median,
      mean,
      stdDev,
      confidenceInterval,
      sources,
      outliers,
      quality,
      timestamp: Date.now(),
    };
  }

  /**
   * Aggregate prices for multiple tokens
   */
  async aggregatePrices(symbols: string[]): Promise<AggregatedPrice[]> {
    const promises = symbols.map(symbol => this.aggregatePrice(symbol));
    return Promise.all(promises);
  }

  /**
   * Get aggregated prices for major tokens (SOL, USDC, mSOL, USDT)
   */
  async getMajorTokenPrices(): Promise<{
    SOL: AggregatedPrice;
    USDC: AggregatedPrice;
    mSOL: AggregatedPrice;
  }> {
    const [SOL, USDC, mSOL] = await this.aggregatePrices([
      'SOL/USD',
      'USDC/USD',
      'mSOL/USD',
    ]);

    return { SOL, USDC, mSOL };
  }

  /**
   * Validate aggregated price quality
   */
  validatePrice(price: AggregatedPrice): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    // Check if we have outliers
    if (price.outliers.length > 0) {
      issues.push(`Outliers detected: ${price.outliers.join(', ')}`);
    }

    // Check confidence interval
    if (price.confidenceInterval > 2.0) {
      issues.push(`High confidence interval: ${price.confidenceInterval.toFixed(2)}%`);
    }

    // Check if price is reasonable
    if (price.price <= 0) {
      issues.push('Invalid price: must be positive');
    }

    // Check quality
    if (price.quality === 'poor') {
      issues.push('Poor price quality');
    }

    // Check source count
    const sourceCount = Object.keys(price.sources).length;
    if (sourceCount < 2) {
      issues.push(`Insufficient sources: only ${sourceCount} available`);
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get health status of all oracle sources
   */
  async getOracleHealth(): Promise<{
    pyth: { healthy: boolean; latency?: number };
    switchboard: { healthy: boolean; latency?: number };
    birdeye: { healthy: boolean; latency?: number };
    overall: 'healthy' | 'degraded' | 'critical';
  }> {
    const health = {
      pyth: { healthy: false, latency: 0 },
      switchboard: { healthy: false, latency: 0 },
      birdeye: { healthy: false, latency: 0 },
      overall: 'critical' as 'healthy' | 'degraded' | 'critical',
    };

    // Test Pyth
    try {
      const start = Date.now();
      await this.pythClient.getSOLPrice();
      health.pyth = { healthy: true, latency: Date.now() - start };
    } catch (error) {
      console.warn('Pyth health check failed:', error);
    }

    // Test Switchboard
    try {
      const start = Date.now();
      await this.switchboardClient.getSOLPrice();
      health.switchboard = { healthy: true, latency: Date.now() - start };
    } catch (error) {
      console.warn('Switchboard health check failed:', error);
    }

    // Test Birdeye
    try {
      const start = Date.now();
      await this.birdeyeClient.getSOLPrice();
      health.birdeye = { healthy: true, latency: Date.now() - start };
    } catch (error) {
      console.warn('Birdeye health check failed:', error);
    }

    // Determine overall health
    const healthyCount = [health.pyth.healthy, health.switchboard.healthy, health.birdeye.healthy]
      .filter(Boolean).length;

    if (healthyCount === 3) {
      health.overall = 'healthy';
    } else if (healthyCount >= 2) {
      health.overall = 'degraded';
    } else {
      health.overall = 'critical';
    }

    return health;
  }
}

// Singleton instance
let oracleAggregator: OracleAggregator | null = null;

/**
 * Get or create oracle aggregator instance
 */
export function getOracleAggregator(): OracleAggregator {
  if (!oracleAggregator) {
    oracleAggregator = new OracleAggregator();
  }
  return oracleAggregator;
}

/**
 * Initialize oracle aggregator (call this on app startup)
 */
export function initializeOracleAggregator(): OracleAggregator {
  oracleAggregator = new OracleAggregator();
  return oracleAggregator;
}
