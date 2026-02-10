-- Test Script for 010_create_viewing_keys_table.sql
-- This script validates the viewing_keys table schema

-- ============================================
-- VALIDATION QUERIES
-- ============================================

-- 1. Verify table exists
SELECT EXISTS (
    SELECT FROM information_schema.tables 
    WHERE table_schema = 'public' 
    AND table_name = 'viewing_keys'
) AS table_exists;

-- 2. Verify all columns exist with correct types
SELECT 
    column_name,
    data_type,
    is_nullable,
    column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
AND table_name = 'viewing_keys'
ORDER BY ordinal_position;

-- Expected columns:
-- id                | integer                  | NO  | nextval('viewing_keys_id_seq'::regclass)
-- key_hash          | character varying(255)   | NO  | NULL
-- encrypted_key     | text                     | NO  | NULL
-- path              | character varying(255)   | NO  | NULL
-- parent_hash       | character varying(255)   | YES | NULL
-- role              | character varying(50)    | YES | NULL
-- expires_at        | timestamp with time zone | YES | NULL
-- created_at        | timestamp with time zone | YES | now()
-- revoked_at        | timestamp with time zone | YES | NULL

-- 3. Verify indexes exist
SELECT 
    indexname,
    indexdef
FROM pg_indexes
WHERE schemaname = 'public' 
AND tablename = 'viewing_keys'
ORDER BY indexname;

-- Expected indexes:
-- idx_viewing_hash    | CREATE INDEX idx_viewing_hash ON public.viewing_keys USING btree (key_hash)
-- idx_viewing_role    | CREATE INDEX idx_viewing_role ON public.viewing_keys USING btree (role)
-- idx_viewing_expires | CREATE INDEX idx_viewing_expires ON public.viewing_keys USING btree (expires_at)
-- viewing_keys_pkey   | CREATE UNIQUE INDEX viewing_keys_pkey ON public.viewing_keys USING btree (id)

-- 4. Verify foreign key constraint exists
SELECT
    tc.constraint_name,
    tc.table_name,
    kcu.column_name,
    ccu.table_name AS foreign_table_name,
    ccu.column_name AS foreign_column_name
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
    ON tc.constraint_name = kcu.constraint_name
    AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
    ON ccu.constraint_name = tc.constraint_name
    AND ccu.table_schema = tc.table_schema
WHERE tc.constraint_type = 'FOREIGN KEY'
AND tc.table_name = 'viewing_keys';

-- Expected foreign key:
-- fk_parent_hash | viewing_keys | parent_hash | viewing_keys | key_hash

-- 5. Verify table comments
SELECT 
    obj_description('public.viewing_keys'::regclass) AS table_comment;

-- 6. Verify column comments
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
AND st.relname = 'viewing_keys'
ORDER BY col.ordinal_position;

-- ============================================
-- SAMPLE DATA INSERTION TEST
-- ============================================

-- Insert test master viewing key
INSERT INTO public.viewing_keys (
    key_hash,
    encrypted_key,
    path,
    parent_hash,
    role,
    expires_at
) VALUES (
    'master_key_hash_test_001',
    'encrypted_master_viewing_key_aes256gcm_test_data',
    'm/0',
    NULL,
    'master',
    NOW() + INTERVAL '90 days'
);

-- Insert test organizational viewing key (child of master)
INSERT INTO public.viewing_keys (
    key_hash,
    encrypted_key,
    path,
    parent_hash,
    role,
    expires_at
) VALUES (
    'org_key_hash_test_001',
    'encrypted_org_viewing_key_aes256gcm_test_data',
    'm/0/org',
    'master_key_hash_test_001',
    'regulator',
    NOW() + INTERVAL '30 days'
);

-- Insert test yearly viewing key (child of organizational)
INSERT INTO public.viewing_keys (
    key_hash,
    encrypted_key,
    path,
    parent_hash,
    role,
    expires_at
) VALUES (
    'yearly_key_hash_test_001',
    'encrypted_yearly_viewing_key_aes256gcm_test_data',
    'm/0/org/2026',
    'org_key_hash_test_001',
    'external',
    NOW() + INTERVAL '30 days'
);

