/**
 * TypeScript interfaces for Solana Agent Kit (SAK) integration layer
 * Provides type definitions for SAK configuration, operations, and results
 */

import { SolanaAgentKit } from 'solana-agent-kit';
import { Connection, PublicKey, Transaction } from '@solana/web3.js';

// ============================================================================
// Core Configuration Types
// ============================================================================

export interface SAKConfig {
  enabled: boolean;
  core: SAKCoreConfig;
  plugins: SAKPluginConfig;
  integration: SAKIntegrationConfig;
  monitoring: SAKMonitoringConfig;
  errorHandling: SAKErrorHandlingConfig;
}

export interface SAKCoreConfig {
  rpcUrl: string;
  privateKey: string;
  network: 'mainnet' | 'devnet' | 'testnet';
  commitment: 'processed' | 'confirmed' | 'finalized';
}

export interface SAKPluginConfig {
  token: PluginSettings;
  defi: PluginSettings;
  nft: PluginSettings;
  misc: PluginSettings;
  blinks: PluginSettings;
}

export interface PluginSettings {
  enabled: boolean;
  priority: number;
}

export interface SAKIntegrationConfig {
  fallbackEnabled: boolean;
  retryAttempts: number;
  retryDelay: number;
  timeoutMs: number;
  batchSize: number;
}

export interface SAKMonitoringConfig {
  metricsEnabled: boolean;
  loggingLevel: 'debug' | 'info' | 'warn' | 'error';
  healthCheckInterval: number;
  alertThresholds: AlertThresholds;
}

export interface AlertThresholds {
  errorRate: number;
  responseTime: number;
  memoryUsage: number;
}

export interface SAKErrorHandlingConfig {
  circuitBreaker: CircuitBreakerConfig;
  exponentialBackoff: ExponentialBackoffConfig;
}

export interface CircuitBreakerConfig {
  failureThreshold: number;
  openDurationMs: number;
  halfOpenMaxCalls: number;
}

export interface ExponentialBackoffConfig {
  initialDelay: number;
  maxDelay: number;
  multiplier: number;
  jitter: number;
}

// ============================================================================
// Plugin Management Types
// ============================================================================

export enum PluginStatus {
  LOADED = 'loaded',
  UNLOADED = 'unloaded',
  ERROR = 'error',
  LOADING = 'loading',
  UNLOADING = 'unloading'
}

export interface SAKPlugin {
  name: string;
  version: string;
  status: PluginStatus;
  priority: number;
  capabilities: string[];
  lastError?: Error;
  loadedAt?: Date;
}

export interface PluginOperationResult {
  success: boolean;
  data?: any;
  error?: Error;
  executionTime: number;
  pluginUsed: string;
}

// ============================================================================
// Agent Operation Types
// ============================================================================

export enum OperationType {
  TRADE = 'trade',
  LEND = 'lend',
  STAKE = 'stake',
  BRIDGE = 'bridge',
  ANALYZE = 'analyze',
  MONITOR = 'monitor',
  TRANSFER = 'transfer',
  SWAP = 'swap',
  CREATE_MARKET = 'create_market',
  MANAGE_POSITION = 'manage_position'
}

export interface AgentOperationContext {
  agentId: string;
  operationType: OperationType;
  timestamp: number;
  
  // ARS context
  currentILI: number;
  currentICR: number;
  vaultHealthRatio: number;
  
  // SAK context
  availablePlugins: string[];
  walletBalance: TokenBalance[];
  networkStatus: NetworkStatus;
  
  // Operation parameters
  parameters: Record<string, any>;
  constraints: OperationConstraints;
  fallbackOptions: FallbackOption[];
}

export interface TokenBalance {
  mint: string;
  amount: number;
  decimals: number;
  symbol?: string;
  name?: string;
}

export interface NetworkStatus {
  tps: number;
  blockHeight: number;
  health: 'healthy' | 'degraded' | 'unhealthy';
  avgBlockTime: number;
}

