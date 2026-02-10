-- Database Optimization Script for Sipher Privacy Integration
-- Task 18.2: Performance optimization
-- 
-- This script ensures all necessary indexes are created for optimal query performance.
-- Run this script after initial database setup or when performance issues are detected.

-- ============================================================================
-- PRIVACY SCORES TABLE OPTIMIZATIONS
-- ============================================================================

-- Composite index for efficient latest score queries
-- Supports: SELECT * FROM privacy_scores WHERE address = ? ORDER BY analyzed_at DESC LIMIT 1
CREATE INDEX IF NOT EXISTS idx_privacy_address_analyzed 
ON privacy_scores(address, analyzed_at DESC);

-- Index for score threshold queries
-- Supports: SELECT * FROM privacy_scores WHERE score < 70
CREATE INDEX IF NOT EXISTS idx_privacy_score_analyzed 
ON privacy_scores(score, analyzed_at DESC);

-- Partial index for low privacy scores (more efficient than full index)
-- Supports: SELECT * FROM privacy_scores WHERE score < 70
CREATE INDEX IF NOT EXISTS idx_privacy_low_scores 
ON privacy_scores(address, analyzed_at DESC) 
WHERE score < 70;

-- ============================================================================
-- COMMITMENTS TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for recent commitments queries
-- Supports: SELECT * FROM commitments ORDER BY created_at DESC LIMIT 10
CREATE INDEX IF NOT EXISTS idx_commitment_created_desc 
ON commitments(created_at DESC);

-- Index for verified commitments
-- Supports: SELECT * FROM commitments WHERE verified_at IS NOT NULL
CREATE INDEX IF NOT EXISTS idx_commitment_verified 
ON commitments(verified_at) 
WHERE verified_at IS NOT NULL;

-- ============================================================================
-- SHIELDED TRANSACTIONS TABLE OPTIMIZATIONS
-- ============================================================================

-- Composite index for sender transaction history
-- Supports: SELECT * FROM shielded_transactions WHERE sender = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_shielded_sender_created 
ON shielded_transactions(sender, created_at DESC);

-- Composite index for stealth address lookups
-- Supports: SELECT * FROM shielded_transactions WHERE stealth_address = ? AND status = ?
CREATE INDEX IF NOT EXISTS idx_shielded_stealth_status 
ON shielded_transactions(stealth_address, status);

-- Index for pending transactions
-- Supports: SELECT * FROM shielded_transactions WHERE status = 'pending'
CREATE INDEX IF NOT EXISTS idx_shielded_pending 
ON shielded_transactions(created_at DESC) 
WHERE status = 'pending';

-- Index for unclaimed transactions
-- Supports: SELECT * FROM shielded_transactions WHERE status = 'confirmed' AND claimed_at IS NULL
CREATE INDEX IF NOT EXISTS idx_shielded_unclaimed 
ON shielded_transactions(stealth_address, created_at DESC) 
WHERE status = 'confirmed' AND claimed_at IS NULL;

-- ============================================================================
-- STEALTH ADDRESSES TABLE OPTIMIZATIONS
-- ============================================================================

-- Composite index for agent address lookups
-- Supports: SELECT * FROM stealth_addresses WHERE agent_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_stealth_agent_created 
ON stealth_addresses(agent_id, created_at DESC);

-- Index for active addresses only
-- Supports: SELECT * FROM stealth_addresses WHERE agent_id = ? AND active = true
CREATE INDEX IF NOT EXISTS idx_stealth_active 
ON stealth_addresses(agent_id, created_at DESC) 
WHERE active = true;

-- ============================================================================
-- VIEWING KEYS TABLE OPTIMIZATIONS
-- ============================================================================

-- Composite index for role-based key lookups
-- Supports: SELECT * FROM viewing_keys WHERE role = ? AND expires_at > NOW()
CREATE INDEX IF NOT EXISTS idx_viewing_role_expires 
ON viewing_keys(role, expires_at);

-- Index for non-revoked keys
-- Supports: SELECT * FROM viewing_keys WHERE revoked_at IS NULL
CREATE INDEX IF NOT EXISTS idx_viewing_active 
ON viewing_keys(key_hash, expires_at) 
WHERE revoked_at IS NULL;

-- Index for hierarchy queries
-- Supports: SELECT * FROM viewing_keys WHERE parent_hash = ?
CREATE INDEX IF NOT EXISTS idx_viewing_parent 
ON viewing_keys(parent_hash, created_at DESC);

-- ============================================================================
-- DISCLOSURES TABLE OPTIMIZATIONS
-- ============================================================================

-- Composite index for auditor disclosure lookups
-- Supports: SELECT * FROM disclosures WHERE auditor_id = ? ORDER BY created_at DESC
CREATE INDEX IF NOT EXISTS idx_disclosure_auditor_created 
ON disclosures(auditor_id, created_at DESC);

