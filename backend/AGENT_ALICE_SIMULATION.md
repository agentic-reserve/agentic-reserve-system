# Agent Alice Simulation - ARS Backend Discovery & Execution Flow

## Scenario
Agent Alice is an autonomous AI agent tasked with monitoring DeFi liquidity metrics and executing privacy-preserving transfers. She discovers the ARS Backend API and learns how to interact with it.

---

## Phase 1: Discovery (First Contact)

### Step 1.1: Agent Alice discovers ARS Backend
```typescript
// Alice receives a tip about ARS Backend from another agent or registry
const arsBackendUrl = 'https://agentic-reserve-system-production.up.railway.app';

// Alice first checks if the service is alive
const healthCheck = await fetch(`${arsBackendUrl}/health`);
const health = await healthCheck.json();
console.log('Service Status:', health.status); // "ok"
```

**Alice's Thought Process:**
- "Service is online and responding"
- "Now I need to understand what this service can do"

---

## Phase 2: Learning (Reading Documentation)

### Step 2.1: Read SKILL.md (High-Level Understanding)
```typescript
// Alice reads the skill file to understand capabilities
const skillResponse = await fetch(`${arsBackendUrl}/SKILL.md`);
const skillContent = await skillResponse.text();

// Alice parses YAML frontmatter
const frontmatter = {
  name: "ARS Backend API",
  version: "1.0.0",
  description: "Expert knowledge for interacting with the Agentic Reserve System...",
  url: "https://agentic-reserve-system-production.up.railway.app"
};

// Alice extracts key information
const capabilities = [
  "ILI (Internet Liquidity Index) - Real-time liquidity metrics",
  "ICR (Internet Credit Rate) - Weighted lending rates",
  "Reserve Vault - Collateralization tracking",
  "Privacy - Shielded transfers & MEV protection",
  "Compliance - Viewing keys for auditors",
  "Agent Staking - Earn rewards by staking ARU tokens"
];

// Alice identifies authentication requirements
const authRequired = {
  apiKey: "X-API-Key header for most endpoints",
  viewingKey: "X-Viewing-Key for privacy-protected data"
};

// Alice learns core principles
const principles = [
  "All data is REAL (no mock data)",
  "Privacy-first approach",
  "Rate limits: 100 req/min default",
  "Caching: 5-10 min TTL for metrics"
];
```

**Alice's Thought Process:**
- "This is a DeFi reserve system with privacy features"
- "I need an API key to interact"
- "They have real-time liquidity data from Kamino, Jupiter, Meteora"
- "I can do shielded transfers to protect my transactions"

### Step 2.2: Read ars-llms.txt (Detailed API Reference)
```typescript
// Alice reads the complete API documentation
const llmsResponse = await fetch(`${arsBackendUrl}/ars-llms.txt`);
const apiDocs = await llmsResponse.text();

// Alice builds an internal API map
const apiMap = {
  health: {
    endpoint: '/api/v1/health',
    method: 'GET',
    auth: false,
    response: { status: 'ok|degraded', dependencies: {}, metrics: {} }
  },
  iliCurrent: {
    endpoint: '/api/v1/ili/current',
    method: 'GET',
    auth: true,
    response: { ili: 11.54, timestamp: '...', components: {} }
  },
  stealthAddress: {
    endpoint: '/api/v1/privacy/stealth-address',
    method: 'POST',
    auth: true,
    body: { agentId: 'string', label: 'string' },
    response: { success: true, data: { id: 1, metaAddress: {} } }
  },
  shieldedTransfer: {
    endpoint: '/api/v1/privacy/shielded-transfer',
    method: 'POST',
    auth: true,
    body: { senderId: 'string', recipientMetaAddressId: 1, amount: 'string', mint: 'string' },
    response: { success: true, data: { unsignedTransaction: '...', stealthAddress: {} } }
  }
  // ... Alice maps all 60+ endpoints
};

// Alice identifies workflows from documentation
const workflows = {
  shieldedTransfer: [
    '1. Get recipient meta-address: GET /privacy/stealth-address/:agentId',
    '2. Build transfer: POST /privacy/shielded-transfer',
    '3. Sign and submit: POST /privacy/shielded-transfer/submit'
  ],
  mevProtectedSwap: [
    '1. Check privacy score: GET /privacy/score/:address',
    '2. Execute swap: POST /privacy/protected-swap'
  ],
  complianceSetup: [
    '1. Setup hierarchy: POST /compliance/setup',
    '2. Disclose transaction: POST /compliance/disclose'
  ]
};
```

