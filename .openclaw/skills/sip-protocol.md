# Sipher — Privacy-as-a-Skill for Solana Agents

> Add stealth addresses, hidden amounts, and compliance viewing keys to any Solana transaction.

**Base URL:** `https://sipher.sip-protocol.org`
**Auth:** `X-API-Key: <your-key>` header (skip for `GET /`, `GET /skill.md`, `GET /v1/health`, `GET /v1/ready`, `GET /v1/errors`)
**Docs:** Interactive API docs at `/docs` | OpenAPI spec at `/v1/openapi.json`

---

## What Sipher Does

Sipher wraps [SIP Protocol](https://sip-protocol.org)'s privacy SDK as a REST API. Any autonomous agent can call these endpoints to:

1. **Generate stealth addresses** — one-time recipient addresses that prevent on-chain linkability
2. **Create shielded transfers** — build unsigned Solana transactions with hidden recipients via stealth addresses and hidden amounts via Pedersen commitments
3. **Scan for payments** — detect incoming shielded payments using viewing keys
4. **Selective disclosure** — encrypt/decrypt transaction data for auditors/compliance using viewing keys
5. **Homomorphic commitment math** — add and subtract commitments without revealing values

All privacy operations use:
- **Stealth addresses** (ed25519 DKSAP) — unlinkable one-time addresses
- **Pedersen commitments** — homomorphic commitments hiding amounts
- **Viewing keys** — selective disclosure for compliance without revealing spending power

---

## Endpoints

All responses follow: `{ success: boolean, data?: T, error?: { code, message, details? } }`

### Health & Meta

```
GET /v1/health        → Server status, Solana RPC latency, memory usage
GET /v1/ready         → Readiness probe (200 if healthy, 503 otherwise)
GET /v1/errors        → Full error code catalog with retry guidance
GET /v1/openapi.json  → OpenAPI 3.1 specification
GET /docs             → Interactive Swagger UI
```

---

### Stealth Addresses

#### Generate Meta-Address Keypair

```
POST /v1/stealth/generate
Content-Type: application/json

{ "label": "My Agent Wallet" }
```

Returns: `metaAddress` (spending + viewing public keys), `spendingPrivateKey`, `viewingPrivateKey`

#### Derive One-Time Stealth Address

```
POST /v1/stealth/derive
Content-Type: application/json

{
  "recipientMetaAddress": {
    "spendingKey": "0x...",
    "viewingKey": "0x...",
    "chain": "solana"
  }
}
```

Returns: `stealthAddress` (address, ephemeralPublicKey, viewTag), `sharedSecret`

#### Check Ownership

```
POST /v1/stealth/check
Content-Type: application/json

{
  "stealthAddress": {
    "address": "0x...",
    "ephemeralPublicKey": "0x...",
    "viewTag": 42
  },
  "spendingPrivateKey": "0x...",
  "viewingPrivateKey": "0x..."
}
```

Returns: `{ isOwner: boolean }`

---

### Shielded Transfers

Mutation endpoints support `Idempotency-Key` header (UUID v4) for safe retries.

#### Build Shielded Transfer (Unsigned)

```
POST /v1/transfer/shield
Content-Type: application/json

{
  "sender": "<base58 Solana address>",
  "recipientMetaAddress": {
    "spendingKey": "0x...",
    "viewingKey": "0x...",
    "chain": "solana"
  },
  "amount": "1000000000",
  "mint": "<optional SPL token mint address>"
}
```

Returns unsigned base64 transaction, stealth address, commitment, viewing key hash. Agent signs and submits.

#### Claim Stealth Payment (Signed)

```
POST /v1/transfer/claim
Content-Type: application/json

{
  "stealthAddress": "<base58>",
  "ephemeralPublicKey": "<base58>",
  "spendingPrivateKey": "0x...",
  "viewingPrivateKey": "0x...",
  "destinationAddress": "<base58>",
  "mint": "<SPL token mint>"
}
```

Derives stealth private key server-side, signs and submits claim transaction. Returns `txSignature`.

---

### Scan for Payments

```
POST /v1/scan/payments
Content-Type: application/json

{
  "viewingPrivateKey": "0x...",
  "spendingPublicKey": "0x...",
  "fromSlot": 300000000,
  "limit": 100
}
```

Scans Solana for SIP announcements matching your viewing key. Returns array of detected payments.

---

### Pedersen Commitments

#### Create Commitment

```
POST /v1/commitment/create
Content-Type: application/json

{ "value": "1000000000" }
```

Returns: `commitment` (curve point), `blindingFactor`

#### Verify Commitment

```
POST /v1/commitment/verify
Content-Type: application/json

{
  "commitment": "0x...",
  "value": "1000000000",
  "blindingFactor": "0x..."
}
```

Returns: `{ valid: boolean }`

#### Add Commitments (Homomorphic)

```
POST /v1/commitment/add
Content-Type: application/json

{
  "commitmentA": "0x...",
  "commitmentB": "0x...",
  "blindingA": "0x...",
  "blindingB": "0x..."
}
```

Returns: combined `commitment` and `blindingFactor` representing sum of hidden values.

#### Subtract Commitments (Homomorphic)

```
POST /v1/commitment/subtract
Content-Type: application/json

{
  "commitmentA": "0x...",
  "commitmentB": "0x...",
  "blindingA": "0x...",
  "blindingB": "0x..."
}
```

Returns: combined `commitment` and `blindingFactor` representing difference of hidden values.

---

### Viewing Keys

#### Generate Viewing Key

```
POST /v1/viewing-key/generate
Content-Type: application/json

{ "path": "m/0" }
```

Returns: viewing key with `key`, `path`, `hash`

#### Derive Child Viewing Key (BIP32-style)

```
POST /v1/viewing-key/derive
Content-Type: application/json

{
  "masterKey": {
    "key": "0x...",
    "path": "m/0",
    "hash": "0x..."
  },
  "childPath": "audit"
}
```

Returns: derived child viewing key with `key`, `path` (e.g., `m/0/audit`), `hash`, and `derivedFrom` metadata.

Supports multi-level derivation: `m/0 → m/0/org → m/0/org/2026 → m/0/org/2026/Q1`

#### Verify Key Hierarchy

```
POST /v1/viewing-key/verify-hierarchy
Content-Type: application/json

{
  "parentKey": { "key": "0x...", "path": "m/0", "hash": "0x..." },
  "childKey": { "key": "0x...", "path": "m/0/audit", "hash": "0x..." },
  "childPath": "audit"
}
```

Returns: `{ valid: boolean }` — verifies the child key was derived from the parent at the specified path.

#### Encrypt for Disclosure

```
POST /v1/viewing-key/disclose
Content-Type: application/json

{
  "viewingKey": {
    "key": "0x...",
    "path": "m/0",
    "hash": "0x..."
  },
  "transactionData": {
    "sender": "<address>",
    "recipient": "<stealth address>",
    "amount": "1000000000",
    "timestamp": 1706000000000
  }
}
```

Returns encrypted payload (ciphertext, nonce, viewingKeyHash) that only the viewing key holder can decrypt.

#### Decrypt with Viewing Key

```
POST /v1/viewing-key/decrypt
Content-Type: application/json

{
  "viewingKey": {
    "key": "0x...",
    "path": "m/0",
    "hash": "0x..."
  },
  "encrypted": {
    "ciphertext": "0x...",
    "nonce": "0x...",
    "viewingKeyHash": "0x..."
  }
}
```

Returns decrypted transaction data: `sender`, `recipient`, `amount`, `timestamp`.

---

### Batch Operations

Process multiple operations in a single call (max 100 per request).

#### Batch Generate Stealth Keypairs

```
POST /v1/stealth/generate/batch
Content-Type: application/json

{ "count": 10, "label": "Fleet" }
```

Returns per-item results with `summary: { total, succeeded, failed }`.

#### Batch Create Commitments

```
POST /v1/commitment/create/batch
Content-Type: application/json

{
  "items": [
    { "value": "1000000000" },
    { "value": "2000000000" }
  ]
}
```

#### Batch Scan Payments

```
POST /v1/scan/payments/batch
Content-Type: application/json

{
  "keyPairs": [
    { "viewingPrivateKey": "0x...", "spendingPublicKey": "0x...", "label": "Wallet A" },
    { "viewingPrivateKey": "0x...", "spendingPublicKey": "0x...", "label": "Wallet B" }
  ]
}
```

---

### RPC Providers

```
GET /v1/rpc/providers  → Active provider, supported list, configuration guidance
```

Returns: `active` (provider name, cluster, endpoint, connected, latencyMs), `supported` (array of 4 providers with config details), `configuration` (env var names).

Supported providers: `generic` (any Solana RPC), `helius`, `quicknode`, `triton`. Configure via `RPC_PROVIDER` and `RPC_PROVIDER_API_KEY` env vars.

---

### Privacy Score

Analyze any Solana wallet's on-chain privacy posture.

```
POST /v1/privacy/score
Content-Type: application/json

{ "address": "<base58 Solana address>", "limit": 100 }
```

Returns: `score` (0-100), `grade` (A-F), `factors` (addressReuse, amountPatterns, timingCorrelation, counterpartyExposure), and `recommendations` with specific Sipher endpoints to improve privacy.

---

### Confidential SPL Tokens (C-SPL)

Wrap, unwrap, and transfer SPL tokens with encrypted (hidden) amounts using Solana's Confidential Transfer extension.

#### Wrap SPL → Confidential

```
POST /v1/cspl/wrap
Content-Type: application/json

{
  "mint": "<SPL token mint address>",
  "amount": "1000000000",
  "owner": "<base58 Solana address>",
  "createAccount": true
}
```

Returns: `signature`, `csplMint`, `encryptedBalance` (hex), `token` metadata.

#### Unwrap Confidential → SPL

```
POST /v1/cspl/unwrap
Content-Type: application/json

{
  "csplMint": "C-wSOL",
  "encryptedAmount": "0x...",
  "owner": "<base58 Solana address>",
  "proof": "0x..."
}
```

Returns: `signature`, `amount` (decrypted, as string).

#### Confidential Transfer

```
POST /v1/cspl/transfer
Content-Type: application/json

{
  "csplMint": "C-USDC",
  "from": "<base58>",
  "to": "<base58>",
  "encryptedAmount": "0x...",
  "memo": "payment for services"
}
```

Returns: `signature`, `newSenderBalance` (hex), `recipientPendingUpdated`.

Supported tokens: `C-wSOL`, `C-USDC`, `C-USDT`. All C-SPL endpoints support `Idempotency-Key` header.

---

## Idempotency

Mutation endpoints (`/transfer/shield`, `/transfer/claim`, `/commitment/create`, `/viewing-key/disclose`) support the `Idempotency-Key` header. Send a UUID v4 value to safely retry requests — duplicate keys return the cached response with `Idempotency-Replayed: true` header.

---

## Agent Workflow Example

```
1. Agent generates stealth meta-address → POST /v1/stealth/generate
2. Counterparty derives stealth address → POST /v1/stealth/derive
3. Counterparty builds shielded transfer → POST /v1/transfer/shield
4. Counterparty signs + submits the returned transaction
5. Agent scans for incoming payments → POST /v1/scan/payments
6. Agent claims funds to real wallet → POST /v1/transfer/claim
7. If audit needed → POST /v1/viewing-key/disclose
8. Auditor decrypts → POST /v1/viewing-key/decrypt
```

---

## Powered By

- [SIP Protocol](https://sip-protocol.org) — The privacy standard for Web3
- [@sip-protocol/sdk](https://www.npmjs.com/package/@sip-protocol/sdk) — Core cryptographic primitives
- Solana Mainnet — Program `S1PMFspo4W6BYKHWkHNF7kZ3fnqibEXg3LQjxepS9at`