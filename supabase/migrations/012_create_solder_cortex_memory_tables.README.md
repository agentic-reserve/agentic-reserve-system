# Migration 012: Solder Cortex Memory Tables

## Overview

This migration creates the complete database schema for the Solder Cortex Memory Service integration into the Agentic Reserve System (ARS). The Memory Service provides historical context and real-time transaction intelligence to autonomous agents.

## Purpose

The Memory Service enables ARS agents (Trading, Policy, Security, Compliance) to make informed decisions based on historical wallet data, transaction patterns, PnL analytics, risk profiles, and prediction market trends.

## Tables Created

### 1. `wallet_registrations`
**Purpose:** Tracks registered wallets and their indexing status

**Key Columns:**
- `address` (PK): Wallet address
- `indexing_status`: Current indexing state (pending, active, error, paused)
- `privacy_protected`: Flag for Sipher stealth addresses
- `agent_id`: Associated agent identifier

**Indexes:**
- `idx_wallet_registrations_status`: Query by indexing status
- `idx_wallet_registrations_agent`: Query by agent ID

### 2. `wallet_transactions`
**Purpose:** Stores all indexed transactions from LYS Labs

**Key Columns:**
- `signature` (PK): Transaction signature
- `wallet_address` (FK): References wallet_registrations
- `timestamp`: Transaction timestamp (UNIX epoch)
- `transaction_type`: Type of transaction (transfer, swap, stake, etc.)
- `amount`: Transaction amount
- `token_mint`: Token mint address
- `metadata`: Additional transaction data (JSONB)
- `is_privacy_protected`: Privacy flag for encrypted transactions

**Indexes:**
- `idx_wallet_transactions_address`: Query by wallet
- `idx_wallet_transactions_timestamp`: Query by time (DESC)
- `idx_wallet_transactions_type`: Query by transaction type
- `idx_wallet_transactions_token`: Query by token
- `idx_wallet_transactions_composite`: Optimized for wallet + time queries

### 3. `wallet_balances`
**Purpose:** Tracks current token balances for registered wallets

**Key Columns:**
- `wallet_address` (FK): References wallet_registrations
- `token_mint`: Token mint address
- `amount`: Current balance
- `usd_value`: USD value of balance
- `last_updated`: Last update timestamp

**Unique Constraint:** (wallet_address, token_mint)

**Indexes:**
- `idx_wallet_balances_address`: Query by wallet
- `idx_wallet_balances_token`: Query by token

### 4. `wallet_pnl`
**Purpose:** Stores profit and loss analytics for different time periods

**Key Columns:**
- `wallet_address` (FK): References wallet_registrations
- `period`: Time period (24h, 7d, 30d, all)
- `realized_pnl`: Realized profit/loss
- `unrealized_pnl`: Unrealized profit/loss
- `total_pnl`: Total profit/loss
- `return_percentage`: Return percentage
- `by_token`: Per-token PnL breakdown (JSONB)
- `calculated_at`: Calculation timestamp
- `is_stale`: Flag for stale price data

**Unique Constraint:** (wallet_address, period, calculated_at)

**Indexes:**
- `idx_wallet_pnl_address`: Query by wallet
- `idx_wallet_pnl_period`: Query by period
- `idx_wallet_pnl_calculated`: Query by calculation time (DESC)

### 5. `prediction_markets`
**Purpose:** Stores prediction market data for futarchy governance

**Key Columns:**
- `market_address` (PK): Market address
- `proposal_id`: Associated governance proposal
- `outcomes`: Market outcomes with odds (JSONB)
- `total_volume`: Total trading volume
- `total_liquidity`: Total liquidity
- `confidence_score`: Market confidence metric

**Indexes:**
- `idx_prediction_markets_proposal`: Query by proposal
- `idx_prediction_markets_updated`: Query by update time (DESC)

### 6. `market_snapshots`
**Purpose:** Historical snapshots of prediction market odds

**Key Columns:**
- `market_address` (FK): References prediction_markets
- `outcomes`: Snapshot of outcomes (JSONB)
- `snapshot_timestamp`: Snapshot timestamp

**Indexes:**
- `idx_market_snapshots_market`: Query by market
- `idx_market_snapshots_timestamp`: Query by time (DESC)

### 7. `risk_profiles`
**Purpose:** Risk assessment data for wallets