export interface OperationConstraints {
  maxSlippage?: number;
  minAmount?: number;
  maxAmount?: number;
  deadline?: number;
  priorityFee?: number;
}

export interface FallbackOption {
  type: 'legacy_ars' | 'alternative_plugin' | 'retry_later';
  description: string;
  parameters?: Record<string, any>;
}

// ============================================================================
// Transaction Result Types
// ============================================================================

export enum TransactionStatus {
  PENDING = 'pending',
  SUCCESS = 'success',
  FAILED = 'failed',
  TIMEOUT = 'timeout',
  FALLBACK = 'fallback'
}

export interface SAKTransactionResult {
  transactionId: string;
  signature: string;
  status: TransactionStatus;
  
  // Execution details
  executionTime: number;
  gasUsed: number;
  priorityFee: number;
  
  // Operation details
  operationType: OperationType;
  pluginUsed: string;
  inputParams: Record<string, any>;
  outputData: Record<string, any>;
  
  // Integration context
  arsContext: {
    iliAtExecution: number;
    icrAtExecution: number;
    vhrImpact: number;
  };
  
  // Error handling
  errors: TransactionError[];
  fallbackUsed: boolean;
  retryCount: number;
}

export interface TransactionError {
  code: string;
  message: string;
  timestamp: number;
  recoverable: boolean;
  context?: Record<string, any>;
}

// ============================================================================
// Health and Metrics Types
// ============================================================================

export interface SAKHealthStatus {
  overall: 'healthy' | 'degraded' | 'unhealthy';
  core: ComponentHealth;
  plugins: Record<string, ComponentHealth>;
  network: NetworkHealth;
  lastCheck: Date;
}

export interface ComponentHealth {
  status: 'healthy' | 'degraded' | 'unhealthy';
  uptime: number;
  errorRate: number;
  responseTime: number;
  lastError?: Error;
}

export interface NetworkHealth {
  connection: 'connected' | 'disconnected' | 'unstable';
  latency: number;
  blockHeight: number;
  syncStatus: 'synced' | 'syncing' | 'behind';
}

export interface SAKMetrics {
  operations: {
    total: number;
    successful: number;
    failed: number;
    avgExecutionTime: number;
  };
  plugins: Record<string, PluginMetrics>;
  network: {
    requestCount: number;
    avgLatency: number;
    errorCount: number;
  };
  resources: {
    memoryUsage: number;
    cpuUsage: number;
    connectionCount: number;
  };
}

export interface PluginMetrics {
  operationCount: number;
  successRate: number;
  avgExecutionTime: number;
  errorCount: number;
  lastUsed: Date;
}

// ============================================================================
// Trading Operation Types
// ============================================================================

export interface JupiterSwapParams {
  inputMint: string;
  outputMint: string;
  amount: number;
  slippageBps: number;
  priorityFee?: number;
  onlyDirectRoutes?: boolean;
}

export interface LimitOrderParams {
  market: string;
  side: 'buy' | 'sell';
  amount: number;
  price: number;
  orderType: 'limit' | 'post_only' | 'ioc' | 'fok';
  clientId?: string;
}

export interface PerpPositionParams {
  market: string;
  side: 'long' | 'short';
  size: number;
  leverage?: number;
  reduceOnly?: boolean;
  stopLoss?: number;
  takeProfit?: number;
}

export interface BridgeParams {
  fromChain: string;
  toChain: string;
  token: string;
  amount: number;
  recipient: string;
  slippage?: number;
}

// ============================================================================
// DeFi Operation Types
// ============================================================================

export interface LendingParams {
  protocol: 'lulo' | 'drift' | 'solend';
  action: 'supply' | 'withdraw' | 'borrow' | 'repay';
  asset: string;
  amount: number;
  collateral?: string;
}

