# Privacy Services Database Schema

This document describes the database schema for the Sipher Privacy Integration.

## Overview

The privacy services use PostgreSQL (via Supabase) to store stealth addresses, shielded transactions, viewing keys, and related privacy data. All sensitive data (private keys, blinding factors) is encrypted at rest using AES-256-GCM.

## Tables

### stealth_addresses

Stores stealth meta-addresses for agents with encrypted private keys.

**Purpose**: Enable privacy-preserving ARU token transfers using Sipher's stealth address protocol.

**Schema**:

```sql
CREATE TABLE public.stealth_addresses (
    id SERIAL PRIMARY KEY,
    agent_id VARCHAR(255) NOT NULL,
    meta_address JSONB NOT NULL,
    encrypted_spending_key TEXT NOT NULL,
    encrypted_viewing_key TEXT NOT NULL,
    label VARCHAR(255),
    created_at TIMESTAMPTZ DEFAULT NOW()
);
```

**Columns**:

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL | NO | Primary key, auto-incrementing |
| `agent_id` | VARCHAR(255) | NO | Unique identifier for the agent owning this meta-address |
| `meta_address` | JSONB | NO | Contains `spendingPublicKey` and `viewingPublicKey` (Base58 encoded) |
| `encrypted_spending_key` | TEXT | NO | AES-256-GCM encrypted spending private key |
| `encrypted_viewing_key` | TEXT | NO | AES-256-GCM encrypted viewing private key |
| `label` | VARCHAR(255) | YES | Optional human-readable label for identifying the purpose |
| `created_at` | TIMESTAMPTZ | YES | Timestamp when the meta-address was created (default: NOW()) |

**Indexes**:

- `idx_stealth_agent` on `agent_id` - For efficient lookup of all meta-addresses for an agent
- `idx_stealth_created` on `created_at DESC` - For chronological queries

**TypeScript Types**:

```typescript
// Database row type
interface StealthAddressDB {
  id: number;
  agent_id: string;
  meta_address: {
    spendingPublicKey: string;
    viewingPublicKey: string;
  };
  encrypted_spending_key: string;
  encrypted_viewing_key: string;
  label: string;
  created_at: Date;
}

// Application record type
interface StealthAddressRecord {
  id: number;
  agentId: string;
  metaAddress: MetaAddress;
  encryptedSpendingKey: string;
  encryptedViewingKey: string;
  label: string;
  createdAt: Date;
}
```

**Example Queries**:

```typescript
// Insert new stealth address
const { data, error } = await supabase
  .from('stealth_addresses')
  .insert({
    agent_id: 'agent-123',
    meta_address: {
      spendingPublicKey: '5ZWj7a1f8tWkjBESHKgrLmXshuXxqeY9SYcfbshpAqPG',
      viewingPublicKey: '8qbHbw2BbbTHBW1sbeqakYXVKRQM8Ne7pLK7m6CVfeR9'
    },
    encrypted_spending_key: 'encrypted_data_here',
    encrypted_viewing_key: 'encrypted_data_here',
    label: 'Primary Meta-Address'
  })
  .select()
  .single();

// Get all meta-addresses for an agent
const { data, error } = await supabase
  .from('stealth_addresses')
  .select('*')
  .eq('agent_id', 'agent-123')
  .order('created_at', { ascending: false });

// Get specific meta-address by ID
const { data, error } = await supabase
  .from('stealth_addresses')
  .select('*')
  .eq('id', 1)
  .single();
```

**Security Considerations**:

1. **Encryption**: Private keys MUST be encrypted before storage using AES-256-GCM
2. **Key Derivation**: Encryption keys derived from agent public key using PBKDF2 (100k iterations)
3. **Access Control**: Implement row-level security (RLS) policies to restrict access by agent_id
4. **Audit Logging**: Log all access to encrypted keys for security monitoring
5. **Key Rotation**: Implement quarterly key rotation policy

**Migration**:

- File: `supabase/migrations/003_create_stealth_addresses_table.sql`
- Requirements: 5.1, 5.3 (Sipher Privacy Integration)
- Date: 2026-02-04

## Future Tables (Phase 2 & 3)

### shielded_transactions (Phase 1)

