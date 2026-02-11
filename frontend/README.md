# Agentic Reserve System - Frontend Dashboard

Real-time monitoring dashboard for the Agentic Reserve System (ARS).

## Features

- **ILI Heartbeat** - Real-time Internet Liquidity Index with 24h trend
- **ICR Display** - Internet Credit Rate with confidence intervals
- **Reserve Chart** - Vault composition and VHR tracking
- **Revenue Metrics** - Protocol revenue with projections
- **Staking Metrics** - ARU staking and rewards
- **Oracle Status** - Multi-source oracle health monitoring
- **WebSocket Updates** - Real-time data streaming

## Tech Stack

- **Framework**: Vite + React 19 + TypeScript
- **Styling**: Tailwind CSS 4
- **State**: Zustand
- **API**: Axios + WebSocket
- **Blockchain**: Solana Web3.js + Wallet Adapter

## Getting Started

### Prerequisites

- Node.js 18+
- Backend API running on port 4000

### Installation

```bash
# Install dependencies
npm install

# Copy environment variables
cp .env.example .env

# Update .env with your configuration
```

### Development

```bash
# Start development server
npm run dev

# Open browser at http://localhost:5173
```

### Build

```bash
# Build for production
npm run build

# Preview production build
npm run preview
```

## Project Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── Dashboard.tsx          # Main dashboard
│   │   ├── ILIHeartbeat.tsx       # ILI visualization
│   │   ├── ICRDisplay.tsx         # ICR display
│   │   ├── ReserveChart.tsx       # Reserve vault chart
│   │   ├── RevenueMetrics.tsx     # Revenue metrics
│   │   ├── StakingMetrics.tsx     # Staking metrics
│   │   └── OracleStatus.tsx       # Oracle health
│   ├── hooks/
│   │   ├── useAPI.ts              # API data fetching
│   │   └── useWebSocket.ts        # WebSocket connection
│   ├── providers/
│   │   ├── WalletProvider.tsx     # Solana wallet
│   │   └── SupabaseProvider.tsx   # Supabase client
│   ├── App.tsx                    # Main app component
│   └── main.tsx                   # Entry point
├── public/
├── .env.example
├── package.json
├── vite.config.ts
└── tailwind.config.js
```

## Components

### Dashboard

Main dashboard component that orchestrates all sub-components and manages WebSocket subscriptions.

### ILIHeartbeat

Displays the Internet Liquidity Index with:
- Current ILI value with color coding
- Components breakdown (yield, volatility, TVL)
- 24-hour mini chart
- Animated heartbeat pulse

### ICRDisplay

Shows the Internet Credit Rate with:
- Current ICR in percentage and basis points
- Confidence interval (±2σ)
- Data sources with weights
- Confidence range

### ReserveChart

Visualizes the reserve vault with:
- Total value and liabilities
- Vault Health Ratio (VHR)
- Asset composition bar chart
- Detailed asset breakdown
- Last rebalance timestamp

### RevenueMetrics

Displays protocol revenue with:
- Daily/monthly/annual revenue
- Average revenue per agent
- Fee breakdown by type
- Revenue projections for different agent counts

### StakingMetrics

Shows staking information with:
- Total ARU staked
- Current staking APY
- Rewards pool and burned ARU
- Revenue distribution breakdown
- Recent distribution history

### OracleStatus

Monitors oracle health with:
- Overall system status
- Individual oracle status (Pyth, Switchboard, Birdeye)
- Uptime percentages
- Last update timestamps
- Active features (median calculation, outlier detection)

## Hooks

### useAPI

Custom hook for API data fetching with:
- Automatic loading states
- Error handling
- Optional polling
- Manual refetch

```typescript
const { data, loading, error, refetch } = useAPI('/ili/current', {
  interval: 60000, // Poll every minute
  enabled: true,
});
```

### useWebSocket

Custom hook for WebSocket connections with:
- Automatic reconnection
- Channel subscriptions
- Message handlers
- Connection status

```typescript
const { connected, subscribe, unsubscribe, on } = useWebSocket();

// Subscribe to channel
subscribe('ili');

// Listen for updates
on('ili_update', (data) => {
  console.log('ILI updated:', data);
});
```

## API Integration

The dashboard connects to the backend API at `http://localhost:4000/api/v1`:

- `GET /ili/current` - Current ILI value
- `GET /ili/history` - Historical ILI data
- `GET /icr/current` - Current ICR
- `GET /reserve/state` - Reserve vault state
- `GET /revenue/current` - Current revenue metrics
- `GET /revenue/breakdown` - Fee breakdown
- `GET /revenue/projections` - Revenue projections
- `GET /revenue/distributions` - Distribution history

WebSocket connection at `ws://localhost:4000/ws`:

- Channel: `ili` - ILI updates
- Channel: `proposals` - Proposal updates
- Channel: `reserve` - Reserve updates
- Channel: `revenue` - Revenue updates

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `VITE_API_URL` | Backend API URL | `http://localhost:4000/api/v1` |
| `VITE_WS_URL` | WebSocket URL | `ws://localhost:4000/ws` |
| `VITE_SUPABASE_URL` | Supabase URL | `http://localhost:8000` |
| `VITE_SUPABASE_ANON_KEY` | Supabase anon key | - |
| `VITE_SOLANA_NETWORK` | Solana network | `devnet` |
| `VITE_SOLANA_RPC_URL` | Solana RPC URL | `https://api.devnet.solana.com` |

## Styling

The dashboard uses Tailwind CSS with a custom color scheme:

- **Primary**: Blue (ILI, system)
- **Secondary**: Purple (ICR, staking)
- **Success**: Green (healthy, positive)
- **Warning**: Yellow (degraded, caution)
- **Danger**: Red (down, critical)

## Performance

- **Code Splitting**: Automatic chunking for Solana and vendor libraries
- **Lazy Loading**: Components loaded on demand
- **Caching**: API responses cached with appropriate TTLs
- **WebSocket**: Efficient real-time updates
- **Optimized Build**: Production build with tree-shaking and minification

## Browser Support

- Chrome/Edge 90+
- Firefox 88+
- Safari 14+

## License

MIT

## Contributing

Contributions welcome! Please open an issue or PR.

## Support

For issues or questions, please open an issue on GitHub.
