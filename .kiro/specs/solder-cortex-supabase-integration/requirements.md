# Requirements Document

## Introduction

This document specifies the requirements for integrating Solder Cortex (Memory Layer for AI Agents) into the Agentic Reserve System (ARS). The integration provides historical context and real-time transaction intelligence to ARS agents by adapting Solder Cortex's wallet memory capabilities to use Supabase (PostgreSQL) instead of ClickHouse, while maintaining integration with LYS Labs for real-time Solana transaction indexing.

## Glossary

- **Memory_Service**: Backend service that provides historical wallet context and analytics to ARS agents
- **LYS_Labs**: External WebSocket API provider for real-time Solana transaction indexing
- **Wallet_Memory**: Historical transaction data, balances, and analytics for Solana wallets
- **PnL_Analytics**: Profit and Loss calculations over various time periods (24h, 7d, 30d, all-time)
- **Prediction_Market_Data**: Historical and current data from futarchy prediction markets
- **Risk_Profile**: Aggregated risk metrics and anomaly detection results for a wallet
- **Stealth_Address**: Privacy-protected wallet address using Sipher protocol
- **Indexing_Status**: Current state of transaction indexing for a registered wallet
- **Cache_Layer**: Redis-based caching system for frequently accessed memory data
- **Agent_Query**: Request from an ARS agent for historical context or analytics

## Requirements

### Requirement 1: Supabase Schema Extension

**User Story:** As a system architect, I want to extend the Supabase schema with wallet memory tables, so that historical transaction data and analytics can be stored and queried efficiently.

#### Acceptance Criteria

1. THE Memory_Service SHALL create a `wallet_registrations` table with columns for wallet address, registration timestamp, indexing status, and privacy flags
2. THE Memory_Service SHALL create a `wallet_transactions` table with columns for transaction signature, wallet address, timestamp, transaction type, amount, token mint, and metadata
3. THE Memory_Service SHALL create a `wallet_balances` table with columns for wallet address, token mint, balance amount, last updated timestamp, and USD value
4. THE Memory_Service SHALL create a `wallet_pnl` table with columns for wallet address, time period, realized PnL, unrealized PnL, total PnL, and calculation timestamp
5. THE Memory_Service SHALL create a `prediction_markets` table with columns for market address, proposal ID, outcome odds, volume, liquidity, and last updated timestamp
6. THE Memory_Service SHALL create a `risk_profiles` table with columns for wallet address, risk score, anomaly flags, last assessment timestamp, and risk factors JSON
7. THE Memory_Service SHALL create indexes on wallet address, timestamp, and transaction type columns for query performance
8. THE Memory_Service SHALL create a `wallet_audit_trail` table with columns for wallet address, action type, timestamp, agent ID, and authorization status

### Requirement 2: LYS Labs WebSocket Integration

**User Story:** As a system operator, I want to integrate with LYS Labs WebSocket API, so that real-time Solana transaction data can be indexed automatically.

#### Acceptance Criteria

1. WHEN the Memory_Service starts, THE Memory_Service SHALL establish a WebSocket connection to LYS Labs API
2. WHEN a wallet is registered, THE Memory_Service SHALL subscribe to transaction updates for that wallet address via LYS Labs
3. WHEN a transaction update is received from LYS Labs, THE Memory_Service SHALL parse the transaction data and store it in the `wallet_transactions` table
4. WHEN a transaction update is received, THE Memory_Service SHALL update the corresponding wallet balance in the `wallet_balances` table
5. IF the WebSocket connection is lost, THEN THE Memory_Service SHALL attempt reconnection with exponential backoff up to 5 attempts
6. WHEN reconnection succeeds, THE Memory_Service SHALL re-subscribe to all registered wallet addresses
7. THE Memory_Service SHALL validate transaction data from LYS Labs against expected schema before storage
8. WHEN invalid transaction data is received, THE Memory_Service SHALL log the error and continue processing other transactions

