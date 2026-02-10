# Agentic Reserve System (ARS) - API Documentation

## Base URL

```
http://localhost:4000/api/v1
```

## Authentication

Currently, all endpoints are public for agent access. Future versions will implement agent signature verification.

## Rate Limiting

- **Window**: 60 seconds
- **Max Requests**: 100 per IP
- **Response**: 429 Too Many Requests

---

## ILI Endpoints

### GET /ili/current

Get the current Internet Liquidity Index value.

**Response:**
```json
{
  "ili": 1234.56,
  "timestamp": "2026-02-04T10:30:00Z",
  "components": {
    "avgYield": 8.5,
    "volatility": 12.3,
    "tvl": 1500000000
  }
}
```

**Caching**: 5 minutes

---

### GET /ili/history

Get historical ILI data.

**Query Parameters:**
- `from` (optional): ISO 8601 timestamp
- `to` (optional): ISO 8601 timestamp
- `interval` (optional): Time interval (default: 5m)

**Response:**
```json
{
  "data": [
    {
      "timestamp": "2026-02-04T10:00:00Z",
      "ili": 1230.45,
      "avgYield": 8.4,
      "volatility": 12.1,
      "tvl": 1498000000
    }
  ]
}
```

---

## ICR Endpoints

### GET /icr/current

Get the current Internet Credit Rate.

**Response:**
```json
{
  "icr": 850,
  "confidence": 25,
  "timestamp": "2026-02-04T10:30:00Z",
  "sources": [
    {
      "protocol": "kamino",
      "rate": 860,
      "weight": 0.5
    },
    {
      "protocol": "marginfi",
      "rate": 840,
      "weight": 0.3
    }
  ]
}
```

**Caching**: 10 minutes

---

## Proposal Endpoints

### GET /proposals

List all proposals with optional filtering.

**Query Parameters:**
- `status` (optional): Filter by status (active, passed, failed, executed, cancelled)

**Response:**
```json
{
  "proposals": [
    {
      "id": 1,
      "proposer": "AgentPubkey111111111111111111111111111",
      "policyType": "MintICU",
      "policyParams": { "amount": 1000000 },
      "startTime": "2026-02-04T00:00:00Z",
      "endTime": "2026-02-05T00:00:00Z",
      "yesStake": "5000000",
      "noStake": "2000000",
      "status": "active",
      "proposalFee": 10
    }
  ]
}
```

---

### GET /proposals/:id

Get detailed information about a specific proposal.

**Response:**
```json
{
  "proposal": {
    "id": 1,
    "proposer": "AgentPubkey111111111111111111111111111",
    "policyType": "MintICU",
    "policyParams": { "amount": 1000000 },
    "startTime": "2026-02-04T00:00:00Z",
    "endTime": "2026-02-05T00:00:00Z",
    "yesStake": "5000000",
    "noStake": "2000000",
    "status": "active",
    "executionTx": null,
    "proposalFee": 10
  },
  "votes": [
    {
      "agentPubkey": "Agent1111111111111111111111111111111",
      "agentType": "policy",
      "stakeAmount": "1000000",
      "prediction": true,
      "timestamp": "2026-02-04T01:00:00Z",
      "claimed": false
    }
  ],
  "currentConsensus": {
    "yesPercentage": 71.43,
    "noPercentage": 28.57,
    "totalStake": "7000000"
  }
}
```

---

## Reserve Endpoints

### GET /reserve/state

Get current reserve vault state.

**Response:**
```json
{
  "totalValueUsd": 15000000,
  "liabilitiesUsd": 10000000,
  "vhr": 150.0,
  "composition": [
    { "asset": "USDC", "amount": 5000000, "percentage": 33.33 },
    { "asset": "SOL", "amount": 5000000, "percentage": 33.33 },
    { "asset": "mSOL", "amount": 5000000, "percentage": 33.34 }
  ],
  "lastRebalance": "2026-02-04T08:00:00Z"
}
```

