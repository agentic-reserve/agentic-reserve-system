# Shielded Transactions Database Schema

## Overview

The `shielded_transactions` table stores all shielded ARU transfer transactions with privacy-preserving features. This table is part of Phase 1 of the Sipher Privacy Integration and enables unlinkable, private token transfers using stealth addresses and Pedersen commitments.

## Table: shielded_transactions

### Purpose

Track all shielded ARU transfers from creation through claiming, maintaining transaction history while preserving privacy through cryptographic commitments and stealth addresses.

### Schema

```sql
CREATE TABLE shielded_transactions (
  id SERIAL PRIMARY KEY,
  tx_signature VARCHAR(255) UNIQUE NOT NULL,
  sender VARCHAR(255) NOT NULL,
  stealth_address VARCHAR(255) NOT NULL,
  ephemeral_public_key VARCHAR(255) NOT NULL,
  commitment TEXT NOT NULL,
  amount_encrypted TEXT NOT NULL,
  viewing_key_hash VARCHAR(255),
  status VARCHAR(50) DEFAULT 'pending' NOT NULL,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  claimed_at TIMESTAMP,
  
  CONSTRAINT chk_status CHECK (status IN ('pending', 'confirmed', 'claimed', 'failed'))
);
```

### Columns

| Column | Type | Nullable | Description |
|--------|------|----------|-------------|
| `id` | SERIAL | NO | Primary key, auto-incrementing identifier |
| `tx_signature` | VARCHAR(255) | NO | Unique Solana transaction signature (base58) |
| `sender` | VARCHAR(255) | NO | Sender's public wallet address (visible on-chain) |
| `stealth_address` | VARCHAR(255) | NO | One-time recipient stealth address (unlinkable) |
| `ephemeral_public_key` | VARCHAR(255) | NO | Ephemeral public key used for stealth address derivation |
| `commitment` | TEXT | NO | Pedersen commitment hiding the transfer amount (hex) |
| `amount_encrypted` | TEXT | NO | Encrypted amount value for recipient decryption |
| `viewing_key_hash` | VARCHAR(255) | YES | Optional hash of viewing key for compliance disclosure |
| `status` | VARCHAR(50) | NO | Transaction status: pending, confirmed, claimed, or failed |
| `created_at` | TIMESTAMP | NO | Timestamp when transaction was created |
| `claimed_at` | TIMESTAMP | YES | Timestamp when payment was claimed (if applicable) |

### Indexes

```sql
CREATE INDEX idx_shielded_sender ON shielded_transactions(sender);
CREATE INDEX idx_shielded_stealth ON shielded_transactions(stealth_address);
CREATE INDEX idx_shielded_status ON shielded_transactions(status);
CREATE INDEX idx_shielded_created ON shielded_transactions(created_at DESC);
```

**Index Usage**:
- `idx_shielded_sender`: Query transactions by sender address
- `idx_shielded_stealth`: Query transactions by stealth address (for claiming)
- `idx_shielded_status`: Filter transactions by status (pending, confirmed, etc.)
- `idx_shielded_created`: Sort transactions by creation time (most recent first)

### Constraints

**Primary Key**: `id` (auto-incrementing)

**Unique Constraint**: `tx_signature` (prevents duplicate transaction records)

**Check Constraint**: `status` must be one of: `pending`, `confirmed`, `claimed`, `failed`

### Status Lifecycle

```
pending → confirmed → claimed
   ↓
failed
```

**Status Transitions**:
1. **pending**: Transaction built but not yet confirmed on-chain
2. **confirmed**: Transaction confirmed on Solana blockchain
3. **claimed**: Recipient has claimed the payment to their real wallet
4. **failed**: Transaction failed (insufficient balance, network error, etc.)

**Property 14**: Transaction status SHALL transition in order (pending → confirmed → claimed) and SHALL NOT transition backwards or skip states.

## TypeScript Types

```typescript
export type ShieldedTransactionStatus = 'pending' | 'confirmed' | 'claimed' | 'failed';

export interface ShieldedTransactionDB {
  id: number;
  tx_signature: string;
  sender: string;
  stealth_address: string;
  ephemeral_public_key: string;
  commitment: string;
  amount_encrypted: string;
  viewing_key_hash?: string;
  status: ShieldedTransactionStatus;
  created_at: Date;
  claimed_at?: Date;
}

export interface ShieldedTransferRecord {
  id: number;
  txSignature: string;
  sender: string;
  stealthAddress: string;
  ephemeralPublicKey: string;
  commitment: string;
  amountEncrypted: string;
  viewingKeyHash?: string;
  status: ShieldedTransactionStatus;
  createdAt: Date;
  claimedAt?: Date;
}
```

## Privacy Features

### Unlinkable Transactions

**Stealth Addresses**: Each transaction uses a unique, one-time stealth address derived from the recipient's meta-address. Multiple payments to the same recipient cannot be linked through on-chain analysis.