### Requirement 3: Memory Query Service

**User Story:** As an ARS agent, I want to query historical wallet context and analytics, so that I can make informed decisions based on past behavior and performance.

#### Acceptance Criteria

1. WHEN an agent queries transaction history, THE Memory_Service SHALL return transactions for the specified wallet address and time range within 200ms for cached data
2. WHEN an agent queries PnL analytics, THE Memory_Service SHALL return realized PnL, unrealized PnL, and total PnL for the specified time periods (24h, 7d, 30d, all-time)
3. WHEN an agent queries prediction market data, THE Memory_Service SHALL return current odds, volume, and liquidity for the specified market address
4. WHEN an agent queries risk profile, THE Memory_Service SHALL return risk score, anomaly flags, and risk factors for the specified wallet address
5. WHEN an agent queries wallet balances, THE Memory_Service SHALL return current token balances with USD values for the specified wallet address
6. THE Memory_Service SHALL support pagination for transaction history queries with configurable page size
7. THE Memory_Service SHALL support filtering transaction history by transaction type, token mint, and amount range
8. WHEN query results are not in cache, THE Memory_Service SHALL fetch from Supabase and cache the results with 5-minute TTL

### Requirement 4: Trading Agent Integration

**User Story:** As a Trading Agent, I want access to historical trading performance and portfolio analytics, so that I can optimize trading strategies based on past results.

#### Acceptance Criteria

1. WHEN the Trading Agent requests portfolio analytics, THE Memory_Service SHALL return current balances, PnL by token, and allocation percentages
2. WHEN the Trading Agent requests trading history, THE Memory_Service SHALL return all swap transactions with entry/exit prices and realized PnL
3. WHEN the Trading Agent requests performance metrics, THE Memory_Service SHALL return win rate, average profit per trade, and Sharpe ratio for the specified time period
4. THE Memory_Service SHALL calculate portfolio concentration risk and return it as part of risk profile queries
5. WHEN the Trading Agent requests liquidity analysis, THE Memory_Service SHALL return historical liquidity provision positions and fees earned

### Requirement 5: Policy Agent Integration

**User Story:** As a Policy Agent, I want access to prediction market odds for governance proposals, so that I can execute policies based on market consensus.

#### Acceptance Criteria

1. WHEN the Policy Agent requests prediction market data for a proposal, THE Memory_Service SHALL return current odds for all outcomes
2. WHEN the Policy Agent requests market history, THE Memory_Service SHALL return historical odds changes and volume over time
3. WHEN the Policy Agent requests market liquidity, THE Memory_Service SHALL return current liquidity depth and slippage estimates
4. THE Memory_Service SHALL calculate market confidence score based on volume, liquidity, and odds stability
5. WHEN a prediction market resolves, THE Memory_Service SHALL store the final outcome and settlement data

### Requirement 6: Security Agent Integration

**User Story:** As a Security Agent, I want to detect anomalous transactions and assess wallet risk profiles, so that I can identify potential security threats.

#### Acceptance Criteria

1. WHEN a new transaction is indexed, THE Memory_Service SHALL calculate anomaly score based on transaction amount, frequency, and recipient patterns
2. WHEN an anomaly score exceeds threshold, THE Memory_Service SHALL flag the transaction and emit a security alert event
3. WHEN the Security Agent requests risk profile, THE Memory_Service SHALL return aggregated risk metrics including anomaly count, high-risk transaction percentage, and counterparty risk
4. THE Memory_Service SHALL track known malicious addresses and flag transactions involving them
5. WHEN the Security Agent requests audit trail, THE Memory_Service SHALL return all transactions with authorization status and agent actions

### Requirement 7: Compliance Agent Integration

**User Story:** As a Compliance Agent, I want access to transaction audit trails and compliance history, so that I can ensure regulatory compliance and investigate suspicious activity.

#### Acceptance Criteria

