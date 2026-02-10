# Compliance API Endpoints

Phase 3 compliance layer REST API endpoints for the Sipher Privacy Integration.

## Overview

The Compliance API provides hierarchical viewing key management, selective transaction disclosure, and compliance reporting for regulatory requirements. All endpoints support role-based access control with BIP32-style key derivation.

**Base URL**: `/api/v1/compliance`

**Requirements**: 12.1, 13.1, 14.1, 15.1, 16.1, 17.1

## Authentication

All endpoints require the privacy feature to be enabled in configuration:

```bash
PRIVACY_ENABLED=true
SIPHER_API_KEY=your_api_key_here
```

## Endpoints

### 1. Generate Master Viewing Key

Generate a master viewing key (m/0) for the compliance hierarchy.

**Endpoint**: `POST /api/v1/compliance/viewing-key/generate`

**Request Body**:
```json
{
  "path": "m/0"  // Optional, defaults to "m/0"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "keyHash": "abc123...",
    "path": "m/0",
    "role": "master",
    "createdAt": "2026-01-15T10:30:00.000Z"
  }
}
```

**Requirements**: 12.1

---

### 2. Derive Child Viewing Key

Derive a child viewing key from a parent key using BIP32-style derivation.

**Endpoint**: `POST /api/v1/compliance/viewing-key/derive`

**Request Body**:
```json
{
  "parentId": 1,
  "childPath": "org"  // Can be "org", "2026", "Q1", etc.
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 2,
    "keyHash": "def456...",
    "path": "m/0/org",
    "parentHash": "abc123...",
    "role": "regulator",
    "expiresAt": "2027-01-15T10:30:00.000Z",
    "createdAt": "2026-01-15T10:30:00.000Z"
  }
}
```

**Hierarchy Paths**:
- `m/0` → Master (no expiration)
- `m/0/org` → Organizational/Regulator (1 year)
- `m/0/org/2026` → Yearly/External Auditor (90 days)
- `m/0/org/2026/Q1` → Quarterly/Internal Auditor (30 days)

**Requirements**: 12.2

---

### 3. Verify Viewing Key Hierarchy

Verify that a child key was properly derived from a parent key.

**Endpoint**: `POST /api/v1/compliance/viewing-key/verify`

**Request Body**:
```json
{
  "parentId": 1,
  "childId": 2
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "valid": true
  }
}
```

**Requirements**: 13.1, 13.2

---

### 4. Disclose Transaction

Disclose a transaction to an auditor with role-based viewing key access.

**Endpoint**: `POST /api/v1/compliance/disclose`

**Request Body**:
```json
{
  "transactionId": 123,
  "auditorId": "auditor@example.com",
  "role": "internal"  // "internal", "external", or "regulator"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "id": 456,
    "transactionId": 123,
    "auditorId": "auditor@example.com",
    "viewingKeyHash": "ghi789...",
    "disclosedFields": ["sender", "recipient", "amount", "timestamp"],
    "expiresAt": "2026-02-14T10:30:00.000Z",
    "createdAt": "2026-01-15T10:30:00.000Z"
  }
}
```

**Disclosed Fields by Role**:
- **Internal**: sender, recipient, amount, timestamp
- **External**: sender, recipient, amount, timestamp, txSignature
- **Regulator**: sender, recipient, amount, timestamp, txSignature

**Hidden Fields** (never disclosed): spendingKey, viewingKey, blindingFactor

**Requirements**: 14.1, 14.2

---

### 5. Decrypt Disclosure

Decrypt disclosed transaction data using a viewing key.

**Endpoint**: `POST /api/v1/compliance/decrypt`

**Request Body**:
```json
{
  "disclosureId": 456,
  "viewingKeyHash": "ghi789..."
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "sender": "SenderAddress...",
    "recipient": "StealthAddress...",
    "amount": "1000000",
    "timestamp": 1705315800000,
    "txSignature": "TxSignature...",
    "compliance": {
      "compliant": true,
      "riskScore": 15,
      "flags": []
    }
  }
}
```

**Error Responses**:
- `403`: Viewing key expired or revoked
- `404`: Disclosure or viewing key not found

**Requirements**: 15.1, 15.2

---

### 6. List Disclosures

List all disclosures for a specific auditor.

**Endpoint**: `GET /api/v1/compliance/disclosures/:auditorId`

