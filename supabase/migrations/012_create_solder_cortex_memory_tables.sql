-- Migration: Create Solder Cortex Memory Tables
-- Description: Creates all tables for the Memory Service including wallet registrations,
--              transactions, balances, PnL analytics, prediction markets, risk profiles,
--              anomalies, audit trails, cost basis tracking, and malicious addresses.
-- Requirements: 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7, 1.8

-- ============================================================================
-- Wallet Registrations
-- ============================================================================
-- Tracks registered wallets and their indexing status
CREATE TABLE IF NOT EXISTS wallet_registrations (
  address TEXT PRIMARY KEY,
  registered_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  indexing_status TEXT NOT NULL CHECK (indexing_status IN ('pending', 'active', 'error', 'paused')),
  last_indexed_timestamp BIGINT,
  transaction_count INTEGER DEFAULT 0,
  privacy_protected BOOLEAN DEFAULT FALSE,
  label TEXT,
  agent_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for wallet registrations
CREATE INDEX IF NOT EXISTS idx_wallet_registrations_status ON wallet_registrations(indexing_status);
CREATE INDEX IF NOT EXISTS idx_wallet_registrations_agent ON wallet_registrations(agent_id);

-- ============================================================================
-- Wallet Transactions
-- ============================================================================
-- Stores all indexed transactions for registered wallets
CREATE TABLE IF NOT EXISTS wallet_transactions (
  signature TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallet_registrations(address) ON DELETE CASCADE,
  timestamp BIGINT NOT NULL,
  block_number BIGINT,
  transaction_type TEXT NOT NULL,
  amount NUMERIC(20, 8),
  token_mint TEXT,
  token_symbol TEXT,
  counterparty_address TEXT,
  fee_amount NUMERIC(20, 8),
  metadata JSONB,
  is_privacy_protected BOOLEAN DEFAULT FALSE,
  encrypted_data TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for wallet transactions (optimized for common query patterns)
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_address ON wallet_transactions(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_timestamp ON wallet_transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_type ON wallet_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_token ON wallet_transactions(token_mint);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_composite ON wallet_transactions(wallet_address, timestamp DESC);

-- ============================================================================
-- Wallet Balances
-- ============================================================================
-- Tracks current token balances for registered wallets
CREATE TABLE IF NOT EXISTS wallet_balances (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallet_registrations(address) ON DELETE CASCADE,
  token_mint TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  amount NUMERIC(20, 8) NOT NULL,
  usd_value NUMERIC(20, 2),
  last_updated BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet_address, token_mint)
);

-- Indexes for wallet balances
CREATE INDEX IF NOT EXISTS idx_wallet_balances_address ON wallet_balances(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_balances_token ON wallet_balances(token_mint);

-- ============================================================================
-- Wallet PnL (Profit and Loss)
-- ============================================================================
-- Stores PnL analytics for different time periods
CREATE TABLE IF NOT EXISTS wallet_pnl (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallet_registrations(address) ON DELETE CASCADE,
  period TEXT NOT NULL CHECK (period IN ('24h', '7d', '30d', 'all')),
  realized_pnl NUMERIC(20, 2) NOT NULL,
  unrealized_pnl NUMERIC(20, 2) NOT NULL,
  total_pnl NUMERIC(20, 2) NOT NULL,
  return_percentage NUMERIC(10, 4),
  fees_paid NUMERIC(20, 2),
  by_token JSONB,
  calculated_at BIGINT NOT NULL,
  is_stale BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet_address, period, calculated_at)
);

-- Indexes for wallet PnL
CREATE INDEX IF NOT EXISTS idx_wallet_pnl_address ON wallet_pnl(wallet_address);
CREATE INDEX IF NOT EXISTS idx_wallet_pnl_period ON wallet_pnl(period);
CREATE INDEX IF NOT EXISTS idx_wallet_pnl_calculated ON wallet_pnl(calculated_at DESC);

-- ============================================================================
-- Prediction Markets
-- ============================================================================
-- Stores prediction market data for futarchy governance
CREATE TABLE IF NOT EXISTS prediction_markets (
  market_address TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  outcomes JSONB NOT NULL,
  total_volume NUMERIC(20, 2) NOT NULL,
  total_liquidity NUMERIC(20, 2) NOT NULL,
  confidence_score NUMERIC(5, 2),
  last_updated BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for prediction markets
CREATE INDEX IF NOT EXISTS idx_prediction_markets_proposal ON prediction_markets(proposal_id);
CREATE INDEX IF NOT EXISTS idx_prediction_markets_updated ON prediction_markets(last_updated DESC);

-- ============================================================================
-- Market Snapshots
-- ============================================================================
-- Stores historical snapshots of prediction market odds
CREATE TABLE IF NOT EXISTS market_snapshots (
  id SERIAL PRIMARY KEY,
  market_address TEXT NOT NULL REFERENCES prediction_markets(market_address) ON DELETE CASCADE,
  outcomes JSONB NOT NULL,
  total_volume NUMERIC(20, 2) NOT NULL,
  total_liquidity NUMERIC(20, 2) NOT NULL,
  snapshot_timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for market snapshots
CREATE INDEX IF NOT EXISTS idx_market_snapshots_market ON market_snapshots(market_address);
CREATE INDEX IF NOT EXISTS idx_market_snapshots_timestamp ON market_snapshots(snapshot_timestamp DESC);

-- ============================================================================
-- Risk Profiles
-- ============================================================================
-- Stores risk assessment data for wallets
CREATE TABLE IF NOT EXISTS risk_profiles (
  wallet_address TEXT PRIMARY KEY REFERENCES wallet_registrations(address) ON DELETE CASCADE,
  risk_score NUMERIC(5, 2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  anomaly_count INTEGER DEFAULT 0,
  high_risk_transaction_percentage NUMERIC(5, 2),
  counterparty_risk NUMERIC(5, 2),
  risk_factors JSONB NOT NULL,
  last_assessment BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for risk profiles
CREATE INDEX IF NOT EXISTS idx_risk_profiles_score ON risk_profiles(risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_risk_profiles_assessment ON risk_profiles(last_assessment DESC);

-- ============================================================================
-- Anomalies
-- ============================================================================
-- Stores detected anomalies in wallet transactions
CREATE TABLE IF NOT EXISTS anomalies (
  id SERIAL PRIMARY KEY,
  transaction_signature TEXT NOT NULL REFERENCES wallet_transactions(signature) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL REFERENCES wallet_registrations(address) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  score NUMERIC(5, 2) NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for anomalies
CREATE INDEX IF NOT EXISTS idx_anomalies_wallet ON anomalies(wallet_address);
CREATE INDEX IF NOT EXISTS idx_anomalies_severity ON anomalies(severity);
CREATE INDEX IF NOT EXISTS idx_anomalies_timestamp ON anomalies(timestamp DESC);

-- ============================================================================
-- Wallet Audit Trail
-- ============================================================================
-- Tracks all access and actions on wallet data for compliance
CREATE TABLE IF NOT EXISTS wallet_audit_trail (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallet_registrations(address) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  authorization_status TEXT NOT NULL CHECK (authorization_status IN ('authorized', 'unauthorized', 'pending')),
  query_params JSONB,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for audit trail
CREATE INDEX IF NOT EXISTS idx_audit_trail_wallet ON wallet_audit_trail(wallet_address);
CREATE INDEX IF NOT EXISTS idx_audit_trail_agent ON wallet_audit_trail(agent_id);
CREATE INDEX IF NOT EXISTS idx_audit_trail_timestamp ON wallet_audit_trail(timestamp DESC);

-- ============================================================================
-- Cost Basis Tracking
-- ============================================================================
-- Tracks cost basis for PnL calculations using FIFO method
CREATE TABLE IF NOT EXISTS cost_basis (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES wallet_registrations(address) ON DELETE CASCADE,
  token_mint TEXT NOT NULL,
  amount NUMERIC(20, 8) NOT NULL,
  cost_per_token NUMERIC(20, 8) NOT NULL,
  total_cost NUMERIC(20, 2) NOT NULL,
  acquired_at BIGINT NOT NULL,
  transaction_signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for cost basis
CREATE INDEX IF NOT EXISTS idx_cost_basis_wallet ON cost_basis(wallet_address);
CREATE INDEX IF NOT EXISTS idx_cost_basis_token ON cost_basis(token_mint);
CREATE INDEX IF NOT EXISTS idx_cost_basis_acquired ON cost_basis(acquired_at);
CREATE INDEX IF NOT EXISTS idx_cost_basis_composite ON cost_basis(wallet_address, token_mint, acquired_at);

-- ============================================================================
-- Malicious Addresses
-- ============================================================================
-- Tracks known malicious addresses for risk assessment
CREATE TABLE IF NOT EXISTS malicious_addresses (
  address TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  reported_by TEXT,
  reported_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Indexes for malicious addresses
CREATE INDEX IF NOT EXISTS idx_malicious_addresses_severity ON malicious_addresses(severity);

-- ============================================================================
-- Comments for Documentation
-- ============================================================================

COMMENT ON TABLE wallet_registrations IS 'Tracks registered wallets and their indexing status for the Memory Service';
COMMENT ON TABLE wallet_transactions IS 'Stores all indexed transactions from LYS Labs for registered wallets';
COMMENT ON TABLE wallet_balances IS 'Tracks current token balances for registered wallets with USD values';
COMMENT ON TABLE wallet_pnl IS 'Stores profit and loss analytics for different time periods (24h, 7d, 30d, all-time)';
COMMENT ON TABLE prediction_markets IS 'Stores prediction market data for futarchy governance proposals';
COMMENT ON TABLE market_snapshots IS 'Historical snapshots of prediction market odds for trend analysis';
COMMENT ON TABLE risk_profiles IS 'Risk assessment data including anomaly detection and counterparty risk';
COMMENT ON TABLE anomalies IS 'Detected anomalies in wallet transactions flagged by the Security Agent';
COMMENT ON TABLE wallet_audit_trail IS 'Audit trail of all access and actions on wallet data for compliance';
COMMENT ON TABLE cost_basis IS 'Cost basis tracking for PnL calculations using FIFO method';
COMMENT ON TABLE malicious_addresses IS 'Known malicious addresses for risk assessment and transaction flagging';

-- ============================================================================
-- Connection Pooling Configuration
-- ============================================================================
-- Note: Connection pooling is configured at the application level in the backend service
-- Recommended settings:
--   - Minimum connections: 20
--   - Maximum connections: 100
--   - Connection timeout: 30 seconds
--   - Idle timeout: 10 minutes
-- These settings are configured in backend/src/config/index.ts
