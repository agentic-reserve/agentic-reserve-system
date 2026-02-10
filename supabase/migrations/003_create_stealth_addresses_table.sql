-- Migration: Create Stealth Addresses Table for Sipher Privacy Integration
-- Date: 2026-02-04
-- Description: Creates table for storing stealth meta-addresses with encrypted private keys
-- Requirements: 5.1, 5.3 (Sipher Privacy Integration)

-- ============================================
-- STEALTH ADDRESSES TABLE
-- ============================================
-- Stores stealth meta-addresses for agents with encrypted private keys
-- Used for privacy-preserving ARU token transfers via Sipher protocol
CREATE TABLE IF NOT EXISTS public.stealth_addresses (
    id SERIAL PRIMARY KEY,
    agent_id VARCHAR(255) NOT NULL,
    meta_address JSONB NOT NULL,                    -- Contains spendingPublicKey and viewingPublicKey
    encrypted_spending_key TEXT NOT NULL,           -- AES-256 encrypted spending private key
    encrypted_viewing_key TEXT NOT NULL,            -- AES-256 encrypted viewing private key
    label VARCHAR(255),                             -- Human-readable label for the meta-address
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- ============================================
-- INDEXES
-- ============================================
-- Index on agent_id for efficient lookup of all meta-addresses for an agent
CREATE INDEX IF NOT EXISTS idx_stealth_agent ON public.stealth_addresses(agent_id);

-- Index on created_at for chronological queries (descending order)
CREATE INDEX IF NOT EXISTS idx_stealth_created ON public.stealth_addresses(created_at DESC);

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON TABLE public.stealth_addresses IS 'Stores stealth meta-addresses for agents with encrypted private keys for Sipher privacy integration';
COMMENT ON COLUMN public.stealth_addresses.agent_id IS 'Unique identifier for the agent owning this meta-address';
COMMENT ON COLUMN public.stealth_addresses.meta_address IS 'JSONB containing spendingPublicKey and viewingPublicKey (Base58 encoded)';
COMMENT ON COLUMN public.stealth_addresses.encrypted_spending_key IS 'AES-256-GCM encrypted spending private key';
COMMENT ON COLUMN public.stealth_addresses.encrypted_viewing_key IS 'AES-256-GCM encrypted viewing private key';
COMMENT ON COLUMN public.stealth_addresses.label IS 'Optional human-readable label for identifying the purpose of this meta-address';
COMMENT ON COLUMN public.stealth_addresses.created_at IS 'Timestamp when the meta-address was created';
