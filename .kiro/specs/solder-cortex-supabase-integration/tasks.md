# Implementation Plan: Solder Cortex Supabase Integration

## Overview

This implementation plan breaks down the Solder Cortex memory layer integration into discrete, incremental coding tasks. Each task builds on previous work, with property-based tests integrated throughout to catch errors early. The plan follows a bottom-up approach: database schema → data layer → core services → API layer → agent integration.

## Tasks

- [x] 1. Set up database schema and migrations
  - Create Supabase migration files for all memory tables
  - Create indexes for query performance optimization
  - Set up database connection pooling configuration (20-100 connections)
  - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8_

- [x] 1.1 Write unit tests for schema validation
  - Test table existence and column structure
  - Test index creation
  - Test foreign key constraints
  - _Requirements: 1.1-1.8_

- [x] 2. Implement LYS Labs WebSocket client
  - [x] 2.1 Create WebSocket client with connection management
    - Implement connect/disconnect methods
    - Implement subscription management (subscribe/unsubscribe wallet)
    - Implement event handlers (onTransaction, onError, onReconnect)
    - _Requirements: 2.1, 2.2_
  
  - [ ]* 2.2 Write property test for wallet subscription consistency
    - **Property 2: Wallet Subscription Consistency**
    - **Validates: Requirements 2.2, 2.6**
  
  - [x] 2.3 Implement exponential backoff reconnection logic
    - Implement retry logic with delays (1s, 2s, 4s, 8s, 16s)
    - Maintain subscription list for re-subscription after reconnect
    - _Requirements: 2.5, 2.6_
  
  - [ ]* 2.4 Write property test for WebSocket reconnection resilience
    - **Property 4: WebSocket Reconnection Resilience**
    - **Validates: Requirements 2.5**
  
  - [x] 2.5 Implement transaction data validation
    - Validate incoming messages against LYSTransaction schema
    - Handle invalid data gracefully
    - _Requirements: 2.7, 2.8_
  
  - [ ]* 2.6 Write property test for transaction validation
    - **Property 3: Transaction Validation**
    - **Validates: Requirements 2.7, 2.8**


- [ ] 3. Implement transaction indexer
  - [x] 3.1 Create transaction indexer service
    - Implement indexTransaction method with Supabase insert
    - Implement balance update logic (atomic transaction)
    - Parse transaction metadata to extract relevant fields
    - _Requirements: 2.3, 2.4_
  
  - [ ]* 3.2 Write property test for transaction indexing completeness
    - **Property 1: Transaction Indexing Completeness**
    - **Validates: Requirements 2.3, 2.4**
  
  - [x] 3.3 Implement batch indexing for historical backfill
    - Implement indexTransactionBatch with batch inserts (100 per batch)
    - Implement backfillWallet method with progress tracking
    - Update indexing status in wallet_registrations table
    - _Requirements: 2.3, 2.4_
  
  - [x] 3.4 Implement transaction deduplication
    - Use transaction signature as unique key
    - Handle duplicate transaction attempts gracefully
    - _Requirements: 2.3_
  
  - [x] 3.5 Implement privacy-protected transaction handling
    - Encrypt sensitive fields for privacy-protected transactions
    - Store encrypted metadata with agent-specific keys
    - _Requirements: 8.3, 8.4_
  
  - [ ]* 3.6 Write property test for privacy protection data encryption
    - **Property 17: Privacy Protection Data Encryption**
    - **Validates: Requirements 8.3, 8.4**

- [ ] 4. Implement wallet registration manager
  - [x] 4.1 Create wallet registration service
    - Implement registerWallet with privacy flag support
    - Implement unregisterWallet with data retention
    - Implement getRegistration and listRegistrations
    - _Requirements: 11.2, 11.5, 11.6, 11.7_
  
  - [ ]* 4.2 Write property test for registration lifecycle state machine
    - **Property 19: Registration Lifecycle State Machine**
    - **Validates: Requirements 11.3, 11.4**
  
  - [ ]* 4.3 Write property test for unregistration data retention
    - **Property 20: Unregistration Data Retention**
    - **Validates: Requirements 11.7**
  
  - [x] 4.4 Implement auto-registration of ARS protocol wallets
    - Read wallet addresses from environment configuration
    - Auto-register on service startup
    - _Requirements: 11.1_
  
  - [x] 4.5 Implement bulk wallet registration
    - Implement registerWalletsBulk with atomic operation
    - Support CSV upload via API endpoint
    - _Requirements: 11.8_
  
  - [ ]* 4.6 Write property test for bulk registration atomicity
    - **Property 21: Bulk Registration Atomicity**
    - **Validates: Requirements 11.8**
  
  - [ ]* 4.7 Write property test for privacy flag persistence
    - **Property 18: Privacy Flag Persistence**
    - **Validates: Requirements 8.1**

