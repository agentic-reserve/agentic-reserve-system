import dotenv from 'dotenv';

dotenv.config();

export const config = {
  port: parseInt(process.env.PORT || '4000', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  
  supabase: {
    url: process.env.SUPABASE_URL || 'http://localhost:8000',
    anonKey: process.env.SUPABASE_ANON_KEY || '',
    serviceKey: process.env.SUPABASE_SERVICE_KEY || '',
    // Connection pooling configuration for Memory Service
    pool: {
      min: parseInt(process.env.SUPABASE_POOL_MIN || '20', 10),
      max: parseInt(process.env.SUPABASE_POOL_MAX || '100', 10),
      connectionTimeoutMillis: parseInt(process.env.SUPABASE_CONNECTION_TIMEOUT || '30000', 10),
      idleTimeoutMillis: parseInt(process.env.SUPABASE_IDLE_TIMEOUT || '600000', 10), // 10 minutes
    },
  },
  
  redis: {
    url: process.env.REDIS_URL || 'redis://localhost:6379',
    password: process.env.REDIS_PASSWORD || '',
    // Connection pooling configuration for Memory Service cache layer
    pool: {
      min: parseInt(process.env.REDIS_POOL_MIN || '10', 10),
      max: parseInt(process.env.REDIS_POOL_MAX || '50', 10),
    },
  },
  
  solana: {
    rpcUrl: process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
    network: process.env.SOLANA_NETWORK || 'devnet',
    programs: {
      arsCore: process.env.ARS_CORE_PROGRAM_ID || '',
      arsReserve: process.env.ARS_RESERVE_PROGRAM_ID || '',
      arsToken: process.env.ARS_TOKEN_PROGRAM_ID || '',
    },
  },
  
  heliusApiKey: process.env.HELIUS_API_KEY || '',
  
  helius: {
    apiKey: process.env.HELIUS_API_KEY || '',
    rpcUrl: process.env.HELIUS_RPC_URL || 'https://mainnet.helius-rpc.com',
    senderRegion: process.env.HELIUS_SENDER_REGION || 'sg', // Singapore for Asia-Pacific
    useSWQOSOnly: process.env.HELIUS_SWQOS_ONLY === 'true',
  },
  
  oracles: {
    pythProgramId: process.env.PYTH_PROGRAM_ID || 'gSbePebfvPy7tRqimPoVecS2UsBvYv46ynrzWocc92s',
    switchboardProgramId: process.env.SWITCHBOARD_PROGRAM_ID || 'SW1TCH7qEPTdLsDHRgPuMQjbQxKdH2aBStViMFnt64f',
  },
  
  apis: {
    birdeyeApiKey: process.env.BIRDEYE_API_KEY || '',
    jupiterApiUrl: process.env.JUPITER_API_URL || 'https://quote-api.jup.ag/v6',
    meteoraApiUrl: process.env.METEORA_API_URL || 'https://dlmm-api.meteora.ag',
    kaminoApiUrl: process.env.KAMINO_API_URL || 'https://api.kamino.finance',
    magicRouterUrl: process.env.MAGIC_ROUTER_URL || 'https://router.magicblock.gg',
    openRouterApiKey: process.env.OPENROUTER_API_KEY || '',
    openRouterReferer: process.env.OPENROUTER_REFERER || 'https://internet-capital-bank.com',
    
    // God Mode Plugin APIs (from plugin-god-mode)
    luloApiKey: process.env.LULO_API_KEY || '',
    messariApiKey: process.env.MESSARI_API_KEY || '',
    bdsApiKey: process.env.BDS_API_KEY || '',
    nextPublicBdsApiKey: process.env.NEXT_PUBLIC_BDS_API_KEY || '',
  },
  
  sipher: {
    url: process.env.SIPHER_API_URL || 'https://sipher.sip-protocol.org',
    apiKey: process.env.SIPHER_API_KEY || '',
    enabled: process.env.SIPHER_ENABLED === 'true',
    timeout: parseInt(process.env.SIPHER_TIMEOUT || '30000', 10),
  },
  
  privacy: {
    enabled: process.env.PRIVACY_ENABLED === 'true',
    mevProtectionEnabled: process.env.MEV_PROTECTION_ENABLED === 'true',
    privacyScoreThreshold: parseInt(process.env.PRIVACY_SCORE_THRESHOLD || '70', 10),
    mevReductionTarget: parseInt(process.env.MEV_REDUCTION_TARGET || '80', 10),
  },
  
  rateLimit: {
    windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '60000', 10),
    maxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
  },
  
  // Memory Service configuration for Solder Cortex integration
  memoryService: {
    // LYS Labs WebSocket API configuration
    lysLabs: {
      wsUrl: process.env.LYS_LABS_WS_URL || 'wss://api.lyslabs.io/v1/ws',
      apiKey: process.env.LYS_LABS_API_KEY || '',
      reconnectAttempts: parseInt(process.env.LYS_LABS_RECONNECT_ATTEMPTS || '5', 10),
      reconnectDelays: [1000, 2000, 4000, 8000, 16000], // Exponential backoff in ms
    },
    
    // Cache configuration
    cache: {
      ttl: parseInt(process.env.MEMORY_CACHE_TTL || '300', 10), // 5 minutes in seconds
      memoryThreshold: parseFloat(process.env.MEMORY_CACHE_THRESHOLD || '0.8'), // 80%
      warmupEnabled: process.env.MEMORY_CACHE_WARMUP === 'true',
    },
    
    // Query configuration
    query: {
      defaultPageSize: parseInt(process.env.MEMORY_QUERY_PAGE_SIZE || '50', 10),
      maxPageSize: parseInt(process.env.MEMORY_QUERY_MAX_PAGE_SIZE || '1000', 10),
      cachedQueryTimeoutMs: parseInt(process.env.MEMORY_CACHED_QUERY_TIMEOUT || '200', 10),
      slowQueryThresholdMs: parseInt(process.env.MEMORY_SLOW_QUERY_THRESHOLD || '1000', 10),
    },
    
    // PnL calculation configuration
    pnl: {
      updateIntervalMinutes: parseInt(process.env.MEMORY_PNL_UPDATE_INTERVAL || '10', 10),
      stalePriceThresholdMinutes: parseInt(process.env.MEMORY_STALE_PRICE_THRESHOLD || '15', 10),
      costBasisMethod: process.env.MEMORY_COST_BASIS_METHOD || 'FIFO',
    },
    
    // Risk analysis configuration
    risk: {
      anomalyThreshold: parseFloat(process.env.MEMORY_ANOMALY_THRESHOLD || '3.0'), // z-score
      anomalyWindowHours: [1, 24, 168], // 1h, 24h, 7d
    },
    
    // Event emission configuration
    events: {
      rateLimit: parseInt(process.env.MEMORY_EVENT_RATE_LIMIT || '100', 10), // events per second per agent
      heartbeatIntervalSeconds: parseInt(process.env.MEMORY_EVENT_HEARTBEAT || '30', 10),
    },
    
    // Circuit breaker configuration
    circuitBreaker: {
      failureThreshold: parseInt(process.env.MEMORY_CIRCUIT_BREAKER_THRESHOLD || '5', 10),
      openDurationMs: parseInt(process.env.MEMORY_CIRCUIT_BREAKER_DURATION || '300000', 10), // 5 minutes
    },
    
    // Retry configuration
    retry: {
      maxAttempts: parseInt(process.env.MEMORY_RETRY_MAX_ATTEMPTS || '3', 10),
      delays: [1000, 2000, 4000], // Exponential backoff in ms
    },
    
    // Auto-registration configuration
    autoRegister: {
      enabled: process.env.MEMORY_AUTO_REGISTER === 'true',
      protocolWallets: (process.env.MEMORY_PROTOCOL_WALLETS || '').split(',').filter(Boolean),
    },
  },

  // Solana Agent Kit (SAK) integration configuration
  sak: {
    enabled: process.env.SAK_ENABLED === 'true',
    
    // Core SAK configuration
    core: {
      rpcUrl: process.env.SAK_RPC_URL || process.env.SOLANA_RPC_URL || 'https://api.devnet.solana.com',
      privateKey: process.env.SAK_PRIVATE_KEY || '',
      network: process.env.SAK_NETWORK || process.env.SOLANA_NETWORK || 'devnet',
      commitment: process.env.SAK_COMMITMENT || 'confirmed',
    },
    
    // Plugin configuration
    plugins: {
      token: {
        enabled: process.env.SAK_TOKEN_PLUGIN_ENABLED !== 'false', // Default enabled
        priority: parseInt(process.env.SAK_TOKEN_PLUGIN_PRIORITY || '100', 10),
      },
      defi: {
        enabled: process.env.SAK_DEFI_PLUGIN_ENABLED !== 'false', // Default enabled
        priority: parseInt(process.env.SAK_DEFI_PLUGIN_PRIORITY || '90', 10),
      },
      nft: {
        enabled: process.env.SAK_NFT_PLUGIN_ENABLED === 'true', // Default disabled
        priority: parseInt(process.env.SAK_NFT_PLUGIN_PRIORITY || '80', 10),
      },
      misc: {
        enabled: process.env.SAK_MISC_PLUGIN_ENABLED !== 'false', // Default enabled
        priority: parseInt(process.env.SAK_MISC_PLUGIN_PRIORITY || '70', 10),
      },
      blinks: {
        enabled: process.env.SAK_BLINKS_PLUGIN_ENABLED === 'true', // Default disabled
        priority: parseInt(process.env.SAK_BLINKS_PLUGIN_PRIORITY || '60', 10),
      },
    },
    
    // Integration settings
    integration: {
      fallbackEnabled: process.env.SAK_FALLBACK_ENABLED !== 'false', // Default enabled
      retryAttempts: parseInt(process.env.SAK_RETRY_ATTEMPTS || '3', 10),
      retryDelay: parseInt(process.env.SAK_RETRY_DELAY || '1000', 10), // ms
      timeoutMs: parseInt(process.env.SAK_TIMEOUT_MS || '30000', 10),
      batchSize: parseInt(process.env.SAK_BATCH_SIZE || '10', 10),
    },
    
    // Monitoring configuration
    monitoring: {
      metricsEnabled: process.env.SAK_METRICS_ENABLED !== 'false', // Default enabled
      loggingLevel: process.env.SAK_LOGGING_LEVEL || 'info',
      healthCheckInterval: parseInt(process.env.SAK_HEALTH_CHECK_INTERVAL || '60000', 10), // ms
      alertThresholds: {
        errorRate: parseFloat(process.env.SAK_ERROR_RATE_THRESHOLD || '0.05'), // 5%
        responseTime: parseInt(process.env.SAK_RESPONSE_TIME_THRESHOLD || '5000', 10), // ms
        memoryUsage: parseFloat(process.env.SAK_MEMORY_USAGE_THRESHOLD || '0.8'), // 80%
      },
    },
    
    // Error handling configuration
    errorHandling: {
      circuitBreaker: {
        failureThreshold: parseInt(process.env.SAK_CIRCUIT_BREAKER_THRESHOLD || '5', 10),
        openDurationMs: parseInt(process.env.SAK_CIRCUIT_BREAKER_DURATION || '30000', 10), // 30 seconds
        halfOpenMaxCalls: parseInt(process.env.SAK_CIRCUIT_BREAKER_HALF_OPEN_CALLS || '3', 10),
      },
      exponentialBackoff: {
        initialDelay: parseInt(process.env.SAK_BACKOFF_INITIAL_DELAY || '1000', 10), // ms
        maxDelay: parseInt(process.env.SAK_BACKOFF_MAX_DELAY || '60000', 10), // ms
        multiplier: parseFloat(process.env.SAK_BACKOFF_MULTIPLIER || '2.0'),
        jitter: parseFloat(process.env.SAK_BACKOFF_JITTER || '0.25'), // 25%
      },
    },
  },
};
