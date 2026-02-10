/**
 * SAK Configuration Helper - Utilities for creating and validating SAK configuration
 */

import { config } from '../../config';
import { logger } from '../memory/logger';
import {
  SAKConfig,
  SAKCoreConfig,
  SAKPluginConfig,
  SAKIntegrationConfig,
  SAKMonitoringConfig,
  SAKErrorHandlingConfig
} from './types';

/**
 * Create SAK configuration from environment variables and defaults
 */
export function createSAKConfig(): SAKConfig {
  logger.info('Creating SAK configuration from environment');
  
  const sakConfig: SAKConfig = {
    enabled: config.sak.enabled,
    
    core: {
      rpcUrl: config.sak.core.rpcUrl,
      privateKey: config.sak.core.privateKey,
      network: config.sak.core.network as 'mainnet' | 'devnet' | 'testnet',
      commitment: config.sak.core.commitment as 'processed' | 'confirmed' | 'finalized'
    },
    
    plugins: {
      token: {
        enabled: config.sak.plugins.token.enabled,
        priority: config.sak.plugins.token.priority
      },
      defi: {
        enabled: config.sak.plugins.defi.enabled,
        priority: config.sak.plugins.defi.priority
      },
      nft: {
        enabled: config.sak.plugins.nft.enabled,
        priority: config.sak.plugins.nft.priority
      },
      misc: {
        enabled: config.sak.plugins.misc.enabled,
        priority: config.sak.plugins.misc.priority
      },
      blinks: {
        enabled: config.sak.plugins.blinks.enabled,
        priority: config.sak.plugins.blinks.priority
      }
    },
    
    integration: {
      fallbackEnabled: config.sak.integration.fallbackEnabled,
      retryAttempts: config.sak.integration.retryAttempts,
      retryDelay: config.sak.integration.retryDelay,
      timeoutMs: config.sak.integration.timeoutMs,
      batchSize: config.sak.integration.batchSize
    },
    
    monitoring: {
      metricsEnabled: config.sak.monitoring.metricsEnabled,
      loggingLevel: config.sak.monitoring.loggingLevel as 'debug' | 'info' | 'warn' | 'error',
      healthCheckInterval: config.sak.monitoring.healthCheckInterval,
      alertThresholds: {
        errorRate: config.sak.monitoring.alertThresholds.errorRate,
        responseTime: config.sak.monitoring.alertThresholds.responseTime,
        memoryUsage: config.sak.monitoring.alertThresholds.memoryUsage
      }
    },
    
    errorHandling: {
      circuitBreaker: {
        failureThreshold: config.sak.errorHandling.circuitBreaker.failureThreshold,
        openDurationMs: config.sak.errorHandling.circuitBreaker.openDurationMs,
        halfOpenMaxCalls: config.sak.errorHandling.circuitBreaker.halfOpenMaxCalls
      },
      exponentialBackoff: {
        initialDelay: config.sak.errorHandling.exponentialBackoff.initialDelay,
        maxDelay: config.sak.errorHandling.exponentialBackoff.maxDelay,
        multiplier: config.sak.errorHandling.exponentialBackoff.multiplier,
        jitter: config.sak.errorHandling.exponentialBackoff.jitter
      }
    }
  };
  
  logger.info('SAK configuration created', {
    enabled: sakConfig.enabled,
    network: sakConfig.core.network,
    enabledPlugins: Object.entries(sakConfig.plugins)
      .filter(([_, plugin]) => plugin.enabled)
      .map(([name, _]) => name)
  });
  
  return sakConfig;
}

/**
 * Validate SAK configuration
 */
