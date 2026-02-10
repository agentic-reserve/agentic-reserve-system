/**
 * SAK Utility Functions - Helper functions for SAK integration
 */

import { SolanaAgentKit, KeypairWallet } from 'solana-agent-kit';
import { Connection, Keypair } from '@solana/web3.js';
import { logger } from '../memory/logger';
import {
  SAKConfig,
  AgentConfig,
  SAKTransactionResult,
  TransactionStatus,
  OperationType,
  SAKMetrics,
  PluginMetrics
} from './types';

/**
 * Validate SAK configuration
 */
export function validateSAKConfiguration(config: SAKConfig): boolean {
  try {
    // Basic validation
    if (!config.enabled) {
      logger.info('SAK is disabled, skipping validation');
      return true;
    }
    
    if (!config.core.rpcUrl) {
      logger.error('SAK RPC URL is required');
      return false;
    }
    
    if (!['mainnet', 'devnet', 'testnet'].includes(config.core.network)) {
      logger.error('Invalid SAK network', { network: config.core.network });
      return false;
    }
    
    if (!['processed', 'confirmed', 'finalized'].includes(config.core.commitment)) {
      logger.error('Invalid SAK commitment', { commitment: config.core.commitment });
      return false;
    }
    
    logger.info('SAK configuration validation passed');
    return true;
    
  } catch (error) {
    logger.error('Error validating SAK configuration', { error });
    return false;
  }
}

/**
 * Create agent instance with configuration
 */