- [ ] 5. Implement Redis cache layer
  - [x] 5.1 Create cache service with Redis connection pooling
    - Implement get/set/delete methods
    - Implement cache key generation with SHA-256 hash
    - Configure connection pool (10-50 connections)
    - _Requirements: 9.1, 9.5, 13.3_
  
  - [ ]* 5.2 Write property test for cache key format consistency
    - **Property 11: Cache Key Format Consistency**
    - **Validates: Requirements 9.5**
  
  - [x] 5.3 Implement cache invalidation logic
    - Implement invalidation on transaction updates
    - Implement wildcard invalidation for wallet patterns
    - _Requirements: 9.4_
  
  - [ ]* 5.4 Write property test for cache invalidation on update
    - **Property 10: Cache Invalidation on Update**
    - **Validates: Requirements 9.4**
  
  - [x] 5.5 Implement cache eviction under memory pressure
    - Monitor cache memory usage
    - Implement LRU eviction when usage exceeds 80%
    - _Requirements: 9.7_
  
  - [ ]* 5.6 Write property test for cache eviction under pressure
    - **Property 12: Cache Eviction Under Pressure**
    - **Validates: Requirements 9.7**
  
  - [x] 5.7 Implement cache warming on startup
    - Pre-load cache for ARS protocol wallets
    - _Requirements: 9.6_

- [x] 6. Checkpoint - Ensure core data layer tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [ ] 7. Implement query API service
  - [x] 7.1 Create query API with Express routes
    - Implement getTransactionHistory with pagination
    - Implement getWalletBalances
    - Implement getPnLAnalytics
    - Implement getRiskProfile
    - Implement getPredictionMarket
    - Implement getPortfolioAnalytics
    - Use Supabase connection pooling (20-100 connections)
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 3.6, 13.2_
  
  - [ ]* 7.2 Write property test for query response completeness
    - **Property 5: Query Response Completeness**
    - **Validates: Requirements 3.2, 3.3, 3.4, 3.5, 4.1, 4.2, 4.3, 4.5, 5.1, 5.2, 5.3, 6.3, 6.5, 7.1, 7.2**
  
  - [x] 7.3 Implement cache-first query pattern
    - Check Redis cache before Supabase query
    - Cache results with 5-minute TTL on cache miss
    - _Requirements: 9.1, 9.2, 9.3_
  
  - [ ]* 7.4 Write property test for cache round trip
    - **Property 9: Cache Round Trip**
    - **Validates: Requirements 9.3**
  
  - [ ]* 7.5 Write property test for cached query performance
    - **Property 6: Cached Query Performance**
    - **Validates: Requirements 3.1, 9.2**
  
  - [x] 7.6 Implement query filtering and pagination
    - Implement filter logic for transaction type, token mint, amount range
    - Implement pagination with page/pageSize parameters
    - _Requirements: 3.6, 3.7, 7.3_
  
  - [ ]* 7.7 Write property test for query filtering correctness
    - **Property 7: Query Filtering Correctness**
    - **Validates: Requirements 3.7, 7.3**
  
  - [ ]* 7.8 Write property test for pagination consistency
    - **Property 8: Pagination Consistency**
    - **Validates: Requirements 3.6**
  
  - [x] 7.9 Implement privacy protection authorization
    - Check authorization token for privacy-protected wallets
    - Return 401 for unauthorized queries without revealing wallet existence
    - _Requirements: 8.2, 8.5_
  
  - [ ]* 7.10 Write property test for privacy protection authorization
    - **Property 16: Privacy Protection Authorization**
    - **Validates: Requirements 8.2, 8.5**
  
  - [x] 7.11 Implement query rate limiting
    - Implement rate limiter (100 queries/min per agent)
    - Return 429 for rate limit exceeded
    - _Requirements: 13.5_
  
  - [ ]* 7.12 Write property test for query rate limiting
    - **Property 34: Query Rate Limiting**
    - **Validates: Requirements 13.5**

