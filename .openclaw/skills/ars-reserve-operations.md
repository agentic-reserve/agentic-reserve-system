---
name: ars-reserve-operations
version: 1.0.0
description: ARS Reserve program operations - vault management, VHR monitoring, deposits, withdrawals, and autonomous rebalancing
tags: [ars, solana, defi, vault-management]
---

# ARS Reserve Operations Skill

## Overview

This skill enables OpenClaw agents to interact with the ars-reserve Solana program for vault management, VHR (Vault Health Ratio) monitoring, and autonomous rebalancing operations.

## Program Information

- **Program ID**: `[DEPLOYED_PROGRAM_ID]` (devnet)
- **Network**: Solana Devnet
- **Framework**: Anchor 0.30.1
- **Location**: `ars-protocol/programs/ars-reserve/`

## Core Concepts

### Vault Health Ratio (VHR)
- **Formula**: `VHR = (Total Assets USD / Total Liabilities USD) * 100`
- **Target**: 200% (2:1 backing)
- **Warning**: 175%
- **Critical**: 150%
- **Minimum**: 150% (withdrawals blocked below this)

### Supported Assets
- **SOL**: Native Solana token
- **USDC**: USD Coin stablecoin
- **mSOL**: Marinade staked SOL
- **JitoSOL**: Jito staked SOL

### Rebalancing Strategy
- Triggered when VHR < 175%
- Uses Jupiter aggregator for swaps
- Integrates with Kamino (lending), Meteora (DLMM)
- Minimum 1-hour interval between rebalances

## Account Structures

### ReserveVault
```rust
pub struct ReserveVault {
    pub authority: Pubkey,
    pub usdc_vault: Pubkey,
    pub sol_vault: Pubkey,
    pub msol_vault: Pubkey,
    pub jitosol_vault: Pubkey,
    pub total_value_usd: u64,
    pub liabilities_usd: u64,
    pub vhr: u16,                       // Basis points (20000 = 200%)
    pub last_rebalance: i64,
    pub rebalance_threshold_bps: u16,   // 17500 = 175%
    pub min_vhr: u16,                   // 15000 = 150%
    pub bump: u8,
}
```

### AssetConfig
```rust
pub struct AssetConfig {
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub target_weight_bps: u16,         // Target allocation (e.g., 2500 = 25%)
    pub min_weight_bps: u16,
    pub max_weight_bps: u16,
    pub volatility_threshold_bps: u16,
    pub current_weight_bps: u16,
    pub oracle_source: Pubkey,
    pub bump: u8,
}
```

## Instructions

### 1. Deposit Assets

Deposit assets into the reserve vault.

```typescript
import { Program, BN } from '@coral-xyz/anchor';
import { PublicKey, SystemProgram } from '@solana/web3.js';
import { TOKEN_PROGRAM_ID } from '@solana/spl-token';

async function deposit(
  program: Program,
  depositorKeypair: Keypair,
  assetMint: PublicKey,
  amount: number // In lamports
) {
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault')],
    program.programId
  );

  const [assetConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('asset'), assetMint.toBuffer()],
    program.programId
  );

  const depositorTokenAccount = await getAssociatedTokenAddress(
    assetMint,
    depositorKeypair.publicKey
  );

  const vaultTokenAccount = await getAssociatedTokenAddress(
    assetMint,
    vault,
    true
  );

  const tx = await program.methods
    .deposit(new BN(amount))
    .accounts({
      depositor: depositorKeypair.publicKey,
      vault,
      assetConfig,
      assetMint,
      depositorTokenAccount,
      vaultTokenAccount,
      oracle: oraclePDA,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([depositorKeypair])
    .rpc();

  console.log(`Deposit successful: ${tx}`);
  return tx;
}
```

**Effects:**
- Transfers tokens from depositor to vault
- Updates `total_value_usd` based on oracle price
- Recalculates VHR
- Emits `DepositMade` event

### 2. Withdraw Assets

Withdraw assets from the reserve vault (VHR check enforced).

