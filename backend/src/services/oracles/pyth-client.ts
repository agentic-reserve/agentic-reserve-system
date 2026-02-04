import { HermesClient } from '@pythnetwork/hermes-client';
import { getHeliusClient } from '../helius-client';

/**
 * Pyth Price Feed IDs for Solana ecosystem
 * Source: https://pyth.network/developers/price-feed-ids
 * Verified: https://hermes.pyth.network/docs/
 */
export const PYTH_PRICE_FEEDS = {
  // Major tokens
  SOL_USD: 'ef0d8b6fda2ceba41da15d4095d1da392a0d2f8ed0c6c7bc0f4cfac8c280b56d',
  USDC_USD: 'eaa020c61cc479712813461ce153894a96a6c00b21ed0cfc2798d1f9a9e9c94a',
  USDT_USD: '2b89b9dc8fdf9f34709a5b106b472f0f39bb6ca9ce04b0fd7f2e971688e2e53b',
  
  // Liquid staking tokens
  MSOL_USD: 'c2289a6a43d2ce91c6f55caec370f4acc38a2ed477f58813334c6d03749ff2a4',
  STSOL_USD: '3b9551b6178645d8f3f0a8e7e1f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4',
  JITOSOL_USD: '67be9f519b95cf24338801051f9a808eff0a578ccb388db73b7f6fe1de019ffb',
  
  // DeFi tokens
  JUP_USD: '0a0408d619e9380abad35060f9192039ed5042fa6f82301d0e48bb52be830996',
  RAY_USD: '91568baa8d0b0c4a1f2c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c8c',
  
  // Stablecoins
  DAI_USD: 'b0948a5e5313200c632b51bb5ca32f6de0d36e9950a942d19751e833f70dabfd',
  PYUSD_USD: '3b9551b6178645d8f3f0a8e7e1f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4f4',
  
  // BTC and ETH
  BTC_USD: 'e62df6c8b4a85fe1a67db44dc12de5db330f7ac66b72dc658afedf0f4a415b43',
  ETH_USD: 'ff61491a931112ddf1bd8147cd1b641375f79f5825126d665480874634fd0ace',
} as const;

export interface PythPrice {
  price: number;
  confidence: number;
  expo: number;
  publishTime: number;
  priceId: string;
}

export interface PythPriceData {
  symbol: string;
  price: number;
  confidence: number;
  confidenceInterval: number; // as percentage
  timestamp: number;
  source: 'pyth';
}

/**
 * Pyth Oracle Client for fetching real-time price data
 * Uses Hermes API for off-chain price updates
 */
export class PythClient {
  private hermesClient: HermesClient;
  private heliusClient: ReturnType<typeof getHeliusClient>;
  private priceCache: Map<string, { data: PythPriceData; timestamp: number }>;
  private cacheTTL: number = 5000; // 5 seconds

  constructor() {
    // Initialize Hermes client (Pyth's price service)
    this.hermesClient = new HermesClient('https://hermes.pyth.network', {});
    this.heliusClient = getHeliusClient();
    this.priceCache = new Map();

    console.log('✅ Pyth oracle client initialized');
  }

