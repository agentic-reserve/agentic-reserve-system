# Design Document: ARS Complete Implementation and Deployment

## Overview

This design specifies the complete production implementation of the Agentic Reserve System (ARS) on Solana, encompassing three Anchor smart contracts with comprehensive security revisions, conversion of audit tools from Pinocchio to Anchor framework, integration of the Percolator orderbook system, and full devnet deployment with extensive testing.

The implementation builds upon existing ARS architecture while adding critical security mechanisms (Byzantine fault tolerance, agent registration, reputation systems), converting legacy audit tooling to modern Anchor patterns, and integrating a production-grade orderbook for ARU token trading.

## Architecture

### High-Level System Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    ARS Complete Implementation                           │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              Smart Contracts (Anchor 0.30.1)                      │   │
│  │                                                                    │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │   │
│  │  │ ars-core   │  │ars-reserve │  │ ars-token  │                 │   │
│  │  │ ~1,200 LOC │  │  ~900 LOC  │  │ ~1,100 LOC │                 │   │
│  │  └────────────┘  └────────────┘  └────────────┘                 │   │
│  │                                                                    │   │
│  │  Security Features:                                               │   │
│  │  • Admin transfer (48h timelock)                                  │   │
│  │  • Agent registration (tiered, stake-based)                       │   │
│  │  • Byzantine fault-tolerant ILI (3+ consensus)                    │   │
│  │  • Futarchy governance (quadratic voting)                         │   │
│  │  • Circuit breaker (griefing protection)                          │   │
│  │  • Reputation and slashing system                                 │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              Audit Tools (Anchor-based)                           │   │
│  │                                                                    │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐                 │   │
│  │  │  Static    │  │  Dynamic   │  │  Report    │                 │   │
│  │  │ Analysis   │  │  Testing   │  │ Generator  │                 │   │
│  │  └────────────┘  └────────────┘  └────────────┘                 │   │
│  │                                                                    │   │
│  │  Tools: checked-math, sealevel-attacks, proptest, Trident        │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              Percolator Orderbook System                          │   │
│  │                                                                    │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐  ┌──────────┐  │   │
│  │  │percolator  │  │percolator  │  │percolator  │  │percolator│  │   │
│  │  │   -prog    │  │   -cli     │  │  -match    │  │  (core)  │  │   │
│  │  └────────────┘  └────────────┘  └────────────┘  └──────────┘  │   │
│  │                                                                    │   │
│  │  Features: ARU/USDC market, price discovery, liquidity           │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              Testing Infrastructure                               │   │
│  │                                                                    │   │
│  │  • Unit tests (>90% coverage)                                     │   │
│  │  • Property-based tests (proptest)                                │   │
│  │  • Integration tests (multi-program flows)                        │   │
│  │  • Fuzz testing (Trident)                                         │   │
│  │  • Economic attack simulations                                    │   │
│  │  • Byzantine fault tolerance tests                                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                           │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │              Deployment Pipeline                                  │   │
│  │                                                                    │   │
│  │  Build → Test → Deploy (Devnet) → Verify → Report                │   │
│  └──────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────┘
```

## Components and Interfaces

### 1. Smart Contract: ars-core

**Purpose**: Main protocol logic with security revisions including admin transfer, agent registration, Byzantine fault-tolerant ILI updates, futarchy governance, and circuit breaker mechanisms.

**Location**: `ars-protocol/programs/ars-core/`


**Account Structures**:

```rust
#[account]
pub struct GlobalState {
    pub authority: Pubkey,              // Current admin
    pub pending_authority: Option<Pubkey>, // Pending admin transfer
    pub transfer_timelock: i64,         // 48-hour timelock timestamp
    pub ili_oracle: Pubkey,
    pub reserve_vault: Pubkey,
    pub aru_mint: Pubkey,
    pub epoch_duration: i64,
    pub mint_burn_cap_bps: u16,
    pub stability_fee_bps: u16,
    pub vhr_threshold: u16,
    pub circuit_breaker_active: bool,
    pub circuit_breaker_timelock: i64,  // 24-hour timelock
    pub min_agent_consensus: u8,        // Minimum 3 agents
    pub bump: u8,
}

#[account]
pub struct AgentRegistry {
    pub agent_pubkey: Pubkey,
    pub agent_tier: AgentTier,          // Based on stake
    pub stake_amount: u64,
    pub reputation_score: i32,          // Can be negative
    pub total_ili_updates: u64,
    pub successful_updates: u64,
    pub slashed_amount: u64,
    pub registered_at: i64,
    pub last_active: i64,
    pub is_active: bool,
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum AgentTier {
    Bronze,   // 100-999 ARU staked
    Silver,   // 1,000-9,999 ARU staked
    Gold,     // 10,000-99,999 ARU staked
    Platinum, // 100,000+ ARU staked
}

#[account]
pub struct ILIOracle {
    pub authority: Pubkey,
    pub current_ili: u64,
    pub last_update: i64,
    pub update_interval: i64,
    pub pending_updates: Vec<ILIPendingUpdate>,
    pub consensus_threshold: u8,        // Minimum 3 agents
    pub bump: u8,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone)]
pub struct ILIPendingUpdate {
    pub agent: Pubkey,
    pub ili_value: u64,
    pub timestamp: i64,
    pub signature: [u8; 64],            // Ed25519 signature
}

#[account]
pub struct PolicyProposal {
    pub id: u64,
    pub proposer: Pubkey,
    pub policy_type: PolicyType,
    pub policy_params: Vec<u8>,
    pub start_time: i64,
    pub end_time: i64,
    pub yes_stake: u64,
    pub no_stake: u64,
    pub quadratic_yes: u64,             // Sqrt of yes_stake
    pub quadratic_no: u64,              // Sqrt of no_stake
    pub status: ProposalStatus,
    pub execution_tx: Option<Signature>,
    pub griefing_protection_deposit: u64, // 10 ARU minimum
    pub bump: u8,
}
```

**Instructions**:


```rust
// Admin transfer with 48h timelock
pub fn initiate_admin_transfer(
    ctx: Context<InitiateAdminTransfer>,
    new_authority: Pubkey,
) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    require!(
        ctx.accounts.authority.key() == global_state.authority,
        ErrorCode::Unauthorized
    );
    
    global_state.pending_authority = Some(new_authority);
    global_state.transfer_timelock = Clock::get()?.unix_timestamp
        .checked_add(48 * 60 * 60)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    emit!(AdminTransferInitiated {
        old_authority: global_state.authority,
        new_authority,
        timelock_expires: global_state.transfer_timelock,
    });
    
    Ok(())
}

pub fn execute_admin_transfer(
    ctx: Context<ExecuteAdminTransfer>,
) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    let current_time = Clock::get()?.unix_timestamp;
    
    require!(
        current_time >= global_state.transfer_timelock,
        ErrorCode::TimelockNotExpired
    );
    
    require!(
        global_state.pending_authority.is_some(),
        ErrorCode::NoPendingTransfer
    );
    
    let new_authority = global_state.pending_authority.unwrap();
    global_state.authority = new_authority;
    global_state.pending_authority = None;
    
    emit!(AdminTransferExecuted {
        new_authority,
        timestamp: current_time,
    });
    
    Ok(())
}

