import axios, { AxiosInstance } from 'axios';
import WebSocket from 'ws';
import { Connection, Keypair, PublicKey, Transaction } from '@solana/web3.js';
import {
  ARSClientConfig,
  ILI,
  ICR,
  ReserveState,
  Proposal,
  CreateProposalParams,
  VoteOnProposalParams,
  HistoricalDataPoint,
  ILIUpdateCallback,
  ProposalUpdateCallback,
  ReserveUpdateCallback,
} from './types';
import {
  DEFAULT_API_URL,
  DEFAULT_WS_URL,
  DEFAULT_TIMEOUT,
  WS_EVENTS,
  ENDPOINTS,
} from './constants';

/**
 * ARS SDK Client for interacting with Agentic Reserve System
 * 
 * @example
 * ```typescript
 * const client = new ARSClient({
 *   apiUrl: 'https://api.ars-protocol.com',
 *   rpcUrl: 'https://api.mainnet-beta.solana.com'
 * });
 * 
 * const ili = await client.getILI();
 * console.log('Current ILI:', ili.value);
 * ```
 */
export class ARSClient {
  private api: AxiosInstance;
  private ws?: WebSocket;
  private connection?: Connection;
  private wsUrl: string;
  private eventHandlers: Map<string, Set<Function>>;

  /**
   * Create a new ARS client
   * @param config - Client configuration
   */
  constructor(config: ARSClientConfig = {}) {
    const {
      apiUrl = DEFAULT_API_URL,
      rpcUrl,
      wsUrl = DEFAULT_WS_URL,
      timeout = DEFAULT_TIMEOUT,
    } = config;

    this.api = axios.create({
      baseURL: apiUrl,
      timeout,
      headers: {
        'Content-Type': 'application/json',
      },
    });

    this.wsUrl = wsUrl;
    this.eventHandlers = new Map();

    if (rpcUrl) {
      this.connection = new Connection(rpcUrl, 'confirmed');
    }
  }

  /**
   * Get current Internet Liquidity Index
   * @returns Current ILI data
   */
  async getILI(): Promise<ILI> {
    const response = await this.api.get(ENDPOINTS.ILI_CURRENT);
    return response.data;
  }

  /**
   * Get historical ILI data
   * @param startTime - Start timestamp (optional)
   * @param endTime - End timestamp (optional)
   * @returns Array of historical ILI data points
   */
  async getILIHistory(
    startTime?: number,
    endTime?: number
  ): Promise<HistoricalDataPoint[]> {
    const params: any = {};
    if (startTime) params.start = startTime;
    if (endTime) params.end = endTime;

    const response = await this.api.get(ENDPOINTS.ILI_HISTORY, { params });
    return response.data.history;
  }

  /**
   * Get current Internet Credit Rate
   * @returns Current ICR data
   */
  async getICR(): Promise<ICR> {
    const response = await this.api.get(ENDPOINTS.ICR_CURRENT);
    return response.data;
  }

  /**
   * Get current reserve vault state
   * @returns Reserve state data
   */
  async getReserveState(): Promise<ReserveState> {
    const response = await this.api.get(ENDPOINTS.RESERVE_STATE);
    return response.data.vault;
  }

  /**
   * Get list of proposals
   * @param status - Filter by status (optional)
   * @returns Array of proposals
   */
  async getProposals(status?: string): Promise<Proposal[]> {
    const params = status ? { status } : {};
    const response = await this.api.get(ENDPOINTS.PROPOSALS_LIST, { params });
    return response.data.proposals;
  }

  /**
   * Get proposal details
   * @param proposalId - Proposal ID
   * @returns Proposal data
   */
  async getProposal(proposalId: number): Promise<Proposal> {
    const url = ENDPOINTS.PROPOSAL_DETAIL.replace(':id', proposalId.toString());
    const response = await this.api.get(url);
    return response.data.proposal;
  }

