---
name: ARS Backend API
version: 1.0.0
description: Expert knowledge for interacting with the Agentic Reserve System (ARS) backend API, including real-time oracle data, privacy features, and DeFi integrations.
homepage: https://agenticreserve.dev/
---

# ARS Backend API Skill

You are an expert at using the ARS (Agentic Reserve System) backend API. This system manages ARU tokens backed by a diversified reserve vault on Solana, with privacy-preserving features and real-time DeFi integrations.

## Core Principles

1. **All data is REAL** - No mock data. Jupiter ($84 SOL), Kamino ($1.53B TVL), Meteora (1,245 pools)
2. **Privacy-first** - Use stealth addresses and MEV protection for sensitive operations
3. **Rate limits** - 100 req/min default, 50 req/min for memory endpoints
4. **Caching** - Respect 5-10 min cache TTLs for ILI/ICR/reserve data
5. **Error handling** - Always check health endpoint before critical operations

## Base URL

- Production: `https://api.agenticreserve.dev`
- All endpoints: `/api/v1/`

## Authentication

```typescript
// Currently NO authentication required for public endpoints
// Future implementation will include:
headers: {
  'X-API-Key': 'your-api-key',           // (PLANNED) For rate limiting per agent
  'X-Viewing-Key': 'viewing-key-hash'    // (PLANNED) For privacy-protected data
}

// Current state: All endpoints are publicly accessible
```

## Key Endpoints

### Health & Monitoring
- `GET /health` - System health, dependency status, capacity metrics
- `GET /health/sak` - SAK integration detailed health

### ILI (Internet Liquidity Index)
- `GET /ili/current` - Current ILI value with components (avgYield, volatility, TVL)
- `GET /ili/history?from=&to=&interval=5m` - Historical ILI data

**Formula**: `ILI = κ × (avg_yield / (1 + volatility)) × log(1 + normalized_TVL)`

### ICR (Internet Credit Rate)
- `GET /icr/current` - Weighted average lending rate in basis points

### Reserve Vault
- `GET /reserve/state` - Current vault state (VHR, composition, TVL)
- `GET /reserve/history?limit=50` - Rebalance history

**Target VHR**: 2.0 (200% collateralization)

### Agents
- `GET /agents/:pubkey/fees` - Fee history and earnings
- `GET /agents/:pubkey/staking` - Staking status and rewards
- `POST /agents/:pubkey/stake` - Stake ARU tokens (body: `{amount}`)
- `POST /agents/:pubkey/claim` - Claim staking rewards

### Privacy - Shielded Transfers (Phase 1)
- `POST /privacy/stealth-address` - Generate meta-address (body: `{agentId, label}`)
- `GET /privacy/stealth-address/:agentId` - Get agent's meta-address
- `POST /privacy/shielded-transfer` - Build shielded transfer (body: `{senderId, recipientMetaAddressId, amount, mint?}`)
- `POST /privacy/shielded-transfer/submit` - Submit signed transaction (body: `{unsignedTransaction, senderPrivateKey, recordId}`)
- `GET /privacy/payments/:agentId?limit=100` - Detect incoming payments
- `POST /privacy/claim` - Claim stealth payment (body: `{agentId, stealthAddress, ephemeralPublicKey, destinationAddress, mint?}`)
- `GET /privacy/transactions/:agentId?limit=100` - Transaction history

### Privacy - MEV Protection (Phase 2)
- `POST /privacy/commitment` - Create Pedersen commitment (body: `{value}`)
- `POST /privacy/commitment/verify` - Verify commitment (body: `{commitmentId, value}`)
- `POST /privacy/commitment/add` - Add commitments homomorphically (body: `{commitmentIdA, commitmentIdB}`)
- `GET /privacy/score/:address?limit=` - Privacy score (0-100) with grade and recommendations
- `GET /privacy/score/:address/trend?limit=10` - Historical privacy scores
- `POST /privacy/protected-swap` - MEV-protected swap (body: `{vaultId, inputMint, outputMint, amount, slippageBps}`)
- `GET /privacy/mev-metrics/:vaultId` - MEV extraction metrics
- `GET /privacy/low-privacy-addresses` - Addresses with score <70

