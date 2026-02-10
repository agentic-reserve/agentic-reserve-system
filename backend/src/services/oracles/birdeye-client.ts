import axios, { AxiosInstance } from 'axios';
import { config } from '../../config';
import { getRedisClient } from '../redis';

/**
 * Solana Token Addresses for Birdeye API
 */
export const SOLANA_TOKENS = {
  SOL: 'So11111111111111111111111111111111111111112',
  USDC: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v',
  USDT: 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB',
  mSOL: 'mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So',
  stSOL: '7dHbWXmci3dT8UFYWYZweBLXgycu7Y3iL6trKn1Y7ARj',
  jitoSOL: 'J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn',
  JUP: 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN',
  RAY: '4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R',
  BONK: 'DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263',
} as const;

export interface BirdeyeTokenPrice {
  address: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  liquidity: number;
  marketCap: number;
  timestamp: number;
  source: 'birdeye';
}

export interface BirdeyeMarketData {
  address: string;
  symbol: string;
  price: number;
  priceChange24h: number;
  volume24h: number;
  volumeChange24h: number;
  liquidity: number;
  liquidityChange24h: number;
  marketCap: number;
  fdv: number; // Fully diluted valuation
  holders: number;
  trustScore: number; // 0-100
  trustGrade: 'A' | 'B' | 'C';
  timestamp: number;
}

export interface BirdeyeOHLCV {
  address: string;
  timestamp: number;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

/**
 * Birdeye API Client for comprehensive market data
 * Provides price, volume, liquidity, and trust score data
 */
export class BirdeyeClient {
  private client: AxiosInstance;
  private redis: ReturnType<typeof getRedisClient>;
  private cacheTTL: number = 60; // 60 seconds for market data
  private rateLimitDelay: number = 100; // 100ms between requests

  constructor() {
    const apiKey = config.apis.birdeyeApiKey;

    if (!apiKey) {
      console.warn('⚠️  BIRDEYE_API_KEY not set - using public tier with rate limits');
    }

    this.client = axios.create({
      baseURL: 'https://public-api.birdeye.so',
      headers: {
        'X-API-KEY': apiKey || '',
        'Accept': 'application/json',
      },
      timeout: 10000,
    });

    this.redis = getRedisClient();

    console.log('✅ Birdeye API client initialized');
  }

  /**
   * Rate limiting helper
   */
  private async rateLimit(): Promise<void> {
    await new Promise(resolve => setTimeout(resolve, this.rateLimitDelay));
  }

  /**
   * Get cached data or fetch from API
   */
  private async getCached<T>(
    key: string,
    fetcher: () => Promise<T>,
    ttl: number = this.cacheTTL
  ): Promise<T> {
    try {
      const cached = await this.redis.get(key);
      if (cached) {
        return JSON.parse(cached);
      }
    } catch (error) {
      console.warn('Redis cache read error:', error);
    }

    const data = await fetcher();

    try {
      await this.redis.setex(key, ttl, JSON.stringify(data));
    } catch (error) {
      console.warn('Redis cache write error:', error);
    }

    return data;
  }

  /**
   * Get token price
   */
  async getTokenPrice(address: string): Promise<BirdeyeTokenPrice> {
    const cacheKey = `birdeye:price:${address}`;

    return this.getCached(cacheKey, async () => {
      await this.rateLimit();

      const response = await this.client.get(`/defi/price`, {
        params: {
          address,
          check_liquidity: 'true',
        },
      });

      const data = response.data.data;

      return {
        address,
        symbol: data.symbol || 'UNKNOWN',
        price: data.value || 0,
        priceChange24h: data.priceChange24h || 0,
        volume24h: data.volume24h || 0,
        liquidity: data.liquidity || 0,
        marketCap: data.mc || 0,
        timestamp: Date.now(),
        source: 'birdeye',
      };
    });
  }

