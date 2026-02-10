import axios, { AxiosInstance } from 'axios';
import { config } from '../../config';

export interface JupiterUltraOrder {
  orderId: string;
  inputMint: string;
  outputMint: string;
  inAmount: string;
  outAmount: string;
  priceImpactPct: number;
  slippageBps: number;
  fee: {
    amount: string;
    mint: string;
    pct: number;
  };
  routePlan: any[];
}

export interface JupiterUltraExecuteResponse {
  orderId: string;
  status: 'pending' | 'confirmed' | 'failed';
  txid?: string;
  inAmount: string;
  outAmount: string;
  error?: string;
}

export interface JupiterTokenInfo {
  address: string;
  name: string;
  symbol: string;
  decimals: number;
  logoURI?: string;
  tags?: string[];
  daily_volume?: number;
}

export interface JupiterPriceData {
  id: string;
  mintSymbol: string;
  vsToken: string;
  vsTokenSymbol: string;
  price: number;
}

/**
 * Jupiter API Client
 * Uses Ultra API (v3) - the most advanced trading engine on Solana
 * Features: Juno liquidity engine, sub-second execution, gasless support
 */
export class JupiterClient {
  private ultraClient: AxiosInstance;
  private priceClient: AxiosInstance;
  private priceCache: Map<string, { price: number; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 30 * 1000; // 30 seconds

  constructor() {
    // Ultra API for swaps (recommended)
    this.ultraClient = axios.create({
      baseURL: 'https://api.jup.ag/ultra/v1',
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Price API
    this.priceClient = axios.create({
      baseURL: 'https://api.jup.ag/price/v2',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Jupiter Ultra client initialized');
  }

  /**
   * Get Ultra order (quote + execution in one)
   * Ultra API provides best executed price with sub-second landing
   */
  async getUltraOrder(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    slippageBps?: number;
    userPublicKey: string;
  }): Promise<JupiterUltraOrder> {
    try {
      const response = await this.ultraClient.post('/order', {
        inputMint: params.inputMint,
        outputMint: params.outputMint,
        amount: params.amount.toString(),
        slippageBps: params.slippageBps || 50, // 0.5% default slippage
        userPublicKey: params.userPublicKey,
      });

      return response.data;
    } catch (error) {
      console.error('Jupiter getUltraOrder error:', error);
      throw new Error(`Failed to get Ultra order: ${error}`);
    }
  }

  /**
   * Execute Ultra order
   * Handles transaction signing and broadcasting
   */
  async executeUltraOrder(params: {
    orderId: string;
    signedTransaction: string;
  }): Promise<JupiterUltraExecuteResponse> {
    try {
      const response = await this.ultraClient.post('/execute', {
        orderId: params.orderId,
        signedTransaction: params.signedTransaction,
      });

      return response.data;
    } catch (error) {
      console.error('Jupiter executeUltraOrder error:', error);
      throw new Error(`Failed to execute Ultra order: ${error}`);
    }
  }

  /**
   * Get token price from Jupiter Price API v2
   */
  async getTokenPrice(mintAddress: string): Promise<number> {
    // Check cache
    const cached = this.priceCache.get(mintAddress);
    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.price;
    }

    try {
      const response = await this.priceClient.get('', {
        params: {
          ids: mintAddress,
        },
      });

      const priceData = response.data.data[mintAddress];
      if (!priceData) {
        throw new Error(`Price not found for ${mintAddress}`);
      }

      const price = priceData.price;

      // Cache the price
      this.priceCache.set(mintAddress, { price, timestamp: Date.now() });

      return price;
    } catch (error) {
      console.error('Jupiter getTokenPrice error:', error);
      throw new Error(`Failed to get token price: ${error}`);
    }
  }

  /**
   * Get multiple token prices
   */
  async getTokenPrices(mintAddresses: string[]): Promise<Record<string, number>> {
    try {
      const response = await this.priceClient.get('', {
        params: {
          ids: mintAddresses.join(','),
        },
      });

      const prices: Record<string, number> = {};
      for (const [mint, data] of Object.entries(response.data.data)) {
        prices[mint] = (data as any).price;

        // Cache each price
        this.priceCache.set(mint, {
          price: (data as any).price,
          timestamp: Date.now(),
        });
      }

      return prices;
    } catch (error) {
      console.error('Jupiter getTokenPrices error:', error);
      throw new Error(`Failed to get token prices: ${error}`);
    }
  }

  /**
   * Get token list
   */
  async getTokenList(): Promise<JupiterTokenInfo[]> {
    try {
      const response = await axios.get('https://token.jup.ag/all');
      return response.data;
    } catch (error) {
      console.error('Jupiter getTokenList error:', error);
      throw new Error(`Failed to get token list: ${error}`);
    }
  }

  /**
   * Get swap volume for a token pair (24h)
   */
  async getSwapVolume(inputMint: string, outputMint: string): Promise<number> {
    try {
      // Note: Jupiter doesn't have a direct volume API
      // This would need to be calculated from historical swap data
      // For now, return 0 as placeholder
      console.warn('Jupiter swap volume API not available, returning 0');
      return 0;
    } catch (error) {
      console.error('Jupiter getSwapVolume error:', error);
      return 0;
    }
  }

  /**
   * Calculate price impact for a swap using Ultra API
   */
  async calculatePriceImpact(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    userPublicKey: string;
  }): Promise<number> {
    try {
      const order = await this.getUltraOrder(params);
      return order.priceImpactPct;
    } catch (error) {
      console.error('Jupiter calculatePriceImpact error:', error);
      throw new Error(`Failed to calculate price impact: ${error}`);
    }
  }

  /**
   * Get best route for a swap using Ultra API
   */
  async getBestRoute(params: {
    inputMint: string;
    outputMint: string;
    amount: number;
    userPublicKey: string;
  }): Promise<any[]> {
    try {
      const order = await this.getUltraOrder(params);
      return order.routePlan;
    } catch (error) {
      console.error('Jupiter getBestRoute error:', error);
      throw new Error(`Failed to get best route: ${error}`);
    }
  }

  /**
   * Get user token holdings via Ultra API
   */
  async getUserHoldings(userPublicKey: string): Promise<any[]> {
    try {
      const response = await this.ultraClient.get('/holdings', {
        params: {
          owner: userPublicKey,
        },
      });

      return response.data.tokens || [];
    } catch (error) {
      console.error('Jupiter getUserHoldings error:', error);
      return [];
    }
  }

  /**
   * Search for tokens
   */
  async searchToken(query: string): Promise<JupiterTokenInfo[]> {
    try {
      const response = await this.ultraClient.get('/search', {
        params: {
          query,
        },
      });

      return response.data.tokens || [];
    } catch (error) {
      console.error('Jupiter searchToken error:', error);
      return [];
    }
  }

  /**
   * Get SOL/USDC price
   */
  async getSOLUSDCPrice(): Promise<number> {
    const SOL_MINT = 'So11111111111111111111111111111111111111112';
    return this.getTokenPrice(SOL_MINT);
  }

  /**
   * Get liquidity for a token pair
   */
  async getLiquidity(
    inputMint: string,
    outputMint: string,
    userPublicKey: string
  ): Promise<{
    available: boolean;
    routes: number;
  }> {
    try {
      const order = await this.getUltraOrder({
        inputMint,
        outputMint,
        amount: 1000000, // 1 USDC equivalent
        userPublicKey,
      });

      return {
        available: true,
        routes: order.routePlan.length,
      };
    } catch (error) {
      return {
        available: false,
        routes: 0,
      };
    }
  }

  /**
   * Get swap volume for a token (24h)
   * Note: Jupiter doesn't provide direct volume API
   * This would need to be calculated from historical data
   */
  async get24hVolume(mintAddress: string): Promise<number> {
    // Placeholder - would need historical swap data
    console.warn('Jupiter 24h volume API not available');
    return 0;
  }
}

// Singleton instance
let jupiterClient: JupiterClient | null = null;

/**
 * Get or create Jupiter client instance
 */
export function getJupiterClient(): JupiterClient {
  if (!jupiterClient) {
    jupiterClient = new JupiterClient();
  }
  return jupiterClient;
}
