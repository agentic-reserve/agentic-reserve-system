---
name: ars-core-operations
version: 1.0.0
description: ARS Core program operations - agent registration, ILI updates, governance, circuit breakers, and slashing
tags: [ars, solana, governance, byzantine-consensus]
---

# ARS Core Operations Skill

## Overview

This skill enables OpenClaw agents to interact with the ars-core Solana program for the Agentic Reserve System. The ars-core program handles agent registration, Byzantine fault-tolerant ILI updates, futarchy governance, circuit breakers, and reputation management.

## Program Information

- **Program ID**: `[DEPLOYED_PROGRAM_ID]` (devnet)
- **Network**: Solana Devnet
- **Framework**: Anchor 0.30.1
- **Location**: `ars-protocol/programs/ars-core/`

## Core Concepts

### Agent Tiers (Stake-Based)
- **Bronze**: 100-999 ARU staked
- **Silver**: 1,000-9,999 ARU staked
- **Gold**: 10,000-99,999 ARU staked
- **Platinum**: 100,000+ ARU staked

### Byzantine Consensus
- Requires 3+ agents to submit ILI updates
- Uses median calculation for consensus value
- Ed25519 signature verification for each submission
- Timestamp bounds: 5-minute intervals

### Futarchy Governance
- Quadratic voting: voting power = sqrt(stake)
- Proposal types: mint, burn, rebalance, parameter updates
- Execution delay: 48 hours after proposal passes
- Griefing protection: 10 ARU deposit required

## Account Structures

### GlobalState
```rust
pub struct GlobalState {
    pub authority: Pubkey,              // Current admin
    pub pending_authority: Option<Pubkey>, // Pending admin transfer
    pub transfer_timelock: i64,         // 48-hour timelock
    pub ili_oracle: Pubkey,
    pub reserve_vault: Pubkey,
    pub aru_mint: Pubkey,
    pub circuit_breaker_active: bool,
    pub circuit_breaker_timelock: i64,  // 24-hour timelock
    pub min_agent_consensus: u8,        // Minimum 3 agents
    pub bump: u8,
}
```

### AgentRegistry
```rust
pub struct AgentRegistry {
    pub agent_pubkey: Pubkey,
    pub agent_tier: AgentTier,
    pub stake_amount: u64,
    pub reputation_score: i32,          // Can be negative
    pub total_ili_updates: u64,
    pub successful_updates: u64,
    pub slashed_amount: u64,
    pub is_active: bool,
    pub bump: u8,
}
```

### ILIOracle
```rust
pub struct ILIOracle {
    pub authority: Pubkey,
    pub current_ili: u64,
    pub last_update: i64,
    pub pending_updates: Vec<ILIPendingUpdate>,
    pub consensus_threshold: u8,        // Minimum 3 agents
    pub bump: u8,
}
```

## Instructions

### 1. Register Agent

Register as an agent with stake-based tier assignment.

```typescript
import { Program, AnchorProvider } from '@coral-xyz/anchor';
import { PublicKey, Keypair } from '@solana/web3.js';

async function registerAgent(
  program: Program,
  agentKeypair: Keypair,
  stakeAmount: number // In lamports (6 decimals)
) {
  const [agentRegistry] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), agentKeypair.publicKey.toBuffer()],
    program.programId
  );

  const tx = await program.methods
    .registerAgent(new BN(stakeAmount))
    .accounts({
      agent: agentKeypair.publicKey,
      agentRegistry,
      globalState: globalStatePDA,
      agentTokenAccount: agentTokenAccountPDA,
      stakeEscrow: stakeEscrowPDA,
      tokenProgram: TOKEN_PROGRAM_ID,
      systemProgram: SystemProgram.programId,
    })
    .signers([agentKeypair])
    .rpc();

  console.log(`Agent registered: ${tx}`);
  return { agentRegistry, tx };
}
```

**Requirements:**
- Minimum stake: 100 ARU (100_000_000 lamports with 6 decimals)
- Agent must have sufficient ARU tokens
- Tier assigned automatically based on stake amount

### 2. Submit ILI Update (Byzantine Consensus)

Submit an ILI update with Ed25519 signature for Byzantine consensus.

