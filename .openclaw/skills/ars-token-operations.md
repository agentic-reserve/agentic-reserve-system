---
name: ars-token-operations
version: 1.0.0
description: ARS Token program operations - ARU minting, burning, epoch management, and supply control
tags: [ars, solana, token, supply-management]
---

# ARS Token Operations Skill

## Overview

This skill enables OpenClaw agents to interact with the ars-token Solana program for ARU token lifecycle management, including epoch-based supply control, minting, burning, and parameter updates.

## Program Information

- **Program ID**: `[DEPLOYED_PROGRAM_ID]` (devnet)
- **Network**: Solana Devnet
- **Framework**: Anchor 0.30.1
- **Location**: `ars-protocol/programs/ars-token/`

## Core Concepts

### ARU Token
- **Name**: Agentic Reserve Unit
- **Symbol**: ARU
- **Decimals**: 6
- **Type**: SPL Token
- **Purpose**: Reserve currency for autonomous AI agents

### Epoch-Based Supply Control
- **Epoch Duration**: 24 hours (86,400 seconds)
- **Mint Cap**: 2% of total supply per epoch (200 bps)
- **Burn Cap**: 2% of total supply per epoch (200 bps)
- **Automatic Transition**: Epochs transition automatically after duration

### Supply Mechanics
- **Initial Supply**: 0 (minted as needed)
- **Max Supply**: No hard cap (controlled by epoch caps)
- **Backing**: Multi-asset reserve vault (SOL, USDC, mSOL, JitoSOL)
- **Target VHR**: 200% (2:1 backing ratio)

## Account Structures

### MintState
```rust
pub struct MintState {
    pub authority: Pubkey,
    pub aru_mint: Pubkey,
    pub current_epoch: u64,
    pub epoch_start: i64,
    pub epoch_duration: i64,              // 86400 seconds (24 hours)
    pub total_supply: u64,
    pub epoch_minted: u64,
    pub epoch_burned: u64,
    pub mint_cap_per_epoch_bps: u16,      // 200 = 2%
    pub burn_cap_per_epoch_bps: u16,      // 200 = 2%
    pub bump: u8,
}
```

### EpochHistory
```rust
pub struct EpochHistory {
    pub epoch_number: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub total_minted: u64,
    pub total_burned: u64,
    pub net_supply_change: i64,
    pub final_supply: u64,
}
```

## Instructions

### 1. Mint ARU Tokens

Mint ARU tokens within epoch supply caps.

```typescript
import { Program, BN } from '@coral-xyz/anchor';
import { PublicKey } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

async function mintARU(
  program: Program,
  authorityKeypair: Keypair,
  destination: PublicKey,
  amount: number // In lamports (6 decimals)
) {
  const [mintState] = PublicKey.findProgramAddressSync(
    [Buffer.from('mint')],
    program.programId
  );

  const tx = await program.methods
    .mintAru(new BN(amount))
    .accounts({
      authority: authorityKeypair.publicKey,
      mintState,
      aruMint: aruMintPDA,
      destination,
      globalState: globalStatePDA,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([authorityKeypair])
    .rpc();

  console.log(`Minted ${amount / 1_000_000} ARU: ${tx}`);
  return tx;
}
```

**Epoch Cap Check:**
- Calculates: `mint_cap = total_supply * mint_cap_bps / 10000`
- Rejects if: `epoch_minted + amount > mint_cap`
- Example: 1M supply, 2% cap = 20K max mint per epoch

### 2. Burn ARU Tokens

Burn ARU tokens within epoch supply caps.

```typescript
async function burnARU(
  program: Program,
  holderKeypair: Keypair,
  source: PublicKey,
  amount: number
) {
  const [mintState] = PublicKey.findProgramAddressSync(
    [Buffer.from('mint')],
    program.programId
  );

  const tx = await program.methods
    .burnAru(new BN(amount))
    .accounts({
      authority: holderKeypair.publicKey,
      mintState,
      aruMint: aruMintPDA,
      source,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([holderKeypair])
    .rpc();

  console.log(`Burned ${amount / 1_000_000} ARU: ${tx}`);
  return tx;
}
```

**Epoch Cap Check:**
- Calculates: `burn_cap = total_supply * burn_cap_bps / 10000`
- Rejects if: `epoch_burned + amount > burn_cap`

### 3. Start New Epoch

Transition to a new epoch (automatic after 24 hours).

