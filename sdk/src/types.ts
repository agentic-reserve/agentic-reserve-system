import { Keypair, PublicKey } from '@solana/web3.js';

/**
 * Configuration options for ARSClient
 */
export interface ARSClientConfig {
  /** API base URL (default: http://localhost:3000) */
  apiUrl?: string;
  /** Solana RPC URL */
  rpcUrl?: string;
  /** WebSocket URL for real-time updates */
  wsUrl?: string;
  /** Request timeout in milliseconds */
  timeout?: number;
}

/**
 * Internet Liquidity Index data
 */
export interface ILI {
  /** Current ILI value */
  value: number;
  /** Timestamp of last update */
  timestamp: number;
  /** Average yield across protocols (basis points) */
  avgYield: number;
  /** Volatility metric (basis points) */
  volatility: number;
  /** Total Value Locked in USD */
  tvl: number;
}

/**
 * Internet Credit Rate data
 */
export interface ICR {
  /** Current ICR value (percentage) */
  value: number;
  /** Confidence interval (±basis points) */
  confidence: number;
  /** Timestamp of last update */
  timestamp: number;
  /** Source protocols */
  sources: string[];
}

/**
 * Reserve vault state
 */
export interface ReserveState {
  /** Vault Health Ratio (percentage) */
  vhr: number;
  /** Total vault value in USD */
  totalValue: number;
  /** Total liabilities in USD */
  liabilities: number;
  /** Asset composition */
  assets: Asset[];
  /** Last rebalance timestamp */
  lastRebalance: number;
}

/**
 * Asset in reserve vault
 */
export interface Asset {
  /** Asset symbol (USDC, SOL, mSOL) */
  symbol: string;
  /** Amount in vault */
  amount: number;
  /** Value in USD */
  valueUsd: number;
  /** Percentage of total vault */
  percentage: number;
}

/**
 * Futarchy proposal
 */
export interface Proposal {
  /** Proposal ID */
  id: number;
  /** Proposer public key */
  proposer: string;
  /** Policy type */
  policyType: 'mint' | 'burn' | 'icr_update' | 'rebalance';
  /** Policy parameters */
  params: any;
  /** Proposal status */
  status: 'active' | 'passed' | 'rejected' | 'executed';
  /** YES stake amount */
  yesStake: number;
  /** NO stake amount */
  noStake: number;
  /** Total stake */
  totalStake: number;
  /** Start timestamp */
  startTime: number;
  /** End timestamp */
  endTime: number;
  /** Execution transaction signature */
  executionTx?: string;
}

/**
 * Vote record
 */
export interface Vote {
  /** Proposal ID */
  proposalId: number;
  /** Agent public key */
  agent: string;
  /** Stake amount */
  stakeAmount: number;
  /** Prediction (true=YES, false=NO) */
  prediction: boolean;
  /** Vote timestamp */
  timestamp: number;
  /** Whether rewards have been claimed */
  claimed: boolean;
}

/**
 * Parameters for creating a proposal
 */
export interface CreateProposalParams {
  /** Policy type */
  policyType: 'mint' | 'burn' | 'icr_update' | 'rebalance';
  /** Policy parameters */
  params: {
    amount?: number;
    reason?: string;
    [key: string]: any;
  };
  /** Signer keypair */
  signer: Keypair;
}

/**
 * Parameters for voting on a proposal
 */
export interface VoteOnProposalParams {
  /** Proposal ID */
  proposalId: number;
  /** Prediction (true=YES, false=NO) */
  prediction: boolean;
  /** Stake amount in ARU */
  stakeAmount: number;
  /** Signer keypair */
  signer: Keypair;
}

/**
 * Historical data point
 */
export interface HistoricalDataPoint {
  /** Timestamp */
  timestamp: number;
  /** Value */
  value: number;
}

/**
 * Event callback types
 */
export type ILIUpdateCallback = (ili: ILI) => void;
export type ProposalUpdateCallback = (proposal: Proposal) => void;
export type ReserveUpdateCallback = (reserve: ReserveState) => void;
export type VoteUpdateCallback = (vote: Vote) => void;
