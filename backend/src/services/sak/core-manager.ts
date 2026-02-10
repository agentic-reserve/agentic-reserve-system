/**
 * SAK Core Manager - Central coordination component for Solana Agent Kit integration
 * Manages SAK initialization, plugin lifecycle, and agent instances
 */

import { SolanaAgentKit, KeypairWallet } from 'solana-agent-kit';
import { Connection, Keypair } from '@solana/web3.js';
import { logger } from '../memory/logger';
import {
  SAKConfig,
  SAKCoreManager as ISAKCoreManager,
  AgentConfig,
  SAKHealthStatus,
  SAKMetrics,
  SAKPlugin,
  PluginStatus,
  ComponentHealth,
  NetworkHealth,
  SAKMetrics as Metrics,
  ErrorType,
  TransactionStatus
} from './types';
import { PluginManager } from './plugin-manager';
import { ErrorHandler } from './error-handler';

export class SAKCoreManager implements ISAKCoreManager {
  private config: SAKConfig | null = null;
  private connection: Connection | null = null;
  private pluginManager: PluginManager | null = null;
  private errorHandler: ErrorHandler | null = null;
  private agentInstances: Map<string, SolanaAgentKit> = new Map();
  private isInitialized = false;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metrics: Metrics = this.initializeMetrics();

  constructor() {
    logger.info('SAK Core Manager initialized');
  }

  /**
   * Initialize the SAK Core Manager with configuration
   */
  async initialize(config: SAKConfig): Promise<void> {
    try {
      logger.info('Initializing SAK Core Manager', { 
        enabled: config.enabled,
        plugins: Object.keys(config.plugins).filter(p => config.plugins[p as keyof typeof config.plugins].enabled)
      });

      if (!config.enabled) {
        logger.info('SAK integration is disabled, skipping initialization');
        return;
      }

      this.config = config;
      
      // Validate configuration
      await this.validateConfiguration(config);
      
      // Initialize connection
      this.connection = new Connection(
        config.core.rpcUrl,
        { commitment: config.core.commitment }
      );
      
      // Test connection
      await this.testConnection();
      
      // Initialize plugin manager
      this.pluginManager = new PluginManager(config.plugins, this.connection);
      await this.pluginManager.initialize();
      
      // Initialize error handler
      this.errorHandler = new ErrorHandler(config.errorHandling);
      
      // Start health monitoring if enabled
      if (config.monitoring.metricsEnabled) {
        this.startHealthMonitoring();
      }
      
      this.isInitialized = true;
      logger.info('SAK Core Manager initialization completed successfully');
      
    } catch (error) {
      logger.error('Failed to initialize SAK Core Manager', { error });
      throw error;
    }
  }

  /**
   * Shutdown the SAK Core Manager and cleanup resources
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down SAK Core Manager');
      
      // Stop health monitoring
      if (this.healthCheckInterval) {
        clearInterval(this.healthCheckInterval);
        this.healthCheckInterval = null;
      }
      
      // Shutdown plugin manager
      if (this.pluginManager) {
        await this.pluginManager.shutdown();
      }
      
      // Clear agent instances
      this.agentInstances.clear();
      
      // Reset state
      this.isInitialized = false;
      this.config = null;
      this.connection = null;
      
      logger.info('SAK Core Manager shutdown completed');
      
    } catch (error) {
      logger.error('Error during SAK Core Manager shutdown', { error });
      throw error;
    }
  }

  /**
   * Load a specific plugin
   */
  async loadPlugin(pluginName: string): Promise<SAKPlugin> {
    this.ensureInitialized();
    
    if (!this.pluginManager) {
      throw new Error('Plugin manager not initialized');
    }
    
    try {
      logger.info('Loading SAK plugin', { pluginName });
      
      const plugin = await this.pluginManager.loadPlugin(pluginName);
      
      // Update metrics
      this.metrics.plugins[pluginName] = {
        operationCount: 0,
        successRate: 1.0,
        avgExecutionTime: 0,
        errorCount: 0,
        lastUsed: new Date()
      };
      
      logger.info('SAK plugin loaded successfully', { pluginName, status: plugin.status });
      return plugin;
      
    } catch (error) {
      logger.error('Failed to load SAK plugin', { pluginName, error });
      throw error;
    }
  }

  /**
   * Unload a specific plugin
   */
  async unloadPlugin(pluginName: string): Promise<void> {
    this.ensureInitialized();
    
    if (!this.pluginManager) {
      throw new Error('Plugin manager not initialized');
    }
    
    try {
      logger.info('Unloading SAK plugin', { pluginName });
      
      await this.pluginManager.unloadPlugin(pluginName);
      
      // Remove from metrics
      delete this.metrics.plugins[pluginName];
      
      logger.info('SAK plugin unloaded successfully', { pluginName });
      
    } catch (error) {
      logger.error('Failed to unload SAK plugin', { pluginName, error });
      throw error;
    }
  }

