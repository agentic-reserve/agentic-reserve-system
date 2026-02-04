# ARS SDK

TypeScript SDK for interacting with the Agentic Reserve System (ARS) - an Agent-First DeFi Protocol on Solana.

## Installation

```bash
npm install @ars/sdk
```

or

```bash
yarn add @ars/sdk
```

## Quick Start

```typescript
import { ARSClient } from '@ars/sdk';

// Initialize client
const client = new ARSClient({
  apiUrl: 'https://api.ars-protocol.com',
  rpcUrl: 'https://api.mainnet-beta.solana.com'
});

// Query ILI
const ili = await client.getILI();
console.log('Current ILI:', ili.value);

// Query ICR
const icr = await client.getICR();
console.log('Current ICR:', icr.value);

// Get reserve state
const reserve = await client.getReserveState();
console.log('VHR:', reserve.vhr);
```

## Features

- ✅ Query Internet Liquidity Index (ILI)
- ✅ Query Internet Credit Rate (ICR)
- ✅ Get reserve vault state
- ✅ Create futarchy proposals
- ✅ Vote on proposals with quadratic staking
- ✅ Real-time subscriptions via WebSocket
- ✅ TypeScript support with full type definitions
- ✅ Automatic reconnection for WebSocket
- ✅ Agent authentication with Ed25519 signatures

## API Reference

### ARSClient

Main client class for interacting with ARS protocol.

#### Constructor

```typescript
new ARSClient(config?: ARSClientConfig)
```

**Config Options:**
- `apiUrl` - API base URL (default: `http://localhost:3000`)
- `rpcUrl` - Solana RPC URL (optional)
- `wsUrl` - WebSocket URL (default: `ws://localhost:3000`)
- `timeout` - Request timeout in ms (default: `30000`)

#### Methods

##### getILI()

Get current Internet Liquidity Index.

```typescript
const ili = await client.getILI();
// Returns: { value, timestamp, avgYield, volatility, tvl }
```

##### getILIHistory(startTime?, endTime?)

Get historical ILI data.

```typescript
const history = await client.getILIHistory(
  Date.now() - 7 * 24 * 60 * 60 * 1000, // 7 days ago
  Date.now()
);
// Returns: Array<{ timestamp, value }>
```

##### getICR()

Get current Internet Credit Rate.

```typescript
const icr = await client.getICR();
// Returns: { value, confidence, timestamp, sources }
```

##### getReserveState()

Get current reserve vault state.

```typescript
const reserve = await client.getReserveState();
// Returns: { vhr, totalValue, liabilities, assets, lastRebalance }
```

##### getProposals(status?)

Get list of proposals, optionally filtered by status.

```typescript
const proposals = await client.getProposals('active');
// Returns: Array<Proposal>
```

##### getProposal(proposalId)

Get details of a specific proposal.

```typescript
const proposal = await client.getProposal(42);
// Returns: Proposal
```

##### createProposal(params)

Create a new futarchy proposal.

```typescript
import { Keypair } from '@solana/web3.js';

const agentKeypair = Keypair.fromSecretKey(/* your secret key */);

const proposal = await client.createProposal({
  policyType: 'mint',
  params: {
    amount: 1000000, // 1M ARU
    reason: 'Expand liquidity based on ILI analysis'
  },
  signer: agentKeypair
});
// Returns: Proposal
```

##### voteOnProposal(params)

Vote on an existing proposal.

```typescript
const signature = await client.voteOnProposal({
  proposalId: 42,
  prediction: true, // true = YES, false = NO
  stakeAmount: 10000, // 10k ARU
  signer: agentKeypair
});
// Returns: transaction signature (string)
```

**Note:** Quadratic staking applies: `voting_power = sqrt(stakeAmount)`

##### onILIUpdate(callback)

Subscribe to real-time ILI updates.

```typescript
client.onILIUpdate((ili) => {
  console.log('ILI updated:', ili.value);
});
```

##### onProposalUpdate(callback)

Subscribe to real-time proposal updates.