- [x] 8. Implement PnL calculation engine
  - [x] 8.1 Create PnL calculator service
    - Implement calculateRealizedPnL with FIFO cost basis
    - Implement calculateUnrealizedPnL with current prices
    - Implement calculateTotalPnL for all time periods
    - _Requirements: 12.1, 12.2, 12.4_
  
  - [ ]* 8.2 Write property test for FIFO cost basis calculation
    - **Property 22: FIFO Cost Basis Calculation**
    - **Validates: Requirements 12.1**
  
  - [ ]* 8.3 Write property test for unrealized PnL calculation
    - **Property 23: Unrealized PnL Calculation**
    - **Validates: Requirements 12.2**
  
  - [x] 8.4 Implement cost basis tracking
    - Store cost basis entries in cost_basis table
    - Handle partial position closes by splitting entries
    - _Requirements: 12.1_
  
  - [x] 8.5 Implement multi-token PnL aggregation
    - Calculate PnL separately for each token
    - Aggregate for total portfolio PnL
    - _Requirements: 12.5_
  
  - [ ]* 8.6 Write property test for multi-token PnL aggregation
    - **Property 25: Multi-Token PnL Aggregation**
    - **Validates: Requirements 12.5**
  
  - [x] 8.7 Implement fee inclusion in realized PnL
    - Extract fees from transaction metadata
    - Include fees in realized PnL calculations
    - _Requirements: 12.7_
  
  - [ ]* 8.8 Write property test for fee inclusion in realized PnL
    - **Property 27: Fee Inclusion in Realized PnL**
    - **Validates: Requirements 12.7**
  
  - [x] 8.9 Implement stale price handling
    - Use last known price when current price unavailable
    - Flag PnL calculation as stale
    - _Requirements: 12.6_
  
  - [ ]* 8.10 Write property test for stale price handling
    - **Property 26: Stale Price Handling**
    - **Validates: Requirements 12.6**
  
  - [ ]* 8.11 Write property test for PnL snapshot completeness
    - **Property 24: PnL Snapshot Completeness**
    - **Validates: Requirements 12.4**
  
  - [x] 8.12 Implement cron job for PnL updates
    - Set up node-cron to run every 10 minutes
    - Call calculateAllWallets for all registered wallets
    - _Requirements: 12.3_

- [ ] 9. Implement risk analysis engine
  - [x] 9.1 Create risk analyzer service
    - Implement analyzeTransaction with anomaly score calculation
    - Implement calculateWalletRisk with aggregated metrics
    - Implement detectAnomalies with z-score calculation
    - _Requirements: 6.1, 6.3_
  
  - [ ]* 9.2 Write property test for anomaly score calculation
    - **Property 28: Anomaly Score Calculation**
    - **Validates: Requirements 6.1**
  
  - [x] 9.3 Implement anomaly flagging and alerting
    - Flag transactions exceeding anomaly threshold
    - Emit security.anomaly event for high-risk transactions
    - _Requirements: 6.2_
  
  - [ ]* 9.4 Write property test for anomaly flagging and alerting
    - **Property 29: Anomaly Flagging and Alerting**
    - **Validates: Requirements 6.2**
  
  - [x] 9.5 Implement malicious address tracking
    - Query malicious_addresses table
    - Flag transactions involving known malicious addresses
    - _Requirements: 6.4_
  
  - [ ]* 9.6 Write property test for malicious address flagging
    - **Property 30: Malicious Address Flagging**
    - **Validates: Requirements 6.4**

