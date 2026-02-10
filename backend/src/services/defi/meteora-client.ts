import axios, { AxiosInstance } from 'axios';
import { config } from '../../config';

export interface MeteoraPoolInfo {
  address: string;
  name: string;
  mint_x: string;
  mint_y: string;
  reserve_x: string;
  reserve_y: string;
  reserve_x_amount: number;
  reserve_y_amount: number;
  bin_step: number;
  base_fee_percentage: string;
  max_fee_percentage: string;
  protocol_fee_percentage: string;
  liquidity: string;
  reward_mint_x: string;
  reward_mint_y: string;
  fees_24h: number;
  today_fees: number;
  trade_volume_24h: number;
  cumulative_trade_volume: string;
  cumulative_fee_volume: string;
  current_price: number;
  apr: number;
  apy: number;
  farm_apr: number;
  farm_apy: number;
  hide: boolean;
}

export interface MeteoraVaultInfo {
  address: string;
  name: string;
  token_a_mint: string;
  token_b_mint: string;
  tvl: number;
  apy: number;
  apr: number;
  fees_24h: number;
  volume_24h: number;
}

export interface MeteoraDLMMPool {
  address: string;
  name: string;
  mint_x: string;
  mint_y: string;
  tvl: number;
  volume_24h: number;
  fees_24h: number;
  apr: number;
  apy: number;
}

/**
 * Meteora API Client
 * Provides DLMM pool data, Dynamic Vault APY, and liquidity metrics
 */
export class MeteoraClient {
  private client: AxiosInstance;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60 * 1000; // 60 seconds

  constructor() {
    this.client = axios.create({
      baseURL: config.apis.meteoraApiUrl,
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    console.log('✅ Meteora client initialized');
  }

  /**
   * Get all DLMM pools
   */
  async getDLMMPools(): Promise<MeteoraPoolInfo[]> {
    const cacheKey = 'dlmm_pools';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const response = await this.client.get('/pair/all');
      const pools = response.data.groups.flatMap((group: any) => group.pairs);

      this.cache.set(cacheKey, { data: pools, timestamp: Date.now() });
      return pools;
    } catch (error) {
      console.error('Meteora getDLMMPools error:', error);
      throw new Error(`Failed to get DLMM pools: ${error}`);
    }
  }

  /**
   * Get specific DLMM pool by address
   */
  async getDLMMPool(poolAddress: string): Promise<MeteoraPoolInfo> {
    try {
      const response = await this.client.get(`/pair/${poolAddress}`);
      return response.data;
    } catch (error) {
      console.error('Meteora getDLMMPool error:', error);
      throw new Error(`Failed to get DLMM pool: ${error}`);
    }
  }

  /**
   * Get all Dynamic Vaults
   */
  async getDynamicVaults(): Promise<MeteoraVaultInfo[]> {
    const cacheKey = 'dynamic_vaults';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const response = await axios.get('https://dlmm-api.meteora.ag/vault/all');
      const vaults = response.data;

      this.cache.set(cacheKey, { data: vaults, timestamp: Date.now() });
      return vaults;
    } catch (error) {
      console.error('Meteora getDynamicVaults error:', error);
      throw new Error(`Failed to get Dynamic Vaults: ${error}`);
    }
  }

  /**
   * Get specific Dynamic Vault by address
   */
  async getDynamicVault(vaultAddress: string): Promise<MeteoraVaultInfo> {
    try {
      const response = await axios.get(`https://dlmm-api.meteora.ag/vault/${vaultAddress}`);
      return response.data;
    } catch (error) {
      console.error('Meteora getDynamicVault error:', error);
      throw new Error(`Failed to get Dynamic Vault: ${error}`);
    }
  }

  /**
   * Get pool TVL
   */
  async getPoolTVL(poolAddress: string): Promise<number> {
    try {
      const pool = await this.getDLMMPool(poolAddress);
      const tvl = parseFloat(pool.liquidity);
      return tvl;
    } catch (error) {
      console.error('Meteora getPoolTVL error:', error);
      return 0;
    }
  }

  /**
   * Get pool APY
   */
  async getPoolAPY(poolAddress: string): Promise<number> {
    try {
      const pool = await this.getDLMMPool(poolAddress);
      return pool.apy;
    } catch (error) {
      console.error('Meteora getPoolAPY error:', error);
      return 0;
    }
  }