export interface LiquidityParams {
  protocol: 'orca' | 'raydium' | 'fluxbeam';
  action: 'add' | 'remove';
  tokenA: string;
  tokenB: string;
  amountA: number;
  amountB: number;
  slippage?: number;
}

export interface StakingParams {
  protocol: 'solayer' | 'sanctum';
  action: 'stake' | 'unstake';
  validator?: string;
  amount: number;
  lstToken?: string;
}

// ============================================================================
// Error Types
// ============================================================================

export enum ErrorType {
  SAK_UNAVAILABLE = 'sak_unavailable',
  PLUGIN_FAILURE = 'plugin_failure',
  TRANSACTION_FAILURE = 'transaction_failure',
  NETWORK_ERROR = 'network_error',
  CONFIGURATION_ERROR = 'configuration_error',
  TIMEOUT_ERROR = 'timeout_error',
  INSUFFICIENT_FUNDS = 'insufficient_funds',
  SLIPPAGE_EXCEEDED = 'slippage_exceeded',
  MARKET_CLOSED = 'market_closed'
}

export interface ErrorHandlingStrategy {
  errorType: ErrorType;
  retryPolicy: RetryPolicy;
  fallbackAction: FallbackAction;
  alertLevel: AlertLevel;
  recoveryProcedure: RecoveryProcedure;
}

export interface RetryPolicy {
  maxAttempts: number;
  delays: number[];
  backoffMultiplier: number;
  jitter: boolean;
}

export enum FallbackAction {
  USE_LEGACY_ARS = 'use_legacy_ars',
  TRY_ALTERNATIVE_PLUGIN = 'try_alternative_plugin',
  QUEUE_FOR_LATER = 'queue_for_later',
  ABORT_OPERATION = 'abort_operation'
}

export enum AlertLevel {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export enum RecoveryProcedure {
  RESTART_PLUGIN = 'restart_plugin',
  RECONNECT_NETWORK = 'reconnect_network',
  CLEAR_CACHE = 'clear_cache',
  MANUAL_INTERVENTION = 'manual_intervention'
}

// ============================================================================
// Integration Interface Types
// ============================================================================

export interface SAKCoreManager {
  // Core initialization and configuration
  initialize(config: SAKConfig): Promise<void>;
  shutdown(): Promise<void>;
  
  // Plugin management
  loadPlugin(pluginName: string): Promise<SAKPlugin>;
  unloadPlugin(pluginName: string): Promise<void>;
  getAvailablePlugins(): string[];
  
  // Agent integration
  createAgentInstance(agentConfig: AgentConfig): Promise<SolanaAgentKit>;
  getAgentInstance(agentId: string): SolanaAgentKit | null;
  
  // Health monitoring
  getHealthStatus(): SAKHealthStatus;
  getMetrics(): SAKMetrics;
}

export interface AgentConfig {
  agentId: string;
  rpcUrl: string;
  privateKey: string;
  enabledPlugins: string[];
  customConfig?: Record<string, any>;
}

export interface PluginManager {
  // Plugin lifecycle
  loadPlugin(name: string, config: PluginSettings): Promise<void>;
  unloadPlugin(name: string): Promise<void>;
  reloadPlugin(name: string): Promise<void>;
  
  // Plugin status
  getPluginStatus(name: string): PluginStatus;
  getAllPluginStatuses(): Map<string, PluginStatus>;
  
  // Plugin operations
  executePluginOperation(
    pluginName: string, 
    operation: string, 
    params: any
  ): Promise<PluginOperationResult>;
  
  // Conflict resolution
  resolvePluginConflicts(): Promise<void>;
  setPriority(pluginName: string, priority: number): void;
}

// ============================================================================
// Enhanced Service Interface Types
// ============================================================================

export interface EnhancedTradingAgent {
  // Legacy ARS trading (maintained for compatibility)
  executeRebalance(params: any): Promise<string>;
  calculateOptimalAllocation(vhr: number): Promise<any>;
  
