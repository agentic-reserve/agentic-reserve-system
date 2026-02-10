-- Migration: Create viewing_keys table for hierarchical viewing keys
-- Phase 3: Compliance Layer
-- Task: 12.1 Create database schema for viewing keys
-- Requirements: 12.4

-- Create viewing_keys table
CREATE TABLE IF NOT EXISTS viewing_keys (
  id SERIAL PRIMARY KEY,
  key_hash VARCHAR(255) UNIQUE NOT NULL,
  encrypted_key TEXT NOT NULL,           -- AES-256 encrypted viewing key
  path VARCHAR(255) NOT NULL,            -- BIP32 path (e.g., m/0/org/2026/Q1)
  parent_hash VARCHAR(255),              -- Reference to parent viewing key
  role VARCHAR(50),                      -- internal, external, regulator, master
  expires_at TIMESTAMP,                  -- Expiration timestamp (default 30 days)
  created_at TIMESTAMP DEFAULT NOW(),
  revoked_at TIMESTAMP,                  -- Revocation timestamp
  
  -- Foreign key constraint for parent_hash
  CONSTRAINT fk_parent_hash FOREIGN KEY (parent_hash) 
    REFERENCES viewing_keys(key_hash) 
    ON DELETE SET NULL
);

-- Create indexes for efficient queries
CREATE INDEX IF NOT EXISTS idx_viewing_hash ON viewing_keys(key_hash);
CREATE INDEX IF NOT EXISTS idx_viewing_role ON viewing_keys(role);
CREATE INDEX IF NOT EXISTS idx_viewing_expires ON viewing_keys(expires_at);

-- Add comments for documentation
COMMENT ON TABLE viewing_keys IS 'Hierarchical viewing keys for compliance and selective disclosure';
COMMENT ON COLUMN viewing_keys.key_hash IS 'SHA256 hash of the viewing key for verification';
COMMENT ON COLUMN viewing_keys.encrypted_key IS 'AES-256 encrypted viewing key';
COMMENT ON COLUMN viewing_keys.path IS 'BIP32-style derivation path (e.g., m/0/org/2026/Q1)';
COMMENT ON COLUMN viewing_keys.parent_hash IS 'Hash of parent viewing key for hierarchy verification';
COMMENT ON COLUMN viewing_keys.role IS 'Role-based access level: internal, external, regulator, master';
COMMENT ON COLUMN viewing_keys.expires_at IS 'Expiration timestamp for time-limited access';
COMMENT ON COLUMN viewing_keys.revoked_at IS 'Timestamp when key was revoked (if applicable)';
