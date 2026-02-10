/**
 * SAK Service - Main service for initializing and managing SAK integration
 */

import { logger } from '../memory/logger';
import { SAKCoreManager } from './core-manager';
import { createSAKConfig, validateSAKConfiguration } from './config-helper';
import { SAKConfig, SAKHealthStatus, SAKMetrics } from './types';

export class SAKService {
  private static instance: SAKService | null = null;
  private coreManager: SAKCoreManager | null = null;
  private config: SAKConfig | null = null;
  private isInitialized = false;

  private constructor() {
    logger.info('SAK Service instance created');
  }

  /**
   * Get singleton instance
   */
  static getInstance(): SAKService {
    if (!SAKService.instance) {
      SAKService.instance = new SAKService();
    }
    return SAKService.instance;
  }

  /**
   * Initialize SAK service
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing SAK Service');

      // Create configuration
      this.config = createSAKConfig();

      // Skip initialization if SAK is disabled
      if (!this.config.enabled) {
        logger.info('SAK is disabled, skipping initialization');
        return;
      }

      // Validate configuration
      const validation = validateSAKConfiguration(this.config);
      if (!validation.isValid) {
        throw new Error(`SAK configuration validation failed: ${validation.errors.join(', ')}`);
      }

      if (validation.warnings.length > 0) {
        logger.warn('SAK configuration warnings', { warnings: validation.warnings });
      }

      // Initialize core manager
      this.coreManager = new SAKCoreManager();
      await this.coreManager.initialize(this.config);

      this.isInitialized = true;
      logger.info('SAK Service initialization completed successfully');

    } catch (error) {
      logger.error('Failed to initialize SAK Service', { error });
      throw error;
    }
  }

  /**
   * Shutdown SAK service
   */
  async shutdown(): Promise<void> {
    try {
      logger.info('Shutting down SAK Service');

      if (this.coreManager) {
        await this.coreManager.shutdown();
        this.coreManager = null;
      }

      this.isInitialized = false;
      this.config = null;

      logger.info('SAK Service shutdown completed');

    } catch (error) {
      logger.error('Error during SAK Service shutdown', { error });
      throw error;
    }
  }

  /**
   * Check if SAK is enabled and initialized
   */
  isEnabled(): boolean {
    return this.config?.enabled === true && this.isInitialized;
  }

  /**
   * Get SAK health status
   */
  getHealthStatus(): SAKHealthStatus | null {
    if (!this.isEnabled() || !this.coreManager) {
      return null;
    }

    return this.coreManager.getHealthStatus();
  }

  /**
   * Get SAK metrics
   */
  getMetrics(): SAKMetrics | null {
    if (!this.isEnabled() || !this.coreManager) {
      return null;
    }

    return this.coreManager.getMetrics();
  }

  /**
   * Get core manager instance (for advanced usage)
   */
  getCoreManager(): SAKCoreManager | null {
    return this.coreManager;
  }

  /**
   * Get current configuration
   */
  getConfig(): SAKConfig | null {
    return this.config;
  }

  /**
   * Reload configuration and restart SAK
   */
  async reload(): Promise<void> {
    logger.info('Reloading SAK Service');

    try {
      // Shutdown current instance
      if (this.isInitialized) {
        await this.shutdown();
      }

      // Reinitialize
      await this.initialize();

      logger.info('SAK Service reload completed successfully');

    } catch (error) {
      logger.error('Failed to reload SAK Service', { error });
      throw error;
    }
  }

  /**
   * Get service status summary
   */
  getStatus(): {
    enabled: boolean;
    initialized: boolean;
    healthy: boolean;
    pluginCount: number;
    agentCount: number;
  } {
    const health = this.getHealthStatus();
    const metrics = this.getMetrics();

    return {
      enabled: this.config?.enabled === true,
      initialized: this.isInitialized,
      healthy: health?.overall === 'healthy',
      pluginCount: health ? Object.keys(health.plugins).length : 0,
      agentCount: this.coreManager ? 
        Array.from((this.coreManager as any).agentInstances?.keys() || []).length : 0
    };
  }
}

// Export singleton instance
export const sakService = SAKService.getInstance();