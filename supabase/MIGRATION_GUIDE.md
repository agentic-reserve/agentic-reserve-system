# Database Migration Guide

## Quick Reset & Run

### Opsi 1: Via Supabase Dashboard (Recommended)

1. **Login ke Supabase Dashboard**: https://app.supabase.com
2. **Pilih project Anda**
3. **Buka SQL Editor** (sidebar kiri)
4. **Reset Database**:
   - Copy isi file `supabase/reset_database.sql`
   - Paste ke SQL Editor
   - Klik "Run"
5. **Run Migrations**:
   - Jalankan migration satu per satu secara berurutan:
     - `001_create_base_tables.sql`
     - `002_add_revenue_and_staking.sql`
     - `003_create_stealth_addresses_table.sql`
     - dst...

### Opsi 2: Via psql (Command Line)

```bash
# 1. Connect ke database
psql "postgresql://postgres:[YOUR-PASSWORD]@[YOUR-PROJECT-REF].supabase.co:5432/postgres"

# 2. Reset database
\i supabase/reset_database.sql

# 3. Run all migrations
\i supabase/run_all_migrations.sql

# 4. Exit
\q
```

### Opsi 3: Via Supabase CLI (Jika sudah install)

```bash
# Install Supabase CLI (jika belum)
npm install -g supabase

# Login
supabase login

# Link project
supabase link --project-ref [YOUR-PROJECT-REF]

# Reset database
supabase db reset

# Migrations akan otomatis dijalankan
```

## Manual Migration (Step by Step)

Jika Anda ingin menjalankan migration satu per satu:

### 1. Reset Database

```sql
-- Copy dan run isi file: supabase/reset_database.sql
```

### 2. Run Migrations Secara Berurutan

```sql
-- Migration 001: Base Tables
\i supabase/migrations/001_create_base_tables.sql

-- Migration 002: Revenue & Staking
\i supabase/migrations/002_add_revenue_and_staking.sql

-- Migration 003: Stealth Addresses
\i supabase/migrations/003_create_stealth_addresses_table.sql

-- Migration 004: Encryption Metadata
\i supabase/migrations/004_add_encryption_metadata_to_stealth_addresses.sql

-- Migration 005: Shielded Transactions
\i supabase/migrations/005_create_shielded_transactions_table.sql

-- Migration 006: Payment Scan State
\i supabase/migrations/006_create_payment_scan_state_table.sql

-- Migration 007: Commitments
\i supabase/migrations/007_create_commitments_table.sql

-- Migration 008: Privacy Scores
\i supabase/migrations/008_create_privacy_scores_table.sql

-- Migration 009: MEV Metrics
\i supabase/migrations/009_create_mev_metrics_table.sql

-- Migration 010: Viewing Keys
\i supabase/migrations/010_create_viewing_keys_table.sql

-- Migration 011: Disclosures
\i supabase/migrations/011_create_disclosures_table.sql

-- Migration 012: Solder Cortex Memory
\i supabase/migrations/012_create_solder_cortex_memory_tables.sql
```

## Troubleshooting

### Error: "relation already exists"

Artinya tabel sudah ada. Solusi:
1. Run `reset_database.sql` untuk drop semua tabel
2. Jalankan ulang migration dari awal

### Error: "column already exists"

Artinya kolom sudah ada dari migration sebelumnya. Solusi:
- Migration sudah menggunakan `IF NOT EXISTS` dan `ADD COLUMN IF NOT EXISTS`
- Jika masih error, reset database dan run ulang

### Error: "policy already exists"

Artinya policy RLS sudah ada. Solusi:
- Drop policy manual: `DROP POLICY IF EXISTS "policy_name" ON table_name;`
- Atau reset database dan run ulang

### Error: "permission denied"

Artinya user tidak punya permission. Solusi:
- Pastikan Anda login sebagai `postgres` user atau user dengan role `service_role`
- Di Supabase Dashboard, gunakan SQL Editor yang otomatis menggunakan service role

## Verifikasi Migration Berhasil

Setelah run migration, cek apakah semua tabel sudah ada:

```sql
-- List all tables
SELECT table_name 
FROM information_schema.tables 
WHERE table_schema = 'public' 
ORDER BY table_name;

-- Expected tables:
-- agents
-- agent_staking
-- agent_transactions
-- commitments
-- disclosures
-- ili_history
-- mev_metrics
-- oracle_data
-- oracle_query_fees
-- payment_scan_state
-- privacy_scores
-- proposals
-- reserve_events
-- revenue_distributions
-- revenue_events
-- shielded_transactions
-- sol_staking
-- stealth_addresses
-- viewing_keys
-- votes
```

## Connection String

Dapatkan connection string dari:
1. Supabase Dashboard → Settings → Database
2. Copy "Connection string" atau "Connection pooling"
3. Format: `postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres`

## Environment Variables

Pastikan `.env` sudah diisi dengan benar:

```env
SUPABASE_URL=https://[YOUR-PROJECT-REF].supabase.co
SUPABASE_KEY=[YOUR-ANON-KEY]
SUPABASE_SERVICE_ROLE_KEY=[YOUR-SERVICE-ROLE-KEY]
DATABASE_URL=postgresql://postgres:[PASSWORD]@[PROJECT-REF].supabase.co:5432/postgres
```

## Notes

- **PENTING**: `reset_database.sql` akan **MENGHAPUS SEMUA DATA**. Backup dulu jika ada data penting!
- Migration menggunakan `IF NOT EXISTS` untuk idempotency
- RLS (Row Level Security) sudah diaktifkan untuk semua tabel
- Realtime subscriptions sudah dikonfigurasi untuk tabel utama
