# Sipher API Client

Core client for interacting with the Sipher Privacy-as-a-Skill REST API. Provides comprehensive privacy features including stealth addresses, shielded transfers, Pedersen commitments, and hierarchical viewing keys.

## Features

- ✅ **X-API-Key Authentication**: Secure API key authentication via headers
- ✅ **UUID v4 Idempotency Keys**: Safe retries for all mutating operations
- ✅ **Request/Response Logging**: Comprehensive logging with sensitive data sanitization
- ✅ **Configurable Timeout**: Default 30000ms, customizable per client
- ✅ **Error Handling**: Comprehensive error handling with specific error types
- ✅ **Retry Logic**: Exponential backoff for transient failures (implemented in error handler)

## Installation

The Sipher client is part of the privacy services module. Dependencies are managed at the backend workspace level.

```bash
# Install backend dependencies (includes uuid and axios)
npm install --workspace=backend
```

## Configuration

Configure the Sipher client using environment variables:

```bash
# .env
SIPHER_API_URL=https://sipher.sip-protocol.org
SIPHER_API_KEY=your_api_key_here
SIPHER_TIMEOUT=30000
```

## Usage

### Initialize Client

```typescript
import { SipherClient } from './services/privacy/sipher';
import { SipherConfig } from './services/privacy/types';

const config: SipherConfig = {
  baseUrl: process.env.SIPHER_API_URL || 'https://sipher.sip-protocol.org',
  apiKey: process.env.SIPHER_API_KEY!,
  timeout: 30000,
  retries: 3
};

const client = new SipherClient(config);
```

### Stealth Addresses

Generate unlinkable addresses for receiving private payments:

```typescript
// Generate meta-address
const metaAddress = await client.generateMetaAddress('agent-wallet-1');

// Derive one-time stealth address
const stealthAddress = await client.deriveStealthAddress(metaAddress);

// Batch generate (up to 100)
const addresses = await client.batchGenerateStealth(10, 'batch-label');
```

### Shielded Transfers

Build and claim private transfers with hidden amounts:

```typescript
// Build shielded transfer
const transfer = await client.buildShieldedTransfer({
  sender: 'SenderAddress...',
  recipientMetaAddress: recipientMeta,
  amount: '1000000',
  mint: 'ARUTokenMint...'
});

// Claim payment
const result = await client.claimPayment({
  stealthAddress: payment.stealthAddress,
  ephemeralPublicKey: payment.ephemeralPublicKey,
  spendingPrivateKey: decryptedSpendingKey,
  viewingPrivateKey: decryptedViewingKey,
  destinationAddress: 'DestinationAddress...',
  mint: 'ARUTokenMint...'
});
```

### Payment Scanning

Scan for incoming shielded payments:

```typescript
const payments = await client.scanPayments({
  viewingPrivateKey: decryptedViewingKey,
  spendingPublicKey: metaAddress.metaAddress.spendingPublicKey,
  fromSlot: lastScannedSlot,
  limit: 100
});
```

### Pedersen Commitments

Create and verify commitments for hidden amounts:

```typescript
// Create commitment
const commitment = await client.createCommitment('5000000');

// Verify commitment
const verification = await client.verifyCommitment({
  commitment: commitment.commitment,
  value: commitment.value,
  blindingFactor: commitment.blindingFactor
});

// Homomorphic addition
const sum = await client.addCommitments({
  commitmentA: commitmentA.commitment,
  commitmentB: commitmentB.commitment,
  blindingA: commitmentA.blindingFactor,
  blindingB: commitmentB.blindingFactor
});

// Batch create
const commitments = await client.batchCreateCommitments(['1000000', '2000000', '3000000']);
```

### Hierarchical Viewing Keys

Generate and manage role-based viewing keys:

```typescript
// Generate master key
const masterKey = await client.generateViewingKey('m/0');

// Derive child keys
const orgKey = await client.deriveViewingKey(masterKey, 'm/0/org');
const yearKey = await client.deriveViewingKey(orgKey, 'm/0/org/2026');
const quarterKey = await client.deriveViewingKey(yearKey, 'm/0/org/2026/Q1');

// Verify hierarchy
const verification = await client.verifyHierarchy(masterKey, quarterKey);

// Disclose transaction
const disclosure = await client.disclose({
  viewingKey: quarterKey,
  transactionData: { /* transaction details */ }
});

// Decrypt disclosure
const decrypted = await client.decrypt({
  viewingKey: quarterKey,
  encrypted: disclosure.encrypted
});
```

### Privacy Score Analysis

Analyze wallet privacy posture:

```typescript
const score = await client.analyzePrivacy('VaultAddress...', 100);

console.log(`Score: ${score.score}/100 (${score.grade})`);
console.log('Factors:', score.factors);
console.log('Recommendations:', score.recommendations);
```

### Health Check

Verify API availability:

```typescript
const health = await client.checkHealth();
console.log(`Status: ${health.status}, Version: ${health.version}`);
```

## Error Handling

The client includes comprehensive error handling with specific error types:

