-- Migration: Add Encryption Metadata to Stealth Addresses Table
-- Date: 2026-02-04
-- Description: Adds IV, tag, and salt columns for AES-256-GCM encryption
-- Requirements: 1.3, 1.4 (Sipher Privacy Integration - Encryption Service)

-- ============================================
-- ADD ENCRYPTION METADATA COLUMNS
-- ============================================

-- Add IV (Initialization Vector) columns for spending key
ALTER TABLE public.stealth_addresses 
ADD COLUMN IF NOT EXISTS spending_private_key_iv TEXT;

-- Add authentication tag columns for spending key (GCM mode)
ALTER TABLE public.stealth_addresses 
ADD COLUMN IF NOT EXISTS spending_private_key_tag TEXT;

-- Add salt columns for spending key (PBKDF2 key derivation)
ALTER TABLE public.stealth_addresses 
ADD COLUMN IF NOT EXISTS spending_private_key_salt TEXT;

-- Add IV columns for viewing key
ALTER TABLE public.stealth_addresses 
ADD COLUMN IF NOT EXISTS viewing_private_key_iv TEXT;

-- Add authentication tag columns for viewing key (GCM mode)
ALTER TABLE public.stealth_addresses 
ADD COLUMN IF NOT EXISTS viewing_private_key_tag TEXT;

-- Add salt columns for viewing key (PBKDF2 key derivation)
ALTER TABLE public.stealth_addresses 
ADD COLUMN IF NOT EXISTS viewing_private_key_salt TEXT;

-- ============================================
-- UPDATE COLUMN CONSTRAINTS
-- ============================================

-- For new records, these columns should be NOT NULL
-- But we can't add NOT NULL constraint to existing columns with NULL values
-- So we'll add a check constraint for new inserts

-- ============================================
-- COMMENTS
-- ============================================
COMMENT ON COLUMN public.stealth_addresses.spending_private_key_iv IS 'Initialization vector for AES-256-GCM encryption of spending private key (hex encoded)';
COMMENT ON COLUMN public.stealth_addresses.spending_private_key_tag IS 'Authentication tag for AES-256-GCM encryption of spending private key (hex encoded)';
COMMENT ON COLUMN public.stealth_addresses.spending_private_key_salt IS 'Salt for PBKDF2 key derivation of spending private key encryption (hex encoded)';
COMMENT ON COLUMN public.stealth_addresses.viewing_private_key_iv IS 'Initialization vector for AES-256-GCM encryption of viewing private key (hex encoded)';
COMMENT ON COLUMN public.stealth_addresses.viewing_private_key_tag IS 'Authentication tag for AES-256-GCM encryption of viewing private key (hex encoded)';
COMMENT ON COLUMN public.stealth_addresses.viewing_private_key_salt IS 'Salt for PBKDF2 key derivation of viewing private key encryption (hex encoded)';