```typescript
async function withdraw(
  program: Program,
  withdrawerKeypair: Keypair,
  assetMint: PublicKey,
  amount: number
) {
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault')],
    program.programId
  );

  const [assetConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('asset'), assetMint.toBuffer()],
    program.programId
  );

  const withdrawerTokenAccount = await getAssociatedTokenAddress(
    assetMint,
    withdrawerKeypair.publicKey
  );

  const vaultTokenAccount = await getAssociatedTokenAddress(
    assetMint,
    vault,
    true
  );

  const tx = await program.methods
    .withdraw(new BN(amount))
    .accounts({
      withdrawer: withdrawerKeypair.publicKey,
      vault,
      assetConfig,
      assetMint,
      withdrawerTokenAccount,
      vaultTokenAccount,
      oracle: oraclePDA,
      tokenProgram: TOKEN_PROGRAM_ID,
    })
    .signers([withdrawerKeypair])
    .rpc();

  console.log(`Withdrawal successful: ${tx}`);
  return tx;
}
```

**VHR Check:**
- Calculates VHR after withdrawal
- Rejects if `new_vhr < min_vhr` (150%)
- Protects vault from under-collateralization

### 3. Rebalance Vault

Execute autonomous rebalancing to restore VHR.

```typescript
async function rebalance(
  program: Program,
  executorKeypair: Keypair,
  fromAsset: PublicKey,
  toAsset: PublicKey,
  amount: number
) {
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault')],
    program.programId
  );

  const tx = await program.methods
    .rebalance(new BN(amount))
    .accounts({
      executor: executorKeypair.publicKey,
      vault,
      globalState: globalStatePDA,
      fromAssetConfig: fromAssetConfigPDA,
      toAssetConfig: toAssetConfigPDA,
      fromVaultTokenAccount: fromVaultTokenAccountPDA,
      toVaultTokenAccount: toVaultTokenAccountPDA,
      jupiterProgram: JUPITER_PROGRAM_ID,
      // ... Jupiter swap accounts
    })
    .signers([executorKeypair])
    .rpc();

  console.log(`Rebalance executed: ${tx}`);
  return tx;
}
```

**Rebalancing Logic:**
1. Check VHR < threshold (175%)
2. Calculate optimal asset allocation
3. Execute swaps via Jupiter
4. Update vault composition
5. Recalculate VHR
6. Emit `RebalanceExecuted` event

### 4. Calculate VHR

Helper function to calculate Vault Health Ratio.

```typescript
function calculateVHR(
  totalValueUsd: number,
  liabilitiesUsd: number
): number {
  if (liabilitiesUsd === 0) {
    return 65535; // Max u16 (infinite backing)
  }
  
  const ratio = (totalValueUsd * 10000) / liabilitiesUsd;
  return Math.floor(ratio);
}

// Example
const vhr = calculateVHR(2_000_000, 1_000_000);
console.log(`VHR: ${vhr / 100}%`); // 200%
```

## Reading Account Data

### Get Vault State
```typescript
async function getVaultState(program: Program) {
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault')],
    program.programId
  );

  const account = await program.account.reserveVault.fetch(vault);
  
  return {
    totalValueUsd: account.totalValueUsd.toNumber(),
    liabilitiesUsd: account.liabilitiesUsd.toNumber(),
    vhr: account.vhr, // Basis points
    vhrPercent: account.vhr / 100,
    lastRebalance: account.lastRebalance.toNumber(),
    rebalanceThreshold: account.rebalanceThresholdBps / 100,
    minVhr: account.minVhr / 100,
  };
}
```

### Get Asset Config
```typescript
async function getAssetConfig(
  program: Program,
  assetMint: PublicKey
) {
  const [assetConfig] = PublicKey.findProgramAddressSync(
    [Buffer.from('asset'), assetMint.toBuffer()],
    program.programId
  );

  const account = await program.account.assetConfig.fetch(assetConfig);
  
  return {
    mint: account.mint,
    targetWeight: account.targetWeightBps / 100,
    currentWeight: account.currentWeightBps / 100,
    minWeight: account.minWeightBps / 100,
    maxWeight: account.maxWeightBps / 100,
  };
}
```

