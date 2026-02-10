import axios, { AxiosInstance } from 'axios';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';
import { config } from '../../config';

export interface DelegationStatus {
  account: string;
  isDelegated: boolean;
  delegatedTo?: string;
  sessionId?: string;
  expiresAt?: number;
}

export interface ERSession {
  sessionId: string;
  accounts: string[];
  validator: string;
  createdAt: number;
  expiresAt: number;
  status: 'active' | 'expired' | 'committed';
}

export interface ERRoute {
  validator: string;
  endpoint: string;
  region: string;
  latency: number;
  capacity: number;
}

export interface CommitmentResult {
  sessionId: string;
  accounts: string[];
  signature: string;
  slot: number;
  status: 'pending' | 'confirmed' | 'finalized';
}

/**
 * MagicBlock Ephemeral Rollups Client
 * Provides high-frequency state updates with account delegation
 * and session management for real-time DeFi operations
 */
export class MagicBlockClient {
  private routerClient: AxiosInstance;
  private erClient: AxiosInstance;
  private connection: Connection;
  private cache: Map<string, { data: any; timestamp: number }> = new Map();
  private readonly CACHE_TTL = 60 * 1000; // 60 seconds

  constructor() {
    // Magic Router for discovering ER nodes
    this.routerClient = axios.create({
      baseURL: config.apis.magicRouterUrl || 'https://router.magicblock.gg',
      timeout: 5000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // ER Validator endpoint (will be set dynamically)
    this.erClient = axios.create({
      timeout: 10000,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    // Solana connection for base layer
    this.connection = new Connection(config.solana.rpcUrl, 'confirmed');

    console.log('✅ MagicBlock ER client initialized');
  }

  /**
   * Get available ER routes from Magic Router
   */
  async getRoutes(): Promise<ERRoute[]> {
    const cacheKey = 'er_routes';
    const cached = this.cache.get(cacheKey);

    if (cached && Date.now() - cached.timestamp < this.CACHE_TTL) {
      return cached.data;
    }

    try {
      const response = await this.routerClient.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'getRoutes',
        params: [],
      });

      const routes = response.data.result || [];
      this.cache.set(cacheKey, { data: routes, timestamp: Date.now() });
      return routes;
    } catch (error) {
      console.error('MagicBlock getRoutes error:', error);
      return [];
    }
  }

  /**
   * Get optimal ER validator based on latency and capacity
   */
  async getOptimalValidator(): Promise<ERRoute | null> {
    try {
      const routes = await this.getRoutes();
      if (routes.length === 0) return null;

      // Sort by latency (lower is better)
      const sorted = routes.sort((a, b) => a.latency - b.latency);
      return sorted[0];
    } catch (error) {
      console.error('MagicBlock getOptimalValidator error:', error);
      return null;
    }
  }

  /**
   * Delegate account to Ephemeral Rollup
   */
  async delegateAccount(params: {
    account: PublicKey;
    payer: PublicKey;
    validatorEndpoint?: string;
  }): Promise<{ signature: string; sessionId: string }> {
    try {
      // Get optimal validator if not specified
      let endpoint = params.validatorEndpoint;
      if (!endpoint) {
        const validator = await this.getOptimalValidator();
        if (!validator) {
          throw new Error('No ER validators available');
        }
        endpoint = validator.endpoint;
      }

      // Set ER client base URL
      this.erClient.defaults.baseURL = endpoint;

      // Create delegation transaction
      const response = await this.erClient.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'delegateAccount',
        params: {
          account: params.account.toBase58(),
          payer: params.payer.toBase58(),
        },
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    } catch (error) {
      console.error('MagicBlock delegateAccount error:', error);
      throw new Error(`Failed to delegate account: ${error}`);
    }
  }

  /**
   * Undelegate account from Ephemeral Rollup
   */
  async undelegateAccount(params: {
    account: PublicKey;
    sessionId: string;
  }): Promise<{ signature: string }> {
    try {
      const response = await this.erClient.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'undelegateAccount',
        params: {
          account: params.account.toBase58(),
          sessionId: params.sessionId,
        },
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    } catch (error) {
      console.error('MagicBlock undelegateAccount error:', error);
      throw new Error(`Failed to undelegate account: ${error}`);
    }
  }

  /**
   * Get delegation status for an account
   */
  async getDelegationStatus(account: PublicKey): Promise<DelegationStatus> {
    try {
      const response = await this.routerClient.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'getDelegationStatus',
        params: {
          account: account.toBase58(),
        },
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    } catch (error) {
      console.error('MagicBlock getDelegationStatus error:', error);
      return {
        account: account.toBase58(),
        isDelegated: false,
      };
    }
  }

  /**
   * Create ER session for multiple accounts
   */
  async createSession(params: {
    accounts: PublicKey[];
    payer: PublicKey;
    duration?: number; // seconds
  }): Promise<ERSession> {
    try {
      const validator = await this.getOptimalValidator();
      if (!validator) {
        throw new Error('No ER validators available');
      }

      this.erClient.defaults.baseURL = validator.endpoint;

      const response = await this.erClient.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'createSession',
        params: {
          accounts: params.accounts.map(a => a.toBase58()),
          payer: params.payer.toBase58(),
          duration: params.duration || 3600, // 1 hour default
        },
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    } catch (error) {
      console.error('MagicBlock createSession error:', error);
      throw new Error(`Failed to create ER session: ${error}`);
    }
  }

  /**
   * Commit ER session state to base layer
   */
  async commitSession(sessionId: string): Promise<CommitmentResult> {
    try {
      const response = await this.erClient.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'commitSession',
        params: {
          sessionId,
        },
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    } catch (error) {
      console.error('MagicBlock commitSession error:', error);
      throw new Error(`Failed to commit session: ${error}`);
    }
  }

  /**
   * Get account info from ER (faster than base layer)
   */
  async getAccountInfo(account: PublicKey): Promise<any> {
    try {
      const response = await this.erClient.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'getAccountInfo',
        params: {
          account: account.toBase58(),
        },
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    } catch (error) {
      console.error('MagicBlock getAccountInfo error:', error);
      throw new Error(`Failed to get account info: ${error}`);
    }
  }

  /**
   * Send transaction to ER for fast execution
   */
  async sendTransaction(params: {
    transaction: Transaction;
    sessionId?: string;
  }): Promise<{ signature: string }> {
    try {
      const serialized = params.transaction.serialize().toString('base64');

      const response = await this.erClient.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'sendTransaction',
        params: {
          transaction: serialized,
          sessionId: params.sessionId,
        },
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    } catch (error) {
      console.error('MagicBlock sendTransaction error:', error);
      throw new Error(`Failed to send transaction: ${error}`);
    }
  }

  /**
   * Get ER validator identity
   */
  async getIdentity(): Promise<{ pubkey: string; version: string }> {
    try {
      const response = await this.erClient.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'getIdentity',
        params: [],
      });

      if (response.data.error) {
        throw new Error(response.data.error.message);
      }

      return response.data.result;
    } catch (error) {
      console.error('MagicBlock getIdentity error:', error);
      throw new Error(`Failed to get identity: ${error}`);
    }
  }

  /**
   * Check if account is delegated
   */
  async isDelegated(account: PublicKey): Promise<boolean> {
    const status = await this.getDelegationStatus(account);
    return status.isDelegated;
  }

  /**
   * Get session info
   */
  async getSession(sessionId: string): Promise<ERSession | null> {
    try {
      const response = await this.erClient.post('/', {
        jsonrpc: '2.0',
        id: 1,
        method: 'getSession',
        params: {
          sessionId,
        },
      });

      if (response.data.error) {
        return null;
      }

      return response.data.result;
    } catch (error) {
      console.error('MagicBlock getSession error:', error);
      return null;
    }
  }
}

// Singleton instance
let magicBlockClient: MagicBlockClient | null = null;

/**
 * Get or create MagicBlock client instance
 */
export function getMagicBlockClient(): MagicBlockClient {
  if (!magicBlockClient) {
    magicBlockClient = new MagicBlockClient();
  }
  return magicBlockClient;
}