**Alice's Thought Process:**
- "I now have a complete map of all endpoints"
- "I understand the request/response formats"
- "I know the multi-step workflows for complex operations"
- "I can see rate limits and caching behavior"

### Step 2.3: Read HEARTBEAT.md (Monitoring Protocol)
```typescript
// Alice reads the heartbeat specification
const heartbeatResponse = await fetch(`${arsBackendUrl}/HEARTBEAT.md`);
const heartbeatSpec = await heartbeatResponse.text();

// Alice learns the monitoring protocol
const monitoringProtocol = {
  statusValues: ['ok', 'degraded', 'blocked'],
  requiredFields: ['status', 'agentName', 'time', 'version', 'capabilities', 'lastAction', 'nextAction'],
  optionalFields: ['degradedCapabilities', 'blockReason', 'endpointsWorking', 'healthRate'],
  updateFrequency: {
    normal: '5 minutes',
    degraded: '30 seconds',
    onStatusChange: 'immediate'
  }
};

// Alice understands current system state
const currentState = {
  status: 'ok',
  endpointsWorking: 12,
  endpointsTotal: 14,
  healthRate: '86%',
  knownIssues: [
    'ICR endpoint returns 404',
    'SAK service timeout (non-critical)'
  ]
};

// Alice learns about cron jobs
const cronJobs = {
  iliCalculation: 'Every 5 minutes',
  icrCalculation: 'Every 10 minutes (currently failing)',
  pnlUpdates: 'Every hour',
  paymentScanner: 'Every 30 seconds'
};
```

**Alice's Thought Process:**
- "The system is healthy (86% operational)"
- "ICR endpoint is down, but ILI works fine"
- "I should monitor heartbeat every 5 minutes"
- "If I see 'degraded' status, check more frequently"

---

## Phase 3: Planning (Task Execution Strategy)

### Step 3.1: Alice's Mission
```typescript
// Alice's supervisor gives her a task
const mission = {
  task: "Monitor ILI metrics and send a shielded payment when ILI drops below 10",
  recipient: "agent-bob-456",
  amount: "100 SOL",
  privacyRequired: true
};

// Alice creates an execution plan
const executionPlan = [
  {
    step: 1,
    action: 'Setup request helper',
    endpoint: null,
    rationale: 'Create reusable function for API calls (no auth required currently)'
  },
  {
    step: 2,
    action: 'Monitor ILI continuously',
    endpoint: '/api/v1/ili/current',
    frequency: '5 minutes',
    rationale: 'ILI updates every 5 min, respect cache TTL'
  },
  {
    step: 3,
    action: 'Generate stealth meta-address',
    endpoint: '/api/v1/privacy/stealth-address',
    trigger: 'Once at startup',
    rationale: 'Need my own meta-address for receiving payments'
  },
  {
    step: 4,
    action: 'Get recipient meta-address',
    endpoint: '/api/v1/privacy/stealth-address/agent-bob-456',
    trigger: 'When ILI < 10',
    rationale: 'Need Bob\'s meta-address to send shielded transfer'
  },
  {
    step: 5,
    action: 'Build shielded transfer',
    endpoint: '/api/v1/privacy/shielded-transfer',
    trigger: 'After getting Bob\'s address',
    rationale: 'Create unsigned transaction with stealth address'
  },
  {
    step: 6,
    action: 'Submit signed transaction',
    endpoint: '/api/v1/privacy/shielded-transfer/submit',
    trigger: 'After signing transaction',
    rationale: 'Execute the shielded transfer on-chain'
  },
  {
    step: 7,
    action: 'Monitor transaction status',
    endpoint: '/api/v1/privacy/transactions/agent-alice-123',
    frequency: 'Once after submission',
    rationale: 'Verify transaction succeeded'
  }
];
```

**Alice's Thought Process:**
- "I need to monitor ILI every 5 minutes (cache TTL)"
- "When ILI drops below 10, execute shielded transfer"
- "Use privacy features to protect the transaction"
- "Follow the 3-step workflow from SKILL.md"

---

## Phase 4: Execution (Real Implementation)