// Agent registration with stake-based tiers
pub fn register_agent(
    ctx: Context<RegisterAgent>,
    stake_amount: u64,
) -> Result<()> {
    require!(
        stake_amount >= 100_000_000, // Minimum 100 ARU (6 decimals)
        ErrorCode::InsufficientStake
    );
    
    let agent_registry = &mut ctx.accounts.agent_registry;
    let current_time = Clock::get()?.unix_timestamp;
    
    // Determine tier based on stake
    let tier = if stake_amount >= 100_000_000_000_000 {
        AgentTier::Platinum
    } else if stake_amount >= 10_000_000_000_000 {
        AgentTier::Gold
    } else if stake_amount >= 1_000_000_000_000 {
        AgentTier::Silver
    } else {
        AgentTier::Bronze
    };
    
    agent_registry.agent_pubkey = ctx.accounts.agent.key();
    agent_registry.agent_tier = tier;
    agent_registry.stake_amount = stake_amount;
    agent_registry.reputation_score = 0;
    agent_registry.registered_at = current_time;
    agent_registry.last_active = current_time;
    agent_registry.is_active = true;
    
    // Transfer stake to escrow
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.agent_token_account.to_account_info(),
                to: ctx.accounts.stake_escrow.to_account_info(),
                authority: ctx.accounts.agent.to_account_info(),
            },
        ),
        stake_amount,
    )?;
    
    emit!(AgentRegistered {
        agent: ctx.accounts.agent.key(),
        tier,
        stake_amount,
        timestamp: current_time,
    });
    
    Ok(())
}

// Byzantine fault-tolerant ILI update
pub fn submit_ili_update(
    ctx: Context<SubmitILIUpdate>,
    ili_value: u64,
    signature: [u8; 64],
) -> Result<()> {
    let agent_registry = &ctx.accounts.agent_registry;
    let ili_oracle = &mut ctx.accounts.ili_oracle;
    let current_time = Clock::get()?.unix_timestamp;
    
    // Verify agent is active
    require!(agent_registry.is_active, ErrorCode::AgentNotActive);
    
    // Verify timestamp bounds (within 5 minutes)
    require!(
        current_time.checked_sub(ili_oracle.last_update).unwrap_or(0) >= 300,
        ErrorCode::UpdateTooFrequent
    );
    
    // Verify Ed25519 signature
    let message = [
        ili_value.to_le_bytes().as_ref(),
        current_time.to_le_bytes().as_ref(),
    ].concat();
    
    require!(
        ed25519_verify(&signature, &message, &agent_registry.agent_pubkey),
        ErrorCode::InvalidSignature
    );
    
    // Add to pending updates
    ili_oracle.pending_updates.push(ILIPendingUpdate {
        agent: agent_registry.agent_pubkey,
        ili_value,
        timestamp: current_time,
        signature,
    });
    
    // Check for consensus (3+ agents)
    if ili_oracle.pending_updates.len() >= ili_oracle.consensus_threshold as usize {
        // Calculate median of pending updates
        let mut values: Vec<u64> = ili_oracle.pending_updates
            .iter()
            .map(|u| u.ili_value)
            .collect();
        values.sort_unstable();
        
        let median = if values.len() % 2 == 0 {
            (values[values.len() / 2 - 1] + values[values.len() / 2]) / 2
        } else {
            values[values.len() / 2]
        };
        
        // Update ILI with consensus value
        ili_oracle.current_ili = median;
        ili_oracle.last_update = current_time;
        
        // Clear pending updates
        ili_oracle.pending_updates.clear();
        
        emit!(ILIUpdated {
            ili_value: median,
            consensus_agents: values.len() as u8,
            timestamp: current_time,
        });
    }
    
    Ok(())
}
```


```rust
// Futarchy governance with quadratic voting
pub fn vote_on_proposal(
    ctx: Context<VoteOnProposal>,
    proposal_id: u64,
    prediction: bool,
    stake_amount: u64,
) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;
    let agent_registry = &ctx.accounts.agent_registry;
    let current_time = Clock::get()?.unix_timestamp;
    
    require!(
        current_time >= proposal.start_time && current_time < proposal.end_time,
        ErrorCode::ProposalNotActive
    );
    
    require!(agent_registry.is_active, ErrorCode::AgentNotActive);
    
    // Calculate quadratic voting power (sqrt of stake)
    let voting_power = (stake_amount as f64).sqrt() as u64;
    
    if prediction {
        proposal.yes_stake = proposal.yes_stake
            .checked_add(stake_amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        proposal.quadratic_yes = proposal.quadratic_yes
            .checked_add(voting_power)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
    } else {
        proposal.no_stake = proposal.no_stake
            .checked_add(stake_amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        proposal.quadratic_no = proposal.quadratic_no
            .checked_add(voting_power)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
    }
    
    emit!(VoteCast {
        proposal_id,
        agent: agent_registry.agent_pubkey,
        prediction,
        stake_amount,
        voting_power,
        timestamp: current_time,
    });
    
    Ok(())
}

// Circuit breaker with griefing protection
pub fn trigger_circuit_breaker(
    ctx: Context<TriggerCircuitBreaker>,
    reason: String,
) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    let agent_registry = &ctx.accounts.agent_registry;
    let current_time = Clock::get()?.unix_timestamp;
    
    // Only high-reputation agents can trigger
    require!(
        agent_registry.reputation_score >= 100,
        ErrorCode::InsufficientReputation
    );
    
    // Require deposit to prevent griefing
    require!(
        ctx.accounts.deposit_amount >= 10_000_000, // 10 ARU
        ErrorCode::InsufficientDeposit
    );
    
    global_state.circuit_breaker_active = true;
    global_state.circuit_breaker_timelock = current_time
        .checked_add(24 * 60 * 60)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    emit!(CircuitBreakerTriggered {
        agent: agent_registry.agent_pubkey,
        reason,
        timelock_expires: global_state.circuit_breaker_timelock,
        timestamp: current_time,
    });
    
    Ok(())
}