```typescript
client.onProposalUpdate((proposal) => {
  console.log('Proposal updated:', proposal);
});
```

##### onReserveUpdate(callback)

Subscribe to real-time reserve updates.

```typescript
client.onReserveUpdate((reserve) => {
  console.log('Reserve updated:', reserve);
});
```

##### disconnect()

Unsubscribe from all events and close connections.

```typescript
client.disconnect();
```

## Integration Examples

### Example 1: Lending Agent

A simple lending agent that adjusts positions based on ICR.

```typescript
import { ARSClient } from '@ars/sdk';
import { Keypair } from '@solana/web3.js';

class LendingAgent {
  private client: ARSClient;
  private keypair: Keypair;

  constructor(apiUrl: string, keypair: Keypair) {
    this.client = new ARSClient({ apiUrl });
    this.keypair = keypair;
  }

  async execute() {
    // Get current ICR
    const icr = await this.client.getICR();
    console.log(`Current ICR: ${icr.value}%`);

    // Strategy: Lend when ICR > 8%
    if (icr.value > 8.0) {
      console.log('ICR is high - good time to lend');
      // Integrate with Kamino Finance to supply USDC
      // await kamino.supply({ asset: 'USDC', amount: 10000 });
    }

    // Strategy: Borrow when ICR < 6%
    if (icr.value < 6.0) {
      console.log('ICR is low - good time to borrow');
      // Integrate with Kamino Finance to borrow SOL
      // await kamino.borrow({ asset: 'SOL', amount: 5 });
    }
  }

  async start() {
    // Execute strategy every minute
    setInterval(() => this.execute(), 60000);
    
    // Subscribe to ICR updates for real-time adjustments
    this.client.onILIUpdate((ili) => {
      console.log('ILI updated:', ili.value);
      this.execute();
    });
  }
}

// Usage
const agent = new LendingAgent(
  'https://api.ars-protocol.com',
  Keypair.fromSecretKey(/* your secret key */)
);
agent.start();
```

### Example 2: Governance Agent

An agent that participates in futarchy governance.

```typescript
import { ARSClient } from '@ars/sdk';
import { Keypair } from '@solana/web3.js';

class GovernanceAgent {
  private client: ARSClient;
  private keypair: Keypair;

  constructor(apiUrl: string, keypair: Keypair) {
    this.client = new ARSClient({ apiUrl });
    this.keypair = keypair;
  }

  async analyzeProposal(proposal: any): Promise<boolean> {
    // Get current ILI
    const ili = await this.client.getILI();
    
    // Simple strategy: Vote YES on mint proposals if ILI is low
    if (proposal.policyType === 'mint' && ili.value < 500) {
      return true; // Vote YES
    }
    
    // Vote NO on burn proposals if ILI is already low
    if (proposal.policyType === 'burn' && ili.value < 500) {
      return false; // Vote NO
    }
    
    // Default: Vote YES
    return true;
  }

  async voteOnActiveProposals() {
    // Get all active proposals
    const proposals = await this.client.getProposals('active');
    
    for (const proposal of proposals) {
      console.log(`Analyzing proposal ${proposal.id}...`);
      
      // Analyze proposal
      const prediction = await this.analyzeProposal(proposal);
      
      // Calculate stake amount based on confidence
      const stakeAmount = 1000; // 1k ARU
      
      // Vote on proposal
      try {
        const signature = await this.client.voteOnProposal({
          proposalId: proposal.id,
          prediction,
          stakeAmount,
          signer: this.keypair
        });
        
        console.log(`Voted ${prediction ? 'YES' : 'NO'} on proposal ${proposal.id}`);
        console.log(`Transaction: ${signature}`);
      } catch (error) {
        console.error(`Failed to vote on proposal ${proposal.id}:`, error);
      }
    }
  }

  async start() {
    // Vote on active proposals every hour
    setInterval(() => this.voteOnActiveProposals(), 60 * 60 * 1000);
    
    // Subscribe to new proposals
    this.client.onProposalUpdate((proposal) => {
      if (proposal.status === 'active') {
        console.log('New proposal detected:', proposal.id);
        this.voteOnActiveProposals();
      }
    });
  }
}

// Usage
const agent = new GovernanceAgent(
  'https://api.ars-protocol.com',
  Keypair.fromSecretKey(/* your secret key */)
);
agent.start();
```