export async function createAgentInstance(
  agentConfig: AgentConfig,
  connection?: Connection
): Promise<SolanaAgentKit> {
  try {
    logger.info('Creating SAK agent instance', { agentId: agentConfig.agentId });
    
    // Validate private key
    if (!agentConfig.privateKey) {
      throw new Error('Private key is required for agent instance');
    }
    
    // Create keypair from private key
    let keypair: Keypair;
    try {
      // Try base64 first
      keypair = Keypair.fromSecretKey(Buffer.from(agentConfig.privateKey, 'base64'));
    } catch {
      try {
        // Try as JSON array
        const secretKey = JSON.parse(agentConfig.privateKey);
        keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
      } catch {
        throw new Error('Invalid private key format. Expected base64 string or JSON array');
      }
    }
    
    // Create or use provided connection
    const conn = connection || new Connection(
      agentConfig.rpcUrl,
      { commitment: 'confirmed' }
    );
    
    // Test connection
    await conn.getVersion();
    
    // Create wallet wrapper
    const wallet = new KeypairWallet(keypair, agentConfig.rpcUrl);
    
    // Create agent instance
    const agent = new SolanaAgentKit(
      wallet,
      agentConfig.rpcUrl,
      agentConfig.customConfig || {}
    );
    
    logger.info('SAK agent instance created successfully', {
      agentId: agentConfig.agentId,
      publicKey: keypair.publicKey.toString(),
      rpcUrl: agentConfig.rpcUrl
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
 * Format transaction result for consistent logging and response
 */
export function formatTransactionResult(
  signature: string,
  status: TransactionStatus,
  operationType: OperationType,
  pluginUsed: string,
  executionTime: number,
  inputParams: Record<string, any>,
  outputData: Record<string, any>,
  arsContext: {
    iliAtExecution: number;
    icrAtExecution: number;
    vhrImpact: number;
  },
  errors: any[] = [],
  fallbackUsed: boolean = false,
  retryCount: number = 0
): SAKTransactionResult {
  
  const result: SAKTransactionResult = {
    transactionId: generateTransactionId(),
    signature,
    status,
    executionTime,
    gasUsed: 0, // TODO: Calculate actual gas used
    priorityFee: inputParams.priorityFee || 0,
    operationType,
    pluginUsed,
    inputParams,
    outputData,
    arsContext,
    errors: errors.map(error => ({
      code: error.code || 'UNKNOWN_ERROR',
      message: error.message || String(error),
      timestamp: Date.now(),
      recoverable: isRecoverableError(error),
      context: error.context || {}
    })),
    fallbackUsed,
    retryCount
  };
  
  logger.info('Transaction result formatted', {
    transactionId: result.transactionId,
    signature: result.signature,
    status: result.status,
    operationType: result.operationType,
    executionTime: result.executionTime,
    fallbackUsed: result.fallbackUsed,
    retryCount: result.retryCount
  });
  
  return result;
}

/**
 * Calculate operation metrics for monitoring
 */
export function calculateOperationMetrics(
  results: SAKTransactionResult[]
): {
  totalOperations: number;
  successRate: number;
  averageExecutionTime: number;
  errorRate: number;
  fallbackUsageRate: number;
  retryRate: number;
  operationsByType: Record<OperationType, number>;
  operationsByPlugin: Record<string, number>;
} {
  
  if (results.length === 0) {
    return {
      totalOperations: 0,
      successRate: 0,
      averageExecutionTime: 0,
      errorRate: 0,
      fallbackUsageRate: 0,
      retryRate: 0,
      operationsByType: {} as Record<OperationType, number>,
      operationsByPlugin: {}
    };
  }
  
  const totalOperations = results.length;
  const successfulOperations = results.filter(r => r.status === TransactionStatus.SUCCESS).length;
  const failedOperations = results.filter(r => r.status === TransactionStatus.FAILED).length;
  const fallbackOperations = results.filter(r => r.fallbackUsed).length;
  const retriedOperations = results.filter(r => r.retryCount > 0).length;
  
  const totalExecutionTime = results.reduce((sum, r) => sum + r.executionTime, 0);
  const averageExecutionTime = totalExecutionTime / totalOperations;
  
  const successRate = successfulOperations / totalOperations;
  const errorRate = failedOperations / totalOperations;
  const fallbackUsageRate = fallbackOperations / totalOperations;
  const retryRate = retriedOperations / totalOperations;
  
  // Group by operation type
  const operationsByType = results.reduce((acc, result) => {
    acc[result.operationType] = (acc[result.operationType] || 0) + 1;
    return acc;
  }, {} as Record<OperationType, number>);
  
  // Group by plugin
  const operationsByPlugin = results.reduce((acc, result) => {
    acc[result.pluginUsed] = (acc[result.pluginUsed] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);
  
  const metrics = {
    totalOperations,
    successRate,
    averageExecutionTime,
    errorRate,
    fallbackUsageRate,
    retryRate,
    operationsByType,
    operationsByPlugin
  };
  
  logger.debug('Operation metrics calculated', metrics);
  
  return metrics;
}

/**
 * Generate unique transaction ID
 */
export function generateTransactionId(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substring(2, 8);
  return `sak_${timestamp}_${random}`;
}

/**
 * Check if error is recoverable
 */
export function isRecoverableError(error: any): boolean {
  if (!error) return false;
  
  const message = error.message?.toLowerCase() || '';
  
  // Network errors are usually recoverable
  if (message.includes('network') || message.includes('connection') || message.includes('timeout')) {
    return true;
  }
  
  // Rate limiting is recoverable
  if (message.includes('rate limit') || message.includes('too many requests')) {
    return true;
  }
  
  // Temporary service unavailable
  if (message.includes('service unavailable') || message.includes('temporarily unavailable')) {
    return true;
  }
  
  // Slippage can be recoverable with adjusted parameters
  if (message.includes('slippage')) {
    return true;
  }
  
  // Configuration errors are not recoverable
  if (message.includes('config') || message.includes('invalid parameter')) {
    return false;
  }
  
  // Insufficient funds are not recoverable without external action
  if (message.includes('insufficient') || message.includes('balance')) {
    return false;
  }
  
  // Default to recoverable for unknown errors
  return true;
}

/**
 * Sanitize sensitive data from logs
 */
export function sanitizeForLogging(data: any): any {
  if (!data || typeof data !== 'object') {
    return data;
  }
  
  const sensitiveKeys = [
    'privateKey',
    'secretKey',
    'password',
    'token',
    'apiKey',
    'signature'
  ];
  
  const sanitized = { ...data };
  
  for (const key of Object.keys(sanitized)) {
    const lowerKey = key.toLowerCase();
    
    if (sensitiveKeys.some(sensitive => lowerKey.includes(sensitive))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof sanitized[key] === 'object') {
      sanitized[key] = sanitizeForLogging(sanitized[key]);
    }
  }
  
  return sanitized;
}

/**
 * Convert plugin metrics to SAK metrics format
 */
export function convertPluginMetrics(
  pluginMetrics: Map<string, PluginMetrics>
): Record<string, PluginMetrics> {
  const result: Record<string, PluginMetrics> = {};
  
  for (const [pluginName, metrics] of pluginMetrics) {
    result[pluginName] = {
      operationCount: metrics.operationCount,
      successRate: metrics.successRate,
      avgExecutionTime: metrics.avgExecutionTime,
      errorCount: metrics.errorCount,
      lastUsed: metrics.lastUsed
    };
  }
  
  return result;
}

/**
 * Validate operation parameters
 */
export function validateOperationParameters(
  operationType: OperationType,
  parameters: Record<string, any>
): { isValid: boolean; errors: string[] } {
  const errors: string[] = [];
  
  switch (operationType) {
    case OperationType.SWAP:
      if (!parameters.inputMint) errors.push('inputMint is required for swap operations');
      if (!parameters.outputMint) errors.push('outputMint is required for swap operations');
      if (!parameters.amount || parameters.amount <= 0) errors.push('amount must be positive for swap operations');
      break;
      
    case OperationType.TRANSFER:
      if (!parameters.recipient) errors.push('recipient is required for transfer operations');
      if (!parameters.amount || parameters.amount <= 0) errors.push('amount must be positive for transfer operations');
      break;
      
    case OperationType.STAKE:
      if (!parameters.amount || parameters.amount <= 0) errors.push('amount must be positive for stake operations');
      break;
      
    case OperationType.LEND:
      if (!parameters.asset) errors.push('asset is required for lend operations');
      if (!parameters.amount || parameters.amount <= 0) errors.push('amount must be positive for lend operations');
      break;
      
    case OperationType.BRIDGE:
      if (!parameters.fromChain) errors.push('fromChain is required for bridge operations');
      if (!parameters.toChain) errors.push('toChain is required for bridge operations');
      if (!parameters.amount || parameters.amount <= 0) errors.push('amount must be positive for bridge operations');
      break;
      
    default:
      // No specific validation for other operation types
      break;
  }
  
  return {
    isValid: errors.length === 0,
    errors
  };
}

/**
 * Create operation context for SAK operations
 */
export function createOperationContext(
  agentId: string,
  operationType: OperationType,
  parameters: Record<string, any>,
  arsContext: {
    currentILI: number;
    currentICR: number;
    vaultHealthRatio: number;
  }
): {
  agentId: string;
  operationType: OperationType;
  timestamp: number;
  currentILI: number;
  currentICR: number;
  vaultHealthRatio: number;
  parameters: Record<string, any>;
  constraints: any;
  fallbackOptions: any[];
} {
  return {
    agentId,
    operationType,
    timestamp: Date.now(),
    currentILI: arsContext.currentILI,
    currentICR: arsContext.currentICR,
    vaultHealthRatio: arsContext.vaultHealthRatio,
    parameters: sanitizeForLogging(parameters),
    constraints: {
      maxSlippage: parameters.maxSlippage || 0.01, // 1% default
      deadline: parameters.deadline || Date.now() + 300000, // 5 minutes default
      priorityFee: parameters.priorityFee || 0
    },
    fallbackOptions: [
      {
        type: 'legacy_ars',
        description: 'Use legacy ARS operations',
        parameters: {}
      }
    ]
  };
}