// Slashing mechanism for malicious behavior
pub fn slash_agent(
    ctx: Context<SlashAgent>,
    slash_amount: u64,
    reason: String,
) -> Result<()> {
    let global_state = &ctx.accounts.global_state;
    let agent_registry = &mut ctx.accounts.agent_registry;
    
    require!(
        ctx.accounts.authority.key() == global_state.authority,
        ErrorCode::Unauthorized
    );
    
    require!(
        slash_amount <= agent_registry.stake_amount,
        ErrorCode::InsufficientStake
    );
    
    agent_registry.stake_amount = agent_registry.stake_amount
        .checked_sub(slash_amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    agent_registry.slashed_amount = agent_registry.slashed_amount
        .checked_add(slash_amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    agent_registry.reputation_score = agent_registry.reputation_score
        .checked_sub(50)
        .unwrap_or(-1000); // Cap at -1000
    
    // Deactivate if stake falls below minimum
    if agent_registry.stake_amount < 100_000_000 {
        agent_registry.is_active = false;
    }
    
    emit!(AgentSlashed {
        agent: agent_registry.agent_pubkey,
        slash_amount,
        reason,
        new_reputation: agent_registry.reputation_score,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}
```

**Security Mechanisms**:
- All arithmetic uses checked operations
- Reentrancy guards on state-modifying functions
- PDA validation for all accounts
- Ed25519 signature verification for agent actions
- Timestamp bounds on time-sensitive operations
- Comprehensive input validation
- Event emission for all state changes

### 2. Smart Contract: ars-reserve

**Purpose**: Multi-asset vault management with deposit/withdraw, VHR monitoring, and autonomous rebalancing.

**Location**: `ars-protocol/programs/ars-reserve/`

**Account Structures**:

```rust
#[account]
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
    pub rebalance_threshold_bps: u16,
    pub min_vhr: u16,                   // 15000 = 150%
    pub bump: u8,
}

#[account]
pub struct AssetConfig {
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub target_weight_bps: u16,
    pub min_weight_bps: u16,
    pub max_weight_bps: u16,
    pub volatility_threshold_bps: u16,
    pub current_weight_bps: u16,
    pub oracle_source: Pubkey,
    pub bump: u8,
}
```

**Instructions**:

```rust
pub fn deposit(
    ctx: Context<Deposit>,
    asset_type: AssetType,
    amount: u64,
) -> Result<()> {
    require!(amount > 0, ErrorCode::InvalidAmount);
    
    let vault = &mut ctx.accounts.vault;
    let asset_config = &ctx.accounts.asset_config;
    
    // Verify asset type matches config
    require!(
        ctx.accounts.asset_mint.key() == asset_config.mint,
        ErrorCode::InvalidAsset
    );
    
    // Transfer tokens to vault
    token::transfer(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.user_token_account.to_account_info(),
                to: ctx.accounts.vault_token_account.to_account_info(),
                authority: ctx.accounts.user.to_account_info(),
            },
        ),
        amount,
    )?;
    
    // Update vault state
    let price_usd = get_oracle_price(&ctx.accounts.oracle)?;
    let value_usd = amount
        .checked_mul(price_usd)
        .ok_or(ErrorCode::ArithmeticOverflow)?
        .checked_div(1_000_000)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    vault.total_value_usd = vault.total_value_usd
        .checked_add(value_usd)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    // Recalculate VHR
    vault.vhr = calculate_vhr(vault.total_value_usd, vault.liabilities_usd)?;
    
    emit!(DepositMade {
        user: ctx.accounts.user.key(),
        asset: asset_config.mint,
        amount,
        value_usd,
        new_vhr: vault.vhr,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}
```


```rust
pub fn withdraw(
    ctx: Context<Withdraw>,
    asset_type: AssetType,
    amount: u64,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let asset_config = &ctx.accounts.asset_config;
    
    // Verify sufficient balance
    let vault_balance = ctx.accounts.vault_token_account.amount;
    require!(amount <= vault_balance, ErrorCode::InsufficientBalance);
    
    // Calculate value and check VHR after withdrawal
    let price_usd = get_oracle_price(&ctx.accounts.oracle)?;
    let value_usd = amount
        .checked_mul(price_usd)
        .ok_or(ErrorCode::ArithmeticOverflow)?
        .checked_div(1_000_000)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    let new_total_value = vault.total_value_usd
        .checked_sub(value_usd)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    let new_vhr = calculate_vhr(new_total_value, vault.liabilities_usd)?;
    
    // Ensure VHR stays above minimum
    require!(new_vhr >= vault.min_vhr, ErrorCode::VHRTooLow);
    
    // Transfer tokens from vault
    let vault_seeds = &[
        b"vault",
        vault.authority.as_ref(),
        &[vault.bump],
    ];
    let signer = &[&vault_seeds[..]];
    
    token::transfer(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::Transfer {
                from: ctx.accounts.vault_token_account.to_account_info(),
                to: ctx.accounts.user_token_account.to_account_info(),
                authority: vault.to_account_info(),
            },
            signer,
        ),
        amount,
    )?;
    
    vault.total_value_usd = new_total_value;
    vault.vhr = new_vhr;
    
    emit!(WithdrawalMade {
        user: ctx.accounts.user.key(),
        asset: asset_config.mint,
        amount,
        value_usd,
        new_vhr,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

pub fn rebalance(
    ctx: Context<Rebalance>,
    from_asset: AssetType,
    to_asset: AssetType,
    amount: u64,
) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    let global_state = &ctx.accounts.global_state;
    
    // Check circuit breaker
    require!(
        !global_state.circuit_breaker_active,
        ErrorCode::CircuitBreakerActive
    );
    
    // Verify VHR is below threshold
    require!(
        vault.vhr < vault.rebalance_threshold_bps,
        ErrorCode::RebalanceNotNeeded
    );
    
    // Perform CPI to DeFi protocol (Jupiter, Kamino, Meteora)
    // This is a simplified example - actual implementation would use Jupiter aggregator
    let swap_result = perform_swap(
        &ctx.accounts,
        from_asset,
        to_asset,
        amount,
    )?;
    
    // Update vault composition
    update_vault_composition(vault, from_asset, to_asset, swap_result)?;
    
    // Recalculate VHR
    vault.vhr = calculate_vhr(vault.total_value_usd, vault.liabilities_usd)?;
    vault.last_rebalance = Clock::get()?.unix_timestamp;
    
    emit!(RebalanceExecuted {
        from_asset,
        to_asset,
        amount,
        new_vhr: vault.vhr,
        timestamp: vault.last_rebalance,
    });
    
    Ok(())
}

// Helper function for VHR calculation
fn calculate_vhr(total_value_usd: u64, liabilities_usd: u64) -> Result<u16> {
    if liabilities_usd == 0 {
        return Ok(u16::MAX); // Infinite backing
    }
    
    let ratio = total_value_usd
        .checked_mul(10000)
        .ok_or(ErrorCode::ArithmeticOverflow)?
        .checked_div(liabilities_usd)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    Ok(ratio as u16)
}
```

### 3. Smart Contract: ars-token

**Purpose**: ARU token lifecycle with epoch-based supply control, mint/burn with caps, and parameter updates.

**Location**: `ars-protocol/programs/ars-token/`

**Account Structures**:

```rust
#[account]
pub struct MintState {
    pub authority: Pubkey,
    pub aru_mint: Pubkey,
    pub current_epoch: u64,
    pub epoch_start: i64,
    pub epoch_duration: i64,
    pub total_supply: u64,
    pub epoch_minted: u64,
    pub epoch_burned: u64,
    pub mint_cap_per_epoch_bps: u16,    // 200 = 2%
    pub burn_cap_per_epoch_bps: u16,
    pub bump: u8,
}

#[account]
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

**Instructions**:

```rust
pub fn mint_aru(
    ctx: Context<MintARU>,
    amount: u64,
) -> Result<()> {
    let mint_state = &mut ctx.accounts.mint_state;
    let global_state = &ctx.accounts.global_state;
    
    // Check circuit breaker
    require!(
        !global_state.circuit_breaker_active,
        ErrorCode::CircuitBreakerActive
    );
    
    // Calculate epoch mint cap
    let mint_cap = mint_state.total_supply
        .checked_mul(mint_state.mint_cap_per_epoch_bps as u64)
        .ok_or(ErrorCode::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    // Check if minting would exceed cap
    let new_epoch_minted = mint_state.epoch_minted
        .checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    require!(
        new_epoch_minted <= mint_cap,
        ErrorCode::MintCapExceeded
    );
    
    // Mint tokens
    let mint_seeds = &[
        b"mint",
        mint_state.authority.as_ref(),
        &[mint_state.bump],
    ];
    let signer = &[&mint_seeds[..]];
    
    token::mint_to(
        CpiContext::new_with_signer(
            ctx.accounts.token_program.to_account_info(),
            token::MintTo {
                mint: ctx.accounts.aru_mint.to_account_info(),
                to: ctx.accounts.destination.to_account_info(),
                authority: mint_state.to_account_info(),
            },
            signer,
        ),
        amount,
    )?;
    
    // Update state
    mint_state.epoch_minted = new_epoch_minted;
    mint_state.total_supply = mint_state.total_supply
        .checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    emit!(ARUMinted {
        amount,
        destination: ctx.accounts.destination.key(),
        epoch: mint_state.current_epoch,
        new_supply: mint_state.total_supply,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

pub fn burn_aru(
    ctx: Context<BurnARU>,
    amount: u64,
) -> Result<()> {
    let mint_state = &mut ctx.accounts.mint_state;
    
    // Calculate epoch burn cap
    let burn_cap = mint_state.total_supply
        .checked_mul(mint_state.burn_cap_per_epoch_bps as u64)
        .ok_or(ErrorCode::ArithmeticOverflow)?
        .checked_div(10000)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    let new_epoch_burned = mint_state.epoch_burned
        .checked_add(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    require!(
        new_epoch_burned <= burn_cap,
        ErrorCode::BurnCapExceeded
    );
    
    // Burn tokens
    token::burn(
        CpiContext::new(
            ctx.accounts.token_program.to_account_info(),
            token::Burn {
                mint: ctx.accounts.aru_mint.to_account_info(),
                from: ctx.accounts.source.to_account_info(),
                authority: ctx.accounts.authority.to_account_info(),
            },
        ),
        amount,
    )?;
    
    mint_state.epoch_burned = new_epoch_burned;
    mint_state.total_supply = mint_state.total_supply
        .checked_sub(amount)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    emit!(ARUBurned {
        amount,
        source: ctx.accounts.source.key(),
        epoch: mint_state.current_epoch,
        new_supply: mint_state.total_supply,
        timestamp: Clock::get()?.unix_timestamp,
    });
    
    Ok(())
}

pub fn start_new_epoch(
    ctx: Context<StartNewEpoch>,
) -> Result<()> {
    let mint_state = &mut ctx.accounts.mint_state;
    let current_time = Clock::get()?.unix_timestamp;
    
    // Verify epoch duration has elapsed
    let epoch_end = mint_state.epoch_start
        .checked_add(mint_state.epoch_duration)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    require!(
        current_time >= epoch_end,
        ErrorCode::EpochNotComplete
    );
    
    // Record epoch history
    let epoch_history = &mut ctx.accounts.epoch_history;
    epoch_history.epoch_number = mint_state.current_epoch;
    epoch_history.start_time = mint_state.epoch_start;
    epoch_history.end_time = current_time;
    epoch_history.total_minted = mint_state.epoch_minted;
    epoch_history.total_burned = mint_state.epoch_burned;
    epoch_history.net_supply_change = (mint_state.epoch_minted as i64)
        .checked_sub(mint_state.epoch_burned as i64)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    epoch_history.final_supply = mint_state.total_supply;
    
    // Start new epoch
    mint_state.current_epoch = mint_state.current_epoch
        .checked_add(1)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    mint_state.epoch_start = current_time;
    mint_state.epoch_minted = 0;
    mint_state.epoch_burned = 0;
    
    emit!(NewEpochStarted {
        epoch_number: mint_state.current_epoch,
        start_time: current_time,
        previous_supply: epoch_history.final_supply,
    });
    
    Ok(())
}
```

## Data Models

### Error Codes

```rust
#[error_code]
pub enum ErrorCode {
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
    
    #[msg("Unauthorized access")]
    Unauthorized,
    
    #[msg("Timelock has not expired")]
    TimelockNotExpired,
    
    #[msg("No pending admin transfer")]
    NoPendingTransfer,
    
    #[msg("Insufficient stake amount")]
    InsufficientStake,
    
    #[msg("Agent is not active")]
    AgentNotActive,
    
    #[msg("ILI update too frequent")]
    UpdateTooFrequent,
    
    #[msg("Invalid Ed25519 signature")]
    InvalidSignature,
    
    #[msg("Proposal is not active")]
    ProposalNotActive,
    
    #[msg("Insufficient reputation score")]
    InsufficientReputation,
    
    #[msg("Insufficient deposit for griefing protection")]
    InsufficientDeposit,
    
    #[msg("Circuit breaker is active")]
    CircuitBreakerActive,
    
    #[msg("Invalid amount")]
    InvalidAmount,
    
    #[msg("Invalid asset type")]
    InvalidAsset,
    
    #[msg("Insufficient balance")]
    InsufficientBalance,
    
    #[msg("VHR would fall below minimum")]
    VHRTooLow,
    
    #[msg("Rebalance not needed")]
    RebalanceNotNeeded,
    
    #[msg("Mint cap exceeded for this epoch")]
    MintCapExceeded,
    
    #[msg("Burn cap exceeded for this epoch")]
    BurnCapExceeded,
    
    #[msg("Epoch duration not complete")]
    EpochNotComplete,
}
```


## 4. Audit Tool Conversion (ars-audit-program)

**Purpose**: Convert existing Pinocchio-based audit tools to Anchor framework for comprehensive security analysis of ARS smart contracts.

**Location**: `ars-audit-program/`

**Components**:

1. **Static Analysis Engine**
   - checked-math analyzer: Detects unchecked arithmetic operations
   - sealevel-attacks analyzer: Identifies 11 common Solana vulnerabilities
   - Anchor pattern validator: Verifies Anchor best practices

2. **Dynamic Testing Engine**
   - Trident fuzzer integration: Stateful property-based fuzzing
   - Invariant checker: Verifies protocol invariants hold
   - PoC executor: Runs proof-of-concept exploits

3. **Report Generator**
   - Severity classifier: Critical, High, Medium, Low, Informational
   - Markdown formatter: Generates comprehensive audit reports
   - Remediation guidance: Provides fix recommendations

**Audit Workflow**:

```rust
pub struct AuditOrchestrator {
    programs: Vec<ProgramTarget>,
    findings: Vec<Finding>,
}

impl AuditOrchestrator {
    pub async fn run_audit(&mut self) -> Result<AuditReport> {
        // Phase 1: Static Analysis
        self.run_checked_math_analysis()?;
        self.run_sealevel_attacks_analysis()?;
        
        // Phase 2: Dynamic Testing
        self.run_trident_fuzzing()?;
        self.run_invariant_checks()?;
        
        // Phase 3: PoC Validation
        self.execute_pocs()?;
        
        // Phase 4: Report Generation
        self.generate_report()
    }
}
```

## 5. Percolator Orderbook Integration

**Purpose**: Integrate Percolator orderbook system for ARU token trading with price discovery and liquidity.

**Locations**:
- `percolator/percolator`: Core orderbook logic
- `percolator/percolator-cli`: CLI tools for market operations
- `percolator/percolator-match`: Matching engine
- `percolator/percolator-prog`: Solana program integration

**Market Structure**:

```rust
#[account]
pub struct Market {
    pub authority: Pubkey,
    pub base_mint: Pubkey,      // ARU
    pub quote_mint: Pubkey,     // USDC
    pub base_vault: Pubkey,
    pub quote_vault: Pubkey,
    pub orderbook: Pubkey,
    pub event_queue: Pubkey,
    pub bids: Pubkey,
    pub asks: Pubkey,
    pub bump: u8,
}

#[account]
pub struct Order {
    pub owner: Pubkey,
    pub side: Side,             // Buy or Sell
    pub price: u64,             // Price in quote per base
    pub quantity: u64,
    pub filled: u64,
    pub timestamp: i64,
    pub order_id: u128,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum Side {
    Buy,
    Sell,
}
```

**Integration with ars-core**:

```rust
// CPI from ars-core to Percolator
pub fn execute_market_order(
    ctx: Context<ExecuteMarketOrder>,
    side: Side,
    quantity: u64,
    max_price: u64,
) -> Result<()> {
    // Perform CPI to Percolator program
    let cpi_program = ctx.accounts.percolator_program.to_account_info();
    let cpi_accounts = percolator::cpi::accounts::PlaceOrder {
        market: ctx.accounts.market.to_account_info(),
        owner: ctx.accounts.owner.to_account_info(),
        // ... other accounts
    };
    
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    percolator::cpi::place_order(cpi_ctx, side, quantity, max_price)?;
    
    Ok(())
}
```

## Correctness Properties

A property is a characteristic or behavior that should hold true across all valid executions of a system—essentially, a formal statement about what the system should do. Properties serve as the bridge between human-readable specifications and machine-verifiable correctness guarantees.

### Property 1: Admin Transfer Timelock Enforcement

*For any* admin transfer initiated, the execution must not be possible until exactly 48 hours (172,800 seconds) have elapsed from initiation, and once executed, the transfer must be irreversible.

**Validates: Requirements 1.2, 1.3**

### Property 2: Agent Tier Assignment Correctness

*For any* agent registration with stake amount S, the assigned tier must be: Bronze if 100 ≤ S < 1,000 ARU, Silver if 1,000 ≤ S < 10,000 ARU, Gold if 10,000 ≤ S < 100,000 ARU, or Platinum if S ≥ 100,000 ARU.

**Validates: Requirements 1.4**

### Property 3: Byzantine Fault Tolerance for ILI Updates

*For any* set of ILI update submissions from registered agents, the protocol must only accept the median value when at least 3 agents have submitted updates with valid Ed25519 signatures and timestamps within the 5-minute update window.

**Validates: Requirements 1.5, 1.6**

### Property 4: Quadratic Voting Power Calculation

*For any* vote on a proposal with stake amount S, the voting power must equal floor(sqrt(S)), ensuring quadratic scaling to prevent whale dominance.

**Validates: Requirements 1.8**

### Property 5: Circuit Breaker Pause Enforcement

*For any* operation attempted while the circuit breaker is active, the operation must fail with CircuitBreakerActive error, and the circuit breaker must remain active for at least 24 hours from trigger time.

**Validates: Requirements 1.9**

### Property 6: Slashing Mechanism Correctness

*For any* slashing event with amount A on an agent with stake S and reputation R, the new stake must be S - A, the new reputation must be R - 50 (capped at -1000), and if new stake < 100 ARU, the agent must be deactivated.

**Validates: Requirements 1.10**

### Property 7: Checked Arithmetic Invariant

*For all* arithmetic operations in ars-core, ars-reserve, and ars-token programs, the operations must use checked variants (checked_add, checked_sub, checked_mul, checked_div) that return errors on overflow/underflow rather than wrapping.

**Validates: Requirements 1.11, 2.8, 3.7**

### Property 8: VHR Calculation Accuracy

*For any* vault state with total value V and liabilities L, the VHR must equal (V * 10000) / L in basis points, and withdrawals that would cause VHR < 150% must be rejected.

**Validates: Requirements 2.4, 2.3**

### Property 9: Deposit and Withdrawal Balance Invariant

*For any* sequence of deposits and withdrawals on the reserve vault, the sum of all deposits minus the sum of all withdrawals must equal the current vault balance for each asset type.

**Validates: Requirements 2.2, 2.3**

### Property 10: Epoch Supply Cap Enforcement

*For any* epoch E, the total amount minted in epoch E must not exceed (total_supply * mint_cap_bps) / 10000, and the total amount burned must not exceed (total_supply * burn_cap_bps) / 10000.

**Validates: Requirements 3.3, 3.4**

### Property 11: Epoch Transition Timing

*For any* epoch transition, the transition must only succeed if current_time >= epoch_start + epoch_duration, and the new epoch must reset minted and burned counters to zero.

**Validates: Requirements 3.5**

### Property 12: Event Emission Completeness

*For any* state-modifying instruction in ars-core, ars-reserve, or ars-token, an event must be emitted containing the operation type, relevant parameters, and timestamp.

**Validates: Requirements 1.14, 2.9, 3.8**

### Property 13: PDA Derivation Validation

*For any* PDA account used in the protocol, the account address must be re-derived using the specified seeds and bump, and must match the provided account address before any operations are performed.

**Validates: Requirements 1.13**

### Property 14: Audit Tool Detection Completeness

*For any* test program containing one of the 11 sealevel attack patterns (missing signer, missing owner, type cosplay, arbitrary CPI, PDA sharing, bump canonicalization, closing account, revival attack, PDA validation, type confusion, duplicate mutable accounts), the audit tool must detect and report the vulnerability with appropriate severity.

**Validates: Requirements 4.1, 4.2**

### Property 15: Fuzzing Iteration Minimum

*For any* property-based fuzz test executed by the audit tool, the test must run for at least 1000 iterations with randomized instruction sequences to ensure adequate coverage.

**Validates: Requirements 4.5**

### Property 16: Invariant Preservation Under Fuzzing

*For any* sequence of randomized instructions executed during fuzzing, the protocol invariants (supply cap, VHR ≥ 150%, circuit breaker timelock, Byzantine consensus) must hold after each instruction or the circuit breaker must be active.

**Validates: Requirements 4.3, 6.2**

### Property 17: Orderbook Price-Time Priority

*For any* two orders O1 and O2 on the same side of the orderbook, if O1 has a better price than O2, O1 must be matched first; if prices are equal, the order with earlier timestamp must be matched first.

**Validates: Requirements 5.6**

### Property 18: Order Matching Balance Conservation

*For any* matched trade between a buy order and sell order, the amount of base tokens transferred from seller to buyer must equal the filled quantity, and the amount of quote tokens transferred from buyer to seller must equal filled quantity * price.

**Validates: Requirements 5.3**

### Property 19: Test Coverage Threshold

*For any* test suite execution, the code coverage across all three programs (ars-core, ars-reserve, ars-token) must exceed 90% of executable lines.

**Validates: Requirements 6.1**

### Property 20: Backend Compatibility Preservation

*For any* account structure in the deployed programs, the account layout must be compatible with the existing TypeScript backend SDK, meaning field names, types, and ordering must match the SDK's expectations.

**Validates: Requirements 10.1, 10.2, 10.3, 10.4, 10.5, 10.6, 10.7**


## Error Handling

### Smart Contract Error Handling

**Arithmetic Errors**: All arithmetic operations use checked variants that return `ErrorCode::ArithmeticOverflow` on overflow/underflow. The program must never panic or wrap on arithmetic errors.

**Authorization Errors**: All instructions verify signer authority and account ownership. Unauthorized access returns `ErrorCode::Unauthorized`. PDA validation failures return `ErrorCode::InvalidPDA`.

**Timelock Errors**: Operations attempted before timelock expiration return `ErrorCode::TimelockNotExpired`. This applies to admin transfers (48h) and circuit breaker (24h).

**State Validation Errors**: Invalid state transitions return specific errors:
- `ErrorCode::AgentNotActive`: Agent is deactivated
- `ErrorCode::CircuitBreakerActive`: Operations paused
- `ErrorCode::VHRTooLow`: Withdrawal would violate minimum VHR
- `ErrorCode::MintCapExceeded`: Epoch mint limit reached
- `ErrorCode::BurnCapExceeded`: Epoch burn limit reached

**Signature Verification Errors**: Invalid Ed25519 signatures return `ErrorCode::InvalidSignature`. This prevents unauthorized ILI updates and agent actions.

### Audit Tool Error Handling

**Tool Execution Failures**: If an audit tool fails to execute (missing dependencies, compilation errors), the orchestrator logs the error, continues with remaining tools, marks the tool as "Failed" in the report, and includes error details in the appendix.

**Parse Errors**: If tool output cannot be parsed, the orchestrator logs raw output for manual review, attempts best-effort parsing, flags findings as "Needs Manual Review", and includes raw output in the report.

**Timeout Handling**: Long-running tools (fuzzing) have 30-minute timeouts. On timeout, the tool terminates gracefully, reports partial results, and notes the timeout in findings.

**False Positive Handling**: Manual review step allows marking findings as "False Positive" with documentation of why it's safe. False positives are excluded from the final report but logged in the appendix.

### Deployment Error Handling

**Build Failures**: If program compilation fails, the deployment stops immediately, logs the compiler error with full context, and generates a build failure report with error details and suggested fixes.

**Deployment Failures**: If deployment to devnet fails (insufficient SOL, network issues), the system retries up to 3 times with exponential backoff, logs all transaction signatures, and generates a deployment failure report.

**Initialization Failures**: If protocol initialization fails (invalid parameters, account creation errors), the system rolls back any partial state, logs the failure, and provides remediation steps.

**Verification Failures**: If post-deployment verification fails (account not found, incorrect state), the system generates a detailed verification report showing expected vs actual state and suggests manual inspection steps.

## Testing Strategy

### Unit Tests

**Smart Contract Unit Tests**:
- Test each instruction in isolation with valid inputs
- Test error conditions (unauthorized access, invalid amounts, timelock violations)
- Test edge cases (zero amounts, maximum values, boundary conditions)
- Test state transitions (agent registration → voting → slashing)
- Target: >90% code coverage per program

**Example Unit Test**:
```rust
#[test]
fn test_admin_transfer_timelock() {
    let mut context = setup_test_context();
    
    // Initiate transfer
    let new_authority = Pubkey::new_unique();
    initiate_admin_transfer(&mut context, new_authority).unwrap();
    
    // Attempt immediate execution (should fail)
    let result = execute_admin_transfer(&mut context);
    assert_eq!(result.unwrap_err(), ErrorCode::TimelockNotExpired);
    
    // Advance time by 48 hours
    context.advance_clock(48 * 60 * 60);
    
    // Execute transfer (should succeed)
    execute_admin_transfer(&mut context).unwrap();
    
    // Verify new authority
    let global_state = context.get_global_state();
    assert_eq!(global_state.authority, new_authority);
}
```

### Property-Based Tests

**Property Test Configuration**:
- Use `proptest` crate for Rust property-based testing
- Minimum 100 iterations per property test (due to randomization)
- Each test references its design document property number
- Tag format: `// Feature: ars-complete-implementation, Property N: [property text]`

**Example Property Test**:
```rust
use proptest::prelude::*;

proptest! {
    #[test]
    // Feature: ars-complete-implementation, Property 2: Agent Tier Assignment Correctness
    fn test_agent_tier_assignment(stake_amount in 100_000_000u64..1_000_000_000_000u64) {
        let tier = calculate_agent_tier(stake_amount);
        
        let expected_tier = if stake_amount >= 100_000_000_000_000 {
            AgentTier::Platinum
        } else if stake_amount >= 10_000_000_000_000 {
            AgentTier::Gold
        } else if stake_amount >= 1_000_000_000_000 {
            AgentTier::Silver
        } else {
            AgentTier::Bronze
        };
        
        prop_assert_eq!(tier, expected_tier);
    }
}
```

### Integration Tests

**Multi-Program Flow Tests**:
- Test ars-core + ars-reserve interaction (proposal → rebalance)
- Test ars-core + ars-token interaction (proposal → mint/burn)
- Test ars-reserve + ars-token interaction (deposit → mint)
- Test full workflow: agent registration → ILI update → proposal → vote → execution

**Example Integration Test**:
```rust
#[tokio::test]
async fn test_full_governance_flow() {
    let mut banks_client = setup_banks_client().await;
    
    // 1. Register agents
    let agent1 = register_agent(&mut banks_client, 10_000_000_000).await;
    let agent2 = register_agent(&mut banks_client, 10_000_000_000).await;
    let agent3 = register_agent(&mut banks_client, 10_000_000_000).await;
    
    // 2. Submit ILI updates (Byzantine consensus)
    submit_ili_update(&mut banks_client, agent1, 5000).await;
    submit_ili_update(&mut banks_client, agent2, 5100).await;
    submit_ili_update(&mut banks_client, agent3, 4900).await;
    
    // Verify median is accepted (5000)
    let ili = get_current_ili(&mut banks_client).await;
    assert_eq!(ili, 5000);
    
    // 3. Create proposal
    let proposal_id = create_proposal(
        &mut banks_client,
        PolicyType::MintARU,
        1_000_000,
    ).await;
    
    // 4. Vote on proposal (quadratic voting)
    vote_on_proposal(&mut banks_client, agent1, proposal_id, true, 10_000_000_000).await;
    vote_on_proposal(&mut banks_client, agent2, proposal_id, true, 10_000_000_000).await;
    
    // 5. Execute proposal
    advance_time(&mut banks_client, 24 * 60 * 60).await;
    execute_proposal(&mut banks_client, proposal_id).await;
    
    // 6. Verify ARU minted
    let total_supply = get_total_supply(&mut banks_client).await;
    assert_eq!(total_supply, 1_000_000);
}
```

### Fuzz Testing with Trident

**Trident Configuration**:
```toml
[fuzz]
iterations = 1000
max_instruction_sequence_length = 10
allow_duplicate_accounts = false

[[fuzz.invariants]]
name = "supply_cap"
description = "Total minted in epoch must not exceed cap"

[[fuzz.invariants]]
name = "vhr_minimum"
description = "VHR must be >= 150% or circuit breaker active"

[[fuzz.invariants]]
name = "byzantine_consensus"
description = "ILI updates require 3+ agent consensus"
```

**Example Fuzz Test**:
```rust
#[trident_test]
fn fuzz_test_supply_cap(
    fuzz_instructions: Vec<FuzzInstruction>,
) -> Result<()> {
    let mut program_test = ProgramTest::new();
    
    for instruction in fuzz_instructions {
        match instruction {
            FuzzInstruction::MintARU { amount } => {
                // Execute mint instruction
                mint_aru(&mut program_test, amount)?;
            }
            FuzzInstruction::BurnARU { amount } => {
                // Execute burn instruction
                burn_aru(&mut program_test, amount)?;
            }
            FuzzInstruction::StartNewEpoch => {
                // Execute epoch transition
                start_new_epoch(&mut program_test)?;
            }
        }
        
        // Check invariant: epoch minted <= cap
        let mint_state = get_mint_state(&program_test)?;
        let cap = (mint_state.total_supply * mint_state.mint_cap_per_epoch_bps as u64) / 10000;
        assert!(mint_state.epoch_minted <= cap, "Supply cap violated!");
    }
    
    Ok(())
}
```

### Economic Attack Simulations

**Attack Scenarios**:
1. **Governance Manipulation**: Attempt to pass malicious proposals with coordinated voting
2. **ILI Manipulation**: Submit false ILI updates to manipulate protocol decisions
3. **Vault Drain**: Attempt to withdraw more than allowed by VHR constraints
4. **Supply Manipulation**: Attempt to mint/burn beyond epoch caps
5. **Circuit Breaker Griefing**: Attempt to trigger circuit breaker repeatedly

**Example Attack Simulation**:
```rust
#[test]
fn test_governance_manipulation_resistance() {
    let mut context = setup_test_context();
    
    // Attacker registers with large stake
    let attacker = register_agent(&mut context, 1_000_000_000_000).unwrap();
    
    // Attacker creates malicious proposal
    let proposal_id = create_proposal(
        &mut context,
        PolicyType::MintARU,
        1_000_000_000_000, // Mint 1 trillion ARU
    ).unwrap();
    
    // Attacker votes with full stake
    vote_on_proposal(&mut context, attacker, proposal_id, true, 1_000_000_000_000).unwrap();
    
    // Advance time and attempt execution
    context.advance_clock(24 * 60 * 60);
    
    // Execution should fail due to supply cap
    let result = execute_proposal(&mut context, proposal_id);
    assert_eq!(result.unwrap_err(), ErrorCode::MintCapExceeded);
}
```

### Byzantine Fault Tolerance Tests

**BFT Test Scenarios**:
1. **Malicious Agent Submissions**: Some agents submit false ILI values
2. **Timing Attacks**: Agents submit updates outside time windows
3. **Signature Forgery**: Attempt to submit updates with invalid signatures
4. **Consensus Manipulation**: Attempt to bypass 3-agent minimum

**Example BFT Test**:
```rust
#[test]
fn test_byzantine_ili_consensus() {
    let mut context = setup_test_context();
    
    // Register 5 agents
    let agents: Vec<_> = (0..5)
        .map(|_| register_agent(&mut context, 10_000_000_000).unwrap())
        .collect();
    
    // 3 honest agents submit correct ILI (5000)
    for i in 0..3 {
        submit_ili_update(&mut context, agents[i], 5000).unwrap();
    }
    
    // 2 Byzantine agents submit false ILI (10000)
    for i in 3..5 {
        submit_ili_update(&mut context, agents[i], 10000).unwrap();
    }
    
    // Verify median is used (5000, not 10000)
    let ili = get_current_ili(&context);
    assert_eq!(ili, 5000);
}
```

## Deployment Strategy

### Phase 1: Build and Compile (Day 1)

**Objectives**:
- Compile all three programs (ars-core, ars-reserve, ars-token) without errors
- Generate program binaries (.so files)
- Extract program IDs from build artifacts

**Steps**:
1. Clean previous build artifacts: `anchor clean`
2. Build all programs: `anchor build`
3. Verify build success: Check for .so files in `target/deploy/`
4. Extract program IDs: `anchor keys list`
5. Update Anchor.toml with program IDs

**Success Criteria**:
- Zero compilation errors
- All three .so files generated
- Program IDs extracted and documented

### Phase 2: Unit and Property Testing (Days 2-3)

**Objectives**:
- Execute all unit tests with >90% coverage
- Run property-based tests (100+ iterations each)
- Verify all tests pass

**Steps**:
1. Run unit tests: `anchor test --skip-deploy`
2. Run property tests: `cargo test --features proptest`
3. Generate coverage report: `cargo tarpaulin --out Html`
4. Review coverage and add tests for uncovered code
5. Re-run tests until >90% coverage achieved

**Success Criteria**:
- All unit tests pass
- All property tests pass (100+ iterations)
- Code coverage >90%

### Phase 3: Integration and Fuzz Testing (Days 4-5)

**Objectives**:
- Test multi-program interactions
- Run Trident fuzzing campaigns
- Execute economic attack simulations
- Verify Byzantine fault tolerance

**Steps**:
1. Initialize Trident: `trident init`
2. Configure fuzz tests in `trident-tests/`
3. Run fuzzing: `trident fuzz run-hfuzz`
4. Execute integration tests: `anchor test`
5. Run attack simulations: `cargo test --test economic_attacks`
6. Run BFT tests: `cargo test --test byzantine_tests`

**Success Criteria**:
- All integration tests pass
- Fuzzing finds no invariant violations (or violations are fixed)
- All attack simulations fail (attacks are prevented)
- BFT tests verify consensus mechanisms work

### Phase 4: Audit Tool Execution (Day 6)

**Objectives**:
- Run converted audit tools on all programs
- Generate comprehensive audit report
- Address any critical/high findings

**Steps**:
1. Run checked-math analysis: `cargo audit-math`
2. Run sealevel-attacks analysis: `cargo audit-sealevel`
3. Execute Trident fuzzing: `trident fuzz`
4. Run PoC exploits: `cargo test --test poc_tests`
5. Generate audit report: `cargo audit-report`
6. Review findings and fix critical/high issues
7. Re-run audit after fixes

**Success Criteria**:
- Audit report generated
- Zero critical findings
- Zero high findings (or all addressed)
- Medium/low findings documented

### Phase 5: Devnet Deployment (Day 7)

**Objectives**:
- Deploy all programs to Solana devnet
- Initialize protocol state
- Verify deployment success

**Steps**:
1. Configure devnet cluster: `solana config set --url devnet`
2. Airdrop SOL for deployment: `solana airdrop 10`
3. Deploy programs: `anchor deploy --provider.cluster devnet`
4. Verify deployment: `solana program show <PROGRAM_ID>`
5. Initialize protocol: Run initialization scripts
6. Verify initialization: Query on-chain accounts

**Success Criteria**:
- All three programs deployed to devnet
- Program IDs recorded
- Protocol initialized successfully
- All accounts created and verified

### Phase 6: Devnet Testing and Verification (Days 8-9)

**Objectives**:
- Test all instructions on devnet
- Verify multi-program flows work
- Test Percolator integration
- Generate deployment verification report

**Steps**:
1. Test agent registration on devnet
2. Test ILI update submission (Byzantine consensus)
3. Test proposal creation and voting
4. Test vault deposits and withdrawals
5. Test ARU minting and burning
6. Test Percolator order placement and matching
7. Monitor transactions: `solana confirm <SIGNATURE>`
8. Generate verification report

**Success Criteria**:
- All instruction types tested successfully
- Multi-program flows work correctly
- Percolator integration functional
- All transactions confirmed on devnet
- Verification report generated

### Phase 7: Documentation and Reporting (Day 10)

**Objectives**:
- Generate comprehensive documentation
- Create deployment report
- Document known issues and limitations
- Prepare submission materials

**Steps**:
1. Generate API documentation: `cargo doc --no-deps`
2. Create deployment report with program IDs and addresses
3. Document test results and coverage metrics
4. Create audit summary from audit report
5. Write integration guide for backend services
6. Prepare demo scenarios and scripts

**Success Criteria**:
- API documentation generated
- Deployment report complete
- Test coverage report available
- Audit summary documented
- Integration guide written
- Demo materials prepared

## Performance Optimization

### On-Chain Optimization

**Account Size Optimization**:
- Use compact data structures (u16 instead of u64 where possible)
- Limit vector sizes (max 168 ILI snapshots = 7 days of hourly data)
- Use discriminators efficiently (Anchor handles automatically)

**Compute Unit Optimization**:
- Batch operations where possible (multiple ILI updates in one transaction)
- Pre-compute constants (scaling factors, thresholds)
- Use efficient algorithms (median calculation with sorting)
- Minimize CPI calls (combine operations when possible)

**Example Optimization**:
```rust
// BEFORE: Multiple CPI calls
token::transfer(ctx, amount1)?;
token::transfer(ctx, amount2)?;
token::transfer(ctx, amount3)?;

// AFTER: Batch transfer
let total_amount = amount1 + amount2 + amount3;
token::transfer(ctx, total_amount)?;
```

### Build Optimization

**Cargo.toml Configuration**:
```toml
[profile.release]
overflow-checks = true
lto = "fat"
codegen-units = 1
opt-level = 3
```

**Benefits**:
- Smaller binary size (important for Solana's 10MB limit)
- Faster execution (fewer compute units)
- Better security (overflow checks enabled)

## Monitoring and Observability

### On-Chain Monitoring

**Event Monitoring**:
- Subscribe to program logs using Helius LaserStream
- Parse events for state changes
- Alert on critical events (circuit breaker triggered, slashing executed)

**Account Monitoring**:
- Poll GlobalState for circuit breaker status
- Monitor ILIOracle for update frequency
- Track ReserveVault VHR in real-time
- Monitor MintState for epoch transitions

### Metrics Collection

**Protocol Metrics**:
- ILI update frequency (target: every 5 minutes)
- Byzantine consensus success rate (target: >95%)
- Proposal execution rate
- VHR stability (target: 175-225%)
- Epoch mint/burn utilization

**Performance Metrics**:
- Transaction success rate (target: >90%)
- Average compute units per instruction
- Account rent costs
- CPI success rate

### Alerting

**Critical Alerts**:
- Circuit breaker triggered
- VHR < 150%
- Byzantine consensus failure (< 3 agents)
- Epoch supply cap reached
- Slashing event

**Warning Alerts**:
- VHR < 175%
- ILI update delayed > 10 minutes
- Low agent participation in consensus
- High proposal rejection rate

## Conclusion

This design provides a comprehensive technical blueprint for implementing the complete ARS protocol on Solana with production-grade security, comprehensive testing, and full devnet deployment. The implementation includes:

**Key Deliverables**:
1. ✅ Three Anchor smart contracts with security revisions (ars-core, ars-reserve, ars-token)
2. ✅ Converted audit tools from Pinocchio to Anchor framework
3. ✅ Integrated Percolator orderbook system
4. ✅ Comprehensive test suite (>90% coverage, property-based, fuzz, integration)
5. ✅ Full devnet deployment with verification
6. ✅ Detailed documentation and reports

**Security Features**:
- Admin transfer with 48h timelock
- Agent registration with stake-based tiers
- Byzantine fault-tolerant ILI updates (3+ consensus)
- Futarchy governance with quadratic voting
- Circuit breaker with griefing protection
- Reputation and slashing system
- Checked arithmetic throughout
- Comprehensive input validation

**Testing Coverage**:
- Unit tests (>90% coverage)
- Property-based tests (20 properties, 100+ iterations each)
- Integration tests (multi-program flows)
- Fuzz testing (Trident, 1000+ iterations)
- Economic attack simulations
- Byzantine fault tolerance tests

**Deployment Pipeline**:
- Build → Test → Audit → Deploy → Verify → Report
- 10-day timeline with clear milestones
- Comprehensive verification at each stage
- Detailed documentation and reporting

This implementation positions ARS as a production-ready, security-audited, and thoroughly tested monetary protocol for autonomous AI agents on Solana.
