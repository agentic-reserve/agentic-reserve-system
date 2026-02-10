-- Migration: Create commitments table for Pedersen commitments
-- Phase 2: MEV-Protected Rebalancing
-- Task 7.1: Create database schema for commitments

-- Commitments table stores Pedersen commitments for hidden swap amounts
CREATE TABLE IF NOT EXISTS commitments (
  id SERIAL PRIMARY KEY,
  commitment TEXT NOT NULL,                      -- Hex-encoded Pedersen commitment
  encrypted_blinding_factor TEXT NOT NULL,       -- AES-256 encrypted blinding factor
  value TEXT NOT NULL,                           -- Original value (for verification)
  created_at TIMESTAMP DEFAULT NOW(),
  verified_at TIMESTAMP,                         -- Timestamp of last successful verification
  
  -- Indexes for efficient queries
  INDEX idx_commitment_created (created_at DESC)
);

-- Add comment for documentation
COMMENT ON TABLE commitments IS 'Stores Pedersen commitments for MEV-protected swaps with encrypted blinding factors';
COMMENT ON COLUMN commitments.commitment IS 'Hex-encoded Pedersen commitment hiding the swap amount';
COMMENT ON COLUMN commitments.encrypted_blinding_factor IS 'AES-256-GCM encrypted blinding factor for commitment verification';
COMMENT ON COLUMN commitments.value IS 'Original value in plaintext (for internal verification only)';
COMMENT ON COLUMN commitments.verified_at IS 'Timestamp of last successful commitment verification';