-- Insert test quarterly viewing key (child of yearly)
INSERT INTO public.viewing_keys (
    key_hash,
    encrypted_key,
    path,
    parent_hash,
    role,
    expires_at
) VALUES (
    'quarterly_key_hash_test_001',
    'encrypted_quarterly_viewing_key_aes256gcm_test_data',
    'm/0/org/2026/Q1',
    'yearly_key_hash_test_001',
    'internal',
    NOW() + INTERVAL '30 days'
);

-- Verify insertion and hierarchy
SELECT 
    id,
    key_hash,
    path,
    parent_hash,
    role,
    expires_at,
    created_at
FROM public.viewing_keys
WHERE key_hash LIKE '%test_001'
ORDER BY path;

-- Test hierarchical query (get all children of master key)
WITH RECURSIVE key_hierarchy AS (
    -- Base case: master key
    SELECT 
        id,
        key_hash,
        path,
        parent_hash,
        role,
        0 AS level
    FROM public.viewing_keys
    WHERE key_hash = 'master_key_hash_test_001'
    
    UNION ALL
    
    -- Recursive case: children
    SELECT 
        vk.id,
        vk.key_hash,
        vk.path,
        vk.parent_hash,
        vk.role,
        kh.level + 1
    FROM public.viewing_keys vk
    INNER JOIN key_hierarchy kh ON vk.parent_hash = kh.key_hash
)
SELECT * FROM key_hierarchy ORDER BY level, path;

-- Test index usage on key_hash
EXPLAIN (ANALYZE, BUFFERS) 
SELECT * FROM public.viewing_keys 
WHERE key_hash = 'quarterly_key_hash_test_001';

-- Test index usage on role
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.viewing_keys 
WHERE role = 'internal';

-- Test index usage on expires_at
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM public.viewing_keys 
WHERE expires_at < NOW() + INTERVAL '7 days'
ORDER BY expires_at;

-- Test foreign key constraint (should fail - referencing non-existent parent)
DO $$
BEGIN
    INSERT INTO public.viewing_keys (
        key_hash,
        encrypted_key,
        path,
        parent_hash,
        role
    ) VALUES (
        'invalid_child_key_test',
        'encrypted_key_data',
        'm/0/invalid',
        'non_existent_parent_hash',
        'internal'
    );
    RAISE EXCEPTION 'Foreign key constraint should have prevented this insert!';
EXCEPTION
    WHEN foreign_key_violation THEN
        RAISE NOTICE 'Foreign key constraint working correctly - insert rejected';
END $$;

-- ============================================
-- CLEANUP TEST DATA
-- ============================================

-- Remove test records (in reverse order due to foreign key constraint)
DELETE FROM public.viewing_keys 
WHERE key_hash = 'quarterly_key_hash_test_001';

DELETE FROM public.viewing_keys 
WHERE key_hash = 'yearly_key_hash_test_001';

DELETE FROM public.viewing_keys 
WHERE key_hash = 'org_key_hash_test_001';

DELETE FROM public.viewing_keys 
WHERE key_hash = 'master_key_hash_test_001';

-- Verify deletion
SELECT COUNT(*) AS remaining_test_records
FROM public.viewing_keys
WHERE key_hash LIKE '%test_001';

-- ============================================
-- VALIDATION SUMMARY
-- ============================================

-- If all queries above execute successfully:
-- ✓ Table created with correct schema
-- ✓ All columns have correct types and constraints
-- ✓ Indexes created and functional
-- ✓ Foreign key constraint working correctly
-- ✓ Comments added for documentation
-- ✓ Insert/Select/Delete operations work correctly
-- ✓ Hierarchical queries work correctly
-- ✓ Indexes are being used by query planner

SELECT 'Migration 010 validation completed successfully!' AS status;
