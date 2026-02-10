-- ============================================
-- RESET DATABASE SCRIPT
-- ============================================
-- WARNING: This will DELETE ALL DATA and DROP ALL TABLES
-- Use this to reset your database to a clean state before running migrations

-- Drop all policies first
DROP POLICY IF EXISTS "ILI history viewable by everyone" ON public.ili_history;
DROP POLICY IF EXISTS "Proposals viewable by everyone" ON public.proposals;
DROP POLICY IF EXISTS "Votes viewable by everyone" ON public.votes;
DROP POLICY IF EXISTS "Agents viewable by everyone" ON public.agents;
DROP POLICY IF EXISTS "Reserve events viewable by everyone" ON public.reserve_events;
DROP POLICY IF EXISTS "Oracle data viewable by everyone" ON public.oracle_data;
DROP POLICY IF EXISTS "Agent transactions viewable by everyone" ON public.agent_transactions;
DROP POLICY IF EXISTS "Revenue events viewable by everyone" ON public.revenue_events;
DROP POLICY IF EXISTS "Revenue distributions viewable by everyone" ON public.revenue_distributions;
DROP POLICY IF EXISTS "Agent staking viewable by everyone" ON public.agent_staking;
DROP POLICY IF EXISTS "SOL staking viewable by everyone" ON public.sol_staking;
DROP POLICY IF EXISTS "Oracle fees viewable by everyone" ON public.oracle_query_fees;

DROP POLICY IF EXISTS "ILI history writable by service" ON public.ili_history;
DROP POLICY IF EXISTS "Proposals writable by service" ON public.proposals;
DROP POLICY IF EXISTS "Votes writable by authenticated" ON public.votes;
DROP POLICY IF EXISTS "Agents writable by authenticated" ON public.agents;
DROP POLICY IF EXISTS "Reserve events writable by service" ON public.reserve_events;
DROP POLICY IF EXISTS "Oracle data writable by service" ON public.oracle_data;
DROP POLICY IF EXISTS "Agent transactions writable by authenticated" ON public.agent_transactions;
DROP POLICY IF EXISTS "Revenue events writable by service" ON public.revenue_events;
DROP POLICY IF EXISTS "Revenue distributions writable by service" ON public.revenue_distributions;
DROP POLICY IF EXISTS "Agent staking writable by authenticated" ON public.agent_staking;
DROP POLICY IF EXISTS "SOL staking writable by authenticated" ON public.sol_staking;
DROP POLICY IF EXISTS "Oracle fees writable by service" ON public.oracle_query_fees;

DROP POLICY IF EXISTS "Allow public read access" ON public.ili_history;
DROP POLICY IF EXISTS "Allow public read access" ON public.proposals;
DROP POLICY IF EXISTS "Allow public read access" ON public.votes;
DROP POLICY IF EXISTS "Allow public read access" ON public.agents;
DROP POLICY IF EXISTS "Allow public read access" ON public.reserve_events;
DROP POLICY IF EXISTS "Allow public read access" ON public.revenue_events;
DROP POLICY IF EXISTS "Allow public read access" ON public.agent_staking;
DROP POLICY IF EXISTS "Allow public read access" ON public.oracle_data;
DROP POLICY IF EXISTS "Allow public read access" ON public.agent_transactions;

DROP POLICY IF EXISTS "Allow service role write access" ON public.ili_history;
DROP POLICY IF EXISTS "Allow service role write access" ON public.proposals;
DROP POLICY IF EXISTS "Allow service role write access" ON public.votes;
DROP POLICY IF EXISTS "Allow service role write access" ON public.agents;
DROP POLICY IF EXISTS "Allow service role write access" ON public.reserve_events;
DROP POLICY IF EXISTS "Allow service role write access" ON public.revenue_events;
DROP POLICY IF EXISTS "Allow service role write access" ON public.agent_staking;
DROP POLICY IF EXISTS "Allow service role write access" ON public.oracle_data;
DROP POLICY IF EXISTS "Allow service role write access" ON public.agent_transactions;

DROP POLICY IF EXISTS "Allow public read access on proposals" ON public.proposals;
DROP POLICY IF EXISTS "Allow public read access on votes" ON public.votes;
DROP POLICY IF EXISTS "Allow public read access on agents" ON public.agents;
DROP POLICY IF EXISTS "Allow service role write on proposals" ON public.proposals;
DROP POLICY IF EXISTS "Allow service role write on votes" ON public.votes;
DROP POLICY IF EXISTS "Allow service role write on agents" ON public.agents;

-- Drop triggers
DROP TRIGGER IF EXISTS update_agent_staking_updated_at ON public.agent_staking;
DROP TRIGGER IF EXISTS update_sol_staking_updated_at ON public.sol_staking;

-- Drop tables in reverse dependency order
DROP TABLE IF EXISTS public.disclosures CASCADE;
DROP TABLE IF EXISTS public.viewing_keys CASCADE;
DROP TABLE IF EXISTS public.mev_metrics CASCADE;
DROP TABLE IF EXISTS public.privacy_scores CASCADE;
DROP TABLE IF EXISTS public.commitments CASCADE;
DROP TABLE IF EXISTS public.payment_scan_state CASCADE;
DROP TABLE IF EXISTS public.shielded_transactions CASCADE;
DROP TABLE IF EXISTS public.stealth_addresses CASCADE;
DROP TABLE IF EXISTS public.oracle_query_fees CASCADE;
DROP TABLE IF EXISTS public.sol_staking CASCADE;
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

-- Drop functions
DROP FUNCTION IF EXISTS update_updated_at_column() CASCADE;

-- Success message
DO $$
BEGIN
    RAISE NOTICE '✅ Database reset complete! All tables dropped.';
    RAISE NOTICE '📝 Now run migrations in order: 001, 002, 003, etc.';
END $$;
