-- Internet Capital Bank - Database Initialization
-- This script sets up the database schema and Row Level Security

-- Enable necessary extensions
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- Create schemas
CREATE SCHEMA IF NOT EXISTS public;
CREATE SCHEMA IF NOT EXISTS auth;
CREATE SCHEMA IF NOT EXISTS storage;
CREATE SCHEMA IF NOT EXISTS realtime;

-- ============================================
-- AGENTS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.agents (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    pubkey TEXT UNIQUE NOT NULL,
    agent_type TEXT NOT NULL CHECK (agent_type IN ('lending', 'yield', 'liquidity', 'prediction', 'arbitrage', 'treasury')),
    name TEXT,
    description TEXT,
    total_transactions BIGINT DEFAULT 0,
    total_volume BIGINT DEFAULT 0,
    reputation_score INTEGER DEFAULT 0,
    registered_at TIMESTAMPTZ DEFAULT NOW(),
    last_active TIMESTAMPTZ DEFAULT NOW(),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- PROPOSALS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.proposals (
    id BIGINT PRIMARY KEY,
    proposer_pubkey TEXT NOT NULL,
    policy_type TEXT NOT NULL CHECK (policy_type IN ('mint_icu', 'burn_icu', 'update_icr', 'rebalance_vault')),
    policy_params JSONB NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    yes_stake BIGINT DEFAULT 0,
    no_stake BIGINT DEFAULT 0,
    status TEXT NOT NULL CHECK (status IN ('active', 'passed', 'failed', 'executed', 'cancelled')),
    passed_at TIMESTAMPTZ,
    execution_tx TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- VOTES TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.votes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    proposal_id BIGINT NOT NULL REFERENCES public.proposals(id),
    agent_pubkey TEXT NOT NULL,
    stake_amount BIGINT NOT NULL,
    prediction BOOLEAN NOT NULL,
    signature TEXT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    claimed BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(proposal_id, agent_pubkey)
);

-- ============================================
-- ILI ORACLE DATA TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.ili_snapshots (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    ili_value BIGINT NOT NULL,
    avg_yield INTEGER NOT NULL,
    volatility INTEGER NOT NULL,
    tvl BIGINT NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    slot BIGINT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- TRANSACTIONS TABLE
-- ============================================
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    signature TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL,
    agent_pubkey TEXT,
    amount BIGINT,
    status TEXT NOT NULL CHECK (status IN ('pending', 'confirmed', 'failed')),
    metadata JSONB DEFAULT '{}',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    confirmed_at TIMESTAMPTZ
);

-- ============================================
-- INDEXES
-- ============================================
CREATE INDEX IF NOT EXISTS idx_agents_pubkey ON public.agents(pubkey);
CREATE INDEX IF NOT EXISTS idx_agents_type ON public.agents(agent_type);
CREATE INDEX IF NOT EXISTS idx_agents_reputation ON public.agents(reputation_score DESC);
CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_end_time ON public.proposals(end_time);
CREATE INDEX IF NOT EXISTS idx_votes_proposal ON public.votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_votes_agent ON public.votes(agent_pubkey);
CREATE INDEX IF NOT EXISTS idx_ili_timestamp ON public.ili_snapshots(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_signature ON public.transactions(signature);
CREATE INDEX IF NOT EXISTS idx_transactions_agent ON public.transactions(agent_pubkey);

-- ============================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================

-- Enable RLS on all tables
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ili_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;

-- Agents: Public read, authenticated write
CREATE POLICY "Agents are viewable by everyone" 
    ON public.agents FOR SELECT 
    USING (true);

CREATE POLICY "Agents can be created by authenticated users" 
    ON public.agents FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "Agents can be updated by their owner" 
    ON public.agents FOR UPDATE 
    USING (auth.uid()::text = id::text);

-- Proposals: Public read, authenticated write
CREATE POLICY "Proposals are viewable by everyone" 
    ON public.proposals FOR SELECT 
    USING (true);

CREATE POLICY "Proposals can be created by authenticated users" 
    ON public.proposals FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- Votes: Public read, authenticated write
CREATE POLICY "Votes are viewable by everyone" 
    ON public.votes FOR SELECT 
    USING (true);

CREATE POLICY "Votes can be created by authenticated users" 
    ON public.votes FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- ILI Snapshots: Public read, service role write
CREATE POLICY "ILI snapshots are viewable by everyone" 
    ON public.ili_snapshots FOR SELECT 
    USING (true);

CREATE POLICY "ILI snapshots can be created by service role" 
    ON public.ili_snapshots FOR INSERT 
    WITH CHECK (auth.role() = 'service_role');

-- Transactions: Public read, authenticated write
CREATE POLICY "Transactions are viewable by everyone" 
    ON public.transactions FOR SELECT 
    USING (true);

CREATE POLICY "Transactions can be created by authenticated users" 
    ON public.transactions FOR INSERT 
    WITH CHECK (auth.role() = 'authenticated');

-- ============================================
-- REALTIME SUBSCRIPTIONS
-- ============================================

-- Enable realtime for all tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.agents;
ALTER PUBLICATION supabase_realtime ADD TABLE public.proposals;
ALTER PUBLICATION supabase_realtime ADD TABLE public.votes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.ili_snapshots;
ALTER PUBLICATION supabase_realtime ADD TABLE public.transactions;

-- ============================================
-- FUNCTIONS AND TRIGGERS
-- ============================================

-- Update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = NOW();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at trigger to tables
CREATE TRIGGER update_agents_updated_at BEFORE UPDATE ON public.agents
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_proposals_updated_at BEFORE UPDATE ON public.proposals
    FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- SEED DATA (Optional - for development)
-- ============================================

-- Insert sample agent types for reference
COMMENT ON COLUMN public.agents.agent_type IS 'Agent types: lending, yield, liquidity, prediction, arbitrage, treasury';
COMMENT ON COLUMN public.proposals.policy_type IS 'Policy types: mint_icu, burn_icu, update_icr, rebalance_vault';
COMMENT ON COLUMN public.proposals.status IS 'Proposal status: active, passed, failed, executed, cancelled';

-- Grant permissions
GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL FUNCTIONS IN SCHEMA public TO anon, authenticated, service_role;

-- Success message
DO $$
BEGIN
    RAISE NOTICE 'Internet Capital Bank database initialized successfully!';
END $$;