### Get Vault Balances
```typescript
async function getVaultBalances(
  connection: Connection,
  program: Program
) {
  const [vault] = PublicKey.findProgramAddressSync(
    [Buffer.from('vault')],
    program.programId
  );

  const assets = [
    { name: 'SOL', mint: NATIVE_MINT },
    { name: 'USDC', mint: USDC_MINT },
    { name: 'mSOL', mint: MSOL_MINT },
    { name: 'JitoSOL', mint: JITOSOL_MINT },
  ];

  const balances = {};
  
  for (const asset of assets) {
    const tokenAccount = await getAssociatedTokenAddress(
      asset.mint,
      vault,
      true
    );
    
    const balance = await connection.getTokenAccountBalance(tokenAccount);
    balances[asset.name] = balance.value.uiAmount;
  }
  
  return balances;
}
```

## Agent Workflows

### VHR Monitoring Workflow (Every 5 Minutes)
```typescript
async function vhrMonitoringWorkflow() {
  // 1. Get current VHR
  const vault = await getVaultState(program);
  
  // 2. Check thresholds
  if (vault.vhrPercent < 150) {
    // Critical: Trigger circuit breaker
    await triggerCircuitBreaker(
      coreProgram,
      agentKeypair,
      `VHR critical: ${vault.vhrPercent}%`
    );
  } else if (vault.vhrPercent < 175) {
    // Warning: Trigger rebalancing
    await rebalanceWorkflow();
  }
  
  // 3. Log metrics
  console.log(`VHR: ${vault.vhrPercent}%`);
  await logMetrics('vhr', vault.vhrPercent);
}

// Run every 5 minutes
setInterval(vhrMonitoringWorkflow, 5 * 60 * 1000);
```

### Rebalancing Workflow (Every 6 Hours or On-Demand)
```typescript
async function rebalanceWorkflow() {
  // 1. Check if rebalancing needed
  const vault = await getVaultState(program);
  if (vault.vhrPercent >= 175) {
    console.log('VHR healthy, no rebalancing needed');
    return;
  }
  
  // 2. Check minimum interval (1 hour)
  const now = Math.floor(Date.now() / 1000);
  if (now - vault.lastRebalance < 3600) {
    console.log('Rebalancing too frequent, waiting...');
    return;
  }
  
  // 3. Calculate optimal allocation
  const allocation = await calculateOptimalAllocation(vault);
  
  // 4. Execute swaps
  for (const swap of allocation.swaps) {
    await rebalance(
      program,
      agentKeypair,
      swap.fromAsset,
      swap.toAsset,
      swap.amount
    );
  }
  
  // 5. Verify VHR improved
  const newVault = await getVaultState(program);
  console.log(`VHR improved: ${vault.vhrPercent}% -> ${newVault.vhrPercent}%`);
}

// Run every 6 hours
setInterval(rebalanceWorkflow, 6 * 60 * 60 * 1000);
```

### Deposit/Withdrawal Monitoring
```typescript
async function monitorVaultActivity() {
  // Subscribe to vault events
  const eventEmitter = program.addEventListener('DepositMade', (event) => {
    console.log(`Deposit: ${event.amount} ${event.asset}`);
    console.log(`New VHR: ${event.newVhr / 100}%`);
  });

  program.addEventListener('WithdrawalMade', (event) => {
    console.log(`Withdrawal: ${event.amount} ${event.asset}`);
    console.log(`New VHR: ${event.newVhr / 100}%`);
  });

  program.addEventListener('RebalanceExecuted', (event) => {
    console.log(`Rebalance: ${event.fromAsset} -> ${event.toAsset}`);
    console.log(`New VHR: ${event.newVhr / 100}%`);
  });
}
```

## DeFi Integration

