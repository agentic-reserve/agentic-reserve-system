/**
 * SAK Integration Foundation Tests
 * Tests the basic SAK integration setup and configuration
 */

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { 
  createSAKConfig, 
  validateSAKConfiguration, 
  createDefaultSAKConfig,
  SAKService,
  SAKCoreManager,
  PluginManager,
  ErrorHandler
} from '../services/sak';
import { SAKConfig } from '../services/sak/types';

describe('SAK Integration Foundation', () => {
  let sakService: SAKService;

  beforeEach(() => {
    sakService = SAKService.getInstance();
  });

  afterEach(async () => {
    if (sakService.isEnabled()) {
      await sakService.shutdown();
    }
  });

  describe('Configuration Management', () => {
    it('should create default SAK configuration', () => {
      const config = createDefaultSAKConfig();
      
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.core.network).toBe('devnet');
      expect(config.core.commitment).toBe('confirmed');
      expect(config.plugins.token.enabled).toBe(true);
      expect(config.plugins.defi.enabled).toBe(true);
    });

    it('should validate SAK configuration correctly', () => {
      const validConfig = createDefaultSAKConfig();
      const validation = validateSAKConfiguration(validConfig);
      
      expect(validation.isValid).toBe(true);
      expect(validation.errors).toHaveLength(0);
    });

    it('should detect invalid configuration', () => {
      const invalidConfig: SAKConfig = {
        ...createDefaultSAKConfig(),
        core: {
          rpcUrl: '',
          privateKey: '',
          network: 'invalid' as any,
          commitment: 'confirmed'
        }
      };
      
      const validation = validateSAKConfiguration(invalidConfig);
      
      expect(validation.isValid).toBe(false);
      expect(validation.errors.length).toBeGreaterThan(0);
    });

    it('should create configuration from environment', () => {
      // Mock environment variables
      process.env.SAK_ENABLED = 'true';
      process.env.SAK_NETWORK = 'devnet';
      process.env.SAK_COMMITMENT = 'confirmed';
      
      const config = createSAKConfig();
      
      expect(config).toBeDefined();
      expect(config.enabled).toBe(true);
      expect(config.core.network).toBe('devnet');
      expect(config.core.commitment).toBe('confirmed');
      
      // Cleanup
      delete process.env.SAK_ENABLED;
      delete process.env.SAK_NETWORK;
      delete process.env.SAK_COMMITMENT;
    });
  });

  describe('SAK Service', () => {
    it('should be a singleton', () => {
      const instance1 = SAKService.getInstance();
      const instance2 = SAKService.getInstance();
      
      expect(instance1).toBe(instance2);
    });

    it('should initialize with disabled SAK', async () => {
      // Mock disabled SAK
      process.env.SAK_ENABLED = 'false';
      
      await sakService.initialize();
      
      expect(sakService.isEnabled()).toBe(false);
      expect(sakService.getHealthStatus()).toBeNull();
      expect(sakService.getMetrics()).toBeNull();
      
      // Cleanup
      delete process.env.SAK_ENABLED;
    });

    it('should provide status information', async () => {
      const status = sakService.getStatus();
      
      expect(status).toHaveProperty('enabled');
      expect(status).toHaveProperty('initialized');
      expect(status).toHaveProperty('healthy');
      expect(status).toHaveProperty('pluginCount');
      expect(status).toHaveProperty('agentCount');
    });
  });

  describe('Core Components', () => {
    it('should create SAK Core Manager', () => {
      const coreManager = new SAKCoreManager();
      
      expect(coreManager).toBeDefined();
      expect(typeof coreManager.initialize).toBe('function');
      expect(typeof coreManager.shutdown).toBe('function');
      expect(typeof coreManager.getHealthStatus).toBe('function');
      expect(typeof coreManager.getMetrics).toBe('function');
    });

    it('should create Plugin Manager', () => {
      const config = createDefaultSAKConfig();
      const mockConnection = {} as any; // Mock connection for testing
      
      const pluginManager = new PluginManager(config.plugins, mockConnection);
      
      expect(pluginManager).toBeDefined();
      expect(typeof pluginManager.initialize).toBe('function');
      expect(typeof pluginManager.loadPlugin).toBe('function');
      expect(typeof pluginManager.unloadPlugin).toBe('function');
    });

    it('should create Error Handler', () => {
      const config = createDefaultSAKConfig();
      
      const errorHandler = new ErrorHandler(config.errorHandling);
      
      expect(errorHandler).toBeDefined();
      expect(typeof errorHandler.handleError).toBe('function');
      expect(typeof errorHandler.executeWithRetry).toBe('function');
    });
  });

  describe('Plugin Configuration', () => {
    it('should have correct plugin priorities', () => {
      const config = createDefaultSAKConfig();
      
      expect(config.plugins.token.priority).toBe(100);
      expect(config.plugins.defi.priority).toBe(90);
      expect(config.plugins.nft.priority).toBe(80);
      expect(config.plugins.misc.priority).toBe(70);
      expect(config.plugins.blinks.priority).toBe(60);
    });

    it('should enable/disable plugins correctly', () => {
      const config = createDefaultSAKConfig();
      
      expect(config.plugins.token.enabled).toBe(true);
      expect(config.plugins.defi.enabled).toBe(true);
      expect(config.plugins.nft.enabled).toBe(false);
      expect(config.plugins.misc.enabled).toBe(true);
      expect(config.plugins.blinks.enabled).toBe(false);
    });
  });

  describe('Error Handling Configuration', () => {
    it('should have reasonable circuit breaker settings', () => {
      const config = createDefaultSAKConfig();
      
      expect(config.errorHandling.circuitBreaker.failureThreshold).toBe(5);
      expect(config.errorHandling.circuitBreaker.openDurationMs).toBe(30000);
      expect(config.errorHandling.circuitBreaker.halfOpenMaxCalls).toBe(3);
    });

    it('should have exponential backoff configuration', () => {
      const config = createDefaultSAKConfig();
      
      expect(config.errorHandling.exponentialBackoff.initialDelay).toBe(1000);
      expect(config.errorHandling.exponentialBackoff.maxDelay).toBe(60000);
      expect(config.errorHandling.exponentialBackoff.multiplier).toBe(2.0);
      expect(config.errorHandling.exponentialBackoff.jitter).toBe(0.25);
    });
  });

  describe('Integration Settings', () => {
    it('should have fallback enabled by default', () => {
      const config = createDefaultSAKConfig();
      
      expect(config.integration.fallbackEnabled).toBe(true);
    });

    it('should have reasonable retry settings', () => {
      const config = createDefaultSAKConfig();
      
      expect(config.integration.retryAttempts).toBe(3);
      expect(config.integration.retryDelay).toBe(1000);
      expect(config.integration.timeoutMs).toBe(30000);
    });

    it('should have appropriate batch size', () => {
      const config = createDefaultSAKConfig();
      
      expect(config.integration.batchSize).toBe(10);
    });
  });

  describe('Monitoring Configuration', () => {
    it('should enable metrics by default', () => {
      const config = createDefaultSAKConfig();
      
      expect(config.monitoring.metricsEnabled).toBe(true);
    });

    it('should have appropriate alert thresholds', () => {
      const config = createDefaultSAKConfig();
      
      expect(config.monitoring.alertThresholds.errorRate).toBe(0.05);
      expect(config.monitoring.alertThresholds.responseTime).toBe(5000);
      expect(config.monitoring.alertThresholds.memoryUsage).toBe(0.8);
    });

    it('should have reasonable health check interval', () => {
      const config = createDefaultSAKConfig();
      
      expect(config.monitoring.healthCheckInterval).toBe(60000);
    });
  });
});