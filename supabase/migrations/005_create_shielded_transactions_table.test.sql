-- Test script for 005_create_shielded_transactions_table.sql
-- This script verifies the migration was applied correctly

-- Test 1: Verify table exists
SELECT EXISTS (
  SELECT FROM information_schema.tables 
  WHERE table_schema = 'public' 
  AND table_name = 'shielded_transactions'
) AS table_exists;

-- Test 2: Verify all columns exist with correct types
SELECT 
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns
WHERE table_schema = 'public' 
  AND table_name = 'shielded_transactions'
ORDER BY ordinal_position;

-- Test 3: Verify indexes exist
SELECT 
  indexname,
  indexdef
FROM pg_indexes
WHERE tablename = 'shielded_transactions'
ORDER BY indexname;

-- Test 4: Verify constraints
SELECT
  con.conname AS constraint_name,
  con.contype AS constraint_type,
  pg_get_constraintdef(con.oid) AS constraint_definition
FROM pg_constraint con
JOIN pg_class rel ON rel.oid = con.conrelid
WHERE rel.relname = 'shielded_transactions';

-- Test 5: Insert test record (will be rolled back)
BEGIN;

INSERT INTO shielded_transactions (
  tx_signature,
  sender,
  stealth_address,
  ephemeral_public_key,
  commitment,
  amount_encrypted,
  status
) VALUES (
  'test_signature_12345',
  'sender_address_12345',
  'stealth_address_12345',
  'ephemeral_key_12345',
  'commitment_hash_12345',
  'encrypted_amount_12345',
  'pending'
);

-- Verify insert succeeded
SELECT * FROM shielded_transactions WHERE tx_signature = 'test_signature_12345';

-- Test 6: Verify status constraint
-- This should fail with constraint violation
DO $$
BEGIN
  INSERT INTO shielded_transactions (
    tx_signature,
    sender,
    stealth_address,
    ephemeral_public_key,
    commitment,
    amount_encrypted,
    status
  ) VALUES (
    'test_signature_invalid',
    'sender_address',
    'stealth_address',
    'ephemeral_key',
    'commitment_hash',
    'encrypted_amount',
    'invalid_status'
  );
  RAISE EXCEPTION 'Status constraint check failed - invalid status was accepted';
EXCEPTION
  WHEN check_violation THEN
    RAISE NOTICE 'Status constraint working correctly - invalid status rejected';
END $$;

-- Test 7: Verify unique constraint on tx_signature
-- This should fail with unique violation
DO $$
BEGIN
  INSERT INTO shielded_transactions (
    tx_signature,
    sender,
    stealth_address,
    ephemeral_public_key,
    commitment,
    amount_encrypted,
    status
  ) VALUES (
    'test_signature_12345',  -- Duplicate
    'sender_address_different',
    'stealth_address_different',
    'ephemeral_key_different',
    'commitment_hash_different',
    'encrypted_amount_different',
    'confirmed'
  );
  RAISE EXCEPTION 'Unique constraint check failed - duplicate tx_signature was accepted';
EXCEPTION
  WHEN unique_violation THEN
    RAISE NOTICE 'Unique constraint working correctly - duplicate tx_signature rejected';
END $$;

ROLLBACK;

-- Test 8: Verify table comments
SELECT 
  obj_description('public.shielded_transactions'::regclass) AS table_comment;

-- Test 9: Verify column comments
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
WHERE st.relname = 'shielded_transactions'
ORDER BY col.ordinal_position;

-- Summary
SELECT 
  'Migration 005_create_shielded_transactions_table.sql verification complete' AS status,
  NOW() AS tested_at;