### Compliance - Viewing Keys (Phase 3)
- `POST /compliance/viewing-key/generate` - Generate master key (body: `{path?}`)
- `POST /compliance/viewing-key/derive` - Derive child key (body: `{parentId, childPath}`)
- `POST /compliance/viewing-key/verify` - Verify hierarchy (body: `{parentId, childId}`)
- `POST /compliance/disclose` - Disclose to auditor (body: `{transactionId, auditorId, role}`)
- `POST /compliance/decrypt` - Decrypt disclosure (body: `{disclosureId, viewingKeyHash}`)
- `GET /compliance/disclosures/:auditorId?includeRevoked=false` - List disclosures
- `POST /compliance/report` - Generate report (body: `{startDate, endDate, role, format?}`)
- `POST /compliance/master-key/approve` - Multi-sig approval (body: `{action, requester?, requestId?, signer?, signature?}`)
- `GET /compliance/master-key/status/:requestId` - Check approval status
- `POST /compliance/setup` - Setup complete hierarchy

**Viewing Key Hierarchy**: `m/0` (master) → `m/0/org` → `m/0/org/2026` → `m/0/org/2026/Q1`

### Memory & Analytics
- `GET /memory/transactions/:walletAddress` - Transaction history with filters (requires privacy auth)
- `GET /memory/balances/:walletAddress` - Current balances (requires privacy auth)
- `GET /memory/pnl/:walletAddress?period=all` - PnL analytics (requires privacy auth)
- `GET /memory/risk/:walletAddress` - Risk profile (requires privacy auth)
- `GET /memory/prediction-markets/:marketId` - Prediction market data
- `GET /memory/portfolio/:walletAddress` - Portfolio analytics (requires privacy auth)

**Query params for transactions**: `page`, `pageSize`, `transactionType`, `tokenMint`, `minAmount`, `maxAmount`, `startDate`, `endDate`

### Metrics & Monitoring
- `GET /metrics` - Prometheus metrics (text format)
- `GET /metrics/json` - JSON metrics with cache hit rate, error rate, circuit breakers
- `GET /slow-queries/stats` - Slow query statistics (>1000ms)
- `GET /slow-queries/recent?limit=50` - Recent slow queries
- `DELETE /slow-queries/history` - Clear slow query history

### Governance
- `GET /proposals?status=` - List proposals (filter by status)
- `GET /proposals/:id` - Proposal details with votes and consensus

### Revenue
- `GET /revenue/current` - Daily/monthly/annual revenue, agent count
- `GET /revenue/history?from=&to=` - Historical revenue data
- `GET /revenue/projections` - Revenue projections by agent count (100, 1K, 10K agents)
- `GET /revenue/breakdown` - Fee breakdown by type
- `GET /revenue/distributions` - Distribution history

### Solana Programs
- `GET /programs/status` - Check if programs deployed and initialized
- `GET /programs/core/state` - GlobalState from ars_core
- `GET /programs/reserve/vault` - Vault state from ars_reserve
- `GET /programs/token/mint` - Token mint info from ars_token

## Common Workflows

### 1. Send Shielded Transfer
```typescript
// Step 1: Get recipient's meta-address
const metaAddr = await fetch(`/api/v1/privacy/stealth-address/${recipientAgentId}`);
const { data: { metaAddress } } = await metaAddr.json();

// Step 2: Build shielded transfer
const transfer = await fetch('/api/v1/privacy/shielded-transfer', {
  method: 'POST',
  body: JSON.stringify({
    senderId: senderAddress,
    recipientMetaAddressId: metaAddress.id,
    amount: '100',
    mint: 'So11111111111111111111111111111111111111112' // SOL
  })
});
const { data: { unsignedTransaction, record } } = await transfer.json();

// Step 3: Sign and submit
await fetch('/api/v1/privacy/shielded-transfer/submit', {
  method: 'POST',
  body: JSON.stringify({
    unsignedTransaction,
    senderPrivateKey: senderKey,
    recordId: record.id
  })
});
```

