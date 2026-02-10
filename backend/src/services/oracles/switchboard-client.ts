import { Connection, PublicKey } from '@solana/web3.js';
import { getHeliusClient } from '../helius-client';

/**
 * Switchboard Feed Addresses for Solana
 * Source: https://app.switchboard.xyz/solana/mainnet
 */
export const SWITCHBOARD_FEEDS = {
  // Major tokens
  SOL_USD: 'GvDMxPzN1sCj7L26YDK2HnMRXEQmQ2aemov8YBtPS7vR',
  USDC_USD: 'BjUgj6YCnFBZ49wF54ddBVA9qu8TeqkFtkbqmZcee8uW',
  USDT_USD: '5mp8kbkTYwWWCsKSte8rURjTuyinsqBpJ3xToWQjcSKj',
  
  // Liquid staking
  MSOL_USD: 'E4v1BBgoso9s64TQvmyownAVJbhbEPGyzA3qn4n46qj9',
  STSOL_USD: 'Bt1hEbY62aMriY1SyQqbeZbm8VmSbQVGBFzSzMuVNWzN',
  JITOSOL_USD: 'DtmE9D2CSB4L5D6A15mraeEjrGMm6auWVzgaD8hK2tZM',
  
  // DeFi tokens
  JUP_USD: '8ahPGPjEbpgGaZx2NV1iG5Shj7TDwvsjkEDcGWjt94TP',
  RAY_USD: 'AnLf8tVYCM816gmBjiy8n53eXKKEDydT5piYjjQDPgTB',
} as const;

export interface SwitchboardPrice {
  price: number;
  confidence: number;
  confidenceInterval: number; // as percentage
  timestamp: number;
  minResponse: number;
  maxResponse: number;
  stdDev: number;
  source: 'switchboard';
}

/**
 * Switchboard Oracle Client for fetching price data with confidence intervals
 * Uses on-chain data from Switchboard aggregators
 */
export class SwitchboardClient {
  private connection: Connection;
  private priceCache: Map<string, { data: SwitchboardPrice; timestamp: number }>;
  private cacheTTL: number = 5000; // 5 seconds

  constructor() {
    const heliusClient = getHeliusClient();
    this.connection = heliusClient.getConnection();
    this.priceCache = new Map();

    console.log('✅ Switchboard oracle client initialized');
  }

  /**
   * Parse Switchboard aggregator account data
   * Switchboard stores data in a specific binary format
   */
  private parseAggregatorData(data: Buffer): {
    value: number;
    minResponse: number;
    maxResponse: number;
    stdDev: number;
    timestamp: number;
  } {
    try {
      // Switchboard V2 aggregator layout (simplified)
      // This is a basic parser - in production, use @switchboard-xyz/on-demand SDK
      
      // Read the current value (8 bytes, little-endian)
      const value = data.readBigInt64LE(0);
      
      // Read min response (8 bytes)
      const minResponse = data.readBigInt64LE(8);
      
      // Read max response (8 bytes)
      const maxResponse = data.readBigInt64LE(16);
      
      // Read standard deviation (8 bytes)
      const stdDev = data.readBigInt64LE(24);
      
      // Read timestamp (8 bytes)
      const timestamp = data.readBigInt64LE(32);

      // Convert from fixed-point to decimal (Switchboard uses 9 decimals)
      const scale = 1e9;
      
      return {
        value: Number(value) / scale,
        minResponse: Number(minResponse) / scale,
        maxResponse: Number(maxResponse) / scale,
        stdDev: Number(stdDev) / scale,
        timestamp: Number(timestamp),
      };
    } catch (error) {
      console.error('Error parsing Switchboard data:', error);
      throw new Error('Failed to parse Switchboard aggregator data');
    }
  }

  /**
   * Get price from Switchboard feed
   */
  async getPrice(feedAddress: string, symbol: string): Promise<SwitchboardPrice> {
    // Check cache first
    const cached = this.priceCache.get(feedAddress);
    if (cached && Date.now() - cached.timestamp < this.cacheTTL) {
      return cached.data;
    }

    try {
      const pubkey = new PublicKey(feedAddress);
      const accountInfo = await this.connection.getAccountInfo(pubkey);

      if (!accountInfo || !accountInfo.data) {
        throw new Error(`No data found for Switchboard feed: ${symbol}`);
      }

      const parsed = this.parseAggregatorData(accountInfo.data);

      // Calculate confidence interval
      const range = parsed.maxResponse - parsed.minResponse;
      const confidenceInterval = parsed.value > 0 
        ? (range / parsed.value) * 100 
        : 0;

      const priceData: SwitchboardPrice = {
        price: parsed.value,
        confidence: parsed.stdDev,
        confidenceInterval,
        timestamp: parsed.timestamp * 1000, // Convert to milliseconds
        minResponse: parsed.minResponse,
        maxResponse: parsed.maxResponse,
        stdDev: parsed.stdDev,
        source: 'switchboard',
      };

      // Cache the result
      this.priceCache.set(feedAddress, {
        data: priceData,
        timestamp: Date.now(),
      });

      return priceData;
    } catch (error) {
      console.error(`Error fetching Switchboard price for ${symbol}:`, error);
      throw error;
    }
  }