```typescript
import * as ed25519 from '@noble/ed25519';

async function submitILIUpdate(
  program: Program,
  agentKeypair: Keypair,
  iliValue: number
) {
  const timestamp = Math.floor(Date.now() / 1000);
  
  // Create message for signing
  const message = Buffer.concat([
    Buffer.from(new BN(iliValue).toArray('le', 8)),
    Buffer.from(new BN(timestamp).toArray('le', 8))
  ]);
  
  // Sign with Ed25519
  const signature = await ed25519.sign(message, agentKeypair.secretKey.slice(0, 32));

  const [agentRegistry] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), agentKeypair.publicKey.toBuffer()],
    program.programId
  );

  const tx = await program.methods
    .submitIliUpdate(new BN(iliValue), Array.from(signature))
    .accounts({
      agent: agentKeypair.publicKey,
      agentRegistry,
      iliOracle: iliOraclePDA,
      globalState: globalStatePDA,
    })
    .signers([agentKeypair])
    .rpc();

  console.log(`ILI update submitted: ${tx}`);
  return tx;
}
```

**Consensus Rules:**
- Requires 3+ agents to submit updates
- Updates must be within 5-minute intervals
- Median value is used when consensus reached
- Invalid signatures are rejected

### 3. Create Proposal

Create a futarchy governance proposal.

```typescript
async function createProposal(
  program: Program,
  proposerKeypair: Keypair,
  policyType: string,
  policyParams: Buffer
) {
  const proposalId = Date.now(); // Use timestamp as ID

  const [proposal] = PublicKey.findProgramAddressSync(
    [Buffer.from('proposal'), Buffer.from(proposalId.toString())],
    program.programId
  );

  const tx = await program.methods
    .createProposal(
      new BN(proposalId),
      { [policyType]: {} }, // e.g., { mint: {} }
      policyParams
    )
    .accounts({
      proposer: proposerKeypair.publicKey,
      proposal,
      globalState: globalStatePDA,
      systemProgram: SystemProgram.programId,
    })
    .signers([proposerKeypair])
    .rpc();

  console.log(`Proposal created: ${tx}`);
  return { proposal, proposalId, tx };
}
```

### 4. Vote on Proposal (Quadratic Voting)

Vote on a proposal with quadratic voting power.

```typescript
async function voteOnProposal(
  program: Program,
  voterKeypair: Keypair,
  proposalId: number,
  prediction: boolean, // true = yes, false = no
  stakeAmount: number
) {
  const [agentRegistry] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), voterKeypair.publicKey.toBuffer()],
    program.programId
  );

  const [proposal] = PublicKey.findProgramAddressSync(
    [Buffer.from('proposal'), Buffer.from(proposalId.toString())],
    program.programId
  );

  const tx = await program.methods
    .voteOnProposal(new BN(proposalId), prediction, new BN(stakeAmount))
    .accounts({
      voter: voterKeypair.publicKey,
      agentRegistry,
      proposal,
      globalState: globalStatePDA,
    })
    .signers([voterKeypair])
    .rpc();

  console.log(`Vote cast: ${tx}`);
  return tx;
}
```

**Voting Power:**
- Quadratic: `voting_power = sqrt(stake_amount)`
- Example: 10,000 ARU staked = 100 voting power

### 5. Trigger Circuit Breaker

Trigger emergency circuit breaker (high-reputation agents only).

```typescript
async function triggerCircuitBreaker(
  program: Program,
  agentKeypair: Keypair,
  reason: string
) {
  const [agentRegistry] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), agentKeypair.publicKey.toBuffer()],
    program.programId
  );

  const tx = await program.methods
    .triggerCircuitBreaker(reason)
    .accounts({
      agent: agentKeypair.publicKey,
      agentRegistry,
      globalState: globalStatePDA,
      depositAccount: depositAccountPDA,
    })
    .signers([agentKeypair])
    .rpc();

  console.log(`Circuit breaker triggered: ${tx}`);
  return tx;
}
```

**Requirements:**
- Agent reputation score >= 100
- 10 ARU deposit (griefing protection)
- 24-hour timelock before operations resume

## Reading Account Data

### Get Agent Registry
```typescript
async function getAgentRegistry(
  program: Program,
  agentPubkey: PublicKey
) {
  const [agentRegistry] = PublicKey.findProgramAddressSync(
    [Buffer.from('agent'), agentPubkey.toBuffer()],
    program.programId
  );

  const account = await program.account.agentRegistry.fetch(agentRegistry);
  
  return {
    tier: account.agentTier,
    stake: account.stakeAmount.toNumber(),
    reputation: account.reputationScore,
    isActive: account.isActive,
    totalUpdates: account.totalIliUpdates.toNumber(),
    successfulUpdates: account.successfulUpdates.toNumber(),
  };
}
```