**Query Parameters**:
- `includeRevoked` (boolean, optional): Include revoked disclosures (default: false)

**Response**:
```json
{
  "success": true,
  "data": {
    "disclosures": [
      {
        "id": 456,
        "transactionId": 123,
        "auditorId": "auditor@example.com",
        "viewingKeyHash": "ghi789...",
        "disclosedFields": ["sender", "recipient", "amount", "timestamp"],
        "expiresAt": "2026-02-14T10:30:00.000Z",
        "createdAt": "2026-01-15T10:30:00.000Z",
        "revokedAt": null
      }
    ],
    "total": 1
  }
}
```

**Requirements**: 14.3

---

### 7. Generate Compliance Report

Generate a compliance report for a date range with role-based access.

**Endpoint**: `POST /api/v1/compliance/report`

**Request Body**:
```json
{
  "startDate": "2026-01-01",
  "endDate": "2026-01-31",
  "role": "internal",
  "format": "json"  // "json" or "pdf" (pdf not yet implemented)
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "transactions": 150,
    "compliant": 148,
    "flagged": 2,
    "report": [
      {
        "compliant": true,
        "riskScore": 15,
        "flags": [],
        "disclosedFields": ["sender", "recipient", "amount", "timestamp"],
        "hiddenFields": ["spendingKey", "viewingKey", "blindingFactor"]
      }
    ],
    "dateRange": {
      "start": "2026-01-01T00:00:00.000Z",
      "end": "2026-01-31T23:59:59.999Z"
    },
    "role": "internal",
    "generatedAt": "2026-02-01T10:30:00.000Z"
  }
}
```

**Valid Roles**: internal, external, regulator, master

**Requirements**: 17.1, 17.2, 17.3

---

### 8. Approve Master Key Access

Request or approve master viewing key access with multi-signature protection.

**Endpoint**: `POST /api/v1/compliance/master-key/approve`

#### Request Master Key Access

**Request Body**:
```json
{
  "action": "request",
  "requester": "admin@example.com"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "requestId": "master-key-1705315800-abc123",
    "threshold": 3,
    "status": "pending",
    "createdAt": "2026-01-15T10:30:00.000Z"
  }
}
```

#### Add Signature to Request

**Request Body**:
```json
{
  "action": "sign",
  "requestId": "master-key-1705315800-abc123",
  "signer": "approver1@example.com",
  "signature": "ed25519_signature_here"
}
```

**Response**:
```json
{
  "success": true,
  "data": {
    "requestId": "master-key-1705315800-abc123",
    "signatures": 3,
    "threshold": 3,
    "status": "approved",
    "approved": true,
    "approvedAt": "2026-01-15T10:35:00.000Z"
  }
}
```

**Multi-Sig Requirements**:
- Minimum threshold: 3 signatures (configurable via `MASTER_KEY_MULTISIG_THRESHOLD`)
- Each signature must be from a unique signer
- Signatures are verified cryptographically

**Requirements**: 16.5

---

### 9. Check Master Key Approval Status

Check the status of a master key approval request.

**Endpoint**: `GET /api/v1/compliance/master-key/status/:requestId`

**Response**:
```json
{
  "success": true,
  "data": {
    "requestId": "master-key-1705315800-abc123",
    "status": "approved",
    "approved": true
  }
}
```

---

### 10. Setup Viewing Key Hierarchy

Setup the complete viewing key hierarchy in one operation.

**Endpoint**: `POST /api/v1/compliance/setup`

**Request Body**: None

**Response**:
```json
{
  "success": true,
  "data": {
    "master": {
      "id": 1,
      "keyHash": "abc123...",
      "path": "m/0",
      "role": "master"
    },
    "org": {
      "id": 2,
      "keyHash": "def456...",
      "path": "m/0/org",
      "role": "regulator"
    },
    "year": {
      "id": 3,
      "keyHash": "ghi789...",
      "path": "m/0/org/2026",
      "role": "external"
    },
    "quarter": {
      "id": 4,
      "keyHash": "jkl012...",
      "path": "m/0/org/2026/Q1",
      "role": "internal"
    }
  }
}
```

**Note**: This is a convenience endpoint for initial setup. It creates the full hierarchy automatically.

---

## Error Handling

All endpoints return consistent error responses:

```json
{
  "error": "Error description",
  "message": "Detailed error message"
}
```