  /**
   * Get multiple prices in parallel
   */
  async getPrices(feeds: Array<{ address: string; symbol: string }>): Promise<SwitchboardPrice[]> {
    const promises = feeds.map(feed => this.getPrice(feed.address, feed.symbol));
    return Promise.all(promises);
  }

  /**
   * Get SOL/USD price
   */
  async getSOLPrice(): Promise<SwitchboardPrice> {
    return this.getPrice(SWITCHBOARD_FEEDS.SOL_USD, 'SOL/USD');
  }

  /**
   * Get USDC/USD price
   */
  async getUSDCPrice(): Promise<SwitchboardPrice> {
    return this.getPrice(SWITCHBOARD_FEEDS.USDC_USD, 'USDC/USD');
  }

  /**
   * Get mSOL/USD price
   */
  async getMSOLPrice(): Promise<SwitchboardPrice> {
    return this.getPrice(SWITCHBOARD_FEEDS.MSOL_USD, 'mSOL/USD');
  }

  /**
   * Get all major token prices
   */
  async getMajorTokenPrices(): Promise<{
    SOL: SwitchboardPrice;
    USDC: SwitchboardPrice;
    mSOL: SwitchboardPrice;
    USDT: SwitchboardPrice;
  }> {
    const feeds = [
      { address: SWITCHBOARD_FEEDS.SOL_USD, symbol: 'SOL/USD' },
      { address: SWITCHBOARD_FEEDS.USDC_USD, symbol: 'USDC/USD' },
      { address: SWITCHBOARD_FEEDS.MSOL_USD, symbol: 'mSOL/USD' },
      { address: SWITCHBOARD_FEEDS.USDT_USD, symbol: 'USDT/USD' },
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
   * Check if price data is stale (older than 60 seconds)
   */
  isPriceStale(priceData: SwitchboardPrice, maxAgeSeconds: number = 60): boolean {
    const ageSeconds = (Date.now() - priceData.timestamp) / 1000;
    return ageSeconds > maxAgeSeconds;
  }

  /**
   * Check if confidence interval is acceptable (< 2% by default)
   */
  isConfidenceAcceptable(priceData: SwitchboardPrice, maxConfidencePercent: number = 2): boolean {
    return priceData.confidenceInterval <= maxConfidencePercent;
  }

  /**
   * Validate price data quality
   */
  validatePriceData(priceData: SwitchboardPrice): {
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

    if (priceData.minResponse > priceData.maxResponse) {
      issues.push('Invalid range: min > max');
    }

    return {
      valid: issues.length === 0,
      issues,
    };
  }

  /**
   * Get price with statistical analysis
   */
  async getPriceWithStats(feedAddress: string, symbol: string): Promise<{
    price: SwitchboardPrice;
    stats: {
      range: number;
      rangePercent: number;
      isOutlier: boolean;
      quality: 'excellent' | 'good' | 'fair' | 'poor';
    };
  }> {
    const price = await this.getPrice(feedAddress, symbol);

    const range = price.maxResponse - price.minResponse;
    const rangePercent = price.price > 0 ? (range / price.price) * 100 : 0;
    
    // Detect outliers using 2-sigma rule
    const isOutlier = price.stdDev > 0 && Math.abs(price.price - price.minResponse) > 2 * price.stdDev;

    // Determine quality based on confidence interval
    let quality: 'excellent' | 'good' | 'fair' | 'poor';
    if (price.confidenceInterval < 0.5) {
      quality = 'excellent';
    } else if (price.confidenceInterval < 1) {
      quality = 'good';
    } else if (price.confidenceInterval < 2) {
      quality = 'fair';
    } else {
      quality = 'poor';
    }

    return {
      price,
      stats: {
        range,
        rangePercent,
        isOutlier,
        quality,
      },
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
    entries: Array<{ address: string; age: number }>;
  } {
    const entries = Array.from(this.priceCache.entries()).map(([address, cached]) => ({
      address,
      age: Date.now() - cached.timestamp,
    }));

    return {
      size: this.priceCache.size,
      entries,
    };
  }
}

// Singleton instance
let switchboardClient: SwitchboardClient | null = null;

/**
 * Get or create Switchboard client instance
 */
export function getSwitchboardClient(): SwitchboardClient {
  if (!switchboardClient) {
    switchboardClient = new SwitchboardClient();
  }
  return switchboardClient;
}

/**
 * Initialize Switchboard client (call this on app startup)
 */
export function initializeSwitchboardClient(): SwitchboardClient {
  switchboardClient = new SwitchboardClient();
  return switchboardClient;
}
