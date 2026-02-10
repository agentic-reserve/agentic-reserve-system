# ICB Backend API

Internet Central Bank Backend API - Agent-First DeFi Protocol

## Features

- **REST API**: ILI, ICR, Proposals, Reserve, Revenue, and Agent endpoints
- **WebSocket API**: Real-time updates for ILI, proposals, reserve, and revenue
- **Policy Executor**: Automated proposal execution and monitoring
- **Rate Limiting**: 100 requests per minute per IP
- **Caching**: Redis caching for expensive queries
- **Real-time**: Supabase real-time subscriptions

## Setup

1. Install dependencies:
```bash
npm install
```

2. Copy `.env.example` to `.env` and configure:
```bash
cp .env.example .env
```

3. Configure environment variables:
- `SUPABASE_URL`: Your Supabase project URL
- `SUPABASE_ANON_KEY`: Supabase anonymous key
- `SUPABASE_SERVICE_KEY`: Supabase service role key
- `REDIS_URL`: Redis connection URL
- `SOLANA_RPC_URL`: Solana RPC endpoint
- `HELIUS_API_KEY`: Helius API key (optional)

## Development

Start the development server:
```bash
npm run dev
```

The API will be available at `http://localhost:3000`

## API Endpoints

### ILI Endpoints
- `GET /api/v1/ili/current` - Get current ILI value
- `GET /api/v1/ili/history` - Get ILI history

### ICR Endpoints
- `GET /api/v1/icr/current` - Get current Internet Credit Rate

### Proposal Endpoints
- `GET /api/v1/proposals` - List proposals
- `GET /api/v1/proposals/:id` - Get proposal details

### Reserve Endpoints
- `GET /api/v1/reserve/state` - Get reserve vault state
- `GET /api/v1/reserve/history` - Get rebalance history

### Revenue Endpoints
- `GET /api/v1/revenue/current` - Current revenue metrics
- `GET /api/v1/revenue/history` - Historical revenue data
- `GET /api/v1/revenue/projections` - Revenue projections
- `GET /api/v1/revenue/breakdown` - Fee breakdown by type
- `GET /api/v1/revenue/distributions` - Distribution history

### Agent Endpoints
- `GET /api/v1/agents/:pubkey/fees` - Agent fee history
- `GET /api/v1/agents/:pubkey/staking` - Staking status
- `POST /api/v1/agents/:pubkey/stake` - Stake ICU tokens
- `POST /api/v1/agents/:pubkey/claim` - Claim rewards

## WebSocket API

Connect to `ws://localhost:3000/ws`

### Subscribe to channels:
```json
{
  "type": "subscribe",
  "channel": "ili"
}
```

Available channels: `ili`, `proposals`, `reserve`, `revenue`

### Receive updates:
```json
{
  "type": "ili_update",
  "data": {
    "ili": 1234.56,
    "timestamp": "2026-02-03T12:00:00Z",
    "components": {
      "avgYield": 8.5,
      "volatility": 12.3,
      "tvl": 1500000000
    }
  }
}
```

## Testing

Run tests:
```bash
npm test
```

## Production

Build for production:
```bash
npm run build
```

Start production server:
```bash
npm start
```

## Architecture

- **Express.js**: REST API framework
- **WebSocket**: Real-time communication
- **Supabase**: PostgreSQL database with real-time subscriptions
- **Redis**: Caching layer
- **Solana Web3.js**: Blockchain interaction

## Policy Executor

The policy executor runs as a background service that:
- Monitors proposals every minute
- Executes approved proposals automatically
- Collects proposal fees (10 ICU burned)
- Implements retry logic with exponential backoff
- Slashes incorrect voters (10% penalty)

## License

MIT