  /**
   * Get multiple token prices in batch
   */
  async getMultipleTokenPrices(addresses: string[]): Promise<BirdeyeTokenPrice[]> {
    const cacheKey = `birdeye:prices:${addresses.join(',')}`;

    return this.getCached(cacheKey, async () => {
      await this.rateLimit();

      const response = await this.client.get(`/defi/multi_price`, {
        params: {
          list_address: addresses.join(','),
        },
      });

      const data = response.data.data;

      return Object.entries(data).map(([address, priceData]: [string, any]) => ({
        address,
        symbol: priceData.symbol || 'UNKNOWN',
        price: priceData.value || 0,
        priceChange24h: priceData.priceChange24h || 0,
        volume24h: priceData.volume24h || 0,
        liquidity: priceData.liquidity || 0,
        marketCap: priceData.mc || 0,
        timestamp: Date.now(),
        source: 'birdeye' as const,
      }));
    });
  }

  /**
   * Get comprehensive market data including trust score
   */
  async getMarketData(address: string): Promise<BirdeyeMarketData> {
    const cacheKey = `birdeye:market:${address}`;

    return this.getCached(cacheKey, async () => {
      await this.rateLimit();

      // Get price data
      const priceResponse = await this.client.get(`/defi/price`, {
        params: { address, check_liquidity: 'true' },
      });

      // Get token overview
      const overviewResponse = await this.client.get(`/defi/token_overview`, {
        params: { address },
      });

      const priceData = priceResponse.data.data;
      const overviewData = overviewResponse.data.data;

      // Parse trust score (0-100)
      const trustScore = overviewData.trustScore || 0;
      let trustGrade: 'A' | 'B' | 'C' = 'C';
      if (trustScore >= 85) trustGrade = 'A';
      else if (trustScore >= 70) trustGrade = 'B';

      return {
        address,
        symbol: priceData.symbol || overviewData.symbol || 'UNKNOWN',
        price: priceData.value || 0,
        priceChange24h: priceData.priceChange24h || 0,
        volume24h: priceData.volume24h || 0,
        volumeChange24h: overviewData.volumeChange24h || 0,
        liquidity: priceData.liquidity || 0,
        liquidityChange24h: overviewData.liquidityChange24h || 0,
        marketCap: priceData.mc || 0,
        fdv: overviewData.fdv || 0,
        holders: overviewData.holder || 0,
        trustScore,
        trustGrade,
        timestamp: Date.now(),
      };
    });
  }

  /**
   * Get OHLCV data for charting
   */
  async getOHLCV(
    address: string,
    timeframe: '1m' | '5m' | '15m' | '1H' | '4H' | '1D' = '1H',
    limit: number = 100
  ): Promise<BirdeyeOHLCV[]> {
    const cacheKey = `birdeye:ohlcv:${address}:${timeframe}:${limit}`;

    return this.getCached(
      cacheKey,
      async () => {
        await this.rateLimit();

        const response = await this.client.get(`/defi/ohlcv`, {
          params: {
            address,
            type: timeframe,
            time_from: Math.floor(Date.now() / 1000) - 86400 * 7, // 7 days ago
            time_to: Math.floor(Date.now() / 1000),
          },
        });

        const data = response.data.data.items || [];

        return data.slice(0, limit).map((item: any) => ({
          address,
          timestamp: item.unixTime * 1000,
          open: item.o || 0,
          high: item.h || 0,
          low: item.l || 0,
          close: item.c || 0,
          volume: item.v || 0,
        }));
      },
      300 // 5 minute cache for OHLCV
    );
  }

  /**
   * Get SOL price
   */
  async getSOLPrice(): Promise<BirdeyeTokenPrice> {
    return this.getTokenPrice(SOLANA_TOKENS.SOL);
  }

  /**
   * Get USDC price
   */
  async getUSDCPrice(): Promise<BirdeyeTokenPrice> {
    return this.getTokenPrice(SOLANA_TOKENS.USDC);
  }

  /**
   * Get mSOL price
   */
  async getMSOLPrice(): Promise<BirdeyeTokenPrice> {
    return this.getTokenPrice(SOLANA_TOKENS.mSOL);
  }

