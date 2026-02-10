# ARS Agent Swarm Skill

## Overview
This skill enables OpenClaw to work with the Agentic Reserve System's multi-agent swarm system for autonomous monetary policy management.

## Agent Architecture

### Coordinator
- **ARS Orchestrator**: Master coordinator for all agents

### Specialists (10 agents)
1. **Policy Agent**: Monetary policy analysis with AI
2. **Oracle Agent**: Multi-source price aggregation
3. **DeFi Agent**: Protocol integration and yield optimization
4. **Governance Agent**: Futarchy proposals and voting
5. **Risk Agent**: VHR monitoring and circuit breakers
6. **Execution Agent**: On-chain transaction execution
7. **Payment Agent**: x402 micropayments and budgets
8. **Monitoring Agent**: Health checks and alerting
9. **Learning Agent**: ML-based strategy optimization

## Common Tasks

### Start Agent Swarm
```bash
# Start orchestrator
npm run agent:orchestrator

# Start all agents
npm run agent:start-all

# Start specific agent
npm run agent:policy
```

### Execute Workflow
```typescript
import { getOrchestrator } from './services/agent-swarm/orchestrator';

const orchestrator = getOrchestrator();

// Execute ILI update workflow
await orchestrator.executeWorkflow('ili-update', {
  tokens: ['SOL', 'USDC', 'mSOL']
});

// Execute policy execution workflow
await orchestrator.executeWorkflow('policy-execution', {
  proposal_id: '123'
});
```

### Monitor Agent Status
```typescript
// Get all agents
const agents = orchestrator.getAllAgents();

// Get specific agent status
const policyAgent = orchestrator.getAgentStatus('policy-agent');

// Get active workflows
const workflows = orchestrator.getActiveWorkflows();
```

### Send Message to Agent
```typescript
await orchestrator.sendMessage('policy-agent', {
  type: 'action-request',
  from: 'ars-orchestrator',
  to: 'policy-agent',
  payload: {
    action: 'calculate-ili',
    inputs: { tokens: ['SOL', 'USDC'] }
  },
  timestamp: Date.now(),
  priority: 'normal'
});
```

## Workflows

### 1. ILI Update (Every 5 min)
```typescript
await orchestrator.executeWorkflow('ili-update');
```

### 2. Policy Execution
```typescript
await orchestrator.executeWorkflow('policy-execution', {
  proposal_id: '123'
});
```

### 3. Circuit Breaker (Emergency)
```typescript
await orchestrator.executeWorkflow('circuit-breaker', {
  vhr: 145,
  reason: 'VHR below critical threshold'
});
```

### 4. Vault Rebalance (Every 6 hours)
```typescript
await orchestrator.executeWorkflow('rebalance-vault');
```

### 5. AI Policy Recommendation (Daily)
```typescript
await orchestrator.executeWorkflow('ai-policy-recommendation');
```

## Agent Communication

### Message Format
```typescript
interface AgentMessage {
  type: 'action-request' | 'agent-response' | 'approval-request' | 'consensus-vote' | 'alert';
  from: string;
  to: string;
  payload: any;
  timestamp: number;
  priority: 'low' | 'normal' | 'high' | 'critical';
}
```

### Redis Channels
- `icb:orchestrator` - Orchestrator channel
- `icb:policy` - Policy agent
- `icb:oracle` - Oracle agent
- `icb:defi` - DeFi agent
- `icb:governance` - Governance agent
- `icb:risk` - Risk agent
- `icb:execution` - Execution agent
- `icb:payment` - Payment agent
- `icb:monitoring` - Monitoring agent
- `icb:learning` - Learning agent

## AI Integration

### Policy Analysis
```typescript
import { getPolicyAgent } from './services/agent-swarm/agents/policy-agent';

const policyAgent = getPolicyAgent();

// Analyze with AI
const analysis = await policyAgent.analyzeWithAI({
  market_data: currentMarket,
  historical_ili: last24Hours
});

// Get policy recommendation
const recommendation = await policyAgent.recommendPolicy({
  ili: 100,
  icr: 85,
  vhr: 175,
  market_conditions: 'volatile'
});
```

