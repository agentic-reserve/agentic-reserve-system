export interface ILIData {
  ili: number;
  timestamp: string;
  components: {
    avgYield: number;
    volatility: number;
    tvl: number;
  };
}

export interface ReserveState {
  totalValueUsd: number;
  liabilitiesUsd: number;
  vhr: number;
  composition: Array<{
    asset: string;
    amount: number;
    valueUsd: number;
  }>;
  lastRebalance: string;
}

export interface HealthStatus {
  status: "ok" | "degraded";
  timestamp: string;
  service: string;
  version: string;
  dependencies: {
    supabase: { status: string };
    redis: { status: string };
    sak: { status: string };
  };
  metrics: {
    capacity: {
      concurrentRequests: number;
      atCapacity: boolean;
    };
    performance: {
      cacheHitRate: string;
      errorRate: string;
    };
  };
}

export interface RevenueData {
  daily: number;
  monthly: number;
  annual: number;
  agentCount: number;
  avgRevenuePerAgent: number;
}

export interface ILIHistoryItem {
  timestamp: string;
  ili: number;
  avgYield: number;
  volatility: number;
  tvl: number;
}