- [ ] 10. Implement prediction market analytics
  - [ ] 10.1 Create prediction market service
    - Implement getPredictionMarket with current odds
    - Implement getPredictionMarketHistory with snapshots
    - Implement market confidence score calculation
    - _Requirements: 5.1, 5.2, 5.4_
  
  - [ ]* 10.2 Write property test for market confidence score calculation
    - **Property 31: Market Confidence Score Calculation**
    - **Validates: Requirements 5.4**
  
  - [ ] 10.3 Implement market resolution storage
    - Store final outcome and settlement data
    - Update prediction_markets table on resolution
    - _Requirements: 5.5_
  
  - [ ]* 10.4 Write property test for market resolution storage
    - **Property 32: Market Resolution Storage**
    - **Validates: Requirements 5.5**

- [ ] 11. Checkpoint - Ensure calculation engines tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 12. Implement event emitter service
  - [x] 12.1 Create event emitter with WebSocket support
    - Implement emitTransactionEvent
    - Implement emitBalanceUpdateEvent
    - Implement emitAnomalyEvent
    - Implement emitMarketOddsEvent
    - _Requirements: 10.1, 10.2, 10.3, 10.4_
  
  - [ ]* 12.2 Write property test for event emission on state change
    - **Property 13: Event Emission on State Change**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.4**
  
  - [x] 12.3 Implement subscription management
    - Implement subscribe/unsubscribe methods
    - Support event type and wallet address filtering
    - Send confirmation message with subscription ID
    - _Requirements: 10.5, 10.6_
  
  - [ ]* 12.4 Write property test for event subscription confirmation
    - **Property 14: Event Subscription Confirmation**
    - **Validates: Requirements 10.6**
  
  - [x] 12.5 Implement event rate limiting
    - Rate limit to 100 events/sec per agent
    - Buffer and drop excess events
    - _Requirements: 10.7_
  
  - [ ]* 12.6 Write property test for event rate limiting
    - **Property 15: Event Rate Limiting**
    - **Validates: Requirements 10.7**

- [ ] 13. Implement error handling and resilience
  - [x] 13.1 Implement graceful degradation for dependency failures
    - Continue serving cached data when LYS Labs disconnects
    - Queue write operations when Supabase fails
    - Fall back to Supabase when Redis fails
    - _Requirements: 14.1, 14.2, 14.3_
  
  - [ ]* 13.2 Write property test for service resilience under dependency failure
    - **Property 38: Service Resilience Under Dependency Failure**
    - **Validates: Requirements 14.1, 14.2, 14.3**
  
  - [x] 13.3 Implement write operation retry with exponential backoff
    - Retry up to 3 times with delays (1s, 2s, 4s)
    - Log error and emit system.error event on exhaustion
    - _Requirements: 14.4, 14.5_
  
  - [ ]* 13.4 Write property test for write operation retry
    - **Property 39: Write Operation Retry with Exponential Backoff**
    - **Validates: Requirements 14.4**
  
  - [ ]* 13.5 Write property test for retry exhaustion error handling
    - **Property 40: Retry Exhaustion Error Handling**
    - **Validates: Requirements 14.5**
  
  - [x] 13.6 Implement circuit breaker pattern
    - Open circuit after 5 consecutive failures
    - Keep open for 5 minutes
    - Return degraded service response when open
    - _Requirements: 14.6, 14.7_
  
  - [ ]* 13.7 Write property test for circuit breaker pattern
    - **Property 41: Circuit Breaker Pattern**
    - **Validates: Requirements 14.6**
  
  - [ ]* 13.8 Write property test for circuit breaker degraded mode
    - **Property 42: Circuit Breaker Degraded Mode**
    - **Validates: Requirements 14.7**
  
  - [x] 13.9 Implement capacity overload response
    - Return HTTP 503 with retry-after header when at capacity
    - _Requirements: 13.4_
  
  - [ ]* 13.10 Write property test for capacity overload response
    - **Property 35: Capacity Overload Response**
    - **Validates: Requirements 13.4**

