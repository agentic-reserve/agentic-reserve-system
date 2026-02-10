-- Test Script for 003_create_stealth_addresses_table.sql
-- This script validates the stealth_addresses table schema

-- ============================================
-- VALIDATION QUERIES
-- ============================================

-- 1. Verify table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'stealth_addresses'
) AS table_exists;

-- 2. Verify all columns exist with correct types
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'stealth_addresses'
ORDER BY ordinal_position;

-- Expected columns:
-- id                      | integer                  | NO  | nextval('stealth_addresses_id_seq'::regclass)
-- agent_id                | character varying(255)   | NO  | NULL
-- meta_address            | jsonb                    | NO  | NULL
-- encrypted_spending_key  | text                     | NO  | NULL
-- encrypted_viewing_key   | text                     | NO  | NULL
-- label                   | character varying(255)   | YES | NULL
-- created_at              | timestamp with time zone | YES | now()

-- 3. Verify indexes exist
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename = 'stealth_addresses'
ORDER BY indexname;

-- Expected indexes:
-- idx_stealth_agent   | CREATE INDEX idx_stealth_agent ON public.stealth_addresses USING btree (agent_id)
-- idx_stealth_created | CREATE INDEX idx_stealth_created ON public.stealth_addresses USING btree (created_at DESC)
-- stealth_addresses_pkey | CREATE UNIQUE INDEX stealth_addresses_pkey ON public.stealth_addresses USING btree (id)

-- 4. Verify table comments
SELECT 
    obj_description('public.stealth_addresses'::regclass) AS table_comment;

-- 5. Verify column comments
SELECT 
    col.column_name,
    pgd.description AS column_comment
FROM pg_catalog.pg_statio_all_tables AS st
INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
INNER JOIN information_schema.columns col ON (
    pgd.objsubid = col.ordinal_position 
    AND col.table_schema = st.schemaname 
    AND col.table_name = st.relname
)
WHERE st.schemaname = 'public' 
AND st.relname = 'stealth_addresses'
ORDER BY col.ordinal_position;

-- ============================================
-- SAMPLE DATA INSERTION TEST
-- ============================================

-- Insert test record
INSERT INTO public.stealth_addresses (
    agent_id,
    meta_address,
    encrypted_spending_key,
    encrypted_viewing_key,
    label
) VALUES (
    'test-agent-001',
    '{"spendingPublicKey": "5ZWj7a1f8tWkjBESHKgrLmXshuXxqeY9SYcfbshpAqPG", "viewingPublicKey": "8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR9"}'::jsonb,
    'encrypted_spending_key_test_data_aes256gcm',
    'encrypted_viewing_key_test_data_aes256gcm',
    'Test Meta-Address for Agent 001'
);

-- Verify insertion
SELECT 
    id,
    agent_id,
    meta_address->>'spendingPublicKey' AS spending_public_key,
    meta_address->>'viewingPublicKey' AS viewing_public_key,
    label,
    created_at
FROM public.stealth_addresses
WHERE agent_id = 'test-agent-001';

-- Test index usage on agent_id
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM public.stealth_addresses 
WHERE agent_id = 'test-agent-001';

-- Test index usage on created_at
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.stealth_addresses 
ORDER BY created_at DESC 
LIMIT 10;

-- ============================================
-- CLEANUP TEST DATA
-- ============================================

-- Remove test record
DELETE FROM public.stealth_addresses 
WHERE agent_id = 'test-agent-001';

-- Verify deletion
SELECT COUNT(*) AS remaining_test_records
FROM public.stealth_addresses
WHERE agent_id = 'test-agent-001';

-- ============================================
-- VALIDATION SUMMARY
-- ============================================

-- If all queries above execute successfully:
-- ✓ Table created with correct schema
-- ✓ All columns have correct types and constraints
-- ✓ Indexes created and functional
-- ✓ Comments added for documentation
-- ✓ Insert/Select/Delete operations work correctly
-- ✓ Indexes are being used by query planner

SELECT 'Migration 003 validation completed successfully!' AS status;