1. WHEN the Compliance Agent requests audit trail, THE Memory_Service SHALL return all transactions for the specified wallet with timestamps and authorization status
2. WHEN the Compliance Agent requests compliance history, THE Memory_Service SHALL return all compliance checks performed and their results
3. THE Memory_Service SHALL support filtering audit trail by date range, transaction type, and authorization status
4. WHEN the Compliance Agent marks a transaction for review, THE Memory_Service SHALL store the review status and reviewer ID
5. THE Memory_Service SHALL calculate compliance risk score based on transaction patterns and counterparty analysis

### Requirement 8: Privacy Protection

**User Story:** As a system architect, I want to respect Sipher privacy constraints, so that stealth addresses and shielded transfers remain confidential.

#### Acceptance Criteria

1. WHEN a wallet is registered with privacy flag enabled, THE Memory_Service SHALL mark it as a stealth address in the `wallet_registrations` table
2. WHEN an agent queries a privacy-protected wallet, THE Memory_Service SHALL require authorization token before returning data
3. WHEN indexing shielded transfers, THE Memory_Service SHALL NOT store plaintext transfer amounts in the `wallet_transactions` table
4. THE Memory_Service SHALL store encrypted metadata for privacy-protected transactions with agent-specific decryption keys
5. WHEN an unauthorized agent queries a privacy-protected wallet, THE Memory_Service SHALL return an authorization error without revealing wallet existence

### Requirement 9: Cache Layer Performance

**User Story:** As a system operator, I want to cache frequently accessed memory data, so that agent queries respond within 200ms and reduce database load.

#### Acceptance Criteria

1. WHEN an agent queries wallet data, THE Memory_Service SHALL check Redis cache before querying Supabase
2. WHEN cache data is found and not expired, THE Memory_Service SHALL return cached data within 200ms
3. WHEN cache data is not found, THE Memory_Service SHALL query Supabase, cache the result with 5-minute TTL, and return the data
4. WHEN a real-time transaction update is received, THE Memory_Service SHALL invalidate relevant cache entries
5. THE Memory_Service SHALL use cache key format `wallet:{address}:{query_type}:{params_hash}` for consistent cache management
6. THE Memory_Service SHALL support cache warming for ARS protocol wallets on startup
7. WHEN cache memory usage exceeds 80%, THE Memory_Service SHALL evict least recently used entries

### Requirement 10: Real-Time Event Emission

**User Story:** As an ARS agent, I want to receive real-time notifications when wallet data changes, so that I can react immediately to new transactions or risk events.

#### Acceptance Criteria

1. WHEN a new transaction is indexed, THE Memory_Service SHALL emit a `transaction.new` event via WebSocket to subscribed agents
2. WHEN a wallet balance changes, THE Memory_Service SHALL emit a `balance.updated` event with the new balance and USD value
3. WHEN an anomaly is detected, THE Memory_Service SHALL emit a `security.anomaly` event with anomaly details and risk score
4. WHEN a prediction market odds change significantly, THE Memory_Service SHALL emit a `market.odds_changed` event with new odds
5. THE Memory_Service SHALL support agent subscription to specific event types and wallet addresses
6. WHEN an agent subscribes to events, THE Memory_Service SHALL send a confirmation message with subscription ID
7. THE Memory_Service SHALL rate limit event emissions to 100 events per second per agent to prevent overwhelming subscribers

### Requirement 11: Wallet Registration Management

**User Story:** As a system operator, I want to manage wallet registrations, so that I can control which wallets are indexed and track indexing status.

#### Acceptance Criteria

1. WHEN the Memory_Service starts, THE Memory_Service SHALL auto-register all ARS protocol wallets from configuration
2. THE Memory_Service SHALL provide an API endpoint to register new wallets with optional privacy flag
3. WHEN a wallet is registered, THE Memory_Service SHALL set indexing status to `pending` and begin historical data backfill
4. WHEN historical backfill completes, THE Memory_Service SHALL update indexing status to `active`
5. THE Memory_Service SHALL provide an API endpoint to query indexing status for a wallet address
6. THE Memory_Service SHALL provide an API endpoint to unregister a wallet and stop indexing
7. WHEN a wallet is unregistered, THE Memory_Service SHALL retain historical data but stop receiving new transaction updates
8. THE Memory_Service SHALL support bulk wallet registration via CSV upload

