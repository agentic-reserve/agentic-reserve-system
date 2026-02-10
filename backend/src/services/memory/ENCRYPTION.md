# Privacy-Protected Transaction Encryption

## Overview

The Transaction Indexer implements privacy-protected transaction handling to ensure sensitive transaction data is encrypted before storage in the database. This satisfies Requirements 8.3 and 8.4 from the Solder Cortex Supabase Integration specification.

## Requirements

**Requirement 8.3**: When indexing shielded transfers, the Memory_Service SHALL NOT store plaintext transfer amounts in the `wallet_transactions` table.

**Requirement 8.4**: The Memory_Service SHALL store encrypted metadata for privacy-protected transactions with agent-specific decryption keys.

## Implementation

### Encryption Algorithm

- **Algorithm**: AES-256-GCM (Advanced Encryption Standard with Galois/Counter Mode)
- **Key Size**: 256 bits (32 bytes)
- **IV Size**: 128 bits (16 bytes) - randomly generated per transaction
- **Authentication Tag**: 128 bits (16 bytes) - for integrity verification

### Key Derivation

Agent-specific encryption keys are derived from the wallet address using SHA-256:

```typescript
key = SHA256(wallet_address + salt)
```

Where:
- `wallet_address`: The Solana wallet address (base58 encoded)
- `salt`: Environment variable `ENCRYPTION_SALT` (defaults to `'ars-protocol-default-salt'`)

**Note**: In production, this should be replaced with a proper Key Management System (KMS) such as AWS KMS, HashiCorp Vault, or similar.

### Encrypted Data Structure

Encrypted data is stored as a JSON string with the following structure:

```typescript
{
  ciphertext: string;      // Hex-encoded encrypted data
  iv: string;              // Hex-encoded initialization vector (16 bytes)
  authTag: string;         // Hex-encoded authentication tag (16 bytes)
  agentKeyHash: string;    // SHA-256 hash of the encryption key (32 bytes)
  algorithm: string;       // "aes-256-gcm"
  version: number;         // 1 (for future compatibility)
}
```

### Sensitive Fields

The following fields are encrypted for privacy-protected transactions:

```typescript
{
  amount: number;              // Transaction amount
  counterparty?: string;       // Counterparty wallet address
  tokenMint: string;           // Token mint address
  metadata: Record<string, any>; // Full transaction metadata
}
```

### Database Storage

For privacy-protected transactions:

| Field | Storage |
|-------|---------|
| `amount` | **NULL** (not stored in plaintext) |
| `counterparty_address` | **NULL** (not stored in plaintext) |
| `metadata` | **NULL** (not stored in plaintext) |
| `encrypted_data` | JSON string containing encrypted sensitive fields |
| `is_privacy_protected` | `true` |

For non-privacy-protected transactions:

| Field | Storage |
|-------|---------|
| `amount` | Plaintext numeric value |
| `counterparty_address` | Plaintext wallet address |
| `metadata` | Plaintext JSONB |
| `encrypted_data` | **NULL** |
| `is_privacy_protected` | `false` |

## Usage

### Encryption (Automatic)

Encryption happens automatically when indexing a transaction for a wallet registered with `privacy_protected = true`:

```typescript
const indexer = new TransactionIndexer();

// Transaction will be automatically encrypted if wallet is privacy-protected
await indexer.indexTransaction(transaction);
```

### Decryption (Manual)

To decrypt a privacy-protected transaction, use the `decryptSensitiveData` method with the correct wallet address:

```typescript
const indexer = new TransactionIndexer();

// Fetch encrypted transaction from database
const { data } = await supabase
  .from('wallet_transactions')
  .select('encrypted_data')
  .eq('signature', txSignature)
  .single();

// Decrypt with the wallet address that owns the transaction
const decrypted = indexer.decryptSensitiveData(
  data.encrypted_data,
  walletAddress
);

console.log('Amount:', decrypted.amount);
console.log('Counterparty:', decrypted.counterparty);
console.log('Token Mint:', decrypted.tokenMint);
console.log('Metadata:', decrypted.metadata);
```

### Authorization Check

Before decrypting, always verify that the requesting agent is authorized to access the data:

```typescript
// Check if wallet is privacy-protected
const isProtected = await indexer.isPrivacyProtected(walletAddress);

if (isProtected) {
  // Verify agent authorization (implement your authorization logic)
  if (!isAuthorized(agentId, walletAddress)) {
    throw new Error('Unauthorized access to privacy-protected wallet');
  }
}

// Proceed with decryption
const decrypted = indexer.decryptSensitiveData(encryptedData, walletAddress);
```

## Security Considerations

### Current Implementation

1. **Agent Isolation**: Each wallet has a unique encryption key, preventing cross-agent data access
2. **Integrity Protection**: GCM mode provides authentication tag to detect tampering
3. **Random IVs**: Each encryption uses a fresh random IV to prevent pattern analysis
4. **Key Hash Verification**: Decryption verifies the key hash before attempting decryption

### Production Recommendations

1. **Use a KMS**: Replace SHA-256 key derivation with a proper Key Management System
2. **Key Rotation**: Implement periodic key rotation with re-encryption of old data
3. **Audit Logging**: Log all decryption attempts for compliance and security monitoring
4. **Rate Limiting**: Implement rate limits on decryption operations to prevent brute force
5. **Hardware Security Modules (HSM)**: Consider using HSMs for key storage in high-security environments
6. **Zero-Knowledge Proofs**: For advanced privacy, consider integrating ZK proofs for transaction verification without decryption

### Environment Variables

```bash
# Encryption salt for key derivation
# CRITICAL: Change this in production and keep it secret
ENCRYPTION_SALT=your-secure-random-salt-here
```

## Testing

Unit tests are provided in `backend/src/tests/transaction-indexer-encryption.test.ts`:

```bash
npm run test -- transaction-indexer-encryption.test.ts
```

Tests cover:
- ✅ Encryption of sensitive fields
- ✅ Decryption with correct key
- ✅ Decryption failure with wrong key
- ✅ Tamper detection via authentication tag
- ✅ Version and algorithm validation
- ✅ Round-trip encryption/decryption
- ✅ Different IVs for same data
- ✅ Different keys for different wallets

## Integration with Sipher Protocol

This encryption implementation is designed to work alongside the Sipher privacy protocol:

- **Sipher**: Provides stealth addresses and shielded transfers on-chain
- **Transaction Indexer**: Provides additional encryption layer for off-chain storage

When a transaction uses Sipher stealth addresses:
1. On-chain: Transaction uses stealth address (privacy at protocol level)
2. Off-chain: Transaction data is encrypted before database storage (privacy at storage level)

This provides defense-in-depth privacy protection.

## Future Enhancements

1. **Viewing Keys**: Implement hierarchical viewing keys for selective disclosure to auditors
2. **Homomorphic Encryption**: Enable computation on encrypted data without decryption
3. **Multi-Party Computation**: Allow multiple agents to jointly decrypt data
4. **Time-Locked Encryption**: Automatically decrypt data after a specified time period
5. **Threshold Encryption**: Require multiple keys to decrypt (e.g., 2-of-3 multisig)

## References

- [AES-GCM Specification (NIST SP 800-38D)](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-38d.pdf)
- [Node.js Crypto Module](https://nodejs.org/api/crypto.html)
- [Solder Cortex Supabase Integration Spec](.kiro/specs/solder-cortex-supabase-integration/)
