-- Migration: Create payment_scan_state table
-- Purpose: Track last scanned slot for each agent to avoid duplicate payment processing
-- Requirements: 3.2

-- Create payment_scan_state table
CREATE TABLE IF NOT EXISTS payment_scan_state (
  id SERIAL PRIMARY KEY,
  agent_id VARCHAR(255) UNIQUE NOT NULL,
  last_scanned_slot BIGINT NOT NULL DEFAULT 0,
  last_scan_at TIMESTAMP DEFAULT NOW(),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Create unique index on agent_id for fast lookups
CREATE UNIQUE INDEX IF NOT EXISTS idx_payment_scan_agent 
  ON payment_scan_state(agent_id);

-- Create index on last_scan_at for monitoring
CREATE INDEX IF NOT EXISTS idx_payment_scan_last_scan 
  ON payment_scan_state(last_scan_at DESC);

-- Add comment to table
COMMENT ON TABLE payment_scan_state IS 
  'Tracks the last scanned Solana slot for each agent to prevent duplicate payment processing';

-- Add comments to columns
COMMENT ON COLUMN payment_scan_state.agent_id IS 
  'Unique identifier for the agent';
COMMENT ON COLUMN payment_scan_state.last_scanned_slot IS 
  'Last Solana slot number that was scanned for this agent';
COMMENT ON COLUMN payment_scan_state.last_scan_at IS 
  'Timestamp of the last scan operation';
COMMENT ON COLUMN payment_scan_state.created_at IS 
  'Timestamp when the record was created';
COMMENT ON COLUMN payment_scan_state.updated_at IS 
  'Timestamp when the record was last updated';

-- Create function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION update_payment_scan_state_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to call the function before updates
CREATE TRIGGER payment_scan_state_updated_at_trigger
  BEFORE UPDATE ON payment_scan_state
  FOR EACH ROW
  EXECUTE FUNCTION update_payment_scan_state_updated_at();

-- Grant permissions (adjust as needed for your setup)
-- GRANT SELECT, INSERT, UPDATE ON payment_scan_state TO authenticated;
-- GRANT USAGE, SELECT ON SEQUENCE payment_scan_state_id_seq TO authenticated;