### Jupiter Swap Integration
```typescript
import { Jupiter } from '@jup-ag/core';

async function executeJupiterSwap(
  fromMint: PublicKey,
  toMint: PublicKey,
  amount: number,
  slippageBps: number = 50 // 0.5%
) {
  const jupiter = await Jupiter.load({
    connection,
    cluster: 'devnet',
    user: agentKeypair,
  });

  // Get routes
  const routes = await jupiter.computeRoutes({
    inputMint: fromMint,
    outputMint: toMint,
    amount,
    slippageBps,
  });

  // Execute best route
  const { execute } = await jupiter.exchange({
    routeInfo: routes.routesInfos[0],
  });

  const swapResult = await execute();
  return swapResult;
}
```

### Kamino Lending Integration
```typescript
async function depositToKamino(
  asset: PublicKey,
  amount: number
) {
  // Deposit to Kamino for yield
  const kaminoClient = new KaminoClient(connection);
  
  const tx = await kaminoClient.deposit({
    reserve: asset,
    amount,
    user: agentKeypair.publicKey,
  });
  
  return tx;
}
```

### Meteora DLMM Integration
```typescript
async function addLiquidityMeteora(
  poolAddress: PublicKey,
  amountA: number,
  amountB: number
) {
  const meteoraClient = new MeteoraClient(connection);
  
  const tx = await meteoraClient.addLiquidity({
    pool: poolAddress,
    amountA,
    amountB,
    user: agentKeypair.publicKey,
  });
  
  return tx;
}
```

## Oracle Integration

### Pyth Price Feeds
```typescript
import { PythHttpClient } from '@pythnetwork/client';

async function getPythPrice(symbol: string): Promise<number> {
  const pythClient = new PythHttpClient(connection, PYTH_PROGRAM_ID);
  const data = await pythClient.getData();
  
  const priceData = data.productPrice.get(symbol);
  if (!priceData || !priceData.price) {
    throw new Error(`Price not available for ${symbol}`);
  }
  
  return priceData.price;
}
```

### Switchboard Feeds
```typescript
import { AggregatorAccount } from '@switchboard-xyz/solana.js';

async function getSwitchboardPrice(
  aggregatorPubkey: PublicKey
): Promise<number> {
  const aggregator = new AggregatorAccount({
    program,
    publicKey: aggregatorPubkey,
  });
  
  const result = await aggregator.getLatestValue();
  return result.toNumber();
}
```

## Error Handling

```typescript
try {
  await withdraw(program, withdrawerKeypair, assetMint, amount);
} catch (error) {
  if (error.message.includes('VHRTooLow')) {
    console.error('Withdrawal would drop VHR below minimum');
  } else if (error.message.includes('InsufficientBalance')) {
    console.error('Vault has insufficient balance');
  } else if (error.message.includes('CircuitBreakerActive')) {
    console.error('Circuit breaker is active, operations paused');
  } else {
    console.error('Withdrawal failed:', error);
  }
}
```

## Security Considerations

1. **VHR Monitoring**: Always check VHR before operations
2. **Slippage Protection**: Use 0.5% max slippage for swaps
3. **Rate Limiting**: Minimum 1-hour between rebalances
4. **Oracle Validation**: Verify oracle prices before using
5. **Circuit Breaker**: Respect circuit breaker state

## Testing

```bash
# Run ars-reserve tests
cd ars-protocol
anchor test -- --features test-bpf

# Test deposits/withdrawals
npm run test:vault-operations

# Test rebalancing
npm run test:rebalancing

# Test VHR calculations
npm run test:vhr
```

## Resources

- [ARS Reserve Program](../ars-protocol/programs/ars-reserve/)
- [Jupiter Documentation](https://docs.jup.ag/)
- [Kamino Documentation](https://docs.kamino.finance/)
- [Meteora Documentation](https://docs.meteora.ag/)
- [Pyth Documentation](https://docs.pyth.network/)

## Status

- **Implementation**: ✅ COMPLETE
- **Deployment**: 🔄 DEVNET
- **Testing**: ✅ PASSING
- **DeFi Integration**: 🔄 IN PROGRESS