Stores shielded ARU transfer transactions.

**Status**: Not yet implemented

**Schema Preview**:

```sql
CREATE TABLE public.shielded_transactions (
  id SERIAL PRIMARY KEY,
  tx_signature VARCHAR(255) UNIQUE NOT NULL,
  sender VARCHAR(255) NOT NULL,
  stealth_address VARCHAR(255) NOT NULL,
  ephemeral_public_key VARCHAR(255) NOT NULL,
  commitment TEXT NOT NULL,
  amount_encrypted TEXT NOT NULL,
  viewing_key_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  claimed_at TIMESTAMPTZ
);
```

### payment_scan_state (Phase 1)

Tracks last scanned slot for payment scanning.

**Status**: Not yet implemented

### commitments (Phase 2)

Stores Pedersen commitments for MEV protection.

**Status**: Not yet implemented

### privacy_scores (Phase 2)

Stores privacy score analysis results.

**Status**: Not yet implemented

### mev_metrics (Phase 2)

Stores MEV extraction measurements.

**Status**: Not yet implemented

### viewing_keys (Phase 3)

Stores hierarchical viewing keys for compliance.

**Status**: Not yet implemented

### disclosures (Phase 3)

Stores compliance disclosure records.

**Status**: Not yet implemented

## Database Client

The privacy services use the shared Supabase client from `backend/src/services/supabase.ts`.

**Usage**:

```typescript
import { supabase } from '../supabase';

// Query example
const { data, error } = await supabase
  .from('stealth_addresses')
  .select('*')
  .eq('agent_id', agentId);

if (error) {
  throw new DatabaseError(error.message, error.code);
}

return data;
```

## Testing

### Unit Tests

Test database operations with mocked Supabase client:

```typescript
import { describe, it, expect, vi } from 'vitest';

describe('StealthAddressManager', () => {
  it('should store stealth address in database', async () => {
    const mockSupabase = {
      from: vi.fn().mockReturnValue({
        insert: vi.fn().mockReturnValue({
          select: vi.fn().mockReturnValue({
            single: vi.fn().mockResolvedValue({
              data: { id: 1, agent_id: 'test-agent' },
              error: null
            })
          })
        })
      })
    };
    
    // Test implementation
  });
});
```

### Integration Tests

Test with real database (local Supabase instance):

```typescript
describe('Database Integration', () => {
  it('should create and retrieve stealth address', async () => {
    // Insert test data
    const { data: inserted } = await supabase
      .from('stealth_addresses')
      .insert({ /* test data */ })
      .select()
      .single();
    
    // Retrieve and verify
    const { data: retrieved } = await supabase
      .from('stealth_addresses')
      .select('*')
      .eq('id', inserted.id)
      .single();
    
    expect(retrieved).toEqual(inserted);
    
    // Cleanup
    await supabase
      .from('stealth_addresses')
      .delete()
      .eq('id', inserted.id);
  });
});
```

## Monitoring

### Key Metrics

- **Table Size**: Monitor growth of `stealth_addresses` table
- **Query Performance**: Track query execution times for indexed lookups
- **Encryption Operations**: Monitor encryption/decryption latency
- **Failed Queries**: Alert on database errors

### Supabase Dashboard

Monitor via Supabase Dashboard:
1. Database → Tables → stealth_addresses
2. Database → Indexes → Check index usage
3. Database → Logs → Query performance
4. Database → Backups → Verify backup schedule

## Backup and Recovery

### Automated Backups

Supabase provides automated daily backups. Verify backup schedule in Supabase Dashboard.

### Manual Backup

```bash
# Export stealth_addresses table
pg_dump $DATABASE_URL -t stealth_addresses > stealth_addresses_backup.sql

# Restore from backup
psql $DATABASE_URL < stealth_addresses_backup.sql
```

### Disaster Recovery

1. Restore from latest Supabase backup
2. Verify data integrity
3. Re-encrypt any exposed keys
4. Audit access logs for security incidents

## References

- [Sipher Privacy Integration Spec](.kiro/specs/sipher-privacy-integration/)
- [Type Definitions](./types.ts)
- [Migration Files](../../../../../supabase/migrations/)
- [Supabase Documentation](https://supabase.com/docs)