**Key Columns:**
- `wallet_address` (PK, FK): References wallet_registrations
- `risk_score`: Overall risk score (0-100)
- `anomaly_count`: Number of detected anomalies
- `high_risk_transaction_percentage`: Percentage of high-risk transactions
- `counterparty_risk`: Counterparty risk score
- `risk_factors`: Detailed risk factors (JSONB)

**Indexes:**
- `idx_risk_profiles_score`: Query by risk score (DESC)
- `idx_risk_profiles_assessment`: Query by assessment time (DESC)

### 8. `anomalies`
**Purpose:** Detected anomalies in wallet transactions

**Key Columns:**
- `transaction_signature` (FK): References wallet_transactions
- `wallet_address` (FK): References wallet_registrations
- `anomaly_type`: Type of anomaly
- `severity`: Severity level (low, medium, high, critical)
- `description`: Anomaly description
- `score`: Anomaly score

**Indexes:**
- `idx_anomalies_wallet`: Query by wallet
- `idx_anomalies_severity`: Query by severity
- `idx_anomalies_timestamp`: Query by time (DESC)

### 9. `wallet_audit_trail`
**Purpose:** Audit trail of all access and actions on wallet data

**Key Columns:**
- `wallet_address` (FK): References wallet_registrations
- `action_type`: Type of action
- `agent_id`: Agent performing action
- `authorization_status`: Authorization status (authorized, unauthorized, pending)
- `query_params`: Query parameters (JSONB)

**Indexes:**
- `idx_audit_trail_wallet`: Query by wallet
- `idx_audit_trail_agent`: Query by agent
- `idx_audit_trail_timestamp`: Query by time (DESC)

### 10. `cost_basis`
**Purpose:** Cost basis tracking for PnL calculations using FIFO method

**Key Columns:**
- `wallet_address` (FK): References wallet_registrations
- `token_mint`: Token mint address
- `amount`: Token amount
- `cost_per_token`: Cost per token
- `total_cost`: Total cost
- `acquired_at`: Acquisition timestamp
- `transaction_signature`: Source transaction

**Indexes:**
- `idx_cost_basis_wallet`: Query by wallet
- `idx_cost_basis_token`: Query by token
- `idx_cost_basis_acquired`: Query by acquisition time
- `idx_cost_basis_composite`: Optimized for wallet + token + time queries

### 11. `malicious_addresses`
**Purpose:** Known malicious addresses for risk assessment

**Key Columns:**
- `address` (PK): Malicious address
- `reason`: Reason for flagging
- `severity`: Severity level (low, medium, high, critical)
- `reported_by`: Reporter identifier
- `reported_at`: Report timestamp

**Indexes:**
- `idx_malicious_addresses_severity`: Query by severity

## Performance Optimizations

### Index Strategy
- **Composite indexes** for common query patterns (wallet + timestamp)
- **Descending indexes** for time-based queries (most recent first)
- **Covering indexes** to avoid table lookups for common queries

### Connection Pooling
The migration includes configuration for connection pooling:
- **Supabase Pool:** 20-100 connections
- **Redis Pool:** 10-50 connections
- **Connection timeout:** 30 seconds
- **Idle timeout:** 10 minutes

Configuration is managed in `backend/src/config/index.ts`

## Data Integrity

### Foreign Key Constraints
- All child tables reference `wallet_registrations` with `ON DELETE CASCADE`
- Ensures data consistency when wallets are unregistered
- Maintains referential integrity across the schema

### Check Constraints
- `indexing_status` limited to valid values
- `authorization_status` limited to valid values
- `severity` limited to valid values
- `risk_score` constrained to 0-100 range
- `period` limited to valid time periods

### Unique Constraints
- `wallet_balances`: (wallet_address, token_mint)
- `wallet_pnl`: (wallet_address, period, calculated_at)

## Running the Migration

### Local Development (Supabase CLI)
```bash
# Apply migration
supabase db push

# Or apply specific migration
supabase migration up 012_create_solder_cortex_memory_tables.sql
```

### Production (Supabase Dashboard)
1. Navigate to Database → Migrations
2. Upload `012_create_solder_cortex_memory_tables.sql`
3. Review changes
4. Apply migration

