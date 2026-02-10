# Privacy Services Module

This module provides privacy-preserving features for the Agentic Reserve System (ARS) powered by Sipher's Privacy-as-a-Skill REST API.

## Overview

The Privacy Services Module enables three critical capabilities:

1. **Shielded ARU Transfers** (Phase 1): Privacy-preserving token transfers using stealth addresses
2. **MEV-Protected Rebalancing** (Phase 2): Vault rebalancing with Pedersen commitments to prevent MEV attacks
3. **Compliance Layer** (Phase 3): Selective disclosure through hierarchical viewing keys for regulatory compliance

## Directory Structure

```
privacy/
├── sipher/              # Sipher API client and utilities
│   ├── index.ts         # Module exports
│   ├── sipher-client.ts # Core API client (to be implemented)
│   ├── sipher-error-handler.ts # Error handling (to be implemented)
│   └── types.ts         # Sipher-specific types (to be implemented)
│
├── stealth/             # Stealth address management
│   ├── index.ts         # Module exports
│   ├── stealth-address-manager.ts # Address generation and storage (to be implemented)
│   └── types.ts         # Stealth address types (to be implemented)
│
├── shielded/            # Shielded transfer building
│   ├── index.ts         # Module exports
│   ├── shielded-transfer-builder.ts # Transfer building (to be implemented)
│   └── types.ts         # Transfer types (to be implemented)
│
├── scanning/            # Payment scanning service
│   ├── index.ts         # Module exports
│   ├── payment-scanner-service.ts # Continuous scanning (to be implemented)
│   └── types.ts         # Scanning types (to be implemented)
│
├── index.ts             # Main module exports
├── types.ts             # Common type definitions
└── README.md            # This file
```

## Phase 1: Shielded ARU Transfers

### Components

- **Sipher API Client**: Centralized client for all Sipher REST API interactions
- **Stealth Address Manager**: Generate and manage stealth meta-addresses for agents
- **Shielded Transfer Builder**: Build and submit shielded ARU transfers
- **Payment Scanner Service**: Continuously scan for incoming shielded payments

### Features

- Generate stealth meta-addresses for agents
- Build shielded transfers with hidden recipients and amounts
- Scan blockchain for incoming payments to stealth addresses
- Claim payments from stealth addresses to real wallets
- Track transaction history and status

## Phase 2: MEV-Protected Rebalancing (Future)

### Components (To Be Implemented)

- **Commitment Manager**: Create and verify Pedersen commitments
- **Privacy Score Analyzer**: Analyze wallet privacy posture
- **MEV Protection Service**: Execute protected swaps with hidden amounts

### Features

- Create Pedersen commitments for swap amounts
- Homomorphic addition of commitments
- Privacy score analysis (0-100 scale)
- MEV-protected swap execution
- MEV extraction measurement

## Phase 3: Compliance Layer (Future)

### Components (To Be Implemented)

- **Viewing Key Manager**: Generate and manage hierarchical viewing keys
- **Compliance Service**: Role-based disclosure and compliance reporting
- **Disclosure Service**: Encrypt and decrypt transaction data

### Features

- Hierarchical viewing key generation (BIP32-style)
- Role-based access control (internal/external/regulator/master)
- Selective transaction disclosure
- Compliance report generation
- Multi-signature protection for master keys

## Technology Stack