**Common HTTP Status Codes**:
- `400`: Bad Request (missing or invalid parameters)
- `403`: Forbidden (expired or revoked viewing key)
- `404`: Not Found (resource not found)
- `500`: Internal Server Error
- `501`: Not Implemented (e.g., PDF format)

---

## Security Considerations

### Viewing Key Expiration

- **Master keys**: Never expire
- **Organizational keys**: 1 year
- **Yearly keys**: 90 days
- **Quarterly keys**: 30 days (configurable via `VIEWING_KEY_EXPIRATION_DAYS`)

### Multi-Signature Protection

Master viewing key access requires M-of-N signatures where M ≥ 3. This prevents single-point-of-failure security breaches.

### Audit Trail

All compliance operations are logged for audit purposes:
- Viewing key generation and derivation
- Transaction disclosures
- Decryption attempts
- Multi-sig approvals

### Encryption

- Viewing keys encrypted at rest with AES-256-GCM
- Protocol master key used for encryption (should be stored in HSM for production)
- Transaction data encrypted with auditor's public key

---

## Example Workflows

### Workflow 1: Setup Compliance Hierarchy

```bash
# 1. Setup complete hierarchy
curl -X POST http://localhost:4000/api/v1/compliance/setup

# Response includes master, org, year, and quarter keys
```

### Workflow 2: Disclose Transaction to Internal Auditor

```bash
# 1. Disclose transaction
curl -X POST http://localhost:4000/api/v1/compliance/disclose \
  -H "Content-Type: application/json" \
  -d '{
    "transactionId": 123,
    "auditorId": "internal-auditor@example.com",
    "role": "internal"
  }'

# 2. Auditor decrypts disclosure
curl -X POST http://localhost:4000/api/v1/compliance/decrypt \
  -H "Content-Type: application/json" \
  -d '{
    "disclosureId": 456,
    "viewingKeyHash": "ghi789..."
  }'
```

### Workflow 3: Generate Quarterly Compliance Report

```bash
# Generate report for Q1 2026
curl -X POST http://localhost:4000/api/v1/compliance/report \
  -H "Content-Type: application/json" \
  -d '{
    "startDate": "2026-01-01",
    "endDate": "2026-03-31",
    "role": "internal",
    "format": "json"
  }'
```

### Workflow 4: Emergency Master Key Access

```bash
# 1. Request master key access
curl -X POST http://localhost:4000/api/v1/compliance/master-key/approve \
  -H "Content-Type: application/json" \
  -d '{
    "action": "request",
    "requester": "emergency-admin@example.com"
  }'

# 2. Approver 1 signs
curl -X POST http://localhost:4000/api/v1/compliance/master-key/approve \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sign",
    "requestId": "master-key-1705315800-abc123",
    "signer": "approver1@example.com",
    "signature": "signature1"
  }'

# 3. Approver 2 signs
curl -X POST http://localhost:4000/api/v1/compliance/master-key/approve \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sign",
    "requestId": "master-key-1705315800-abc123",
    "signer": "approver2@example.com",
    "signature": "signature2"
  }'

# 4. Approver 3 signs (threshold met)
curl -X POST http://localhost:4000/api/v1/compliance/master-key/approve \
  -H "Content-Type: application/json" \
  -d '{
    "action": "sign",
    "requestId": "master-key-1705315800-abc123",
    "signer": "approver3@example.com",
    "signature": "signature3"
  }'

# 5. Check approval status
curl http://localhost:4000/api/v1/compliance/master-key/status/master-key-1705315800-abc123
```

---

## Configuration

Required environment variables:

```bash
# Privacy Features
PRIVACY_ENABLED=true
SIPHER_API_URL=https://sipher.sip-protocol.org
SIPHER_API_KEY=your_api_key_here

# Key Management
PROTOCOL_MASTER_KEY=your_secure_master_key  # Use HSM in production
VIEWING_KEY_EXPIRATION_DAYS=30
MASTER_KEY_MULTISIG_THRESHOLD=3

# Database
DATABASE_URL=postgresql://user:pass@localhost:5432/ars
```

---

## Testing

Run compliance API tests:

```bash
# Unit tests
npm run test -- compliance

# Integration tests
npm run test:integration -- compliance

# E2E workflow tests
npm run test:e2e -- compliance-workflow
```

---

## Related Documentation

- [Sipher Privacy Integration Design](../../../.kiro/specs/sipher-privacy-integration/design.md)
- [Compliance Service](../services/privacy/complian