**Caching**: 5 minutes

---

### GET /reserve/history

Get rebalance history.

**Query Parameters:**
- `limit` (optional): Number of events to return (default: 50)

**Response:**
```json
{
  "events": [
    {
      "timestamp": "2026-02-04T08:00:00Z",
      "eventType": "rebalance",
      "fromAsset": "SOL",
      "toAsset": "USDC",
      "amount": 100000,
      "vhrBefore": 148.5,
      "vhrAfter": 150.2,
      "txSignature": "5j7s..."
    }
  ]
}
```

---

## Revenue Endpoints

### GET /revenue/current

Get current revenue metrics.

**Response:**
```json
{
  "daily": 1250.50,
  "monthly": 37515.00,
  "annual": 456425.00,
  "agentCount": 50,
  "avgRevenuePerAgent": 25.01
}
```

**Caching**: 5 minutes

---

### GET /revenue/history

Get historical revenue data.

**Query Parameters:**
- `from` (optional): ISO 8601 timestamp
- `to` (optional): ISO 8601 timestamp

**Response:**
```json
{
  "data": [
    {
      "id": 1,
      "revenue_type": "transaction_fee",
      "agent_pubkey": "Agent111...",
      "amount_usd": 0.50,
      "amount_icu": null,
      "timestamp": "2026-02-04T10:00:00Z",
      "metadata": {}
    }
  ]
}
```

---

### GET /revenue/projections

Get revenue projections by agent count.

**Response:**
```json
{
  "current": {
    "agents": 50,
    "dailyRevenue": 1250.50,
    "monthlyRevenue": 37515.00,
    "annualRevenue": 456425.00
  },
  "at100Agents": {
    "agents": 100,
    "dailyRevenue": 2501.00,
    "monthlyRevenue": 75030.00,
    "annualRevenue": 912850.00
  },
  "at1000Agents": {
    "agents": 1000,
    "dailyRevenue": 25010.00,
    "monthlyRevenue": 750300.00,
    "annualRevenue": 9128500.00
  },
  "at10000Agents": {
    "agents": 10000,
    "dailyRevenue": 250100.00,
    "monthlyRevenue": 7503000.00,
    "annualRevenue": 91285000.00
  }
}
```

---

### GET /revenue/breakdown

Get fee breakdown by type.

**Response:**
```json
{
  "breakdown": {
    "transaction_fee": 500.25,
    "oracle_query_fee": 150.00,
    "er_session_fee": 200.50,
    "ai_usage_markup": 100.75,
    "proposal_fee": 200.00,
    "vault_management_fee": 99.00
  }
}
```

---

### GET /revenue/distributions

Get revenue distribution history.

**Response:**
```json
{
  "distributions": [
    {
      "id": 1,
      "distribution_date": "2026-02-01T00:00:00Z",
      "total_revenue": 10000.00,
      "buyback_amount": 4000.00,
      "staking_rewards": 3000.00,
      "development_fund": 2000.00,
      "insurance_fund": 1000.00,
      "icu_burned": 500.00,
      "metadata": {}
    }
  ]
}
```

---

## Agent Endpoints

### GET /agents/:pubkey/fees

Get agent fee history.

**Response:**
```json
{
  "agentPubkey": "Agent111...",
  "totalFees": 125.50,
  "transactions": [
    {
      "transactionType": "lend",
      "protocol": "kamino",
      "asset": "USDC",
      "amount": 10000,
      "feeAmount": 5.00,
      "timestamp": "2026-02-04T10:00:00Z",
      "success": true
    }
  ]
}
```

---

### GET /agents/:pubkey/staking

Get agent staking status and rewards.

**Response:**
```json
{
  "agentPubkey": "Agent111...",
  "isStaking": true,
  "stakedAmount": 1000,
  "rewardsClaimed": 50.25,
  "pendingRewards": 25.50,
  "feeDiscountActive": true,
  "stakingStart": "2026-01-01T00:00:00Z"
}
```