```typescript
import { SipherErrorHandler } from './services/privacy/sipher';
import {
  SipherAPIError,
  AuthenticationError,
  RateLimitError,
  ValidationError,
  ServerError
} from './services/privacy/types';

const errorHandler = new SipherErrorHandler();

try {
  const result = await client.generateMetaAddress('test');
} catch (error) {
  if (error instanceof AuthenticationError) {
    // Handle authentication error (401)
    console.error('Invalid API key');
  } else if (error instanceof RateLimitError) {
    // Handle rate limiting (429)
    console.error(`Rate limited, retry after ${error.retryAfter}s`);
  } else if (error instanceof ValidationError) {
    // Handle validation error (400)
    console.error('Invalid request:', error.details);
  } else if (error instanceof ServerError) {
    // Handle server error (500, 502, 503)
    console.error('Server error, retrying...');
  }
}
```

### Retry with Exponential Backoff

```typescript
const errorHandler = new SipherErrorHandler();

const result = await errorHandler.retryWithBackoff(
  async () => await client.generateMetaAddress('test'),
  3,    // max retries
  1000  // base delay (ms)
);
```

## Logging

The client includes built-in request/response logging with sensitive data sanitization:

```typescript
// Custom logger
class CustomLogger {
  info(message: string, meta?: any): void { /* ... */ }
  warn(message: string, meta?: any): void { /* ... */ }
  error(message: string, meta?: any): void { /* ... */ }
  debug(message: string, meta?: any): void { /* ... */ }
}

const client = new SipherClient(config, new CustomLogger());
```

Logs include:
- Request method, URL, headers (API key redacted), and body
- Response status, headers, and data
- Error details with context

## Security Considerations

### Private Key Storage

⚠️ **CRITICAL**: Never store private keys in plaintext!

```typescript
// ❌ WRONG - Never do this
const metaAddress = await client.generateMetaAddress('agent-1');
await db.insert({ spending_key: metaAddress.spendingPrivateKey });

// ✅ CORRECT - Always encrypt before storage
const metaAddress = await client.generateMetaAddress('agent-1');
const encryptedSpendingKey = await encryptionService.encrypt(
  metaAddress.spendingPrivateKey,
  agentPublicKey
);
await db.insert({ encrypted_spending_key: encryptedSpendingKey });
```

### Blinding Factor Storage

Blinding factors for Pedersen commitments must also be encrypted:

```typescript
const commitment = await client.createCommitment('1000000');
const encryptedBlindingFactor = await encryptionService.encrypt(
  commitment.blindingFactor,
  protocolMasterKey
);
```

### API Key Protection

- Store API keys in environment variables, never in code
- Use different API keys for development and production
- Rotate API keys quarterly
- Monitor API key usage for anomalies

### Idempotency Keys

The client automatically generates UUID v4 idempotency keys for all mutating operations. This ensures safe retries without duplicate operations.

## API Endpoints

The client supports all Sipher API v1 endpoints:

### Stealth Addresses
- `POST /v1/stealth/generate` - Generate meta-address
- `POST /v1/stealth/derive` - Derive stealth address
- `POST /v1/stealth/generate/batch` - Batch generate (max 100)

### Shielded Transfers
- `POST /v1/transfer/shield` - Build shielded transfer
- `POST /v1/transfer/claim` - Claim stealth payment

### Payment Scanning
- `POST /v1/scan/payments` - Scan for payments

### Commitments
- `POST /v1/commitment/create` - Create commitment
- `POST /v1/commitment/verify` - Verify commitment
- `POST /v1/commitment/add` - Add commitments
- `POST /v1/commitment/create/batch` - Batch create

### Viewing Keys
- `POST /v1/viewing-key/generate` - Generate master key
- `POST /v1/viewing-key/derive` - Derive child key
- `POST /v1/viewing-key/verify-hierarchy` - Verify hierarchy
- `POST /v1/viewing-key/disclose` - Disclose transaction
- `POST /v1/viewing-key/decrypt` - Decrypt disclosure

### Privacy Scoring
- `POST /v1/privacy/score` - Analyze privacy score

### Health Check
- `GET /v1/health` - API health status

## Performance

- Default timeout: 30000ms (30 seconds)
- Configurable per-client
- Automatic retry with exponential backoff (via error handler)
- Batch operations support up to 100 items

## Testing

See `example.ts` for comprehensive usage examples:

```bash
# Run examples (requires valid API key)
ts-node backend/src/services/privacy/sipher/example.ts
```

## References

- [Sipher Repository](https://github.com/sip-protocol/sipher)
- [Sipher API Documentation](https://sipher.sip-protocol.org/docs)
- [DKSAP Specification](https://eips.ethereum.org/EIPS/eip-5564)
- [Pedersen Commitments](https://en.wikipedia.org/wiki/Commitment_scheme#Pedersen_commitment)
- [BIP32 Hierarchical Deterministic Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)

## Task Status

✅ **Task 1.2 Complete**: Sipher API client with authentication
- ✅ X-API-Key authentication
- ✅ UUID v4 idempotency key generation
- ✅ Request/response logging with sanitization
- ✅ Configurable timeout (default 30000ms)
- ✅ Comprehensive error handling
- ✅ All API endpoints implemented
- ✅ Type-safe interfaces
- ✅ Documentation and examples

**Requirements Validated**: 1.1, 2.2, 4.3

**Next Steps**: Task 1.3 - Implement retry logic with exponential backoff