### Example 3: Monitoring Agent

An agent that monitors system health and sends alerts.

```typescript
import { ARSClient } from '@ars/sdk';

class MonitoringAgent {
  private client: ARSClient;
  private alertThresholds = {
    vhrMin: 150, // Minimum VHR (%)
    iliMin: 400, // Minimum ILI
    icrMax: 12,  // Maximum ICR (%)
  };

  constructor(apiUrl: string) {
    this.client = new ARSClient({ apiUrl });
  }

  async checkSystemHealth() {
    // Get current metrics
    const [ili, icr, reserve] = await Promise.all([
      this.client.getILI(),
      this.client.getICR(),
      this.client.getReserveState()
    ]);

    console.log('System Health Check:');
    console.log(`- ILI: ${ili.value}`);
    console.log(`- ICR: ${icr.value}%`);
    console.log(`- VHR: ${reserve.vhr}%`);

    // Check for alerts
    if (reserve.vhr < this.alertThresholds.vhrMin) {
      this.sendAlert(`⚠️ VHR is low: ${reserve.vhr}% (threshold: ${this.alertThresholds.vhrMin}%)`);
    }

    if (ili.value < this.alertThresholds.iliMin) {
      this.sendAlert(`⚠️ ILI is low: ${ili.value} (threshold: ${this.alertThresholds.iliMin})`);
    }

    if (icr.value > this.alertThresholds.icrMax) {
      this.sendAlert(`⚠️ ICR is high: ${icr.value}% (threshold: ${this.alertThresholds.icrMax}%)`);
    }
  }

  sendAlert(message: string) {
    console.error(message);
    // Send to Discord, Telegram, email, etc.
  }

  async start() {
    // Check health every 5 minutes
    setInterval(() => this.checkSystemHealth(), 5 * 60 * 1000);
    
    // Subscribe to real-time updates
    this.client.onReserveUpdate((reserve) => {
      if (reserve.vhr < this.alertThresholds.vhrMin) {
        this.sendAlert(`⚠️ VHR dropped to ${reserve.vhr}%`);
      }
    });

    this.client.onILIUpdate((ili) => {
      if (ili.value < this.alertThresholds.iliMin) {
        this.sendAlert(`⚠️ ILI dropped to ${ili.value}`);
      }
    });
  }
}

// Usage
const agent = new MonitoringAgent('https://api.ars-protocol.com');
agent.start();
```

## TypeScript Support

The SDK is written in TypeScript and includes full type definitions.

```typescript
import { ARSClient, ILI, ICR, ReserveState, Proposal } from '@ars/sdk';

const client = new ARSClient();

// All return types are fully typed
const ili: ILI = await client.getILI();
const icr: ICR = await client.getICR();
const reserve: ReserveState = await client.getReserveState();
const proposals: Proposal[] = await client.getProposals();
```

## Error Handling

The SDK throws errors for failed requests. Always wrap calls in try-catch blocks.

```typescript
try {
  const ili = await client.getILI();
  console.log('ILI:', ili.value);
} catch (error) {
  console.error('Failed to fetch ILI:', error);
}
```

## WebSocket Reconnection

The SDK automatically reconnects to the WebSocket server if the connection is lost. Reconnection attempts occur every 5 seconds.

## Contributing

Contributions are welcome! Please open an issue or submit a pull request.

## License

MIT

## Links

- [GitHub Repository](https://github.com/protocoldaemon-sec/agentic-reserve-system)
- [Documentation](https://docs.ars-protocol.com)
- [Discord Community](https://discord.gg/ars)

## Support

For questions and support:
- GitHub Issues: https://github.com/protocoldaemon-sec/agentic-reserve-system/issues
- Discord: https://discord.gg/ars
- Email: support@ars-protocol.com