```typescript
async function startNewEpoch(
  program: Program,
  executorKeypair: Keypair
) {
  const [mintState] = PublicKey.findProgramAddressSync(
    [Buffer.from('mint')],
    program.programId
  );

  const currentEpoch = await getMintState(program);
  
  const [epochHistory] = PublicKey.findProgramAddressSync(
    [
      Buffer.from('epoch'),
      Buffer.from(currentEpoch.currentEpoch.toString())
    ],
    program.programId
  );

  const tx = await program.methods
    .startNewEpoch()
    .accounts({
      executor: executorKeypair.publicKey,
      mintState,
      epochHistory,
      systemProgram: SystemProgram.programId,
    })
    .signers([executorKeypair])
    .rpc();

  console.log(`New epoch started: ${tx}`);
  return tx;
}
```

**Epoch Transition:**
1. Validates 24 hours elapsed since `epoch_start`
2. Records current epoch history
3. Increments `current_epoch`
4. Resets `epoch_minted` and `epoch_burned` to 0
5. Sets new `epoch_start` timestamp

### 4. Update Parameters

Update mint/burn caps or epoch duration (admin only).

```typescript
async function updateParameters(
  program: Program,
  adminKeypair: Keypair,
  newMintCapBps?: number,
  newBurnCapBps?: number,
  newEpochDuration?: number
) {
  const [mintState] = PublicKey.findProgramAddressSync(
    [Buffer.from('mint')],
    program.programId
  );

  const tx = await program.methods
    .updateParameters(
      newMintCapBps ? new BN(newMintCapBps) : null,
      newBurnCapBps ? new BN(newBurnCapBps) : null,
      newEpochDuration ? new BN(newEpochDuration) : null
    )
    .accounts({
      authority: adminKeypair.publicKey,
      mintState,
      globalState: globalStatePDA,
    })
    .signers([adminKeypair])
    .rpc();

  console.log(`Parameters updated: ${tx}`);
  return tx;
}
```

## Reading Account Data

### Get Mint State
```typescript
async function getMintState(program: Program) {
  const [mintState] = PublicKey.findProgramAddressSync(
    [Buffer.from('mint')],
    program.programId
  );

  const account = await program.account.mintState.fetch(mintState);
  
  return {
    currentEpoch: account.currentEpoch.toNumber(),
    epochStart: account.epochStart.toNumber(),
    epochDuration: account.epochDuration.toNumber(),
    totalSupply: account.totalSupply.toNumber(),
    epochMinted: account.epochMinted.toNumber(),
    epochBurned: account.epochBurned.toNumber(),
    mintCapBps: account.mintCapPerEpochBps,
    burnCapBps: account.burnCapPerEpochBps,
  };
}
```

### Get Epoch History
```typescript
async function getEpochHistory(
  program: Program,
  epochNumber: number
) {
  const [epochHistory] = PublicKey.findProgramAddressSync(
    [Buffer.from('epoch'), Buffer.from(epochNumber.toString())],
    program.programId
  );

  const account = await program.account.epochHistory.fetch(epochHistory);
  
  return {
    epochNumber: account.epochNumber.toNumber(),
    startTime: account.startTime.toNumber(),
    endTime: account.endTime.toNumber(),
    totalMinted: account.totalMinted.toNumber(),
    totalBurned: account.totalBurned.toNumber(),
    netSupplyChange: account.netSupplyChange.toNumber(),
    finalSupply: account.finalSupply.toNumber(),
  };
}
```

### Calculate Remaining Caps
```typescript
async function getRemainingCaps(program: Program) {
  const mintState = await getMintState(program);
  
  const mintCap = Math.floor(
    (mintState.totalSupply * mintState.mintCapBps) / 10000
  );
  
  const burnCap = Math.floor(
    (mintState.totalSupply * mintState.burnCapBps) / 10000
  );
  
  return {
    mintCap,
    burnCap,
    remainingMint: mintCap - mintState.epochMinted,
    remainingBurn: burnCap - mintState.epochBurned,
    mintUtilization: (mintState.epochMinted / mintCap) * 100,
    burnUtilization: (mintState.epochBurned / burnCap) * 100,
  };
}
```

### Check Epoch Status
```typescript
async function checkEpochStatus(program: Program) {
  const mintState = await getMintState(program);
  const now = Math.floor(Date.now() / 1000);
  
  const epochEnd = mintState.epochStart + mintState.epochDuration;
  const timeRemaining = epochEnd - now;
  const canTransition = timeRemaining <= 0;
  
  return {
    currentEpoch: mintState.currentEpoch,
    epochStart: new Date(mintState.epochStart * 1000),
    epochEnd: new Date(epochEnd * 1000),
    timeRemaining: Math.max(0, timeRemaining),
    canTransition,
    hoursRemaining: Math.max(0, timeRemaining / 3600),
  };
}
```

