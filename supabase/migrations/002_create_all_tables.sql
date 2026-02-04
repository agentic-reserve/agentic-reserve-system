-- Create all tables for ARS database

-- ILI History Table
CREATE TABLE IF NOT EXISTS public.ili_history (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    ili_value NUMERIC(20, 6) NOT NULL,
    avg_yield NUMERIC(10, 4),
    volatility NUMERIC(10, 4),
    tvl_usd NUMERIC(20, 2),
    source_data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_ili_timestamp ON public.ili_history(timestamp DESC);

-- Proposals Table
CREATE TABLE IF NOT EXISTS public.proposals (
    id BIGSERIAL PRIMARY KEY,
    proposer VARCHAR(44) NOT NULL,
    policy_type VARCHAR(50) NOT NULL,
    policy_params JSONB NOT NULL,
    start_time TIMESTAMPTZ NOT NULL,
    end_time TIMESTAMPTZ NOT NULL,
    yes_stake NUMERIC(20, 0) DEFAULT 0,
    no_stake NUMERIC(20, 0) DEFAULT 0,
    status VARCHAR(20) NOT NULL DEFAULT 'active',
    execution_tx VARCHAR(88),
    proposal_fee NUMERIC(20, 6) DEFAULT 10,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_proposals_status ON public.proposals(status);
CREATE INDEX IF NOT EXISTS idx_proposals_created ON public.proposals(created_at DESC);

-- Votes Table
CREATE TABLE IF NOT EXISTS public.votes (
    id SERIAL PRIMARY KEY,
    proposal_id BIGINT REFERENCES public.proposals(id),
    agent_pubkey VARCHAR(44) NOT NULL,
    agent_type VARCHAR(50),
    stake_amount NUMERIC(20, 0) NOT NULL,
    prediction BOOLEAN NOT NULL,
    timestamp TIMESTAMPTZ NOT NULL,
    claimed BOOLEAN DEFAULT FALSE,
    agent_signature VARCHAR(128),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_votes_proposal ON public.votes(proposal_id);
CREATE INDEX IF NOT EXISTS idx_votes_agent ON public.votes(agent_pubkey);

-- Agents Table
CREATE TABLE IF NOT EXISTS public.agents (
    id SERIAL PRIMARY KEY,
    agent_pubkey VARCHAR(44) UNIQUE NOT NULL,
    agent_type VARCHAR(50) NOT NULL,
    total_transactions BIGINT DEFAULT 0,
    total_volume NUMERIC(20, 2) DEFAULT 0,
    total_fees_paid NUMERIC(20, 6) DEFAULT 0,
    reputation_score INTEGER DEFAULT 0,
    registered_at TIMESTAMPTZ NOT NULL,
    last_active TIMESTAMPTZ NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agents_pubkey ON public.agents(agent_pubkey);
CREATE INDEX IF NOT EXISTS idx_agents_type ON public.agents(agent_type);

-- Reserve Events Table
CREATE TABLE IF NOT EXISTS public.reserve_events (
    id SERIAL PRIMARY KEY,
    event_type VARCHAR(50) NOT NULL,
    from_asset VARCHAR(50),
    to_asset VARCHAR(50),
    amount NUMERIC(20, 6),
    vhr_before NUMERIC(10, 4),
    vhr_after NUMERIC(10, 4),
    timestamp TIMESTAMPTZ NOT NULL,
    transaction_signature VARCHAR(88),
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_reserve_events_timestamp ON public.reserve_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_reserve_events_type ON public.reserve_events(event_type);

-- Revenue Events Table
CREATE TABLE IF NOT EXISTS public.revenue_events (
    id SERIAL PRIMARY KEY,
    revenue_type VARCHAR(50) NOT NULL,
    amount_usd NUMERIC(20, 6) NOT NULL,
    agent_pubkey VARCHAR(44),
    timestamp TIMESTAMPTZ NOT NULL,
    metadata JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_revenue_events_timestamp ON public.revenue_events(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_revenue_events_type ON public.revenue_events(revenue_type);
CREATE INDEX IF NOT EXISTS idx_revenue_events_agent ON public.revenue_events(agent_pubkey);

-- Agent Staking Table
CREATE TABLE IF NOT EXISTS public.agent_staking (
    id SERIAL PRIMARY KEY,
    agent_pubkey VARCHAR(44) UNIQUE NOT NULL,
    staked_amount NUMERIC(20, 0) NOT NULL DEFAULT 0,
    rewards_earned NUMERIC(20, 6) NOT NULL DEFAULT 0,
    last_claim TIMESTAMPTZ,
    stake_timestamp TIMESTAMPTZ NOT NULL,
    unstake_cooldown TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_agent_staking_pubkey ON public.agent_staking(agent_pubkey);

-- Oracle Data Table
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

-- Agent Transactions Table
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

-- Enable Row Level Security (RLS)
ALTER TABLE public.ili_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agents ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reserve_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.revenue_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_staking ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.oracle_data ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.agent_transactions ENABLE ROW LEVEL SECURITY;

-- Create policies for public read access
CREATE POLICY "Allow public read access" ON public.ili_history FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.proposals FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.votes FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.agents FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.reserve_events FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.revenue_events FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.agent_staking FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.oracle_data FOR SELECT USING (true);
CREATE POLICY "Allow public read access" ON public.agent_transactions FOR SELECT USING (true);

-- Create policies for service role write access
CREATE POLICY "Allow service role write access" ON public.ili_history FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role write access" ON public.proposals FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role write access" ON public.votes FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role write access" ON public.agents FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role write access" ON public.reserve_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role write access" ON public.revenue_events FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role write access" ON public.agent_staking FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role write access" ON public.oracle_data FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow service role write access" ON public.agent_transactions FOR INSERT WITH CHECK (true);
