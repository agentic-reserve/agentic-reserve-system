/**
 * Lulo Finance Client - Lending protocol integration
 * Reference: https://github.com/sendaifun/plugin-god-mode
 */

import axios, { AxiosInstance } from 'axios';
import { config } from '../../config';
import { logger } from '../memory/logger';

export interface LuloAccount {
  owner: string;
  totalSupplied: number;
  totalBorrowed: number;
  healthFactor: number;
  netAPY: number;
}

export interface LuloMarket {
  asset: string;
  symbol: string;
  supplyAPY: number;
  borrowAPY: number;
  totalSupply: number;
  totalBorrow: number;
  utilizationRate: number;
  available: number;
}

export interface LuloPosition {
  asset: string;
  supplied: number;
  borrowed: number;
  supplyAPY: number;
  borrowAPY: number;
  collateralFactor: number;
}

export class LuloClient {
  private client: AxiosInstance;
  private apiKey: string;
  private baseUrl: string = 'https://api.flexlend.fi'; // Lulo API endpoint

  constructor() {
    this.apiKey = config.apis.luloApiKey;
    
    this.client = axios.create({
      baseURL: this.baseUrl,
      timeout: 30000,
      headers: {
        'Content-Type': 'application/json',
        ...(this.apiKey && { 'Authorization': `Bearer ${this.apiKey}` })
      }
    });

    logger.info('Lulo client initialized', { 
      hasApiKey: !!this.apiKey,
      baseUrl: this.baseUrl 
    });
  }

  /**
   * Get all available lending markets
   */
  async getMarkets(): Promise<LuloMarket[]> {
    try {
      const response = await this.client.get('/markets');
      
      logger.info('Fetched Lulo markets', { 
        marketCount: response.data.length 
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Lulo markets', { error });
      throw error;
    }
  }

  /**
   * Get specific market data
   */
  async getMarket(asset: string): Promise<LuloMarket> {
    try {
      const response = await this.client.get(`/markets/${asset}`);
      
      logger.info('Fetched Lulo market', { asset });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Lulo market', { asset, error });
      throw error;
    }
  }

  /**
   * Get user account information
   */
  async getAccount(walletAddress: string): Promise<LuloAccount> {
    try {
      const response = await this.client.get(`/accounts/${walletAddress}`);
      
      logger.info('Fetched Lulo account', { 
        walletAddress,
        healthFactor: response.data.healthFactor 
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Lulo account', { walletAddress, error });
      throw error;
    }
  }

  /**
   * Get user positions
   */
  async getPositions(walletAddress: string): Promise<LuloPosition[]> {
    try {
      const response = await this.client.get(`/accounts/${walletAddress}/positions`);
      
      logger.info('Fetched Lulo positions', { 
        walletAddress,
        positionCount: response.data.length 
      });
      
      return response.data;
    } catch (error) {
      logger.error('Failed to fetch Lulo positions', { walletAddress, error });
      throw error;
    }
  }

  /**
   * Calculate optimal lending strategy
   */
  async calculateOptimalStrategy(
    walletAddress: string,
    targetAPY: number
  ): Promise<{
    recommendedSupply: Array<{ asset: string; amount: number; apy: number }>;
    recommendedBorrow: Array<{ asset: string; amount: number; apy: number }>;
    expectedNetAPY: number;
    riskScore: number;
  }> {
    try {
      const [markets, account] = await Promise.all([
        this.getMarkets(),
        this.getAccount(walletAddress)
      ]);

      // Sort markets by supply APY
      const topSupplyMarkets = markets
        .filter(m => m.supplyAPY > 0)
        .sort((a, b) => b.supplyAPY - a.supplyAPY)
        .slice(0, 3);

      // Calculate risk score based on utilization and health factor
      const avgUtilization = markets.reduce((sum, m) => sum + m.utilizationRate, 0) / markets.length;
      const riskScore = Math.min(100, (avgUtilization * 50) + ((2 - account.healthFactor) * 50));

      const result = {
        recommendedSupply: topSupplyMarkets.map(m => ({
          asset: m.asset,
          amount: 0, // To be calculated based on available balance
          apy: m.supplyAPY
        })),
        recommendedBorrow: [],
        expectedNetAPY: topSupplyMarkets[0]?.supplyAPY || 0,
        riskScore
      };

      logger.info('Calculated Lulo optimal strategy', {
        walletAddress,
        expectedNetAPY: result.expectedNetAPY,
        riskScore: result.riskScore
      });

      return result;
    } catch (error) {
      logger.error('Failed to calculate Lulo optimal strategy', { walletAddress, error });
      throw error;
    }
  }

  /**
   * Get total value locked (TVL) across all markets
   */
  async getTVL(): Promise<number> {
    try {
      const markets = await this.getMarkets();
      const tvl = markets.reduce((sum, market) => sum + market.totalSupply, 0);
      
      logger.info('Calculated Lulo TVL', { tvl });
      
      return tvl;
    } catch (error) {
      logger.error('Failed to calculate Lulo TVL', { error });
      throw error;
    }
  }

  /**
   * Check if API key is configured
   */
  isConfigured(): boolean {
    return !!this.apiKey;
  }
}

// Export singleton instance
export const luloClient = new LuloClient();
