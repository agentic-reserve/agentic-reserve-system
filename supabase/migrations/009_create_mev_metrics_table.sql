-- Migration: Create mev_metrics table for MEV extraction tracking
-- Phase 2: MEV-Protected Rebalancing
-- Task 9.1: Create database schema for MEV metrics

-- MEV Metrics table stores MEV extraction measurements for vault rebalancing operations
CREATE TABLE IF NOT EXISTS mev_metrics (
  id SERIAL PRIMARY KEY,
  vault_id VARCHAR(255) NOT NULL,                -- Vault address
  tx_signature VARCHAR(255) NOT NULL,            -- Transaction signature
  mev_extracted NUMERIC(20, 6) NOT NULL,         -- MEV extracted in USD
  privacy_score INTEGER NOT NULL CHECK (privacy_score >= 0 AND privacy_score <= 100), -- Privacy score at time of swap
  timestamp TIMESTAMP DEFAULT NOW(),             -- When swap was executed
  
  -- Indexes for efficient queries
  INDEX idx_mev_vault (vault_id),
  INDEX idx_mev_timestamp (timestamp DESC)
);

-- Add comments for documentation
COMMENT ON TABLE mev_metrics IS 'Tracks MEV extraction for vault rebalancing operations to measure protection effectiveness';
COMMENT ON COLUMN mev_metrics.vault_id IS 'Solana address of the vault performing the rebalancing';
COMMENT ON COLUMN mev_metrics.tx_signature IS 'Transaction signature of the swap operation';
COMMENT ON COLUMN mev_metrics.mev_extracted IS 'Amount of MEV extracted in USD (target >80% reduction from baseline)';
COMMENT ON COLUMN mev_metrics.privacy_score IS 'Privacy score of the vault at time of swap (affects MEV protection level)';
COMMENT ON COLUMN mev_metrics.timestamp IS 'Timestamp when the swap was executed';
