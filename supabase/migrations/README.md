# Database Migrations

This directory contains SQL migration scripts for the ARS database schema.

## Migration Files

### 001_create_base_tables.sql
- **Date**: 2026-02-04
- **Description**: Creates core ARS tables (base schema)
- **Tables**: `ili_history`, `proposals`, `votes`, `agents`, `reserve_events`, `oracle_data`
- **Note**: This is the foundation migration that must run first

### 002_add_revenue_and_staking.sql
- **Date**: 2026-02-04
- **Description**: Adds tables for revenue tracking, agent staking, and transactions
- **Tables**: `agent_transactions`, `revenue_events`, `revenue_distributions`, `agent_staking`, `sol_staking`, `oracle_query_fees`
- **Modifies**: `agents` (adds staking columns), `proposals` (adds proposal_fee column)

### 003_create_stealth_addresses_table.sql
- **Date**: 2026-02-04
- **Description**: Creates table for storing stealth meta-addresses with encrypted private keys for Sipher Privacy Integration
- **Tables**: `stealth_addresses`
- **Requirements**: 5.1, 5.3 (Sipher Privacy Integration spec)

### 004_add_encryption_metadata_to_stealth_addresses.sql
- **Date**: 2026-02-04
- **Description**: Adds encryption metadata columns to stealth_addresses table
- **Tables**: `stealth_addresses` (modified)
- **Requirements**: 1.3, 1.4 (Sipher Privacy Integration spec)

### 005_create_shielded_transactions_table.sql
- **Date**: 2026-02-04
- **Description**: Creates table for storing shielded ARU transfer transactions with privacy-preserving features
- **Tables**: `shielded_transactions`
- **Requirements**: 5.2, 5.3 (Sipher Privacy Integration spec)

### 006_create_payment_scan_state_table.sql
- **Date**: 2026-02-04
- **Description**: Creates table for tracking payment scanning state per agent
- **Tables**: `payment_scan_state`
- **Requirements**: 3.2 (Sipher Privacy Integration spec)

### 007_create_commitments_table.sql
- **Date**: 2026-02-04
- **Description**: Creates table for storing Pedersen commitments for MEV-protected swaps
- **Tables**: `commitments`
- **Requirements**: 6.3 (Sipher Privacy Integration spec)

### 008_create_privacy_scores_table.sql
- **Date**: 2026-02-04
- **Description**: Creates table for storing wallet privacy scores and analysis results
- **Tables**: `privacy_scores`
- **Requirements**: 9.4 (Sipher Privacy Integration spec)

### 009_create_mev_metrics_table.sql
- **Date**: 2026-02-04
- **Description**: Creates table for tracking MEV extraction metrics for protected swaps
- **Tables**: `mev_metrics`
- **Requirements**: 10.5 (Sipher Privacy Integration spec)

### 010_create_viewing_keys_table.sql
- **Date**: 2026-02-04
- **Description**: Creates table for hierarchical viewing keys with BIP32-style derivation for compliance and selective disclosure
- **Tables**: `viewing_keys`
- **Requirements**: 12.4 (Sipher Privacy Integration spec)
- **Features**: 
  - Hierarchical key structure (m/0 → m/0/org → m/0/org/2026 → m/0/org/2026/Q1)
  - Role-based access (internal, external, regulator, master)
  - Self-referential foreign key for parent-child relationships
  - Expiration and revocation support

### 011_create_disclosures_table.sql
- **Date**: 2026-02-04
- **Description**: Creates table for storing selective transaction disclosures to auditors with encrypted data and expiration
- **Tables**: `disclosures`
- **Requirements**: 14.5 (Sipher Privacy Integration spec)
- **Features**:
  - Foreign key to shielded_transactions (CASCADE delete)
  - Foreign key to viewing_keys (RESTRICT delete)
  - JSONB disclosed_fields for flexible field tracking
  - Expiration and revocation support
  - Indexes on auditor_id, expires_at, created_at

## Running Migrations

### Local Development (Supabase CLI)

```bash
# Apply all pending migrations
supabase db push

# Reset database and apply all migrations
supabase db reset

# Create a new migration
supabase migration new <migration_name>
```

### Production (Supabase Dashboard)

1. Navigate to Database → Migrations in Supabase Dashboard
2. Upload migration file or paste SQL
3. Review changes
4. Apply migration

### Manual Execution (psql)

```bash
# Connect to database
psql $DATABASE_URL

# Run migration
\i supabase/migrations/003_create_stealth_addresses_table.sql
```

## Migration Naming Convention

Migrations follow the pattern: `NNN_description.sql`

- `NNN`: Three-digit sequential number (001, 002, 003, ...)
- `description`: Snake_case description of the migration
- `.sql`: SQL file extension

## Best Practices

1. **Idempotent**: Use `IF NOT EXISTS` clauses to make migrations safe to run multiple times
2. **Reversible**: Include rollback instructions in comments when possible
3. **Documented**: Add comments explaining the purpose and requirements
4. **Tested**: Test migrations on local database before production
5. **Sequential**: Apply migrations in order to maintain schema consistency

## Schema Documentation

For detailed schema documentation, see:
- Design specs: `.kiro/specs/*/design.md`
- Type definitions: `backend/src/services/privacy/types.ts`
- Database client: `backend/src/services/supabase.ts`

## Rollback Instructions

### Rollback 003_create_stealth_addresses_table.sql

```sql
-- Drop indexes
DROP INDEX IF EXISTS public.idx_stealth_created;
DROP INDEX IF EXISTS public.idx_stealth_agent;

-- Drop table
DROP TABLE IF EXISTS public.stealth_addresses;
```

### Rollback 005_create_shielded_transactions_table.sql

```sql
-- Drop indexes
DROP INDEX IF EXISTS public.idx_shielded_created;
DROP INDEX IF EXISTS public.idx_shielded_status;
DROP INDEX IF EXISTS public.idx_shielded_stealth;
DROP INDEX IF EXISTS public.idx_shielded_sender;

-- Drop table
DROP TABLE IF EXISTS public.shielded_transactions;
```

### Rollback 010_create_viewing_keys_table.sql

```sql
-- Drop indexes
DROP INDEX IF EXISTS public.idx_viewing_expires;
DROP INDEX IF EXISTS public.idx_viewing_role;
DROP INDEX IF EXISTS public.idx_viewing_hash;

-- Drop table (foreign key constraint will be dropped automatically)
DROP TABLE IF EXISTS public.viewing_keys;
```

### Rollback 011_create_disclosures_table.sql

```sql
-- Drop indexes
DROP INDEX IF EXISTS public.idx_disclosure_created;
DROP INDEX IF EXISTS public.idx_disclosure_expires;
DROP INDEX IF EXISTS public.idx_disclosure_auditor;

-- Drop table (foreign key constraints will be dropped automatically)
DROP TABLE IF EXISTS public.disclosures;
```

## Support

For issues with migrations:
1. Check Supabase logs for error messages
2. Verify database connection and permissions
3. Review migration syntax and table dependencies
4. Consult the spec documentation for requirements