  /**
   * Get list of available plugins
   */
  getAvailablePlugins(): string[] {
    if (!this.pluginManager) {
      return [];
    }
    
    return this.pluginManager.getAvailablePlugins();
  }

  /**
   * Create a new agent instance
   */
  async createAgentInstance(agentConfig: AgentConfig): Promise<SolanaAgentKit> {
    this.ensureInitialized();
    
    try {
      logger.info('Creating SAK agent instance', { agentId: agentConfig.agentId });
      
      // Validate private key
      if (!agentConfig.privateKey) {
        throw new Error('Private key is required for agent instance');
      }
      
      // Create keypair from private key
      const keypair = Keypair.fromSecretKey(
        Buffer.from(agentConfig.privateKey, 'base64')
      );
      
      // Create connection
      const connection = new Connection(
        agentConfig.rpcUrl,
        { commitment: 'confirmed' }
      );
      
      // Create wallet wrapper
      const wallet = new KeypairWallet(keypair, agentConfig.rpcUrl);
      
      // Create agent instance
      const agent = new SolanaAgentKit(
        wallet,
        agentConfig.rpcUrl,
        agentConfig.customConfig || {}
      );
      
      // Store instance
      this.agentInstances.set(agentConfig.agentId, agent);
      
      logger.info('SAK agent instance created successfully', { 
        agentId: agentConfig.agentId,
        publicKey: keypair.publicKey.toString()
      });
      
      return agent;
      
    } catch (error) {
      logger.error('Failed to create SAK agent instance', { 
        agentId: agentConfig.agentId, 
        error 
      });
      throw error;
    }
  }

  /**
   * Get existing agent instance
   */
  getAgentInstance(agentId: string): SolanaAgentKit | null {
    return this.agentInstances.get(agentId) || null;
  }