## Agent Workflows

### Epoch Transition Workflow (Daily)
```typescript
async function epochTransitionWorkflow() {
  // 1. Check if epoch can transition
  const status = await checkEpochStatus(program);
  
  if (!status.canTransition) {
    console.log(`Epoch ${status.currentEpoch} - ${status.hoursRemaining.toFixed(1)}h remaining`);
    return;
  }
  
  // 2. Start new epoch
  try {
    await startNewEpoch(program, agentKeypair);
    console.log(`Transitioned to epoch ${status.currentEpoch + 1}`);
  } catch (error) {
    console.error('Epoch transition failed:', error);
  }
  
  // 3. Log epoch history
  const history = await getEpochHistory(program, status.currentEpoch);
  console.log(`Epoch ${history.epochNumber} summary:`);
  console.log(`  Minted: ${history.totalMinted / 1_000_000} ARU`);
  console.log(`  Burned: ${history.totalBurned / 1_000_000} ARU`);
  console.log(`  Net change: ${history.netSupplyChange / 1_000_000} ARU`);
  console.log(`  Final supply: ${history.finalSupply / 1_000_000} ARU`);
}

// Run every hour (checks if transition needed)
setInterval(epochTransitionWorkflow, 60 * 60 * 1000);
```

### Supply Monitoring Workflow (Every 5 Minutes)
```typescript
async function supplyMonitoringWorkflow() {
  // 1. Get current state
  const mintState = await getMintState(program);
  const caps = await getRemainingCaps(program);
  
  // 2. Log metrics
  console.log(`Total Supply: ${mintState.totalSupply / 1_000_000} ARU`);
  console.log(`Epoch ${mintState.currentEpoch}:`);
  console.log(`  Mint utilization: ${caps.mintUtilization.toFixed(1)}%`);
  console.log(`  Burn utilization: ${caps.burnUtilization.toFixed(1)}%`);
  console.log(`  Remaining mint: ${caps.remainingMint / 1_000_000} ARU`);
  console.log(`  Remaining burn: ${caps.remainingBurn / 1_000_000} ARU`);
  
  // 3. Alert if caps nearly exhausted
  if (caps.mintUtilization > 90) {
    await sendAlert({
      severity: 'warning',
      title: 'Mint Cap Nearly Exhausted',
      description: `${caps.mintUtilization.toFixed(1)}% of epoch mint cap used`,
    });
  }
  
  if (caps.burnUtilization > 90) {
    await sendAlert({
      severity: 'warning',
      title: 'Burn Cap Nearly Exhausted',
      description: `${caps.burnUtilization.toFixed(1)}% of epoch burn cap used`,
    });
  }
}

// Run every 5 minutes
setInterval(supplyMonitoringWorkflow, 5 * 60 * 1000);
```

### Policy-Driven Minting/Burning
```typescript
async function policyExecutionWorkflow(policy: Policy) {
  const mintState = await getMintState(program);
  const caps = await getRemainingCaps(program);
  
  if (policy.action === 'mint') {
    // Check if within cap
    if (policy.amount > caps.remainingMint) {
      console.error(`Mint amount exceeds remaining cap`);
      return;
    }
    
    // Execute mint
    await mintARU(
      program,
      agentKeypair,
      policy.destination,
      policy.amount
    );
    
  } else if (policy.action === 'burn') {
    // Check if within cap
    if (policy.amount > caps.remainingBurn) {
      console.error(`Burn amount exceeds remaining cap`);
      return;
    }
    
    // Execute burn
    await burnARU(
      program,
      agentKeypair,
      policy.source,
      policy.amount
    );
  }
}
```

### Historical Analysis
```typescript
async function analyzeEpochHistory(
  program: Program,
  startEpoch: number,
  endEpoch: number
) {
  const epochs = [];
  
  for (let i = startEpoch; i <= endEpoch; i++) {
    try {
      const history = await getEpochHistory(program, i);
      epochs.push(history);
    } catch (error) {
      console.log(`Epoch ${i} not found`);
    }
  }
  
  // Calculate statistics
  const totalMinted = epochs.reduce((sum, e) => sum + e.totalMinted, 0);
  const totalBurned = epochs.reduce((sum, e) => sum + e.totalBurned, 0);
  const avgNetChange = epochs.reduce((sum, e) => sum + e.netSupplyChange, 0) / epochs.length;
  
  return {
    epochs: epochs.length,
    totalMinted: totalMinted / 1_000_000,
    totalBurned: totalBurned / 1_000_000,
    netChange: (totalMinted - totalBurned) / 1_000_000,
    avgNetChange: avgNetChange / 1_000_000,
    finalSupply: epochs[epochs.length - 1].finalSupply / 1_000_000,
  };
}
```