- [x] 14. Implement monitoring and observability
  - [x] 14.1 Create Prometheus metrics endpoint
    - Expose /metrics endpoint
    - Track query count, latency, cache hit rate, error rate
    - Track WebSocket metrics (connection status, message rate)
    - Track database metrics (pool usage, query duration)
    - _Requirements: 15.1, 15.2, 15.3, 15.4_
  
  - [ ]* 14.2 Write property test for metrics tracking completeness
    - **Property 43: Metrics Tracking Completeness**
    - **Validates: Requirements 15.2, 15.3, 15.4**
  
  - [x] 14.3 Implement comprehensive error logging
    - Log all errors with stack trace and context
    - Include request parameters, timestamp, severity
    - _Requirements: 15.5_
  
  - [ ]* 14.4 Write property test for error logging completeness
    - **Property 44: Error Logging Completeness**
    - **Validates: Requirements 15.5**
  
  - [x] 14.5 Implement health check endpoint
    - Create /health endpoint
    - Return service status, dependency health, query load, pool status
    - _Requirements: 15.6, 13.7_
  
  - [ ]* 14.6 Write property test for health check completeness
    - **Property 37: Health Check Completeness**
    - **Validates: Requirements 13.7**
  
  - [x] 14.7 Implement critical error alerting
    - Emit alerts to Prometheus Alertmanager for critical errors
    - _Requirements: 15.7_
  
  - [ ]* 14.8 Write property test for critical error alerting
    - **Property 45: Critical Error Alerting**
    - **Validates: Requirements 15.7**
  
  - [x] 14.9 Implement slow query logging
    - Log queries exceeding 1 second with full context
    - _Requirements: 13.6_
  
  - [ ]* 14.10 Write property test for slow query logging
    - **Property 36: Slow Query Logging**
    - **Validates: Requirements 13.6**

- [ ] 15. Integrate with Trading Agent
  - [ ] 15.1 Add memory service client to Trading Agent
    - Implement portfolio analytics queries
    - Implement trading history queries
    - Implement performance metrics queries
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_

- [ ] 16. Integrate with Policy Agent
  - [ ] 16.1 Add memory service client to Policy Agent
    - Implement prediction market data queries
    - Implement market history queries
    - Implement market liquidity queries
    - _Requirements: 5.1, 5.2, 5.3_

- [ ] 17. Integrate with Security Agent
  - [ ] 17.1 Add memory service client to Security Agent
    - Implement risk profile queries
    - Implement anomaly detection queries
    - Implement audit trail queries
    - Subscribe to security.anomaly events
    - _Requirements: 6.3, 6.5_

- [ ] 18. Integrate with Compliance Agent
  - [ ] 18.1 Add memory service client to Compliance Agent
    - Implement audit trail queries
    - Implement compliance history queries
    - Implement transaction review marking
    - _Requirements: 7.1, 7.2, 7.4, 7.5_

- [ ] 19. Wire everything together and configure deployment
  - [ ] 19.1 Create main service entry point
    - Initialize all services (WebSocket client, indexer, query API, etc.)
    - Set up Express app with all routes
    - Configure connection pools and caching
    - Start cron jobs for PnL updates
    - _Requirements: All_
  
  - [ ] 19.2 Create environment configuration
    - Define environment variables for LYS Labs API, Supabase, Redis
    - Define ARS protocol wallet addresses for auto-registration
    - Define rate limits, cache TTLs, circuit breaker thresholds
    - _Requirements: All_
  
  - [ ] 19.3 Update Docker Compose configuration
    - Ensure Supabase and Redis services are configured
    - Add memory service to docker-compose.yml
    - _Requirements: All_
  
  - [ ] 19.4 Create Railway deployment configuration
    - Update railway.json with memory service
    - Configure environment variables in Railway
    - _Requirements: All_

- [ ]* 20. Write integration tests
  - Test full workflow: wallet registration → transaction indexing → query → event emission
  - Test LYS Labs WebSocket integration with mock server
  - Test Supabase integration with test database
  - Test Redis integration with test cache
  - _Requirements: All_

- [ ]* 21. Write performance tests
  - Test concurrent query performance (1000 concurrent requests)
  - Test cache hit rate under load
  - Test query latency percentiles (p50, p95, p99)
  - _Requirements: 13.1_

- [ ]* 21.1 Write property test for concurrent query performance
  - **Property 33: Concurrent Query Performance**
  - **Validates: Requirements 13.1**

- [ ] 22. Final checkpoint - Ensure all tests pass
  - Ensure all tests pass, ask the user if questions arise.

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation
- Property tests validate universal correctness properties
- Unit tests validate specific examples and edge cases
- Integration tests validate end-to-end workflows
- The implementation follows a bottom-up approach: database → data layer → services → API → agent integration