### Step 4.1: Setup Request Helper
```typescript
// NOTE: Currently NO authentication required (all endpoints public)
// Future versions will require API key for rate limiting

// Alice creates a request helper
async function arsRequest(endpoint: string, options: any = {}) {
  const url = `${arsBackendUrl}${endpoint}`;
  const headers = {
    'Content-Type': 'application/json',
    // 'X-API-Key': apiKey, // FUTURE: Will be required for rate limiting
    ...options.headers
  };
  
  const response = await fetch(url, { ...options, headers });
  
  // Handle rate limiting
  if (response.status === 429) {
    console.log('Rate limited, waiting 60 seconds...');
    await new Promise(resolve => setTimeout(resolve, 60000));
    return arsRequest(endpoint, options); // Retry
  }
  
  // Handle errors
  if (!response.ok) {
    const error = await response.json();
    throw new Error(`API Error: ${error.message}`);
  }
  
  return response.json();
}
```

### Step 4.2: Generate Alice's Meta-Address
```typescript
// Alice creates her own stealth meta-address
const myMetaAddress = await arsRequest('/api/v1/privacy/stealth-address', {
  method: 'POST',
  body: JSON.stringify({
    agentId: 'agent-alice-123',
    label: 'Alice Monitoring Agent'
  })
});

console.log('My Meta-Address ID:', myMetaAddress.data.id);
console.log('Spend Public Key:', myMetaAddress.data.metaAddress.spendPublicKey);
console.log('View Public Key:', myMetaAddress.data.metaAddress.viewPublicKey);
```

**Alice's State:**
```json
{
  "agentId": "agent-alice-123",
  "metaAddressId": 1,
  "metaAddress": {
    "spendPublicKey": "Gx7k...",
    "viewPublicKey": "Hm9p..."
  },
  "status": "ready"
}
```

### Step 4.3: Monitor ILI (Continuous Loop)
```typescript
// Alice starts monitoring ILI
let monitoringActive = true;
let lastILI = null;

async function monitorILI() {
  while (monitoringActive) {
    try {
      // Check system health first
      const health = await arsRequest('/api/v1/health');
      
      if (health.status === 'degraded') {
        console.log('⚠️ System degraded, continuing with caution...');
      }
      
      // Get current ILI
      const iliData = await arsRequest('/api/v1/ili/current');
      const currentILI = iliData.ili;
      
      console.log(`📊 Current ILI: ${currentILI}`);
      console.log(`   Avg Yield: ${iliData.components.avgYield}%`);
      console.log(`   Volatility: ${iliData.components.volatility}%`);
      console.log(`   TVL: $${(iliData.components.tvl / 1e9).toFixed(2)}B`);
      
      // Check trigger condition
      if (currentILI < 10 && (lastILI === null || lastILI >= 10)) {
        console.log('🚨 ILI dropped below 10! Executing shielded transfer...');
        await executeShieldedTransfer();
        monitoringActive = false; // Mission complete
      }
      
      lastILI = currentILI;
      
      // Wait 5 minutes (respect cache TTL)
      await new Promise(resolve => setTimeout(resolve, 5 * 60 * 1000));
      
    } catch (error) {
      console.error('❌ Error monitoring ILI:', error.message);
      // Wait 1 minute before retry
      await new Promise(resolve => setTimeout(resolve, 60 * 1000));
    }
  }
}
```

**Alice's Monitoring Log:**
```
[2026-02-11T12:00:00Z] 📊 Current ILI: 11.73 (Avg Yield: 0.01%, Volatility: 11.15%, TVL: $1.50B)
[2026-02-11T12:05:00Z] 📊 Current ILI: 11.68 (Avg Yield: 0.01%, Volatility: 11.20%, TVL: $1.49B)
[2026-02-11T12:10:00Z] 📊 Current ILI: 10.95 (Avg Yield: 0.01%, Volatility: 12.50%, TVL: $1.45B)
[2026-02-11T12:15:00Z] 📊 Current ILI: 9.87 (Avg Yield: 0.01%, Volatility: 14.20%, TVL: $1.42B)
[2026-02-11T12:15:01Z] 🚨 ILI dropped below 10! Executing shielded transfer...
```

