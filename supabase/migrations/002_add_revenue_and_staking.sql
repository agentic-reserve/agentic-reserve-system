-- Migration: Add Revenue Tracking and Staking Tables
-- Date: 2026-02-04
-- Description: Adds tables for revenue tracking, agent staking, and agent transactions

-- ============================================
-- AGENT TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_transactions (
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

CREATE INDEX IF NOT EXISTS idx_agent_tx_pubkey ON public.agent_transactions(agent_pubkey);
CREATE INDEX IF NOT EXISTS idx_agent_tx_timestamp ON public.agent_transactions(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_agent_tx_type ON public.agent_transactions(transaction_type);

-- ============================================
-- REVENUE EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.revenue_events (
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

CREATE INDEX IF NOT EXISTS idx_revenue_type ON public.revenue_events(revenue_type);
CREATE INDEX IF NOT EXISTS idx_revenue_timestamp ON public.revenue_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_agent ON public.revenue_events(agent_pubkey);

-- ============================================
-- REVENUE DISTRIBUTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.revenue_distributions (
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

CREATE INDEX IF NOT EXISTS idx_revenue_dist_date ON public.revenue_distributions(distribution_date DESC);

-- ============================================
-- AGENT STAKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agent_staking (
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

CREATE INDEX IF NOT EXISTS idx_agent_staking_pubkey ON public.agent_staking(agent_pubkey);
CREATE INDEX IF NOT EXISTS idx_agent_staking_active ON public.agent_staking(agent_pubkey) WHERE staking_end IS NULL;

-- ============================================
-- SOL STAKING TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.sol_staking (
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

CREATE INDEX IF NOT EXISTS idx_sol_staking_pubkey ON public.sol_staking(agent_pubkey);
CREATE INDEX IF NOT EXISTS idx_sol_staking_account ON public.sol_staking(stake_account);

-- ============================================
-- ORACLE QUERY FEES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.oracle_query_fees (
    id SERIAL PRIMARY KEY,
    agent_pubkey VARCHAR(44) NOT NULL,
    query_type VARCHAR(20) NOT NULL CHECK (query_type IN ('basic', 'realtime', 'premium')),
    fee_amount NUMERIC(10, 6) NOT NULL,
    oracle_source VARCHAR(50),
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oracle_fees_agent ON public.oracle_query_fees(agent_pubkey);
CREATE INDEX IF NOT EXISTS idx_oracle_fees_timestamp ON public.oracle_query_fees(timestamp DESC);

-- ============================================
-- UPDATE AGENTS TABLE
-- ============================================
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS total_fees_paid NUMERIC(20, 6) DEFAULT 0;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS is_staking BOOLEAN DEFAULT FALSE;
ALTER TABLE public.agents ADD COLUMN IF NOT EXISTS staked_icu NUMERIC(20, 6) DEFAULT 0;

-- ============================================
-- UPDATE PROPOSALS TABLE
-- ============================================
ALTER TABLE public.proposals ADD COLUMN IF NOT EXISTS proposal_fee NUMERIC(20, 6) DEFAULT 10;

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS on new tables
ALTER TABLE public.agent_transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_distributions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_staking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.sol_staking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_query_fees ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "Agent transactions viewable by everyone" ON public.agent_transactions FOR SELECT USING (true);
CREATE POLICY "Revenue events viewable by everyone" ON public.revenue_events FOR SELECT USING (true);
CREATE POLICY "Revenue distributions viewable by everyone" ON public.revenue_distributions FOR SELECT USING (true);
CREATE POLICY "Agent staking viewable by everyone" ON public.agent_staking FOR SELECT USING (true);
CREATE POLICY "SOL staking viewable by everyone" ON public.sol_staking FOR SELECT USING (true);
CREATE POLICY "Oracle fees viewable by everyone" ON public.oracle_query_fees FOR SELECT USING (true);

-- Service role write policies
CREATE POLICY "Agent transactions writable by authenticated" ON public.agent_transactions FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Revenue events writable by service" ON public.revenue_events FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Revenue distributions writable by service" ON public.revenue_distributions FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Agent staking writable by authenticated" ON public.agent_staking FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "SOL staking writable by authenticated" ON public.sol_staking FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Oracle fees writable by service" ON public.oracle_query_fees FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_transactions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.revenue_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.revenue_distributions;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agent_staking;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sol_staking;

-- ============================================
-- TRIGGERS
-- ============================================

-- Create update_updated_at_column function if not exists
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
-- GRANT PERMISSIONS
-- ============================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Revenue tracking and staking tables created successfully!';
END $$;