### Governance Analysis
```typescript
// Analyze proposal with AI
const analysis = await governanceAgent.analyzeProposal({
  proposalType: 'mint',
  proposalData: { amount: 1000000 },
  currentState: { ili: 100, vhr: 180 }
});
// Returns: { analysis: "...", recommendation: "approve" | "reject" }
```

## x402 Payments

### Oracle Query Payment
```typescript
import { getX402Client } from './services/payment/x402-client';

const x402 = getX402Client();

// Request with automatic payment
const result = await x402.requestWithPayment({
  url: 'https://api.birdeye.so/premium/price',
  payer: agentKeypair
});
```

### Budget Management
```typescript
// Check budget
const budget = x402.getBudget();
console.log(`Remaining: ${budget.remaining / 1000000} USDC`);

// Add budget
x402.addBudget(5000000); // Add 5 USDC
```

## MagicBlock ER

### Create ER Session
```typescript
import { getMagicBlockClient } from './services/defi/magicblock-client';

const magicBlock = getMagicBlockClient();

// Create session for high-frequency ops
const session = await magicBlock.createSession({
  accounts: [iliAccount, vaultAccount],
  payer: executionAgent.keypair,
  duration: 3600 // 1 hour
});

// Execute transaction on ER
await magicBlock.sendTransaction({
  transaction: updateTx,
  sessionId: session.sessionId
});

// Commit to base layer
await magicBlock.commitSession(session.sessionId);
```

## Monitoring

### Health Checks
```typescript
// Get agent health
const health = await monitoringAgent.checkHealth();

// Get metrics
const metrics = await monitoringAgent.getMetrics();
```

### Alerts
```typescript
// Send alert
await monitoringAgent.sendAlert({
  severity: 'critical',
  title: 'VHR Below Threshold',
  description: 'VHR dropped to 145%'
});
```

## Consensus Voting

### Request Consensus
```typescript
await orchestrator.requestConsensus({
  topic: 'policy-execution',
  data: {
    proposal_id: '123',
    ili_impact: 0.05
  }
});
```

### Agent Weights
- Policy Agent: 3
- Risk Agent: 3
- Oracle Agent: 2
- DeFi Agent: 2
- Governance Agent: 2
- Others: 1

**Quorum**: 60% of weighted votes

## Testing

### Unit Tests
```bash
npm test -- agent-swarm
```

### Integration Tests
```bash
npm test -- agent-swarm.integration
```

### Load Tests
```bash
npm run test:load -- agent-swarm
```

## Deployment

### Development
```bash
# Start Redis
docker-compose up redis

# Start orchestrator
npm run agent:orchestrator

# Start agents
npm run agent:start-all
```

### Production
```bash
# Use PM2
pm2 start ecosystem.config.js

# Monitor
pm2 monit

# Logs
pm2 logs ars-orchestrator
```

## Troubleshooting

### Agent Not Responding
```bash
# Check agent status
pm2 status

# Restart agent
pm2 restart policy-agent

# View logs
pm2 logs policy-agent --lines 100
```

### Consensus Timeout
```bash
# Check Redis connection
redis-cli ping

# Check agent weights
redis-cli get icb:consensus:weights

# Increase timeout in config
```

### High API Costs
```bash
# Check OpenRouter costs
redis-cli get icb:costs:openrouter

# Switch to cheaper model
# Edit swarm-config.json: model -> "openrouter/mixtral-8x7b"
```

## Best Practices

1. **Always use orchestrator** for workflow execution
2. **Monitor agent health** regularly
3. **Set budget limits** for payment agent
4. **Use ER for high-frequency** operations
5. **Enable consensus** for critical decisions
6. **Track AI costs** with OpenRouter
7. **Test workflows** before production
8. **Set up alerts** for critical events

## Resources

- [Agent Swarm Architecture](../AGENT_SWARM_ARCHITECTURE.md)
- [OpenClaw Documentation](https://docs.openclaw.ai)
- [OpenRouter API](https://openrouter.ai/docs)
- [MagicBlock ER](https://docs.magicblock.gg)
- [x402 Protocol](https://x402.org)