**Property 4**: For any two shielded transfers to the same meta-address, the derived stealth addresses SHALL be cryptographically unlinkable.

### Hidden Amounts

**Pedersen Commitments**: Transaction amounts are hidden in cryptographic commitments. Only the recipient (with viewing key) can decrypt the amount.

**Property 11**: Commitment SHALL verify with correct value/blinding factor and SHALL fail with incorrect values.

### Selective Disclosure

**Viewing Key Hash**: Optional field enables compliance officers to decrypt transaction details using hierarchical viewing keys without revealing spending power.

**Property 13**: Disclosed transaction data SHALL NOT contain spending keys, viewing keys, or blinding factors.

## Query Examples

### Get all pending transactions for a sender

```sql
SELECT * FROM shielded_transactions
WHERE sender = 'sender_address_here'
  AND status = 'pending'
ORDER BY created_at DESC;
```

### Get unclaimed payments to a stealth address

```sql
SELECT * FROM shielded_transactions
WHERE stealth_address = 'stealth_address_here'
  AND status = 'confirmed'
  AND claimed_at IS NULL;
```

### Get transaction history for date range

```sql
SELECT * FROM shielded_transactions
WHERE created_at BETWEEN '2026-01-01' AND '2026-12-31'
ORDER BY created_at DESC
LIMIT 100;
```

### Get failed transactions for debugging

```sql
SELECT 
  tx_signature,
  sender,
  stealth_address,
  created_at
FROM shielded_transactions
WHERE status = 'failed'
ORDER BY created_at DESC;
```

### Count transactions by status

```sql
SELECT 
  status,
  COUNT(*) as count
FROM shielded_transactions
GROUP BY status;
```

## Relationships

### Future Foreign Keys (Phase 3)

When compliance layer is implemented:

```sql
-- Link to disclosures table
ALTER TABLE disclosures
ADD CONSTRAINT fk_disclosure_transaction
FOREIGN KEY (transaction_id) REFERENCES shielded_transactions(id);
```

## Security Considerations

### Data Protection

1. **Amount Encryption**: `amount_encrypted` field contains encrypted amount, only decryptable by recipient
2. **Commitment Privacy**: `commitment` field hides amount using Pedersen commitment scheme
3. **Stealth Address Unlinkability**: `stealth_address` prevents transaction graph analysis
4. **Viewing Key Control**: `viewing_key_hash` enables selective disclosure without spending power

### Access Control

- **Read Access**: Agents can query their own transactions (by sender or stealth_address)
- **Write Access**: Only ShieldedTransferBuilder service can insert/update records
- **Compliance Access**: Viewing key holders can decrypt amounts for disclosed transactions

### Audit Trail

All transactions are permanently recorded with:
- Creation timestamp (`created_at`)
- Claim timestamp (`claimed_at`)
- Status transitions (via status updates)
- On-chain signature (`tx_signature`)

## Performance Considerations

### Index Optimization

- **Sender queries**: `idx_shielded_sender` enables fast sender lookups
- **Stealth queries**: `idx_shielded_stealth` enables fast payment detection
- **Status filtering**: `idx_shielded_status` enables efficient status-based queries
- **Time-series queries**: `idx_shielded_created` enables fast chronological sorting

### Expected Load

- **Phase 1**: 100-1,000 transactions/day
- **Phase 2**: 1,000-10,000 transactions/day (with MEV protection)
- **Phase 3**: 10,000+ transactions/day (with compliance layer)

### Scaling Strategy

- Partition by `created_at` for time-series data (monthly partitions)
- Archive old transactions (>1 year) to separate table
- Use connection pooling for high-concurrency access

## Migration

**Migration File**: `supabase/migrations/005_create_shielded_transactions_table.sql`

**Requirements**: 5.2, 5.3 (Sipher Privacy Integration spec)

**Rollback**:
```sql
DROP INDEX IF EXISTS public.idx_shielded_created;
DROP INDEX IF EXISTS public.idx_shielded_status;
DROP INDEX IF EXISTS public.idx_shielded_stealth;
DROP INDEX IF EXISTS public.idx_shielded_sender;
DROP TABLE IF EXISTS public.shielded_transactions;
```

## Testing

**Test File**: `supabase/migrations/005_create_shielded_transactions_table.test.sql`

**Test Coverage**:
1. Table existence verification
2. Column types and constraints
3. Index creation
4. Status constraint enforcement
5. Unique constraint on tx_signature
6. Insert/update operations
7. Query performance

## References

- **Spec**: `.kiro/specs/sipher-privacy-integration/requirements.md` (Requirements 5.2, 5.3)
- **Design**: `.kiro/specs/sipher-privacy-integration/design.md` (Database Schema section)
- **Types**: `backend/src/services/privacy/types.ts`
- **Migration**: `supabase/migrations/005_create_shielded_transactions_table.sql`
- **Sipher API**: https://sipher.sip-protocol.org
- **DKSAP Spec**: https://eips.ethereum.org/EIPS/eip-5564