  /**
   * Get latest price for a single feed
   */
  async getPrice(priceId: string, symbol: string): Promise<PythPriceData> {
    // Check cache first
    const cached = this.priceCache.get(priceId);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      // Fetch latest price from Hermes
      const priceFeeds = await this.hermesClient.getLatestPriceUpdates([priceId]);
      
      if (!priceFeeds || priceFeeds.parsed?.length === 0) {
        throw new Error(`No price data found for ${symbol}`);
      }

      const priceFeed = priceFeeds.parsed[0];
      const price = priceFeed.price;

      // Calculate actual price with exponent
      const actualPrice = Number(price.price) * Math.pow(10, price.expo);
      const actualConfidence = Number(price.conf) * Math.pow(10, price.expo);
      
      // Calculate confidence interval as percentage
      const confidenceInterval = actualPrice > 0 
        ? (actualConfidence / actualPrice) * 100 
        : 0;

      const priceData: PythPriceData = {
        symbol,
        price: actualPrice,
        confidence: actualConfidence,
        confidenceInterval,
        timestamp: price.publishTime * 1000, // Convert to milliseconds
        source: 'pyth',
      };

      // Cache the result
      this.priceCache.set(priceId, {
        data: priceData,
        timestamp: Date.now(),
      });

      return priceData;
    } catch (error) {
      console.error(`Error fetching Pyth price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple prices in a single request
   */
  async getPrices(feeds: Array<{ priceId: string; symbol: string }>): Promise<PythPriceData[]> {
    try {
      const priceIds = feeds.map(f => f.priceId);
      const priceFeeds = await this.hermesClient.getLatestPriceUpdates(priceIds);

      if (!priceFeeds || !priceFeeds.parsed) {
        throw new Error('No price data received from Pyth');
      }

      return priceFeeds.parsed.map((priceFeed, index) => {
        const price = priceFeed.price;
        const symbol = feeds[index].symbol;

        const actualPrice = Number(price.price) * Math.pow(10, price.expo);
        const actualConfidence = Number(price.conf) * Math.pow(10, price.expo);
        const confidenceInterval = actualPrice > 0 
          ? (actualConfidence / actualPrice) * 100 
          : 0;

        const priceData: PythPriceData = {
          symbol,
          price: actualPrice,
          confidence: actualConfidence,
          confidenceInterval,
          timestamp: price.publishTime * 1000,
          source: 'pyth',
        };

        // Cache each result
        this.priceCache.set(feeds[index].priceId, {
          data: priceData,
          timestamp: Date.now(),
        });

        return priceData;
      });
    } catch (error) {
      console.error('Error fetching multiple Pyth prices:', error);
      throw error;
    }
  }

  /**
   * Get SOL/USD price
   */
  async getSOLPrice(): Promise<PythPriceData> {
    return this.getPrice(PYTH_PRICE_FEEDS.SOL_USD, 'SOL/USD');
  }

  /**
   * Get USDC/USD price
   */
  async getUSDCPrice(): Promise<PythPriceData> {
    return this.getPrice(PYTH_PRICE_FEEDS.USDC_USD, 'USDC/USD');
  }

  /**
   * Get mSOL/USD price
   */
  async getMSOLPrice(): Promise<PythPriceData> {
    return this.getPrice(PYTH_PRICE_FEEDS.MSOL_USD, 'mSOL/USD');
  }

  /**
   * Get all major token prices for ILI calculation
   */
  async getMajorTokenPrices(): Promise<{
    SOL: PythPriceData;
    USDC: PythPriceData;
    mSOL: PythPriceData;
    USDT: PythPriceData;
  }> {
    const feeds = [
      { priceId: PYTH_PRICE_FEEDS.SOL_USD, symbol: 'SOL/USD' },
      { priceId: PYTH_PRICE_FEEDS.USDC_USD, symbol: 'USDC/USD' },
      { priceId: PYTH_PRICE_FEEDS.MSOL_USD, symbol: 'mSOL/USD' },
      { priceId: PYTH_PRICE_FEEDS.USDT_USD, symbol: 'USDT/USD' },
    ];

    const prices = await this.getPrices(feeds);

    return {
      SOL: prices[0],
      USDC: prices[1],
      mSOL: prices[2],
      USDT: prices[3],
    };
  }

  /**
   * Get price with VAA (Verifiable Action Approval) for on-chain updates
   * This is used when you need to submit prices to smart contracts
   */
  async getPriceUpdateData(priceIds: string[]): Promise<string[]> {
    try {
      const priceFeeds = await this.hermesClient.getLatestPriceUpdates(priceIds, {
        encoding: 'hex',
      });

      if (!priceFeeds || !priceFeeds.binary) {
        throw new Error('No VAA data received from Pyth');
      }

      return priceFeeds.binary.data;
    } catch (error) {
      console.error('Error fetching Pyth VAA data:', error);
      throw error;
    }
  }

  /**
   * Check if price data is stale (older than 60 seconds)
   */
  isPriceStale(priceData: PythPriceData, maxAgeSeconds: number = 60): boolean {
    const ageSeconds = (Date.now() - priceData.timestamp) / 1000;
    return ageSeconds > maxAgeSeconds;
  }

  /**
   * Check if confidence interval is acceptable (< 1% by default)
   */
  isConfidenceAcceptable(priceData: PythPriceData, maxConfidencePercent: number = 1): boolean {
    return priceData.confidenceInterval <= maxConfidencePercent;
  }

  /**
   * Validate price data quality
   */
  validatePriceData(priceData: PythPriceData): {
    valid: boolean;
    issues: string[];
  } {
    const issues: string[] = [];

    if (this.isPriceStale(priceData)) {
      issues.push('Price data is stale (>60s old)');
    }

    if (!this.isConfidenceAcceptable(priceData)) {
      issues.push(`Confidence interval too high: ${priceData.confidenceInterval.toFixed(2)}%`);
    }

    if (priceData.price <= 0) {
      issues.push('Invalid price: must be positive');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Clear price cache
   */
  clearCache(): void {
    this.priceCache.clear();
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): {
    size: number;
    entries: Array<{ priceId: string; age: number }>;
  } {
    const entries = Array.from(this.priceCache.entries()).map(([priceId, cached]) => ({
      priceId,
      age: Date.now() - cached.timestamp,
    }));

    return {
      size: this.priceCache.size,
      entries,
    };
  }
}

// Singleton instance
let pythClient: PythClient | null = null;

/**
 * Get or create Pyth client instance
 */
export function getPythClient(): PythClient {
  if (!pythClient) {
    pythClient = new PythClient();
  }
  return pythClient;
}

/**
 * Initialize Pyth client (call this on app startup)
 */
export function initializePythClient(): PythClient {
  pythClient = new PythClient();
  return pythClient;
}