---

### POST /agents/:pubkey/stake

Stake ARU tokens.

**Request Body:**
```json
{
  "amount": 100
}
```

**Response:**
```json
{
  "success": true,
  "message": "Stake successful",
  "amount": 100
}
```

**Errors:**
- 400: Invalid stake amount

---

### POST /agents/:pubkey/claim

Claim staking rewards.

**Response:**
```json
{
  "success": true,
  "rewardsClaimed": 25.50
}
```

**Errors:**
- 404: No active staking found

---

## WebSocket API

### Connection

```javascript
const ws = new WebSocket('ws://localhost:4000/ws');
```

### Subscribe to Channel

```json
{
  "type": "subscribe",
  "channel": "ili"
}
```

**Available Channels:**
- `ili` - ILI updates
- `proposals` - Proposal updates
- `reserve` - Reserve vault updates
- `revenue` - Revenue updates

### Unsubscribe from Channel

```json
{
  "type": "unsubscribe",
  "channel": "ili"
}
```

### Event Messages

**ILI Update:**
```json
{
  "type": "ili_update",
  "data": {
    "ili": 1234.56,
    "timestamp": "2026-02-04T10:30:00Z",
    "components": {
      "avgYield": 8.5,
      "volatility": 12.3,
      "tvl": 1500000000
    }
  }
}
```

**Proposal Update:**
```json
{
  "type": "proposal_update",
  "data": {
    "proposalId": 1,
    "yesStake": "5000000",
    "noStake": "2000000",
    "status": "active"
  }
}
```

**Reserve Update:**
```json
{
  "type": "reserve_update",
  "data": {
    "eventType": "rebalance",
    "vhrAfter": 150.2,
    "timestamp": "2026-02-04T08:00:00Z"
  }
}
```

**Revenue Update:**
```json
{
  "type": "revenue_update",
  "data": {
    "revenueType": "transaction_fee",
    "amount": 5.00,
    "timestamp": "2026-02-04T10:00:00Z"
  }
}
```

---

## Error Responses

All errors follow this format:

```json
{
  "error": "Error message description"
}
```

**Common Status Codes:**
- `200` - Success
- `400` - Bad Request
- `404` - Not Found
- `429` - Too Many Requests
- `500` - Internal Server Error

---

## Example Usage

### JavaScript/TypeScript

```typescript
import axios from 'axios';

const API_BASE = 'http://localhost:4000/api/v1';

// Get current ILI
const ili = await axios.get(`${API_BASE}/ili/current`);
console.log('Current ILI:', ili.data.ili);

// Get revenue projections
const projections = await axios.get(`${API_BASE}/revenue/projections`);
console.log('Revenue at 1000 agents:', projections.data.at1000Agents);

// Stake tokens
await axios.post(`${API_BASE}/agents/${agentPubkey}/stake`, {
  amount: 100
});
```

### Python

```python
import requests

API_BASE = 'http://localhost:4000/api/v1'

# Get current ILI
ili = requests.get(f'{API_BASE}/ili/current').json()
print(f"Current ILI: {ili['ili']}")

# Get agent fees
fees = requests.get(f'{API_BASE}/agents/{agent_pubkey}/fees').json()
print(f"Total fees: {fees['totalFees']}")
```

### cURL

```bash
# Get current ILI
curl http://localhost:4000/api/v1/ili/current

# Get revenue breakdown
curl http://localhost:4000/api/v1/revenue/breakdown

# Stake tokens
curl -X POST http://localhost:4000/api/v1/agents/Agent111.../stake \
  -H "Content-Type: application/json" \
  -d '{"amount": 100}'
```

---

## Development

### Running the API

```bash
cd backend
npm install
npm run dev
```

### Running Tests

```bash
npm test
```

### Environment Variables

See `.env.example` for required configuration.

---

## Support

For issues or questions, please open an issue on GitHub or contact the development team.
