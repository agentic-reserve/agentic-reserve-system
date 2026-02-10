-- Migration: Create Base ARS Tables
-- Date: 2026-02-04
-- Description: Creates core tables for ARS protocol (proposals, votes, agents, ILI history)

-- ============================================
-- ILI HISTORY TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ili_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL,
    ili_value NUMERIC(20, 6) NOT NULL,
    avg_yield NUMERIC(10, 4),
    volatility NUMERIC(10, 4),
    tvl_usd NUMERIC(20, 2),
    source_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ili_history_timestamp ON public.ili_history(timestamp DESC);

-- ============================================
-- PROPOSALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.proposals (
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

CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created ON public.proposals(created_at DESC);

-- ============================================
-- VOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.votes (
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

CREATE INDEX IF NOT EXISTS idx_votes_proposal ON public.votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_votes_voter ON public.votes(voter);

-- ============================================
-- AGENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agents (
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

CREATE INDEX IF NOT EXISTS idx_agents_pubkey ON public.agents(agent_pubkey);
CREATE INDEX IF NOT EXISTS idx_agents_type ON public.agents(agent_type);

-- ============================================
-- RESERVE EVENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.reserve_events (
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

CREATE INDEX IF NOT EXISTS idx_reserve_events_type ON public.reserve_events(event_type);
CREATE INDEX IF NOT EXISTS idx_reserve_events_timestamp ON public.reserve_events(timestamp DESC);

-- ============================================
-- ORACLE DATA TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.oracle_data (
    id SERIAL PRIMARY KEY,
    source VARCHAR(50) NOT NULL,
    data_type VARCHAR(50) NOT NULL,
    value NUMERIC(20, 6) NOT NULL,
    metadata JSONB,
    timestamp TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_oracle_source_time ON public.oracle_data(source, timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_oracle_data_type ON public.oracle_data(data_type, timestamp DESC);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

-- Enable RLS
ALTER TABLE public.ili_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_data ENABLE ROW LEVEL SECURITY;

-- Public read policies
CREATE POLICY "ILI history viewable by everyone" ON public.ili_history FOR SELECT USING (true);
CREATE POLICY "Proposals viewable by everyone" ON public.proposals FOR SELECT USING (true);
CREATE POLICY "Votes viewable by everyone" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Agents viewable by everyone" ON public.agents FOR SELECT USING (true);
CREATE POLICY "Reserve events viewable by everyone" ON public.reserve_events FOR SELECT USING (true);
CREATE POLICY "Oracle data viewable by everyone" ON public.oracle_data FOR SELECT USING (true);

-- Service role write policies
CREATE POLICY "ILI history writable by service" ON public.ili_history FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Proposals writable by service" ON public.proposals FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Votes writable by authenticated" ON public.votes FOR INSERT WITH CHECK (auth.role() = 'authenticated');
CREATE POLICY "Agents writable by authenticated" ON public.agents FOR ALL USING (auth.role() = 'authenticated');
CREATE POLICY "Reserve events writable by service" ON public.reserve_events FOR INSERT WITH CHECK (auth.role() = 'service_role');
CREATE POLICY "Oracle data writable by service" ON public.oracle_data FOR INSERT WITH CHECK (auth.role() = 'service_role');

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

ALTER PUBLICATION supabase_realtime ADD TABLE public.ili_history;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.agents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.reserve_events;
ALTER PUBLICATION supabase_realtime ADD TABLE public.oracle_data;

-- ============================================
-- GRANT PERMISSIONS
-- ============================================

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Base ARS tables created successfully!';
END $$;