  // SAK-enhanced trading
  executeJupiterSwap(params: JupiterSwapParams): Promise<string>;
  createLimitOrder(params: LimitOrderParams): Promise<string>;
  managePerpPosition(params: PerpPositionParams): Promise<string>;
  
  // Cross-chain operations
  bridgeAssets(params: BridgeParams): Promise<string>;
  
  // Advanced trading strategies
  executeArbitrageStrategy(params: any): Promise<string>;
  manageLiquidityPosition(params: LiquidityParams): Promise<string>;
}

export interface EnhancedReserveManager {
  // Legacy reserve operations (maintained)
  calculateVHR(): Promise<number>;
  executeRebalancing(): Promise<void>;
  
  // SAK-enhanced DeFi operations
  optimizeYieldStrategy(): Promise<YieldOptimizationResult>;
  manageLendingPositions(): Promise<LendingPositionResult>;
  handleLiquidityProvision(): Promise<LiquidityResult>;
  
  // LST management
  manageLSTPositions(): Promise<LSTManagementResult>;
  optimizeStakingRewards(): Promise<StakingResult>;
  
  // Risk management
  assessProtocolRisks(): Promise<RiskAssessment>;
  implementRiskMitigation(): Promise<void>;
}

// ============================================================================
// Result Types for Enhanced Services
// ============================================================================

export interface YieldOptimizationResult {
  recommendedAllocations: AllocationRecommendation[];
  expectedAPY: number;
  riskScore: number;
  executionPlan: ExecutionStep[];
}

export interface AllocationRecommendation {
  protocol: string;
  asset: string;
  percentage: number;
  expectedYield: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface ExecutionStep {
  order: number;
  action: string;
  parameters: Record<string, any>;
  estimatedGas: number;
  dependencies: string[];
}

export interface LendingPositionResult {
  positions: LendingPosition[];
  totalSupplied: number;
  totalBorrowed: number;
  healthFactor: number;
  recommendations: string[];
}

export interface LendingPosition {
  protocol: string;
  asset: string;
  supplied: number;
  borrowed: number;
  apy: number;
  utilizationRate: number;
}

export interface LiquidityResult {
  pools: LiquidityPool[];
  totalValueLocked: number;
  totalRewards: number;
  impermanentLoss: number;
  recommendations: string[];
}

export interface LiquidityPool {
  protocol: string;
  tokenA: string;
  tokenB: string;
  liquidity: number;
  apr: number;
  fees24h: number;
  volume24h: number;
}

export interface LSTManagementResult {
  lstPositions: LSTPosition[];
  totalStaked: number;
  averageAPY: number;
  unstakingQueue: UnstakingRequest[];
  recommendations: string[];
}

export interface LSTPosition {
  lstToken: string;
  amount: number;
  validator: string;
  apy: number;
  commission: number;
  performance: number;
}

export interface UnstakingRequest {
  amount: number;
  requestedAt: Date;
  availableAt: Date;
  status: 'pending' | 'available' | 'claimed';
}

export interface StakingResult {
  validators: ValidatorInfo[];
  totalStaked: number;
  totalRewards: number;
  averageAPY: number;
  recommendations: string[];
}

export interface ValidatorInfo {
  address: string;
  name: string;
  commission: number;
  apy: number;
  uptime: number;
  stakedAmount: number;
}

export interface RiskAssessment {
  overallRisk: 'low' | 'medium' | 'high' | 'critical';
  protocolRisks: ProtocolRisk[];
  concentrationRisk: number;
  liquidityRisk: number;
  recommendations: RiskRecommendation[];
}

export interface ProtocolRisk {
  protocol: string;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  factors: string[];
  exposure: number;
  mitigation: string[];
}

export interface RiskRecommendation {
  priority: 'low' | 'medium' | 'high' | 'critical';
  action: string;
  description: string;
  impact: string;
  effort: 'low' | 'medium' | 'high';
}