### Requirement 12: PnL Calculation Engine

**User Story:** As a system operator, I want automated PnL calculations, so that agents have accurate profit and loss analytics without manual computation.

#### Acceptance Criteria

1. THE Memory_Service SHALL calculate realized PnL for completed trades using FIFO cost basis method
2. THE Memory_Service SHALL calculate unrealized PnL for open positions using current market prices from oracle aggregator
3. THE Memory_Service SHALL update PnL calculations every 10 minutes for all registered wallets
4. THE Memory_Service SHALL store PnL snapshots for 24h, 7d, 30d, and all-time periods in the `wallet_pnl` table
5. THE Memory_Service SHALL calculate PnL separately for each token and aggregate for total portfolio PnL
6. WHEN a token price is unavailable, THE Memory_Service SHALL use the last known price and flag the PnL calculation as stale
7. THE Memory_Service SHALL calculate fees paid and include them in realized PnL calculations

### Requirement 13: Concurrent Query Support

**User Story:** As a system architect, I want to support high concurrent query load, so that 1000+ agents can query memory data simultaneously without performance degradation.

#### Acceptance Criteria

1. THE Memory_Service SHALL support at least 1000 concurrent agent queries without response time exceeding 500ms
2. THE Memory_Service SHALL use connection pooling for Supabase with minimum 20 and maximum 100 connections
3. THE Memory_Service SHALL use Redis connection pooling with minimum 10 and maximum 50 connections
4. WHEN query load exceeds capacity, THE Memory_Service SHALL return HTTP 503 with retry-after header
5. THE Memory_Service SHALL implement query rate limiting of 100 queries per minute per agent
6. THE Memory_Service SHALL log slow queries (>1 second) for performance analysis
7. THE Memory_Service SHALL provide health check endpoint that reports current query load and connection pool status

### Requirement 14: Error Handling and Resilience

**User Story:** As a system operator, I want robust error handling, so that the Memory_Service continues operating even when external dependencies fail.

#### Acceptance Criteria

1. WHEN LYS Labs WebSocket connection fails, THE Memory_Service SHALL continue serving cached and database queries
2. WHEN Supabase connection fails, THE Memory_Service SHALL serve cached data and queue write operations for retry
3. WHEN Redis connection fails, THE Memory_Service SHALL fall back to direct Supabase queries without caching
4. THE Memory_Service SHALL retry failed write operations up to 3 times with exponential backoff
5. WHEN all retry attempts fail, THE Memory_Service SHALL log the error and emit a `system.error` event
6. THE Memory_Service SHALL implement circuit breaker pattern for external API calls with 5-minute timeout
7. WHEN circuit breaker opens, THE Memory_Service SHALL return degraded service response with cached data only

### Requirement 15: Monitoring and Observability

**User Story:** As a system operator, I want comprehensive monitoring, so that I can track Memory_Service health and performance.

#### Acceptance Criteria

1. THE Memory_Service SHALL expose Prometheus metrics endpoint at `/metrics`
2. THE Memory_Service SHALL track metrics for query count, query latency, cache hit rate, and error rate
3. THE Memory_Service SHALL track metrics for WebSocket connection status, message rate, and reconnection count
4. THE Memory_Service SHALL track metrics for database connection pool usage and query duration
5. THE Memory_Service SHALL log all errors with stack traces and context information
6. THE Memory_Service SHALL provide health check endpoint at `/health` that returns service status and dependency health
7. WHEN a critical error occurs, THE Memory_Service SHALL emit alert to configured monitoring system