  /**
   * Get current health status
   */
  getHealthStatus(): SAKHealthStatus {
    const now = new Date();
    
    // Core health
    const coreHealth: ComponentHealth = {
      status: this.isInitialized ? 'healthy' : 'unhealthy',
      uptime: this.isInitialized ? Date.now() - (this.metrics.operations.total * 1000) : 0,
      errorRate: this.calculateErrorRate(),
      responseTime: this.metrics.operations.avgExecutionTime,
      lastError: undefined // TODO: Track last error
    };
    
    // Plugin health
    const pluginHealth: Record<string, ComponentHealth> = {};
    if (this.pluginManager) {
      const pluginStatuses = this.pluginManager.getAllPluginStatuses();
      for (const [name, status] of pluginStatuses) {
        const metrics = this.metrics.plugins[name];
        pluginHealth[name] = {
          status: status === PluginStatus.LOADED ? 'healthy' : 'unhealthy',
          uptime: metrics ? Date.now() - metrics.lastUsed.getTime() : 0,
          errorRate: metrics ? (metrics.errorCount / Math.max(metrics.operationCount, 1)) : 0,
          responseTime: metrics ? metrics.avgExecutionTime : 0
        };
      }
    }
    
    // Network health
    const networkHealth: NetworkHealth = {
      connection: this.connection ? 'connected' : 'disconnected',
      latency: this.metrics.network.avgLatency,
      blockHeight: 0, // TODO: Get from connection
      syncStatus: 'synced' // TODO: Determine sync status
    };
    
    // Overall health
    const overall = this.determineOverallHealth(coreHealth, pluginHealth, networkHealth);
    
    return {
      overall,
      core: coreHealth,
      plugins: pluginHealth,
      network: networkHealth,
      lastCheck: now
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): SAKMetrics {
    return { ...this.metrics };
  }

  /**
   * Update operation metrics
   */
  updateOperationMetrics(
    pluginName: string,
    success: boolean,
    executionTime: number
  ): void {
    // Update overall metrics
    this.metrics.operations.total++;
    if (success) {
      this.metrics.operations.successful++;
    } else {
      this.metrics.operations.failed++;
    }
    
    // Update average execution time
    const totalTime = this.metrics.operations.avgExecutionTime * (this.metrics.operations.total - 1);
    this.metrics.operations.avgExecutionTime = (totalTime + executionTime) / this.metrics.operations.total;
    
    // Update plugin metrics
    if (!this.metrics.plugins[pluginName]) {
      this.metrics.plugins[pluginName] = {
        operationCount: 0,
        successRate: 1.0,
        avgExecutionTime: 0,
        errorCount: 0,
        lastUsed: new Date()
      };
    }
    
    const pluginMetrics = this.metrics.plugins[pluginName];
    pluginMetrics.operationCount++;
    pluginMetrics.lastUsed = new Date();
    
    if (!success) {
      pluginMetrics.errorCount++;
    }
    
    // Update success rate
    pluginMetrics.successRate = (pluginMetrics.operationCount - pluginMetrics.errorCount) / pluginMetrics.operationCount;
    
    // Update average execution time
    const pluginTotalTime = pluginMetrics.avgExecutionTime * (pluginMetrics.operationCount - 1);
    pluginMetrics.avgExecutionTime = (pluginTotalTime + executionTime) / pluginMetrics.operationCount;
  }

  // ============================================================================
  // Private Methods
  // ============================================================================

  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('SAK Core Manager is not initialized');
    }
  }

  private async validateConfiguration(config: SAKConfig): Promise<void> {
    if (!config.core.rpcUrl) {
      throw new Error('RPC URL is required');
    }
    
    if (!config.core.privateKey) {
      logger.warn('No private key provided - agent instances will require individual keys');
    }
    
    // Validate network
    if (!['mainnet', 'devnet', 'testnet'].includes(config.core.network)) {
      throw new Error(`Invalid network: ${config.core.network}`);
    }
    
    // Validate commitment
    if (!['processed', 'confirmed', 'finalized'].includes(config.core.commitment)) {
      throw new Error(`Invalid commitment: ${config.core.commitment}`);
    }
  }

  private async testConnection(): Promise<void> {
    if (!this.connection) {
      throw new Error('Connection not initialized');
    }
    
    try {
      const version = await this.connection.getVersion();
      logger.info('SAK connection test successful', { 
        rpcUrl: this.config?.core.rpcUrl,
        version: version['solana-core']
      });
    } catch (error) {
      logger.error('SAK connection test failed', { error });
      throw new Error(`Failed to connect to Solana RPC: ${error}`);
    }
  }

  private startHealthMonitoring(): void {
    if (!this.config?.monitoring.healthCheckInterval) {
      return;
    }
    
    this.healthCheckInterval = setInterval(() => {
      try {
        const health = this.getHealthStatus();
        
        // Log health status
        logger.debug('SAK health check', { 
          overall: health.overall,
          coreStatus: health.core.status,
          pluginCount: Object.keys(health.plugins).length,
          networkStatus: health.network.connection
        });
        
        // Check for alerts
        this.checkAlertThresholds(health);
        
      } catch (error) {
        logger.error('Error during SAK health check', { error });
      }
    }, this.config.monitoring.healthCheckInterval);
  }

  private checkAlertThresholds(health: SAKHealthStatus): void {
    if (!this.config?.monitoring.alertThresholds) {
      return;
    }
    
    const thresholds = this.config.monitoring.alertThresholds;
    
    // Check error rate
    if (health.core.errorRate > thresholds.errorRate) {
      logger.warn('SAK error rate threshold exceeded', {
        current: health.core.errorRate,
        threshold: thresholds.errorRate
      });
    }
    
    // Check response time
    if (health.core.responseTime > thresholds.responseTime) {
      logger.warn('SAK response time threshold exceeded', {
        current: health.core.responseTime,
        threshold: thresholds.responseTime
      });
    }
    
    // Check memory usage (if available)
    const memoryUsage = process.memoryUsage().heapUsed / process.memoryUsage().heapTotal;
    if (memoryUsage > thresholds.memoryUsage) {
      logger.warn('SAK memory usage threshold exceeded', {
        current: memoryUsage,
        threshold: thresholds.memoryUsage
      });
    }
  }

  private calculateErrorRate(): number {
    const total = this.metrics.operations.total;
    const failed = this.metrics.operations.failed;
    return total > 0 ? failed / total : 0;
  }

  private determineOverallHealth(
    core: ComponentHealth,
    plugins: Record<string, ComponentHealth>,
    network: NetworkHealth
  ): 'healthy' | 'degraded' | 'unhealthy' {
    // If core is unhealthy, overall is unhealthy
    if (core.status === 'unhealthy') {
      return 'unhealthy';
    }
    
    // If network is disconnected, overall is unhealthy
    if (network.connection === 'disconnected') {
      return 'unhealthy';
    }
    
    // Check plugin health
    const pluginStatuses = Object.values(plugins);
    const unhealthyPlugins = pluginStatuses.filter(p => p.status === 'unhealthy').length;
    const totalPlugins = pluginStatuses.length;
    
    if (totalPlugins > 0) {
      const unhealthyRatio = unhealthyPlugins / totalPlugins;
      
      if (unhealthyRatio > 0.5) {
        return 'unhealthy';
      } else if (unhealthyRatio > 0.2) {
        return 'degraded';
      }
    }
    
    // Check if core or network is degraded
    if (core.status === 'degraded' || network.connection === 'unstable') {
      return 'degraded';
    }
    
    return 'healthy';
  }

  private initializeMetrics(): Metrics {
    return {
      operations: {
        total: 0,
        successful: 0,
        failed: 0,
        avgExecutionTime: 0
      },
      plugins: {},
      network: {
        requestCount: 0,
        avgLatency: 0,
        errorCount: 0
      },
      resources: {
        memoryUsage: 0,
        cpuUsage: 0,
        connectionCount: 0
      }
    };
  }
}