  /**
   * Get all major token prices for ILI calculation
   */
  async getMajorTokenPrices(): Promise<{
    SOL: BirdeyeTokenPrice;
    USDC: BirdeyeTokenPrice;
    mSOL: BirdeyeTokenPrice;
    USDT: BirdeyeTokenPrice;
  }> {
    const addresses = [
      SOLANA_TOKENS.SOL,
      SOLANA_TOKENS.USDC,
      SOLANA_TOKENS.mSOL,
      SOLANA_TOKENS.USDT,
    ];

    const prices = await this.getMultipleTokenPrices(addresses);

    return {
      SOL: prices[0],
      USDC: prices[1],
      mSOL: prices[2],
      USDT: prices[3],
    };
  }

  /**
   * Get token liquidity across all DEXs
   */
  async getTokenLiquidity(address: string): Promise<{
    total: number;
    byDex: Array<{ dex: string; liquidity: number }>;
  }> {
    const cacheKey = `birdeye:liquidity:${address}`;

    return this.getCached(cacheKey, async () => {
      await this.rateLimit();

      const response = await this.client.get(`/defi/token_liquidity`, {
        params: { address },
      });

      const data = response.data.data;

      return {
        total: data.totalLiquidity || 0,
        byDex: (data.items || []).map((item: any) => ({
          dex: item.source || 'unknown',
          liquidity: item.liquidity || 0,
        })),
      };
    });
  }

  /**
   * Get top traders for a token
   */
  async getTopTraders(address: string, limit: number = 10): Promise<Array<{
    wallet: string;
    volume24h: number;
    trades24h: number;
    pnl24h: number;
  }>> {
    const cacheKey = `birdeye:traders:${address}:${limit}`;

    return this.getCached(
      cacheKey,
      async () => {
        await this.rateLimit();

        const response = await this.client.get(`/defi/token_top_traders`, {
          params: { address, limit },
        });

        const data = response.data.data.items || [];

        return data.map((trader: any) => ({
          wallet: trader.address || '',
          volume24h: trader.volume24h || 0,
          trades24h: trader.trades24h || 0,
          pnl24h: trader.pnl24h || 0,
        }));
      },
      300 // 5 minute cache
    );
  }

  /**
   * Validate market data quality
   */
  validateMarketData(data: BirdeyeMarketData): {
    valid: boolean;
    issues: string[];
    trustLevel: 'high' | 'medium' | 'low';
  } {
    const issues: string[] = [];

    // Check trust score
    if (data.trustScore < 70) {
      issues.push(`Low trust score: ${data.trustScore}/100 (Grade ${data.trustGrade})`);
    }

    // Check liquidity
    if (data.liquidity < 100000) {
      issues.push(`Low liquidity: $${data.liquidity.toLocaleString()}`);
    }

    // Check volume
    if (data.volume24h < 10000) {
      issues.push(`Low 24h volume: $${data.volume24h.toLocaleString()}`);
    }

    // Check holders
    if (data.holders < 100) {
      issues.push(`Low holder count: ${data.holders}`);
    }

    // Determine trust level
    let trustLevel: 'high' | 'medium' | 'low';
    if (data.trustGrade === 'A' && data.liquidity > 1000000) {
      trustLevel = 'high';
    } else if (data.trustGrade === 'B' || data.liquidity > 100000) {
      trustLevel = 'medium';
    } else {
      trustLevel = 'low';
    }

    return {
      valid: issues.length === 0,
      issues,
      trustLevel,
    };
  }

  /**
   * Clear cache for a specific token
   */
  async clearTokenCache(address: string): Promise<void> {
    const keys = [
      `birdeye:price:${address}`,
      `birdeye:market:${address}`,
      `birdeye:liquidity:${address}`,
    ];

    for (const key of keys) {
      try {
        await this.redis.del(key);
      } catch (error) {
        console.warn(`Failed to clear cache key ${key}:`, error);
      }
    }
  }
}

// Singleton instance
let birdeyeClient: BirdeyeClient | null = null;

/**
 * Get or create Birdeye client instance
 */
export function getBirdeyeClient(): BirdeyeClient {
  if (!birdeyeClient) {
    birdeyeClient = new BirdeyeClient();
  }
  return birdeyeClient;
}

/**
 * Initialize Birdeye client (call this on app startup)
 */
export function initializeBirdeyeClient(): BirdeyeClient {
  birdeyeClient = new BirdeyeClient();
  return birdeyeClient;
}
