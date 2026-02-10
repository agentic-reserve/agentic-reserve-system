-- Test script for 011_create_disclosures_table.sql
-- This script verifies the migration was applied correctly

-- Test 1: Verify table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'disclosures'
) AS table_exists;

-- Test 2: Verify all columns exist with correct types
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'disclosures'
ORDER BY ordinal_position;

-- Test 3: Verify indexes exist
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'disclosures'
ORDER BY indexname;

-- Test 4: Verify constraints
SELECT
  con.conname AS constraint_name,
  con.contype AS constraint_type,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'disclosures';

-- Test 5: Verify foreign key relationships
SELECT
  tc.constraint_name,
  tc.table_name,
  kcu.column_name,
  ccu.table_name AS foreign_table_name,
  ccu.column_name AS foreign_column_name,
  rc.delete_rule
FROM information_schema.table_constraints AS tc
JOIN information_schema.key_column_usage AS kcu
  ON tc.constraint_name = kcu.constraint_name
  AND tc.table_schema = kcu.table_schema
JOIN information_schema.constraint_column_usage AS ccu
  ON ccu.constraint_name = tc.constraint_name
  AND ccu.table_schema = tc.table_schema
JOIN information_schema.referential_constraints AS rc
  ON tc.constraint_name = rc.constraint_name
WHERE tc.constraint_type = 'FOREIGN KEY'
  AND tc.table_name = 'disclosures';

-- Test 6: Insert test records (will be rolled back)
BEGIN;

-- First, ensure we have prerequisite data
-- Insert a test viewing key
INSERT INTO viewing_keys (
  key_hash,
  encrypted_key,
  path,
  role,
  expires_at
) VALUES (
  'test_viewing_key_hash_12345',
  'encrypted_key_data_12345',
  'm/0/org/2026/Q1',
  'internal',
  NOW() + INTERVAL '30 days'
);

-- Insert a test shielded transaction
INSERT INTO shielded_transactions (
  tx_signature,
  sender,
  stealth_address,
  ephemeral_public_key,
  commitment,
  amount_encrypted,
  status
) VALUES (
  'test_tx_signature_12345',
  'sender_address_12345',
  'stealth_address_12345',
  'ephemeral_key_12345',
  'commitment_hash_12345',
  'encrypted_amount_12345',
  'confirmed'
);

-- Get the transaction ID
DO $$
DECLARE
  test_tx_id INTEGER;
BEGIN
  SELECT id INTO test_tx_id FROM shielded_transactions WHERE tx_signature = 'test_tx_signature_12345';
  
  -- Insert test disclosure
  INSERT INTO disclosures (
    transaction_id,
    auditor_id,
    viewing_key_hash,
    encrypted_data,
    disclosed_fields,
    expires_at
  ) VALUES (
    test_tx_id,
    'auditor_12345',
    'test_viewing_key_hash_12345',
    'encrypted_disclosure_data_12345',
    '["sender", "recipient", "amount", "timestamp"]'::jsonb,
    NOW() + INTERVAL '30 days'
  );
  
  RAISE NOTICE 'Test disclosure inserted successfully';
END $$;

-- Verify insert succeeded
SELECT 
  d.id,
  d.transaction_id,
  d.auditor_id,
  d.viewing_key_hash,
  d.disclosed_fields,
  d.expires_at,
  d.created_at,
  d.revoked_at
FROM disclosures d
WHERE d.auditor_id = 'auditor_12345';

-- Test 7: Verify foreign key constraint on transaction_id
-- This should fail with foreign key violation
DO $$
BEGIN
  INSERT INTO disclosures (
    transaction_id,
    auditor_id,
    viewing_key_hash,
    encrypted_data,
    disclosed_fields,
    expires_at
  ) VALUES (
    999999,  -- Non-existent transaction_id
    'auditor_test',
    'test_viewing_key_hash_12345',
    'encrypted_data',
    '["sender"]'::jsonb,
    NOW() + INTERVAL '30 days'
  );
  RAISE EXCEPTION 'Foreign key constraint check failed - invalid transaction_id was accepted';
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'Foreign key constraint on transaction_id working correctly';
END $$;

-- Test 8: Verify foreign key constraint on viewing_key_hash
-- This should fail with foreign key violation
DO $$
DECLARE
  test_tx_id INTEGER;