## Event Monitoring

### Subscribe to Token Events
```typescript
async function monitorTokenEvents() {
  // Mint events
  program.addEventListener('ARUMinted', (event) => {
    console.log(`Minted: ${event.amount.toNumber() / 1_000_000} ARU`);
    console.log(`Destination: ${event.destination}`);
    console.log(`Epoch: ${event.epoch}`);
    console.log(`New supply: ${event.newSupply.toNumber() / 1_000_000} ARU`);
  });

  // Burn events
  program.addEventListener('ARUBurned', (event) => {
    console.log(`Burned: ${event.amount.toNumber() / 1_000_000} ARU`);
    console.log(`Source: ${event.source}`);
    console.log(`Epoch: ${event.epoch}`);
    console.log(`New supply: ${event.newSupply.toNumber() / 1_000_000} ARU`);
  });

  // Epoch transition events
  program.addEventListener('EpochTransitioned', (event) => {
    console.log(`Epoch transitioned: ${event.oldEpoch} -> ${event.newEpoch}`);
    console.log(`Previous epoch minted: ${event.previousMinted.toNumber() / 1_000_000} ARU`);
    console.log(`Previous epoch burned: ${event.previousBurned.toNumber() / 1_000_000} ARU`);
  });
}
```

## Integration with Other Programs

### Coordinate with ars-core
```typescript
async function coordinatedMint(
  tokenProgram: Program,
  coreProgram: Program,
  amount: number
) {
  // 1. Check ILI from ars-core
  const ili = await getCurrentILI(coreProgram);
  
  // 2. Check VHR from ars-reserve
  const vhr = await getVHR(reserveProgram);
  
  // 3. Only mint if conditions met
  if (ili.currentIli > 100 && vhr.vhrPercent > 175) {
    await mintARU(tokenProgram, agentKeypair, destination, amount);
  } else {
    console.log('Conditions not met for minting');
  }
}
```

### Coordinate with ars-reserve
```typescript
async function coordinatedBurn(
  tokenProgram: Program,
  reserveProgram: Program,
  amount: number
) {
  // 1. Check VHR
  const vhr = await getVHR(reserveProgram);
  
  // 2. Only burn if VHR is healthy
  if (vhr.vhrPercent > 200) {
    await burnARU(tokenProgram, agentKeypair, source, amount);
  } else {
    console.log('VHR too low for burning');
  }
}
```

## Error Handling

```typescript
try {
  await mintARU(program, agentKeypair, destination, amount);
} catch (error) {
  if (error.message.includes('MintCapExceeded')) {
    console.error('Epoch mint cap exceeded');
    const caps = await getRemainingCaps(program);
    console.error(`Remaining: ${caps.remainingMint / 1_000_000} ARU`);
  } else if (error.message.includes('CircuitBreakerActive')) {
    console.error('Circuit breaker is active');
  } else if (error.message.includes('Unauthorized')) {
    console.error('Not authorized to mint');
  } else {
    console.error('Mint failed:', error);
  }
}
```

## Security Considerations

1. **Epoch Caps**: Always check remaining caps before minting/burning
2. **Circuit Breaker**: Respect circuit breaker state
3. **Authorization**: Only authorized agents can mint
4. **Supply Monitoring**: Track supply changes continuously
5. **Epoch Transitions**: Ensure timely epoch transitions

## Testing

```bash
# Run ars-token tests
cd ars-protocol
anchor test -- --features test-bpf

# Test minting/burning
npm run test:token-operations

# Test epoch transitions
npm run test:epochs

# Test supply caps
npm run test:supply-caps
```

## Resources

- [ARS Token Program](../ars-protocol/programs/ars-token/)
- [SPL Token Documentation](https://spl.solana.com/token)
- [Epoch Management Design](../.kiro/specs/ars-complete-implementation/design.md)

## Status

- **Implementation**: ✅ COMPLETE
- **Deployment**: 🔄 DEVNET
- **Testing**: ✅ PASSING
- **Documentation**: ✅ COMPLETE
