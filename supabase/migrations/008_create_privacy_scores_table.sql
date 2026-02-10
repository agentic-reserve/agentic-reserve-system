-- Migration: Create privacy_scores table for wallet privacy analysis
-- Phase 2: MEV-Protected Rebalancing
-- Task 8.1: Create database schema for privacy scores

-- Privacy Scores table stores privacy analysis results for vault addresses
CREATE TABLE IF NOT EXISTS privacy_scores (
  id SERIAL PRIMARY KEY,
  address VARCHAR(255) NOT NULL,                 -- Wallet/vault address analyzed
  score INTEGER NOT NULL CHECK (score >= 0 AND score <= 100), -- Privacy score 0-100
  grade VARCHAR(2) NOT NULL CHECK (grade IN ('A', 'B', 'C', 'D', 'F')), -- Letter grade
  factors JSONB NOT NULL,                        -- Array of privacy-reducing factors
  recommendations JSONB,                         -- Array of improvement suggestions
  analyzed_at TIMESTAMP DEFAULT NOW(),           -- When analysis was performed
  
  -- Indexes for efficient queries
  INDEX idx_privacy_address (address),
  INDEX idx_privacy_score (score),
  INDEX idx_privacy_analyzed (analyzed_at DESC)
);

-- Add comments for documentation
COMMENT ON TABLE privacy_scores IS 'Stores privacy score analysis results for vault addresses to determine MEV protection needs';
COMMENT ON COLUMN privacy_scores.address IS 'Solana wallet or vault address that was analyzed';
COMMENT ON COLUMN privacy_scores.score IS 'Privacy score from 0-100 (higher is better, <70 triggers enhanced protection)';
COMMENT ON COLUMN privacy_scores.grade IS 'Letter grade: A (90-100), B (80-89), C (70-79), D (60-69), F (<60)';
COMMENT ON COLUMN privacy_scores.factors IS 'JSON array of privacy-reducing factors identified in analysis';
COMMENT ON COLUMN privacy_scores.recommendations IS 'JSON array of actionable recommendations for improving privacy';
COMMENT ON COLUMN privacy_scores.analyzed_at IS 'Timestamp when the privacy analysis was performed';