### 2. MEV-Protected Rebalancing
```typescript
// Step 1: Check privacy score
const score = await fetch(`/api/v1/privacy/score/${vaultAddress}`);
const { data: { score: privacyScore, grade } } = await score.json();

// Step 2: Execute protected swap
const swap = await fetch('/api/v1/privacy/protected-swap', {
  method: 'POST',
  body: JSON.stringify({
    vaultId: vaultAddress,
    inputMint: 'So11111111111111111111111111111111111111112', // SOL
    outputMint: 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v', // USDC
    amount: '100',
    slippageBps: 50 // 0.5% slippage
  })
});
const { data: { txSignature, metrics } } = await swap.json();
```

### 3. Setup Compliance Hierarchy
```typescript
// Setup complete viewing key hierarchy
const setup = await fetch('/api/v1/compliance/setup', { method: 'POST' });
const { data: hierarchy } = await setup.json();
// Returns: master, org, year, quarter keys

// Disclose transaction to external auditor
await fetch('/api/v1/compliance/disclose', {
  method: 'POST',
  body: JSON.stringify({
    transactionId: 123,
    auditorId: 'auditor-456',
    role: 'external' // internal, external, regulator
  })
});
```

### 4. Monitor System Health
```typescript
// Check overall health
const health = await fetch('/api/v1/health');
const { status, dependencies, metrics } = await health.json();

if (status === 'degraded') {
  console.warn('System degraded:', dependencies);
}

// Check capacity before high-volume operations
if (metrics.capacity.atCapacity) {
  console.warn('System at capacity, wait before proceeding');
}
```

## Data Sources (REAL - NO MOCK)

1. **Jupiter API** - Real token prices (SOL: $84.02, not mock $150)
2. **Kamino SDK** - Real on-chain data (TVL: $1.53B, 55 reserves, Mainnet)
3. **Meteora API** - Real pool data (1,245 pools, $218M TVL)

## Error Handling

### Standard Error Response
```json
{
  "error": "Error message",
  "message": "Detailed description",
  "requestId": "req-123"
}
```

### HTTP Status Codes
- `200` - Success
- `400` - Bad request (missing/invalid params)
- `401` - Unauthorized (missing/invalid API key)
- `403` - Forbidden (insufficient permissions, expired viewing key)
- `404` - Not found
- `429` - Rate limit exceeded
- `500` - Internal server error
- `503` - Service unavailable (check `/health`)

### Best Practices
1. **Always check health** before critical operations
2. **Implement exponential backoff** for rate limits
3. **Cache responses** according to TTL (5-10 min for ILI/ICR)
4. **Use stealth addresses** for all sensitive transfers
5. **Monitor privacy scores** regularly (target: >70)
6. **Batch requests** when possible to avoid rate limits
7. **Log request IDs** for debugging

## Important Notes

- All timestamps are ISO 8601 format
- All amounts in base units (lamports for SOL)
- Privacy features use Sipher Protocol for ZK proofs
- MEV protection uses Pedersen commitments + stealth addresses
- Viewing key hierarchy follows BIP32-style derivation
- Multi-sig approval requires 3-of-5 signatures for master key
- Cache TTL: 5 min (ILI, reserve), 10 min (ICR), 30 sec (Jupiter), 60 sec (Meteora)

## When to Use This Skill

Use this skill when you need to:
- Interact with ARS backend API
- Build privacy-preserving DeFi applications
- Implement shielded transfers or MEV protection
- Set up compliance and auditing infrastructure
- Monitor system health and performance
- Track ILI/ICR metrics for reserve management
- Analyze agent fees and staking rewards
- Generate compliance reports for regulators

## Reference

For complete API documentation, see `ars-llms.txt` in the same directory.