export function validateSAKConfiguration(config: SAKConfig): {
  isValid: boolean;
  errors: string[];
  warnings: string[];
} {
  const errors: string[] = [];
  const warnings: string[] = [];
  
  // Validate core configuration
  if (!config.core.rpcUrl) {
    errors.push('Core RPC URL is required');
  } else if (!isValidUrl(config.core.rpcUrl)) {
    errors.push('Core RPC URL is not a valid URL');
  }
  
  if (!config.core.network || !['mainnet', 'devnet', 'testnet'].includes(config.core.network)) {
    errors.push('Core network must be one of: mainnet, devnet, testnet');
  }
  
  if (!config.core.commitment || !['processed', 'confirmed', 'finalized'].includes(config.core.commitment)) {
    errors.push('Core commitment must be one of: processed, confirmed, finalized');
  }
  
  if (!config.core.privateKey) {
    warnings.push('No private key provided - agent instances will require individual keys');
  }
  
  // Validate plugin configuration
  const enabledPlugins = Object.entries(config.plugins)
    .filter(([_, plugin]) => plugin.enabled)
    .map(([name, _]) => name);
  
  if (enabledPlugins.length === 0) {
    warnings.push('No plugins are enabled - SAK functionality will be limited');
  }
  
  // Check for plugin priority conflicts
  const priorities = Object.values(config.plugins).map(p => p.priority);
  const uniquePriorities = new Set(priorities);
  if (priorities.length !== uniquePriorities.size) {
    warnings.push('Plugin priorities are not unique - conflicts may occur');
  }
  
  // Validate integration configuration
  if (config.integration.retryAttempts < 0 || config.integration.retryAttempts > 10) {
    warnings.push('Retry attempts should be between 0 and 10');
  }
  
  if (config.integration.retryDelay < 100 || config.integration.retryDelay > 60000) {
    warnings.push('Retry delay should be between 100ms and 60s');
  }
  
  if (config.integration.timeoutMs < 1000 || config.integration.timeoutMs > 300000) {
    warnings.push('Timeout should be between 1s and 5 minutes');
  }
  
  if (config.integration.batchSize < 1 || config.integration.batchSize > 100) {
    warnings.push('Batch size should be between 1 and 100');
  }
  
  // Validate monitoring configuration
  if (!['debug', 'info', 'warn', 'error'].includes(config.monitoring.loggingLevel)) {
    errors.push('Logging level must be one of: debug, info, warn, error');
  }
  
  if (config.monitoring.healthCheckInterval < 10000 || config.monitoring.healthCheckInterval > 300000) {
    warnings.push('Health check interval should be between 10s and 5 minutes');
  }
  
  // Validate alert thresholds
  if (config.monitoring.alertThresholds.errorRate < 0 || config.monitoring.alertThresholds.errorRate > 1) {
    errors.push('Error rate threshold must be between 0 and 1');
  }
  
  if (config.monitoring.alertThresholds.responseTime < 100 || config.monitoring.alertThresholds.responseTime > 60000) {
    warnings.push('Response time threshold should be between 100ms and 60s');
  }
  
  if (config.monitoring.alertThresholds.memoryUsage < 0.1 || config.monitoring.alertThresholds.memoryUsage > 1) {
    warnings.push('Memory usage threshold should be between 0.1 and 1');
  }
  
  // Validate error handling configuration
  if (config.errorHandling.circuitBreaker.failureThreshold < 1 || config.errorHandling.circuitBreaker.failureThreshold > 20) {
    warnings.push('Circuit breaker failure threshold should be between 1 and 20');
  }
  
  if (config.errorHandling.circuitBreaker.openDurationMs < 1000 || config.errorHandling.circuitBreaker.openDurationMs > 600000) {
    warnings.push('Circuit breaker open duration should be between 1s and 10 minutes');
  }
  
  if (config.errorHandling.circuitBreaker.halfOpenMaxCalls < 1 || config.errorHandling.circuitBreaker.halfOpenMaxCalls > 10) {
    warnings.push('Circuit breaker half-open max calls should be between 1 and 10');
  }
  
  // Validate exponential backoff
  if (config.errorHandling.exponentialBackoff.initialDelay < 100 || config.errorHandling.exponentialBackoff.initialDelay > 10000) {
    warnings.push('Initial backoff delay should be between 100ms and 10s');
  }
  
  if (config.errorHandling.exponentialBackoff.maxDelay < 1000 || config.errorHandling.exponentialBackoff.maxDelay > 300000) {
    warnings.push('Max backoff delay should be between 1s and 5 minutes');
  }
  
  if (config.errorHandling.exponentialBackoff.multiplier < 1.1 || config.errorHandling.exponentialBackoff.multiplier > 5) {
    warnings.push('Backoff multiplier should be between 1.1 and 5');
  }
  
  if (config.errorHandling.exponentialBackoff.jitter < 0 || config.errorHandling.exponentialBackoff.jitter > 1) {
    warnings.push('Backoff jitter should be between 0 and 1');
  }
  
  const isValid = errors.length === 0;
  
  logger.info('SAK configuration validation completed', {
    isValid,
    errorCount: errors.length,
    warningCount: warnings.length
  });
  
  if (errors.length > 0) {
    logger.error('SAK configuration validation errors', { errors: errors.join(', ') });
  }
  
  if (warnings.length > 0) {
    logger.warn('SAK configuration validation warnings', { warnings });
  }
  
  return {
    isValid,
    errors,
    warnings
  };
}

/**
 * Create default SAK configuration for testing
 */
export function createDefaultSAKConfig(): SAKConfig {
  return {
    enabled: true,
    
    core: {
      rpcUrl: 'https://api.devnet.solana.com',
      privateKey: '',
      network: 'devnet',
      commitment: 'confirmed'
    },
    
    plugins: {
      token: { enabled: true, priority: 100 },
      defi: { enabled: true, priority: 90 },
      nft: { enabled: false, priority: 80 },
      misc: { enabled: true, priority: 70 },
      blinks: { enabled: false, priority: 60 }
    },
    
    integration: {
      fallbackEnabled: true,
      retryAttempts: 3,
      retryDelay: 1000,
      timeoutMs: 30000,
      batchSize: 10
    },
    
    monitoring: {
      metricsEnabled: true,
      loggingLevel: 'info',
      healthCheckInterval: 60000,
      alertThresholds: {
        errorRate: 0.05,
        responseTime: 5000,
        memoryUsage: 0.8
      }
    },
    
    errorHandling: {
      circuitBreaker: {
        failureThreshold: 5,
        openDurationMs: 30000,
        halfOpenMaxCalls: 3
      },
      exponentialBackoff: {
        initialDelay: 1000,
        maxDelay: 60000,
        multiplier: 2.0,
        jitter: 0.25
      }
    }
  };
}

// ============================================================================
// Private Helper Functions
// ============================================================================

function isValidUrl(url: string): boolean {
  try {
    new URL(url);
    return true;
  } catch {
    return false;
  }
}