### Verification
```sql
-- Check all tables were created
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
  AND table_name IN (
    'wallet_registrations',
    'wallet_transactions',
    'wallet_balances',
    'wallet_pnl',
    'prediction_markets',
    'market_snapshots',
    'risk_profiles',
    'anomalies',
    'wallet_audit_trail',
    'cost_basis',
    'malicious_addresses'
  );

-- Check indexes were created
SELECT indexname, tablename 
FROM pg_indexes 
WHERE schemaname = 'public' 
  AND tablename LIKE 'wallet_%' 
  OR tablename IN ('prediction_markets', 'market_snapshots', 'risk_profiles', 'anomalies', 'cost_basis', 'malicious_addresses');

-- Check foreign key constraints
SELECT
  tc.table_name, 
  kcu.column_name, 
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name 
FROM information_schema.table_constraints AS tc 
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY' 
  AND tc.table_schema = 'public'
  AND (tc.table_name LIKE 'wallet_%' OR tc.table_name IN ('market_snapshots', 'anomalies', 'cost_basis'));
```

## Rollback

If you need to rollback this migration:

```sql
-- Drop all tables in reverse dependency order
DROP TABLE IF EXISTS wallet_audit_trail CASCADE;
DROP TABLE IF EXISTS cost_basis CASCADE;
DROP TABLE IF EXISTS anomalies CASCADE;
DROP TABLE IF EXISTS market_snapshots CASCADE;
DROP TABLE IF EXISTS risk_profiles CASCADE;
DROP TABLE IF EXISTS prediction_markets CASCADE;
DROP TABLE IF EXISTS wallet_pnl CASCADE;
DROP TABLE IF EXISTS wallet_balances CASCADE;
DROP TABLE IF EXISTS wallet_transactions CASCADE;
DROP TABLE IF EXISTS malicious_addresses CASCADE;
DROP TABLE IF EXISTS wallet_registrations CASCADE;
```

## Environment Variables

Add these to your `.env` file (see `backend/.env.example`):

```bash
# Supabase Connection Pooling
SUPABASE_POOL_MIN=20
SUPABASE_POOL_MAX=100
SUPABASE_CONNECTION_TIMEOUT=30000
SUPABASE_IDLE_TIMEOUT=600000

# Redis Connection Pooling
REDIS_POOL_MIN=10
REDIS_POOL_MAX=50

# LYS Labs WebSocket API
LYS_LABS_WS_URL=wss://api.lyslabs.io/v1/ws
LYS_LABS_API_KEY=your-lys-labs-api-key

# Memory Service Configuration
MEMORY_CACHE_TTL=300
MEMORY_QUERY_PAGE_SIZE=50
MEMORY_PNL_UPDATE_INTERVAL=10
MEMORY_AUTO_REGISTER=true
MEMORY_PROTOCOL_WALLETS=wallet1,wallet2,wallet3
```

## Next Steps

After running this migration:

1. **Implement LYS Labs WebSocket Client** (Task 2)
   - Connect to LYS Labs API
   - Subscribe to wallet transactions
   - Handle reconnection logic

2. **Implement Transaction Indexer** (Task 3)
   - Process incoming transactions
   - Update wallet balances
   - Handle privacy-protected transactions

3. **Implement Query API** (Task 7)
   - Create REST endpoints
   - Implement caching layer
   - Add rate limiting

4. **Write Unit Tests** (Task 1.1)
   - Test schema validation
   - Test index creation
   - Test foreign key constraints

## Requirements Validated

This migration validates the following requirements:
- **1.1:** wallet_registrations table created
- **1.2:** wallet_transactions table created
- **1.3:** wallet_balances table created
- **1.4:** wallet_pnl table created
- **1.5:** prediction_markets table created
- **1.6:** risk_profiles table created
- **1.7:** Indexes created for query performance
- **1.8:** wallet_audit_trail table created

## Related Documentation

- Design Document: `.kiro/specs/solder-cortex-supabase-integration/design.md`
- Requirements: `.kiro/specs/solder-cortex-supabase-integration/requirements.md`
- Tasks: `.kiro/specs/solder-cortex-supabase-integration/tasks.md`
- Backend Config: `backend/src/config/index.ts`

## Support

For issues or questions:
1. Check the design document for schema details
2. Review the requirements document for acceptance criteria
3. Consult the tasks document for implementation guidance
4. Check existing migrations in `supabase/migrations/` for patterns