  /**
   * Get pool 24h volume
   */
  async getPool24hVolume(poolAddress: string): Promise<number> {
    try {
      const pool = await this.getDLMMPool(poolAddress);
      return pool.trade_volume_24h;
    } catch (error) {
      console.error('Meteora getPool24hVolume error:', error);
      return 0;
    }
  }

  /**
   * Get pool 24h fees
   */
  async getPool24hFees(poolAddress: string): Promise<number> {
    try {
      const pool = await this.getDLMMPool(poolAddress);
      return pool.fees_24h;
    } catch (error) {
      console.error('Meteora getPool24hFees error:', error);
      return 0;
    }
  }

  /**
   * Get total protocol TVL
   */
  async getProtocolTVL(): Promise<number> {
    try {
      const pools = await this.getDLMMPools();
      const totalTVL = pools.reduce((sum, pool) => {
        return sum + parseFloat(pool.liquidity);
      }, 0);

      return totalTVL;
    } catch (error) {
      console.error('Meteora getProtocolTVL error:', error);
      return 0;
    }
  }

  /**
   * Get total protocol 24h volume
   */
  async getProtocol24hVolume(): Promise<number> {
    try {
      const pools = await this.getDLMMPools();
      const totalVolume = pools.reduce((sum, pool) => {
        return sum + pool.trade_volume_24h;
      }, 0);

      return totalVolume;
    } catch (error) {
      console.error('Meteora getProtocol24hVolume error:', error);
      return 0;
    }
  }

  /**
   * Get pools by token mint
   */
  async getPoolsByToken(tokenMint: string): Promise<MeteoraPoolInfo[]> {
    try {
      const pools = await this.getDLMMPools();
      return pools.filter(
        pool => pool.mint_x === tokenMint || pool.mint_y === tokenMint
      );
    } catch (error) {
      console.error('Meteora getPoolsByToken error:', error);
      return [];
    }
  }

  /**
   * Get top pools by TVL
   */
  async getTopPoolsByTVL(limit: number = 10): Promise<MeteoraPoolInfo[]> {
    try {
      const pools = await this.getDLMMPools();
      return pools
        .sort((a, b) => parseFloat(b.liquidity) - parseFloat(a.liquidity))
        .slice(0, limit);
    } catch (error) {
      console.error('Meteora getTopPoolsByTVL error:', error);
      return [];
    }
  }

  /**
   * Get top pools by volume
   */
  async getTopPoolsByVolume(limit: number = 10): Promise<MeteoraPoolInfo[]> {
    try {
      const pools = await this.getDLMMPools();
      return pools
        .sort((a, b) => b.trade_volume_24h - a.trade_volume_24h)
        .slice(0, limit);
    } catch (error) {
      console.error('Meteora getTopPoolsByVolume error:', error);
      return [];
    }
  }

  /**
   * Get SOL/USDC pool data
   */
  async getSOLUSDCPool(): Promise<MeteoraPoolInfo | null> {
    try {
      const pools = await this.getDLMMPools();
      const solUsdcPool = pools.find(pool =>
        pool.name.toLowerCase().includes('sol') &&
        pool.name.toLowerCase().includes('usdc')
      );

      return solUsdcPool || null;
    } catch (error) {
      console.error('Meteora getSOLUSDCPool error:', error);
      return null;
    }
  }

  /**
   * Get Dynamic Vault APY for a specific vault
   */
  async getVaultAPY(vaultAddress: string): Promise<number> {
    try {
      const vault = await this.getDynamicVault(vaultAddress);
      return vault.apy;
    } catch (error) {
      console.error('Meteora getVaultAPY error:', error);
      return 0;
    }
  }

  /**
   * Get all vaults with APY > threshold
   */
  async getHighYieldVaults(minAPY: number = 10): Promise<MeteoraVaultInfo[]> {
    try {
      const vaults = await this.getDynamicVaults();
      return vaults.filter(vault => vault.apy >= minAPY);
    } catch (error) {
      console.error('Meteora getHighYieldVaults error:', error);
      return [];
    }
  }
}

// Singleton instance
let meteoraClient: MeteoraClient | null = null;

/**
 * Get or create Meteora client instance
 */
export function getMeteoraClient(): MeteoraClient {
  if (!meteoraClient) {
    meteoraClient = new MeteoraClient();
  }
  return meteoraClient;
}
