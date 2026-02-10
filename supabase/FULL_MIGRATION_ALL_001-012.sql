-- ============================================
-- FULL ARS DATABASE MIGRATION (001-012)
-- ============================================
-- COPY-PASTE FILE INI KE SUPABASE SQL EDITOR
-- URL: https://supabase.com/dashboard/project/rxomlbfffgjvjkzmryyh/editor
-- Klik "New query" → Paste semua → Klik "Run"

-- ============================================
-- STEP 1: DROP OLD TABLES (Clean Slate)
-- ============================================

DROP TABLE IF EXISTS public.disclosures CASCADE;
DROP TABLE IF EXISTS public.viewing_keys CASCADE;
DROP TABLE IF EXISTS public.mev_metrics CASCADE;
DROP TABLE IF EXISTS public.privacy_scores CASCADE;
DROP TABLE IF EXISTS public.commitments CASCADE;
DROP TABLE IF EXISTS public.payment_scan_state CASCADE;
DROP TABLE IF EXISTS public.shielded_transactions CASCADE;
DROP TABLE IF EXISTS public.stealth_addresses CASCADE;
DROP TABLE IF EXISTS public.sol_staking CASCADE;
DROP TABLE IF EXISTS public.oracle_query_fees CASCADE;
DROP TABLE IF EXISTS public.agent_staking CASCADE;
DROP TABLE IF EXISTS public.revenue_distributions CASCADE;
DROP TABLE IF EXISTS public.revenue_events CASCADE;
DROP TABLE IF EXISTS public.agent_transactions CASCADE;
DROP TABLE IF EXISTS public.votes CASCADE;
DROP TABLE IF EXISTS public.proposals CASCADE;
DROP TABLE IF EXISTS public.reserve_events CASCADE;
DROP TABLE IF EXISTS public.oracle_data CASCADE;
DROP TABLE IF EXISTS public.agents CASCADE;
DROP TABLE IF EXISTS public.ili_history CASCADE;

-- Solder Cortex Memory tables
DROP TABLE IF EXISTS public.malicious_addresses CASCADE;
DROP TABLE IF EXISTS public.cost_basis CASCADE;
DROP TABLE IF EXISTS public.wallet_audit_trail CASCADE;
DROP TABLE IF EXISTS public.anomalies CASCADE;
DROP TABLE IF EXISTS public.risk_profiles CASCADE;
DROP TABLE IF EXISTS public.market_snapshots CASCADE;
DROP TABLE IF EXISTS public.prediction_markets CASCADE;
DROP TABLE IF EXISTS public.wallet_pnl CASCADE;
DROP TABLE IF EXISTS public.wallet_balances CASCADE;
DROP TABLE IF EXISTS public.wallet_transactions CASCADE;
DROP TABLE IF EXISTS public.wallet_registrations CASCADE;

-- ============================================
-- MIGRATION 001: CREATE BASE TABLES
-- ============================================

CREATE TABLE public.ili_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    ili_value NUMERIC(20, 6) NOT NULL,
    avg_yield NUMERIC(10, 4),
    volatility NUMERIC(10, 4),
    tvl_usd NUMERIC(20, 2),
    source_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_ili_history_timestamp ON public.ili_history(timestamp DESC);