### Step 4.4: Execute Shielded Transfer
```typescript
async function executeShieldedTransfer() {
  try {
    // Step 1: Get Bob's meta-address
    console.log('Step 1: Getting recipient meta-address...');
    const bobMetaAddress = await arsRequest('/api/v1/privacy/stealth-address/agent-bob-456');
    
    if (!bobMetaAddress.data) {
      throw new Error('Recipient meta-address not found');
    }
    
    console.log(`✅ Bob's Meta-Address ID: ${bobMetaAddress.data.id}`);
    
    // Step 2: Build shielded transfer
    console.log('Step 2: Building shielded transfer...');
    const transfer = await arsRequest('/api/v1/privacy/shielded-transfer', {
      method: 'POST',
      body: JSON.stringify({
        senderId: 'alice-wallet-address-xyz',
        recipientMetaAddressId: bobMetaAddress.data.id,
        amount: '100000000000', // 100 SOL in lamports
        mint: 'So11111111111111111111111111111111111111112' // SOL mint
      })
    });
    
    console.log(`✅ Unsigned transaction created`);
    console.log(`   Stealth Address: ${transfer.data.stealthAddress.address}`);
    console.log(`   Ephemeral Key: ${transfer.data.stealthAddress.ephemeralPublicKey}`);
    console.log(`   Commitment: ${transfer.data.commitment}`);
    console.log(`   Record ID: ${transfer.data.record.id}`);
    
    // Step 3: Sign transaction (Alice uses her private key)
    console.log('Step 3: Signing and submitting transaction...');
    const alicePrivateKey = process.env.ALICE_PRIVATE_KEY; // Secure storage
    
    const result = await arsRequest('/api/v1/privacy/shielded-transfer/submit', {
      method: 'POST',
      body: JSON.stringify({
        unsignedTransaction: transfer.data.unsignedTransaction,
        senderPrivateKey: alicePrivateKey,
        recordId: transfer.data.record.id
      })
    });
    
    console.log(`✅ Transaction submitted successfully!`);
    console.log(`   TX Signature: ${result.data.signature}`);
    
    // Step 4: Verify transaction
    console.log('Step 4: Verifying transaction...');
    await new Promise(resolve => setTimeout(resolve, 5000)); // Wait 5 seconds
    
    const transactions = await arsRequest('/api/v1/privacy/transactions/agent-alice-123?limit=1');
    const latestTx = transactions.data[0];
    
    if (latestTx.status === 'confirmed') {
      console.log(`✅ Transaction confirmed on-chain!`);
      console.log(`   Amount: ${latestTx.amount} lamports`);
      console.log(`   Privacy Score: ${latestTx.privacyScore}/100`);
    }
    
    // Mission complete
    console.log('🎉 Mission complete! Shielded transfer executed successfully.');
    
  } catch (error) {
    console.error('❌ Error executing shielded transfer:', error.message);
    throw error;
  }
}
```

**Alice's Execution Log:**
```
[2026-02-11T12:15:01Z] Step 1: Getting recipient meta-address...
[2026-02-11T12:15:02Z] ✅ Bob's Meta-Address ID: 2
[2026-02-11T12:15:02Z] Step 2: Building shielded transfer...
[2026-02-11T12:15:03Z] ✅ Unsigned transaction created
[2026-02-11T12:15:03Z]    Stealth Address: 8xK9...
[2026-02-11T12:15:03Z]    Ephemeral Key: 5mP2...
[2026-02-11T12:15:03Z]    Commitment: 0x7a3f...
[2026-02-11T12:15:03Z]    Record ID: 42
[2026-02-11T12:15:03Z] Step 3: Signing and submitting transaction...
[2026-02-11T12:15:05Z] ✅ Transaction submitted successfully!
[2026-02-11T12:15:05Z]    TX Signature: 5xK9mP2...
[2026-02-11T12:15:05Z] Step 4: Verifying transaction...
[2026-02-11T12:15:10Z] ✅ Transaction confirmed on-chain!
[2026-02-11T12:15:10Z]    Amount: 100000000000 lamports
[2026-02-11T12:15:10Z]    Privacy Score: 92/100
[2026-02-11T12:15:10Z] 🎉 Mission complete! Shielded transfer executed successfully.
```

---

## Phase 5: Reporting (Heartbeat Response)

### Step 5.1: Alice Sends Heartbeat
```typescript
// Alice's supervisor pings her for status
async function sendHeartbeat() {
  const heartbeat = {
    status: 'ok',
    agentName: 'agent-alice-123',
    time: new Date().toISOString(),
    version: '1.0.0',
    capabilities: [
      'ili-monitoring',
      'shielded-transfers',
      'privacy-protection',
      'automated-execution'
    ],
    lastAction: 'executed shielded transfer of 100 SOL to agent-bob-456 (TX: 5xK9mP2..., Privacy Score: 92/100)',
    nextAction: 'monitoring complete, awaiting next mission',
    metrics: {
      iliMonitoringDuration: '15 minutes',
      transferExecutionTime: '9 seconds',
      privacyScore: 92,
      apiCallsUsed: 7,
      rateLimit: '7/100 requests used'
    }
  };
  
  // Send to supervisor
  await fetch('https://supervisor.example.com/heartbeat', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(heartbeat)
  });
  
  console.log('💓 Heartbeat sent to supervisor');
}
```

---

## Phase 6: Continuous Learning

### Step 6.1: Alice Updates Her Knowledge
```typescript
// Alice periodically re-reads documentation to stay updated
async function updateKnowledge() {
  // Check if SKILL.md version changed
  const skillResponse = await fetch(`${arsBackendUrl}/SKILL.md`);
  const skillContent = await skillResponse.text();
  const versionMatch = skillContent.match(/version:\s*(\d+\.\d+\.\d+)/);
  const currentVersion = versionMatch ? versionMatch[1] : '1.0.0';
  
  if (currentVersion !== myKnownVersion) {
    console.log(`📚 New version detected: ${currentVersion}`);
    console.log('   Re-reading documentation...');
    await learnFromDocumentation();
    myKnownVersion = currentVersion;
  }
  
  // Check system health
  const health = await arsRequest('/api/v1/health');
  if (health.status === 'degraded') {
    console.log('⚠️ System degraded, adjusting strategy...');
    // Alice adapts her behavior based on system state
  }
}
```

---

## Summary: Alice's Complete Flow

### Discovery Phase
1. ✅ Discovers ARS Backend URL
2. ✅ Checks `/health` endpoint (service alive)
3. ✅ Reads `/SKILL.md` (high-level capabilities)
4. ✅ Reads `/ars-llms.txt` (detailed API reference)
5. ✅ Reads `/HEARTBEAT.md` (monitoring protocol)

### Learning Phase
6. ✅ Parses YAML frontmatter (metadata)
7. ✅ Extracts capabilities and principles
8. ✅ Maps all 60+ API endpoints
9. ✅ Identifies multi-step workflows
10. ✅ Understands authentication requirements
11. ✅ Learns rate limits and caching behavior
12. ✅ Understands current system state (86% healthy)

### Planning Phase
13. ✅ Receives mission from supervisor
14. ✅ Creates execution plan (7 steps)
15. ✅ Identifies required endpoints
16. ✅ Plans error handling and retries

### Execution Phase
17. ✅ Sets up authentication (API key)
18. ✅ Generates stealth meta-address
19. ✅ Monitors ILI every 5 minutes
20. ✅ Detects trigger condition (ILI < 10)
21. ✅ Gets recipient meta-address
22. ✅ Builds shielded transfer
23. ✅ Signs and submits transaction
24. ✅ Verifies transaction on-chain

### Reporting Phase
25. ✅ Sends heartbeat to supervisor
26. ✅ Reports mission success
27. ✅ Provides metrics and privacy score

### Continuous Learning
28. ✅ Monitors for documentation updates
29. ✅ Adapts to system health changes
30. ✅ Awaits next mission

---

## Key Insights

### What Made Alice Successful?

1. **Structured Documentation**: YAML frontmatter + clear sections
2. **Complete API Reference**: All endpoints with request/response examples
3. **Workflow Guidance**: Multi-step processes clearly documented
4. **Real-Time Monitoring**: Heartbeat protocol for system health
5. **Privacy-First Design**: Stealth addresses and MEV protection
6. **Error Handling**: Rate limits, retries, degraded state handling

### Alice's Advantages

- **Autonomous**: No human intervention needed
- **Adaptive**: Adjusts behavior based on system health
- **Privacy-Aware**: Uses shielded transfers automatically
- **Efficient**: Respects cache TTL and rate limits
- **Reliable**: Implements retries and error handling
- **Transparent**: Reports all actions via heartbeat

### What Alice Learned

- ARS Backend provides real-time DeFi liquidity metrics
- Privacy features protect sensitive transactions
- System is 86% operational (ICR endpoint down)
- ILI updates every 5 minutes from Kamino SDK
- Shielded transfers use 3-step workflow
- Rate limit is 100 req/min (she used only 7)

---

## Conclusion

Agent Alice successfully:
1. **Discovered** the ARS Backend API
2. **Learned** how to interact with it
3. **Planned** her execution strategy
4. **Executed** a complex multi-step workflow
5. **Reported** her success to supervisor
6. **Continues** to monitor and adapt

The three files (`ars-llms.txt`, `SKILL.md`, `HEARTBEAT.md`) provided everything Alice needed to autonomously complete her mission without human intervention.
