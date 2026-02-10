# Compliance API Documentation

Phase 3 compliance layer REST API endpoints for hierarchical viewing keys, selective disclosure, and compliance reporting.

**Base URL**: `/api/v1/compliance`

## Endpoints Summary

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/viewing-key/generate` | POST | Generate master viewing key (m/0) |
| `/viewing-key/derive` | POST | Derive child viewing key (BIP32-style) |
| `/viewing-key/verify` | POST | Verify parent-child hierarchy |
| `/disclose` | POST | Disclose transaction to auditor |
| `/decrypt` | POST | Decrypt disclosed transaction data |
| `/disclosures/:auditorId` | GET | List disclosures for auditor |
| `/report` | POST | Generate compliance report |
| `/master-key/approve` | POST | Request/approve master key access |
| `/master-key/status/:requestId` | GET | Check approval status |
| `/setup` | POST | Setup complete hierarchy |

## Key Hierarchy

```
m/0 (master)              → Full access, no expiration, requires multi-sig
  └─ m/0/org (regulator)  → Organizational access, 1 year expiration
      └─ m/0/org/2026 (external) → Yearly access, 90 days expiration
          └─ m/0/org/2026/Q1 (internal) → Quarterly access, 30 days expiration
```

## Role-Based Access

| Role | Viewing Key Level | Disclosed Fields | Expiration |
|------|------------------|------------------|------------|
| Internal | Quarterly (Q1) | sender, recipient, amount, timestamp | 30 days |
| External | Yearly (2026) | + txSignature | 90 days |
| Regulator | Organizational | + txSignature | 1 year |
| Master | Root (m/0) | All fields | Never |

**Hidden Fields** (never disclosed): spendingKey, viewingKey, blindingFactor

## Example: Disclose Transaction

```bash
# 1. Disclose to internal auditor
curl -X POST http://localhost:4000/api/v1/compliance/disclose \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": 123,
    "auditorId": "auditor@example.com",
    "role": "internal"
  }'

# 2. Auditor decrypts
curl -X POST http://localhost:4000/api/v1/compliance/decrypt \
  -H "Content-Type: application/json" \
  -d '{
    "disclosureId": 456,
    "viewingKeyHash": "abc123..."
  }'
```

## Multi-Sig Master Key Access

Master key access requires M-of-N signatures where M ≥ 3:

```bash
# 1. Request access
POST /api/v1/compliance/master-key/approve
{ "action": "request", "requester": "admin@example.com" }

# 2-4. Three approvers sign
POST /api/v1/compliance/master-key/approve
{ "action": "sign", "requestId": "...", "signer": "...", "signature": "..." }

# 5. Check status
GET /api/v1/compliance/master-key/status/:requestId
```

## Configuration

```bash
PRIVACY_ENABLED=true
SIPHER_API_KEY=your_api_key
PROTOCOL_MASTER_KEY=your_secure_key  # Use HSM in production
VIEWING_KEY_EXPIRATION_DAYS=30
MASTER_KEY_MULTISIG_THRESHOLD=3
```

## Requirements

Implements requirements: 12.1, 13.1, 14.1, 15.1, 16.1, 17.1