- **API**: Sipher REST API (https://sipher.sip-protocol.org)
- **Runtime**: Node.js 22, TypeScript 5
- **Database**: PostgreSQL (Supabase)
- **Cache**: Redis
- **Encryption**: AES-256-GCM
- **Testing**: Vitest, fast-check (property-based testing)

## Configuration

Environment variables required:

```bash
# Sipher API Configuration
SIPHER_API_URL=https://sipher.sip-protocol.org
SIPHER_API_KEY=your_api_key_here
SIPHER_ENABLED=true
SIPHER_TIMEOUT=30000

# Privacy Features
PRIVACY_ENABLED=true
MEV_PROTECTION_ENABLED=false  # Phase 2
COMPLIANCE_MODE=none          # Phase 3: none, selective, full

# Privacy Thresholds
PRIVACY_SCORE_THRESHOLD=70
MEV_REDUCTION_TARGET=80

# Key Management
KEY_ROTATION_DAYS=90
VIEWING_KEY_EXPIRATION_DAYS=30
MASTER_KEY_MULTISIG_THRESHOLD=3

# Scanning Configuration
PAYMENT_SCAN_INTERVAL_SECONDS=60
PAYMENT_SCAN_BATCH_SIZE=100
PAYMENT_SCAN_RETRY_ATTEMPTS=3

# Encryption
ENCRYPTION_ALGORITHM=aes-256-gcm
ENCRYPTION_KEY_DERIVATION=pbkdf2
ENCRYPTION_ITERATIONS=100000
```

## Usage

```typescript
import {
  SipherClient,
  StealthAddressManager,
  ShieldedTransferBuilder,
  PaymentScannerService
} from './services/privacy';

// Initialize Sipher client
const sipherClient = new SipherClient({
  baseUrl: process.env.SIPHER_API_URL!,
  apiKey: process.env.SIPHER_API_KEY!,
  timeout: 30000,
  retries: 3
});

// Generate stealth address for agent
const stealthManager = new StealthAddressManager(sipherClient, db, encryption);
const metaAddress = await stealthManager.generateForAgent('agent-1', 'primary');

// Build shielded transfer
const transferBuilder = new ShieldedTransferBuilder(sipherClient, stealthManager, db, solana);
const transfer = await transferBuilder.buildTransfer({
  senderId: 'agent-1',
  recipientMetaAddressId: metaAddress.id,
  amount: '1000000',
  mint: 'ARU_MINT_ADDRESS'
});

// Start payment scanner
const scanner = new PaymentScannerService(sipherClient, stealthManager, db, eventEmitter);
await scanner.start({
  intervalSeconds: 60,
  batchSize: 100,
  retryAttempts: 3
});
```

## Testing

### Unit Tests

```bash
npm run test -- privacy
```

### Property-Based Tests

```bash
npm run test -- privacy --grep "Property"
```

### Integration Tests

```bash
npm run test:integration -- privacy
```

## Security Considerations

1. **Key Storage**: All private keys encrypted at rest with AES-256-GCM
2. **Key Derivation**: PBKDF2 with 100,000 iterations
3. **API Authentication**: X-API-Key header for Sipher API
4. **Idempotency**: UUID v4 idempotency keys for safe retries
5. **Rate Limiting**: Exponential backoff for API rate limits
6. **Audit Logging**: All key operations and disclosures logged

## References

- [Sipher Repository](https://github.com/sip-protocol/sipher.git)
- [Sipher README](https://github.com/sip-protocol/sipher/blob/main/README.md)
- [Sipher Roadmap](https://github.com/sip-protocol/sipher/blob/main/ROADMAP.md)
- [SIP Protocol](https://sip-protocol.org)
- [DKSAP Specification](https://eips.ethereum.org/EIPS/eip-5564)
- [Pedersen Commitments](https://en.wikipedia.org/wiki/Commitment_scheme#Pedersen_commitment)
- [BIP32 Hierarchical Deterministic Wallets](https://github.com/bitcoin/bips/blob/master/bip-0032.mediawiki)

## Implementation Status

- [x] Phase 1 Setup: Directory structure and type definitions
- [ ] Phase 1: Sipher API Client
- [ ] Phase 1: Stealth Address Management
- [ ] Phase 1: Shielded Transfer Building
- [ ] Phase 1: Payment Scanning
- [ ] Phase 2: MEV Protection (Future)
- [ ] Phase 3: Compliance Layer (Future)

## Contributing

When implementing new features:

1. Follow the existing directory structure
2. Add comprehensive type definitions
3. Implement error handling with retry logic
4. Write unit tests and property-based tests
5. Update this README with implementation status
6. Document all public APIs with JSDoc comments

## License

Part of the Agentic Reserve System (ARS) - See main project LICENSE
