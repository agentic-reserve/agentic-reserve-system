-- Migration: Create disclosures table for selective transaction disclosure
-- Phase 3: Compliance Layer
-- Task: 13.1 Create database schema for disclosures
-- Requirements: 14.5

-- Create disclosures table
CREATE TABLE IF NOT EXISTS disclosures (
  id SERIAL PRIMARY KEY,
  transaction_id INTEGER NOT NULL,
  auditor_id VARCHAR(255) NOT NULL,
  viewing_key_hash VARCHAR(255) NOT NULL,
  encrypted_data TEXT NOT NULL,
  disclosed_fields JSONB NOT NULL,       -- Array of field names
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP,
  
  -- Foreign key constraints
  CONSTRAINT fk_transaction_id FOREIGN KEY (transaction_id) 
    REFERENCES shielded_transactions(id) 
    ON DELETE CASCADE,
  CONSTRAINT fk_viewing_key_hash FOREIGN KEY (viewing_key_hash) 
    REFERENCES viewing_keys(key_hash) 
    ON DELETE RESTRICT
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_disclosure_auditor ON disclosures(auditor_id);
CREATE INDEX IF NOT EXISTS idx_disclosure_expires ON disclosures(expires_at);
CREATE INDEX IF NOT EXISTS idx_disclosure_created ON disclosures(created_at DESC);

-- Add comments for documentation
COMMENT ON TABLE disclosures IS 'Selective transaction disclosures to auditors with encrypted data';
COMMENT ON COLUMN disclosures.transaction_id IS 'Reference to shielded transaction being disclosed';
COMMENT ON COLUMN disclosures.auditor_id IS 'Identifier of the auditor receiving disclosure';
COMMENT ON COLUMN disclosures.viewing_key_hash IS 'Hash of viewing key used for disclosure';
COMMENT ON COLUMN disclosures.encrypted_data IS 'Encrypted transaction data for auditor';
COMMENT ON COLUMN disclosures.disclosed_fields IS 'Array of field names that are disclosed';
COMMENT ON COLUMN disclosures.expires_at IS 'Expiration timestamp for time-limited disclosure';
COMMENT ON COLUMN disclosures.revoked_at IS 'Timestamp when disclosure was revoked (if applicable)';