  /**
   * Create a new futarchy proposal
   * @param params - Proposal parameters
   * @returns Created proposal data
   */
  async createProposal(params: CreateProposalParams): Promise<Proposal> {
    const { policyType, params: policyParams, signer } = params;

    // Sign the proposal data
    const proposalData = {
      policyType,
      params: policyParams,
      proposer: signer.publicKey.toBase58(),
      timestamp: Date.now(),
    };

    const message = JSON.stringify(proposalData);
    const signature = await this.signMessage(message, signer);

    const response = await this.api.post(ENDPOINTS.PROPOSAL_CREATE, {
      ...proposalData,
      signature,
    });

    return response.data.proposal;
  }

  /**
   * Vote on a proposal
   * @param params - Vote parameters
   * @returns Vote transaction signature
   */
  async voteOnProposal(params: VoteOnProposalParams): Promise<string> {
    const { proposalId, prediction, stakeAmount, signer } = params;

    // Sign the vote data
    const voteData = {
      proposalId,
      prediction,
      stakeAmount,
      agent: signer.publicKey.toBase58(),
      timestamp: Date.now(),
    };

    const message = JSON.stringify(voteData);
    const signature = await this.signMessage(message, signer);

    const url = ENDPOINTS.PROPOSAL_VOTE.replace(':id', proposalId.toString());
    const response = await this.api.post(url, {
      ...voteData,
      signature,
    });

    return response.data.signature;
  }

  /**
   * Subscribe to ILI updates
   * @param callback - Callback function
   */
  onILIUpdate(callback: ILIUpdateCallback): void {
    this.addEventListener(WS_EVENTS.ILI_UPDATE, callback);
    this.ensureWebSocketConnection();
  }

  /**
   * Subscribe to proposal updates
   * @param callback - Callback function
   */
  onProposalUpdate(callback: ProposalUpdateCallback): void {
    this.addEventListener(WS_EVENTS.PROPOSAL_UPDATE, callback);
    this.ensureWebSocketConnection();
  }

  /**
   * Subscribe to reserve updates
   * @param callback - Callback function
   */
  onReserveUpdate(callback: ReserveUpdateCallback): void {
    this.addEventListener(WS_EVENTS.RESERVE_UPDATE, callback);
    this.ensureWebSocketConnection();
  }

  /**
   * Unsubscribe from all events and close connections
   */
  disconnect(): void {
    if (this.ws) {
      this.ws.close();
      this.ws = undefined;
    }
    this.eventHandlers.clear();
  }

  /**
   * Sign a message with a keypair
   * @private
   */
  private async signMessage(message: string, signer: Keypair): Promise<string> {
    const messageBytes = Buffer.from(message, 'utf-8');
    const signatureBytes = await signer.sign(messageBytes);
    return Buffer.from(signatureBytes).toString('base64');
  }

  /**
   * Add event listener
   * @private
   */
  private addEventListener(event: string, callback: Function): void {
    if (!this.eventHandlers.has(event)) {
      this.eventHandlers.set(event, new Set());
    }
    this.eventHandlers.get(event)!.add(callback);
  }

  /**
   * Ensure WebSocket connection is established
   * @private
   */
  private ensureWebSocketConnection(): void {
    if (this.ws && this.ws.readyState === WebSocket.OPEN) {
      return;
    }

    this.ws = new WebSocket(this.wsUrl);

    this.ws.on('open', () => {
      console.log('WebSocket connected');
      // Subscribe to all registered events
      for (const event of this.eventHandlers.keys()) {
        this.ws!.send(JSON.stringify({ type: 'subscribe', event }));
      }
    });

    this.ws.on('message', (data: WebSocket.Data) => {
      try {
        const message = JSON.parse(data.toString());
        const handlers = this.eventHandlers.get(message.type);
        if (handlers) {
          handlers.forEach(handler => handler(message.data));
        }
      } catch (error) {
        console.error('Error parsing WebSocket message:', error);
      }
    });

    this.ws.on('error', (error) => {
      console.error('WebSocket error:', error);
    });

    this.ws.on('close', () => {
      console.log('WebSocket disconnected');
      // Attempt to reconnect after 5 seconds
      setTimeout(() => {
        if (this.eventHandlers.size > 0) {
          this.ensureWebSocketConnection();
        }
      }, 5000);
    });
  }
}