CREATE TABLE public.proposals (
    id BIGSERIAL PRIMARY KEY,
    proposer VARCHAR(44) NOT NULL,
    policy_type VARCHAR(50) NOT NULL CHECK (policy_type IN ('MintICU', 'BurnICU', 'UpdateICR', 'RebalanceVault')),
    policy_params JSONB NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    yes_stake NUMERIC(20, 0) DEFAULT 0,
    no_stake NUMERIC(20, 0) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    execution_tx VARCHAR(88),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_proposals_status ON public.proposals(status);
CREATE INDEX idx_proposals_created ON public.proposals(created_at DESC);

CREATE TABLE public.votes (
    id SERIAL PRIMARY KEY,
    proposal_id BIGINT REFERENCES public.proposals(id),
    voter VARCHAR(44) NOT NULL,
    agent_type VARCHAR(50),
    stake_amount NUMERIC(20, 0) NOT NULL,
    prediction BOOLEAN NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    claimed BOOLEAN DEFAULT FALSE,
    agent_signature VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_votes_proposal ON public.votes(proposal_id);
CREATE INDEX idx_votes_voter ON public.votes(voter);

CREATE TABLE public.agents (
    id SERIAL PRIMARY KEY,
    agent_pubkey VARCHAR(44) UNIQUE NOT NULL,
    agent_type VARCHAR(50) NOT NULL CHECK (agent_type IN (
        'lending', 'yield', 'liquidity', 'prediction', 'arbitrage', 'treasury',
        'policy', 'oracle', 'defi', 'governance', 'risk', 'execution', 
        'payment', 'monitoring', 'learning', 'security'
    )),
    total_transactions BIGINT DEFAULT 0,
    total_volume NUMERIC(20, 2) DEFAULT 0,
    reputation_score INTEGER DEFAULT 0,
    registered_at TIMESTAMPTZ NOT NULL,
    last_active TIMESTAMPTZ NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agents_pubkey ON public.agents(agent_pubkey);
CREATE INDEX idx_agents_type ON public.agents(agent_type);

CREATE TABLE public.reserve_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    from_asset VARCHAR(50),
    to_asset VARCHAR(50),
    amount NUMERIC(20, 6),
    vhr_before NUMERIC(10, 4),
    vhr_after NUMERIC(10, 4),
    transaction_signature VARCHAR(88),
    timestamp TIMESTAMPTZ NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_reserve_events_type ON public.reserve_events(event_type);
CREATE INDEX idx_reserve_events_timestamp ON public.reserve_events(timestamp DESC);

CREATE TABLE public.oracle_data (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    value NUMERIC(20, 6) NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_source_time ON public.oracle_data(source, timestamp DESC);
CREATE INDEX idx_oracle_data_type ON public.oracle_data(data_type, timestamp DESC);

ALTER TABLE public.ili_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_data ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ILI history viewable by everyone" ON public.ili_history FOR SELECT USING (true);
CREATE POLICY "Proposals viewable by everyone" ON public.proposals FOR SELECT USING (true);
CREATE POLICY "Votes viewable by everyone" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Agents viewable by everyone" ON public.agents FOR SELECT USING (true);
CREATE POLICY "Reserve events viewable by everyone" ON public.reserve_events FOR SELECT USING (true);
CREATE POLICY "Oracle data viewable by everyone" ON public.oracle_data FOR SELECT USING (true);

CREATE POLICY "ILI history writable by service" ON public.ili_history FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Proposals writable by service" ON public.proposals FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Votes writable by authenticated" ON public.votes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Agents writable by authenticated" ON public.agents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Reserve events writable by service" ON public.reserve_events FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Oracle data writable by service" ON public.oracle_data FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- MIGRATION 002: ADD REVENUE AND STAKING
-- ============================================

CREATE TABLE public.agent_transactions (
    id SERIAL PRIMARY KEY,
    agent_pubkey VARCHAR(44) NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    protocol VARCHAR(50),
    asset VARCHAR(20),
    amount NUMERIC(20, 6),
    fee_amount NUMERIC(20, 6),
    transaction_signature VARCHAR(88),
    timestamp TIMESTAMPTZ NOT NULL,
    success BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_tx_pubkey ON public.agent_transactions(agent_pubkey);
CREATE INDEX idx_agent_tx_timestamp ON public.agent_transactions(timestamp DESC);
CREATE INDEX idx_agent_tx_type ON public.agent_transactions(transaction_type);

CREATE TABLE public.revenue_events (
    id SERIAL PRIMARY KEY,
    revenue_type VARCHAR(50) NOT NULL CHECK (revenue_type IN (
        'transaction_fee',
        'oracle_query_fee',
        'er_session_fee',
        'ai_usage_markup',
        'proposal_fee',
        'vault_management_fee',
        'slashing_penalty'
    )),
    agent_pubkey VARCHAR(44),
    amount_usd NUMERIC(20, 6) NOT NULL,
    amount_icu NUMERIC(20, 6),
    timestamp TIMESTAMPTZ NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revenue_type ON public.revenue_events(revenue_type);
CREATE INDEX idx_revenue_timestamp ON public.revenue_events(timestamp DESC);
CREATE INDEX idx_revenue_agent ON public.revenue_events(agent_pubkey);

CREATE TABLE public.revenue_distributions (
    id SERIAL PRIMARY KEY,
    distribution_date TIMESTAMPTZ NOT NULL,
    total_revenue NUMERIC(20, 6) NOT NULL,
    buyback_amount NUMERIC(20, 6) NOT NULL,
    staking_rewards NUMERIC(20, 6) NOT NULL,
    development_fund NUMERIC(20, 6) NOT NULL,
    insurance_fund NUMERIC(20, 6) NOT NULL,
    icu_burned NUMERIC(20, 6),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_revenue_dist_date ON public.revenue_distributions(distribution_date DESC);

CREATE TABLE public.agent_staking (
    id SERIAL PRIMARY KEY,
    agent_pubkey VARCHAR(44) NOT NULL,
    staked_icu NUMERIC(20, 6) NOT NULL,
    staking_start TIMESTAMPTZ NOT NULL,
    staking_end TIMESTAMPTZ,
    rewards_claimed NUMERIC(20, 6) DEFAULT 0,
    fee_discount_active BOOLEAN DEFAULT TRUE,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_agent_staking_pubkey ON public.agent_staking(agent_pubkey);
CREATE INDEX idx_agent_staking_active ON public.agent_staking(agent_pubkey) WHERE staking_end IS NULL;

CREATE TABLE public.sol_staking (
    id SERIAL PRIMARY KEY,
    agent_pubkey VARCHAR(44) NOT NULL,
    stake_account VARCHAR(44) NOT NULL,
    staked_sol NUMERIC(20, 6) NOT NULL,
    validator_pubkey VARCHAR(44) NOT NULL,
    staking_start TIMESTAMPTZ NOT NULL,
    staking_end TIMESTAMPTZ,
    rewards_claimed NUMERIC(20, 6) DEFAULT 0,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_sol_staking_pubkey ON public.sol_staking(agent_pubkey);
CREATE INDEX idx_sol_staking_account ON public.sol_staking(stake_account);

CREATE TABLE public.oracle_query_fees (
    id SERIAL PRIMARY KEY,
    agent_pubkey VARCHAR(44) NOT NULL,
    query_type VARCHAR(20) NOT NULL CHECK (query_type IN ('basic', 'realtime', 'premium')),
    fee_amount NUMERIC(10, 6) NOT NULL,
    oracle_source VARCHAR(50),
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_oracle_fees_agent ON public.oracle_query_fees(agent_pubkey);
CREATE INDEX idx_oracle_fees_timestamp ON public.oracle_query_fees(timestamp DESC);

ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS total_fees_paid NUMERIC(20, 6) DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS is_staking BOOLEAN DEFAULT FALSE;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS staked_icu NUMERIC(20, 6) DEFAULT 0;
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS proposal_fee NUMERIC(20, 6) DEFAULT 10;

ALTER TABLE public.agent_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_staking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sol_staking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_query_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Agent transactions viewable by everyone" ON public.agent_transactions FOR SELECT USING (true);
CREATE POLICY "Revenue events viewable by everyone" ON public.revenue_events FOR SELECT USING (true);
CREATE POLICY "Revenue distributions viewable by everyone" ON public.revenue_distributions FOR SELECT USING (true);
CREATE POLICY "Agent staking viewable by everyone" ON public.agent_staking FOR SELECT USING (true);
CREATE POLICY "SOL staking viewable by everyone" ON public.sol_staking FOR SELECT USING (true);
CREATE POLICY "Oracle fees viewable by everyone" ON public.oracle_query_fees FOR SELECT USING (true);

CREATE POLICY "Agent transactions writable by authenticated" ON public.agent_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Revenue events writable by service" ON public.revenue_events FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Revenue distributions writable by service" ON public.revenue_distributions FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Agent staking writable by authenticated" ON public.agent_staking FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "SOL staking writable by authenticated" ON public.sol_staking FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Oracle fees writable by service" ON public.oracle_query_fees FOR INSERT WITH CHECK (auth.role() = 'service_role');

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_agent_staking_updated_at BEFORE UPDATE ON public.agent_staking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_sol_staking_updated_at BEFORE UPDATE ON public.sol_staking
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- MIGRATION 003: STEALTH ADDRESSES
-- ============================================

CREATE TABLE public.stealth_addresses (
    id SERIAL PRIMARY KEY,
    agent_id VARCHAR(255) NOT NULL,
    meta_address JSONB NOT NULL,
    encrypted_spending_key TEXT NOT NULL,
    encrypted_viewing_key TEXT NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX idx_stealth_agent ON public.stealth_addresses(agent_id);
CREATE INDEX idx_stealth_created ON public.stealth_addresses(created_at DESC);

-- ============================================
-- MIGRATION 004: ENCRYPTION METADATA
-- ============================================

ALTER TABLE public.stealth_addresses ADD COLUMN IF NOT EXISTS spending_private_key_iv TEXT;
ALTER TABLE public.stealth_addresses ADD COLUMN IF NOT EXISTS spending_private_key_tag TEXT;
ALTER TABLE public.stealth_addresses ADD COLUMN IF NOT EXISTS spending_private_key_salt TEXT;
ALTER TABLE public.stealth_addresses ADD COLUMN IF NOT EXISTS viewing_private_key_iv TEXT;
ALTER TABLE public.stealth_addresses ADD COLUMN IF NOT EXISTS viewing_private_key_tag TEXT;
ALTER TABLE public.stealth_addresses ADD COLUMN IF NOT EXISTS viewing_private_key_salt TEXT;

-- ============================================
-- MIGRATION 005: SHIELDED TRANSACTIONS
-- ============================================

CREATE TABLE public.shielded_transactions (
  id SERIAL PRIMARY KEY,
  tx_signature VARCHAR(255) UNIQUE NOT NULL,
  sender VARCHAR(255) NOT NULL,
  stealth_address VARCHAR(255) NOT NULL,
  ephemeral_public_key VARCHAR(255) NOT NULL,
  commitment TEXT NOT NULL,
  amount_encrypted TEXT NOT NULL,
  viewing_key_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  claimed_at TIMESTAMP,
  CONSTRAINT chk_status CHECK (status IN ('pending', 'confirmed', 'claimed', 'failed'))
);

CREATE INDEX idx_shielded_sender ON public.shielded_transactions(sender);
CREATE INDEX idx_shielded_stealth ON public.shielded_transactions(stealth_address);
CREATE INDEX idx_shielded_status ON public.shielded_transactions(status);
CREATE INDEX idx_shielded_created ON public.shielded_transactions(created_at DESC);

-- ============================================
-- MIGRATION 006: PAYMENT SCAN STATE
-- ============================================

CREATE TABLE public.payment_scan_state (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(255) UNIQUE NOT NULL,
  last_scanned_slot BIGINT NOT NULL DEFAULT 0,
  last_scan_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE UNIQUE INDEX idx_payment_scan_agent ON public.payment_scan_state(agent_id);
CREATE INDEX idx_payment_scan_last_scan ON public.payment_scan_state(last_scan_at DESC);

CREATE OR REPLACE FUNCTION update_payment_scan_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER payment_scan_state_updated_at_trigger
  BEFORE UPDATE ON public.payment_scan_state
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_scan_state_updated_at();

-- ============================================
-- MIGRATION 007: COMMITMENTS
-- ============================================

CREATE TABLE public.commitments (
  id SERIAL PRIMARY KEY,
  commitment TEXT NOT NULL,
  encrypted_blinding_factor TEXT NOT NULL,
  value TEXT NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP
);

CREATE INDEX idx_commitment_created ON public.commitments(created_at DESC);

-- ============================================
-- MIGRATION 008: PRIVACY SCORES
-- ============================================

CREATE TABLE public.privacy_scores (
  id SERIAL PRIMARY KEY,
  address VARCHAR(255) NOT NULL,
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100),
  grade VARCHAR(2) NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'F')),
  factors JSONB NOT NULL,
  recommendations JSONB,
  analyzed_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_privacy_address ON public.privacy_scores(address);
CREATE INDEX idx_privacy_score ON public.privacy_scores(score);
CREATE INDEX idx_privacy_analyzed ON public.privacy_scores(analyzed_at DESC);

-- ============================================
-- MIGRATION 009: MEV METRICS
-- ============================================

CREATE TABLE public.mev_metrics (
  id SERIAL PRIMARY KEY,
  vault_id VARCHAR(255) NOT NULL,
  tx_signature VARCHAR(255) NOT NULL,
  mev_extracted NUMERIC(20, 6) NOT NULL,
  privacy_score INTEGER NOT NULL CHECK (privacy_score >= 0 AND privacy_score <= 100),
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_mev_vault ON public.mev_metrics(vault_id);
CREATE INDEX idx_mev_timestamp ON public.mev_metrics(timestamp DESC);

-- ============================================
-- MIGRATION 010: VIEWING KEYS
-- ============================================

CREATE TABLE public.viewing_keys (
  id SERIAL PRIMARY KEY,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  encrypted_key TEXT NOT NULL,
  path VARCHAR(255) NOT NULL,
  parent_hash VARCHAR(255),
  role VARCHAR(50),
  expires_at TIMESTAMP,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP,
  CONSTRAINT fk_parent_hash FOREIGN KEY (parent_hash) 
    REFERENCES public.viewing_keys(key_hash) 
    ON DELETE SET NULL
);

CREATE INDEX idx_viewing_hash ON public.viewing_keys(key_hash);
CREATE INDEX idx_viewing_role ON public.viewing_keys(role);
CREATE INDEX idx_viewing_expires ON public.viewing_keys(expires_at);

-- ============================================
-- MIGRATION 011: DISCLOSURES
-- ============================================

CREATE TABLE public.disclosures (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL,
  auditor_id VARCHAR(255) NOT NULL,
  viewing_key_hash VARCHAR(255) NOT NULL,
  encrypted_data TEXT NOT NULL,
  disclosed_fields JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP,
  CONSTRAINT fk_transaction_id FOREIGN KEY (transaction_id) 
    REFERENCES public.shielded_transactions(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_viewing_key_hash FOREIGN KEY (viewing_key_hash) 
    REFERENCES public.viewing_keys(key_hash) 
    ON DELETE RESTRICT
);

CREATE INDEX idx_disclosure_auditor ON public.disclosures(auditor_id);
CREATE INDEX idx_disclosure_expires ON public.disclosures(expires_at);
CREATE INDEX idx_disclosure_created ON public.disclosures(created_at DESC);

-- ============================================
-- MIGRATION 012: SOLDER CORTEX MEMORY TABLES
-- ============================================

CREATE TABLE public.wallet_registrations (
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

CREATE INDEX idx_wallet_registrations_status ON public.wallet_registrations(indexing_status);
CREATE INDEX idx_wallet_registrations_agent ON public.wallet_registrations(agent_id);

CREATE TABLE public.wallet_transactions (
  signature TEXT PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES public.wallet_registrations(address) ON DELETE CASCADE,
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

CREATE INDEX idx_wallet_transactions_address ON public.wallet_transactions(wallet_address);
CREATE INDEX idx_wallet_transactions_timestamp ON public.wallet_transactions(timestamp DESC);
CREATE INDEX idx_wallet_transactions_type ON public.wallet_transactions(transaction_type);
CREATE INDEX idx_wallet_transactions_token ON public.wallet_transactions(token_mint);
CREATE INDEX idx_wallet_transactions_composite ON public.wallet_transactions(wallet_address, timestamp DESC);

CREATE TABLE public.wallet_balances (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES public.wallet_registrations(address) ON DELETE CASCADE,
  token_mint TEXT NOT NULL,
  token_symbol TEXT NOT NULL,
  amount NUMERIC(20, 8) NOT NULL,
  usd_value NUMERIC(20, 2),
  last_updated BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(wallet_address, token_mint)
);

CREATE INDEX idx_wallet_balances_address ON public.wallet_balances(wallet_address);
CREATE INDEX idx_wallet_balances_token ON public.wallet_balances(token_mint);

CREATE TABLE public.wallet_pnl (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES public.wallet_registrations(address) ON DELETE CASCADE,
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

CREATE INDEX idx_wallet_pnl_address ON public.wallet_pnl(wallet_address);
CREATE INDEX idx_wallet_pnl_period ON public.wallet_pnl(period);
CREATE INDEX idx_wallet_pnl_calculated ON public.wallet_pnl(calculated_at DESC);

CREATE TABLE public.prediction_markets (
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

CREATE INDEX idx_prediction_markets_proposal ON public.prediction_markets(proposal_id);
CREATE INDEX idx_prediction_markets_updated ON public.prediction_markets(last_updated DESC);

CREATE TABLE public.market_snapshots (
  id SERIAL PRIMARY KEY,
  market_address TEXT NOT NULL REFERENCES public.prediction_markets(market_address) ON DELETE CASCADE,
  outcomes JSONB NOT NULL,
  total_volume NUMERIC(20, 2) NOT NULL,
  total_liquidity NUMERIC(20, 2) NOT NULL,
  snapshot_timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_market_snapshots_market ON public.market_snapshots(market_address);
CREATE INDEX idx_market_snapshots_timestamp ON public.market_snapshots(snapshot_timestamp DESC);

CREATE TABLE public.risk_profiles (
  wallet_address TEXT PRIMARY KEY REFERENCES public.wallet_registrations(address) ON DELETE CASCADE,
  risk_score NUMERIC(5, 2) NOT NULL CHECK (risk_score >= 0 AND risk_score <= 100),
  anomaly_count INTEGER DEFAULT 0,
  high_risk_transaction_percentage NUMERIC(5, 2),
  counterparty_risk NUMERIC(5, 2),
  risk_factors JSONB NOT NULL,
  last_assessment BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_risk_profiles_score ON public.risk_profiles(risk_score DESC);
CREATE INDEX idx_risk_profiles_assessment ON public.risk_profiles(last_assessment DESC);

CREATE TABLE public.anomalies (
  id SERIAL PRIMARY KEY,
  transaction_signature TEXT NOT NULL REFERENCES public.wallet_transactions(signature) ON DELETE CASCADE,
  wallet_address TEXT NOT NULL REFERENCES public.wallet_registrations(address) ON DELETE CASCADE,
  anomaly_type TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  description TEXT NOT NULL,
  score NUMERIC(5, 2) NOT NULL,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_anomalies_wallet ON public.anomalies(wallet_address);
CREATE INDEX idx_anomalies_severity ON public.anomalies(severity);
CREATE INDEX idx_anomalies_timestamp ON public.anomalies(timestamp DESC);

CREATE TABLE public.wallet_audit_trail (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES public.wallet_registrations(address) ON DELETE CASCADE,
  action_type TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  authorization_status TEXT NOT NULL CHECK (authorization_status IN ('authorized', 'unauthorized', 'pending')),
  query_params JSONB,
  timestamp BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_audit_trail_wallet ON public.wallet_audit_trail(wallet_address);
CREATE INDEX idx_audit_trail_agent ON public.wallet_audit_trail(agent_id);
CREATE INDEX idx_audit_trail_timestamp ON public.wallet_audit_trail(timestamp DESC);

CREATE TABLE public.cost_basis (
  id SERIAL PRIMARY KEY,
  wallet_address TEXT NOT NULL REFERENCES public.wallet_registrations(address) ON DELETE CASCADE,
  token_mint TEXT NOT NULL,
  amount NUMERIC(20, 8) NOT NULL,
  cost_per_token NUMERIC(20, 8) NOT NULL,
  total_cost NUMERIC(20, 2) NOT NULL,
  acquired_at BIGINT NOT NULL,
  transaction_signature TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_cost_basis_wallet ON public.cost_basis(wallet_address);
CREATE INDEX idx_cost_basis_token ON public.cost_basis(token_mint);
CREATE INDEX idx_cost_basis_acquired ON public.cost_basis(acquired_at);
CREATE INDEX idx_cost_basis_composite ON public.cost_basis(wallet_address, token_mint, acquired_at);

CREATE TABLE public.malicious_addresses (
  address TEXT PRIMARY KEY,
  reason TEXT NOT NULL,
  severity TEXT NOT NULL CHECK (severity IN ('low', 'medium', 'high', 'critical')),
  reported_by TEXT,
  reported_at BIGINT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_malicious_addresses_severity ON public.malicious_addresses(severity);

-- ============================================
-- VERIFICATION
-- ============================================

SELECT 'All migrations (001-012) completed successfully!' as status;

SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
AND table_type = 'BASE TABLE'
ORDER BY table_name;