BEGIN
  SELECT id INTO test_tx_id FROM shielded_transactions WHERE tx_signature = 'test_tx_signature_12345';
  
  INSERT INTO disclosures (
    transaction_id,
    auditor_id,
    viewing_key_hash,
    encrypted_data,
    disclosed_fields,
    expires_at
  ) VALUES (
    test_tx_id,
    'auditor_test',
    'non_existent_viewing_key_hash',  -- Non-existent viewing_key_hash
    'encrypted_data',
    '["sender"]'::jsonb,
    NOW() + INTERVAL '30 days'
  );
  RAISE EXCEPTION 'Foreign key constraint check failed - invalid viewing_key_hash was accepted';
EXCEPTION
  WHEN foreign_key_violation THEN
    RAISE NOTICE 'Foreign key constraint on viewing_key_hash working correctly';
END $$;

-- Test 9: Verify JSONB disclosed_fields column
DO $$
DECLARE
  test_tx_id INTEGER;
  test_fields JSONB;
BEGIN
  SELECT id INTO test_tx_id FROM shielded_transactions WHERE tx_signature = 'test_tx_signature_12345';
  
  -- Insert disclosure with complex JSONB
  INSERT INTO disclosures (
    transaction_id,
    auditor_id,
    viewing_key_hash,
    encrypted_data,
    disclosed_fields,
    expires_at
  ) VALUES (
    test_tx_id,
    'auditor_jsonb_test',
    'test_viewing_key_hash_12345',
    'encrypted_data',
    '["sender", "recipient", "amount", "timestamp", "memo"]'::jsonb,
    NOW() + INTERVAL '30 days'
  );
  
  -- Query and verify JSONB data
  SELECT disclosed_fields INTO test_fields 
  FROM disclosures 
  WHERE auditor_id = 'auditor_jsonb_test';
  
  IF jsonb_array_length(test_fields) = 5 THEN
    RAISE NOTICE 'JSONB disclosed_fields working correctly - array length: %', jsonb_array_length(test_fields);
  ELSE
    RAISE EXCEPTION 'JSONB disclosed_fields check failed';
  END IF;
END $$;

-- Test 10: Verify CASCADE delete on transaction_id
DO $$
DECLARE
  test_tx_id INTEGER;
  disclosure_count INTEGER;
BEGIN
  -- Get transaction ID
  SELECT id INTO test_tx_id FROM shielded_transactions WHERE tx_signature = 'test_tx_signature_12345';
  
  -- Count disclosures before delete
  SELECT COUNT(*) INTO disclosure_count FROM disclosures WHERE transaction_id = test_tx_id;
  RAISE NOTICE 'Disclosures before delete: %', disclosure_count;
  
  -- Delete the transaction (should cascade to disclosures)
  DELETE FROM shielded_transactions WHERE id = test_tx_id;
  
  -- Count disclosures after delete (should be 0)
  SELECT COUNT(*) INTO disclosure_count FROM disclosures WHERE transaction_id = test_tx_id;
  
  IF disclosure_count = 0 THEN
    RAISE NOTICE 'CASCADE delete working correctly - disclosures deleted with transaction';
  ELSE
    RAISE EXCEPTION 'CASCADE delete check failed - disclosures still exist after transaction delete';
  END IF;
END $$;

ROLLBACK;

-- Test 11: Verify table comments
SELECT 
  obj_description('public.disclosures'::regclass) AS table_comment;

-- Test 12: Verify column comments
SELECT 
  col.column_name,
  pgd.description AS column_comment
FROM pg_catalog.pg_statio_all_tables AS st
INNER JOIN pg_catalog.pg_description pgd ON (pgd.objoid = st.relid)
INNER JOIN information_schema.columns col ON (
  pgd.objsubid = col.ordinal_position AND
  col.table_schema = st.schemaname AND
  col.table_name = st.relname
)
WHERE st.relname = 'disclosures'
ORDER BY col.ordinal_position;

-- Test 13: Verify index performance
EXPLAIN ANALYZE
SELECT * FROM disclosures WHERE auditor_id = 'test_auditor';

EXPLAIN ANALYZE
SELECT * FROM disclosures WHERE expires_at > NOW();

EXPLAIN ANALYZE
SELECT * FROM disclosures ORDER BY created_at DESC LIMIT 10;

-- Summary
SELECT 
  'Migration 011_create_disclosures_table.sql verification complete' AS status,
  NOW() AS tested_at;