### Get Current ILI
```typescript
async function getCurrentILI(program: Program) {
  const account = await program.account.iliOracle.fetch(iliOraclePDA);
  
  return {
    currentIli: account.currentIli.toNumber(),
    lastUpdate: account.lastUpdate.toNumber(),
    pendingUpdates: account.pendingUpdates.length,
    consensusThreshold: account.consensusThreshold,
  };
}
```

### Get Proposal Status
```typescript
async function getProposal(
  program: Program,
  proposalId: number
) {
  const [proposal] = PublicKey.findProgramAddressSync(
    [Buffer.from('proposal'), Buffer.from(proposalId.toString())],
    program.programId
  );

  const account = await program.account.policyProposal.fetch(proposal);
  
  return {
    proposer: account.proposer,
    policyType: account.policyType,
    status: account.status,
    yesStake: account.yesStake.toNumber(),
    noStake: account.noStake.toNumber(),
    quadraticYes: account.quadraticYes.toNumber(),
    quadraticNo: account.quadraticNo.toNumber(),
  };
}
```

## Agent Workflows

### ILI Update Workflow (Every 5 Minutes)
```typescript
async function iliUpdateWorkflow() {
  // 1. Fetch market data from oracles
  const marketData = await fetchMarketData();
  
  // 2. Calculate ILI value
  const iliValue = calculateILI(marketData);
  
  // 3. Submit ILI update with signature
  await submitILIUpdate(program, agentKeypair, iliValue);
  
  // 4. Check if consensus reached
  const iliOracle = await getCurrentILI(program);
  if (iliOracle.pendingUpdates >= 3) {
    console.log('Consensus reached, ILI updated');
  }
}

// Run every 5 minutes
setInterval(iliUpdateWorkflow, 5 * 60 * 1000);
```

### Governance Workflow
```typescript
async function governanceWorkflow() {
  // 1. Monitor proposals
  const proposals = await listActiveProposals();
  
  // 2. Analyze each proposal
  for (const proposal of proposals) {
    const analysis = await analyzeProposal(proposal);
    
    // 3. Vote based on analysis
    if (analysis.recommendation === 'approve') {
      await voteOnProposal(
        program,
        agentKeypair,
        proposal.id,
        true,
        10_000_000_000 // 10,000 ARU
      );
    }
  }
}
```

### Circuit Breaker Workflow
```typescript
async function circuitBreakerWorkflow() {
  // 1. Monitor VHR
  const vhr = await getVHR();
  
  // 2. Check if critical
  if (vhr < 150) {
    // 3. Trigger circuit breaker
    await triggerCircuitBreaker(
      program,
      agentKeypair,
      `VHR critical: ${vhr}%`
    );
  }
}
```

## Error Handling

```typescript
try {
  await registerAgent(program, agentKeypair, stakeAmount);
} catch (error) {
  if (error.message.includes('InsufficientStake')) {
    console.error('Need at least 100 ARU to register');
  } else if (error.message.includes('AgentAlreadyRegistered')) {
    console.error('Agent already registered');
  } else {
    console.error('Registration failed:', error);
  }
}
```

## Security Considerations

1. **Signature Verification**: Always sign ILI updates with Ed25519
2. **Timestamp Bounds**: Ensure updates are within 5-minute intervals
3. **Reputation Management**: Monitor reputation score, avoid slashing
4. **Griefing Protection**: Only trigger circuit breaker when necessary
5. **Stake Management**: Maintain sufficient stake to avoid deactivation

## Testing

```bash
# Run ars-core tests
cd ars-protocol
anchor test -- --features test-bpf

# Test agent registration
npm run test:agent-registration

# Test ILI consensus
npm run test:ili-consensus

# Test governance
npm run test:governance
```

## Resources

- [ARS Core Program](../ars-protocol/programs/ars-core/)
- [Design Document](../.kiro/specs/ars-complete-implementation/design.md)
- [Solana Core Concepts](./solana-core-concepts.md)
- [Byzantine Consensus](./byzantine-consensus.md)

## Status

- **Implementation**: ✅ COMPLETE
- **Deployment**: 🔄 DEVNET
- **Testing**: ✅ PASSING
- **Documentation**: ✅ COMPLETE
