-- Migration: Create shielded_transactions table
-- Description: Stores all shielded ARU transfer transactions with their status, commitment data, and metadata
-- Requirements: 5.2, 5.3
-- Created: 2026-02-04

-- Rollback Instructions:
-- To rollback this migration, run:
-- DROP INDEX IF EXISTS public.idx_shielded_created;
-- DROP INDEX IF EXISTS public.idx_shielded_status;
-- DROP INDEX IF EXISTS public.idx_shielded_stealth;
-- DROP INDEX IF EXISTS public.idx_shielded_sender;
-- DROP TABLE IF EXISTS public.shielded_transactions;

-- Create shielded_transactions table
CREATE TABLE IF NOT EXISTS shielded_transactions (
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
  
  -- Constraints
  CONSTRAINT chk_status CHECK (status IN ('pending', 'confirmed', 'claimed', 'failed'))
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_shielded_sender ON shielded_transactions(sender);
CREATE INDEX IF NOT EXISTS idx_shielded_stealth ON shielded_transactions(stealth_address);
CREATE INDEX IF NOT EXISTS idx_shielded_status ON shielded_transactions(status);
CREATE INDEX IF NOT EXISTS idx_shielded_created ON shielded_transactions(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE shielded_transactions IS 'Stores all shielded ARU transfer transactions with privacy-preserving features';
COMMENT ON COLUMN shielded_transactions.id IS 'Primary key, auto-incrementing';
COMMENT ON COLUMN shielded_transactions.tx_signature IS 'Unique Solana transaction signature';
COMMENT ON COLUMN shielded_transactions.sender IS 'Sender wallet address (public)';
COMMENT ON COLUMN shielded_transactions.stealth_address IS 'One-time recipient stealth address (unlinkable)';
COMMENT ON COLUMN shielded_transactions.ephemeral_public_key IS 'Ephemeral public key used for stealth address derivation';
COMMENT ON COLUMN shielded_transactions.commitment IS 'Pedersen commitment hiding the transfer amount';
COMMENT ON COLUMN shielded_transactions.amount_encrypted IS 'Encrypted amount value';
COMMENT ON COLUMN shielded_transactions.viewing_key_hash IS 'Optional hash of viewing key for compliance disclosure';
COMMENT ON COLUMN shielded_transactions.status IS 'Transaction status: pending, confirmed, claimed, or failed';
COMMENT ON COLUMN shielded_transactions.created_at IS 'Timestamp when transaction was created';
COMMENT ON COLUMN shielded_transactions.claimed_at IS 'Timestamp when payment was claimed (if applicable)';