-- Index for active disclosures
-- Supports: SELECT * FROM disclosures WHERE expires_at > NOW() AND revoked_at IS NULL
CREATE INDEX IF NOT EXISTS idx_disclosure_active 
ON disclosures(auditor_id, expires_at) 
WHERE revoked_at IS NULL;

-- Index for transaction disclosures
-- Supports: SELECT * FROM disclosures WHERE transaction_id = ?
CREATE INDEX IF NOT EXISTS idx_disclosure_transaction 
ON disclosures(transaction_id, created_at DESC);

-- ============================================================================
-- MEV METRICS TABLE OPTIMIZATIONS
-- ============================================================================

-- Composite index for vault metrics queries
-- Supports: SELECT * FROM mev_metrics WHERE vault_id = ? ORDER BY timestamp DESC
CREATE INDEX IF NOT EXISTS idx_mev_vault_timestamp 
ON mev_metrics(vault_id, timestamp DESC);

-- Index for recent metrics
-- Supports: SELECT * FROM mev_metrics WHERE timestamp > ? ORDER BY timestamp DESC
CREATE INDEX IF NOT EXISTS idx_mev_recent 
ON mev_metrics(timestamp DESC);

-- ============================================================================
-- PAYMENT SCAN STATE TABLE OPTIMIZATIONS
-- ============================================================================

-- Index for scan state lookups (already has unique constraint on agent_id)
-- Supports: SELECT * FROM payment_scan_state WHERE agent_id = ?
-- Note: Unique constraint already provides index, no additional index needed

-- ============================================================================
-- ANALYZE TABLES FOR QUERY PLANNER
-- ============================================================================

-- Update table statistics for optimal query planning
ANALYZE privacy_scores;
ANALYZE commitments;
ANALYZE shielded_transactions;
ANALYZE stealth_addresses;
ANALYZE viewing_keys;
ANALYZE disclosures;
ANALYZE mev_metrics;
ANALYZE payment_scan_state;

-- ============================================================================
-- VACUUM TABLES (Optional - run during maintenance window)
-- ============================================================================

-- Uncomment to reclaim space and update statistics
-- VACUUM ANALYZE privacy_scores;
-- VACUUM ANALYZE commitments;
-- VACUUM ANALYZE shielded_transactions;
-- VACUUM ANALYZE stealth_addresses;
-- VACUUM ANALYZE viewing_keys;
-- VACUUM ANALYZE disclosures;
-- VACUUM ANALYZE mev_metrics;
-- VACUUM ANALYZE payment_scan_state;

-- ============================================================================
-- VERIFY INDEXES
-- ============================================================================

-- Query to verify all indexes are created
SELECT 
    schemaname,
    tablename,
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public'
    AND tablename IN (
        'privacy_scores',
        'commitments',
        'shielded_transactions',
        'stealth_addresses',
        'viewing_keys',
        'disclosures',
        'mev_metrics',
        'payment_scan_state'
    )
ORDER BY tablename, indexname;

-- ============================================================================
-- PERFORMANCE MONITORING QUERIES
-- ============================================================================

-- Check index usage statistics
-- Run this periodically to identify unused indexes
SELECT
    schemaname,
    tablename,
    indexname,
    idx_scan as index_scans,
    idx_tup_read as tuples_read,
    idx_tup_fetch as tuples_fetched
FROM pg_stat_user_indexes
WHERE schemaname = 'public'
    AND tablename IN (
        'privacy_scores',
        'commitments',
        'shielded_transactions',
        'stealth_addresses',
        'viewing_keys',
        'disclosures',
        'mev_metrics',
        'payment_scan_state'
    )
ORDER BY idx_scan DESC;

-- Check table sizes
SELECT
    schemaname,
    tablename,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename)) AS total_size,
    pg_size_pretty(pg_relation_size(schemaname||'.'||tablename)) AS table_size,
    pg_size_pretty(pg_total_relation_size(schemaname||'.'||tablename) - pg_relation_size(schemaname||'.'||tablename)) AS index_size
FROM pg_tables
WHERE schemaname = 'public'
    AND tablename IN (
        'privacy_scores',
        'commitments',
        'shielded_transactions',
        'stealth_addresses',
        'viewing_keys',
        'disclosures',
        'mev_metrics',
        'payment_scan_state'
    )
ORDER BY pg_total_relation_size(schemaname||'.'||tablename) DESC;

-- ============================================================================
-- NOTES
-- ============================================================================

-- 1. Run this script after initial database setup
-- 2. Monitor index usage with the provided queries
-- 3. Drop unused indexes to save space and improve write performance
-- 4. Run ANALYZE regularly (daily) to keep statistics up to date
-- 5. Run VACUUM during maintenance windows to reclaim space
-- 6. Consider partitioning large tables (>10M rows) by date
-- 7. Monitor query performance with pg_stat_statements extension

-- ============================================================================
-- MAINTENANCE SCHEDULE
-- ============================================================================

-- Daily: ANALYZE tables
-- Weekly: Check index usage statistics
-- Monthly: VACUUM ANALYZE during maintenance window
-- Quarterly: Review and optimize slow queries
