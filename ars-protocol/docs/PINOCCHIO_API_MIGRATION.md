# Pinocchio API Migration Guide

## Overview

This guide provides a comprehensive reference for migrating from Anchor 0.30.1 to Pinocchio 0.10.1 in the ARS protocol. It covers all type changes, instruction patterns, and CPI modifications needed to update client code and integrations.

## Table of Contents

1. [Type Mappings](#type-mappings)
2. [Account Access Patterns](#account-access-patterns)
3. [Instruction Examples](#instruction-examples)
4. [CPI Changes](#cpi-changes)
5. [Error Handling](#error-handling)
6. [Common Patterns](#common-patterns)

---

## Type Mappings

### Core Type Changes

| Anchor Type | Pinocchio Type | Notes |
|-------------|----------------|-------|
| `AccountInfo<'a>` | `AccountView<'a>` | Account reference with lifetime |
| `Pubkey` | `Address` | 32-byte public key |
| `Account<'info, T>` | Manual validation + `AccountView` | No macro wrapper |
| `Program<'info, T>` | `AccountView` + program ID check | Manual validation required |
| `Signer<'info>` | `AccountView` + `is_signer()` | Manual signer check |
| `SystemProgram` | `pinocchio_system::ID` | Constant address |
| `TokenProgram` | `pinocchio_token::ID` | Constant address |
| `Clock` | `Clock::get()?` | Sysvar access |
| `Rent` | `Rent::get()?` | Sysvar access |

### Import Changes

**Before (Anchor)**:
```rust
use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint};
```

**After (Pinocchio)**:
```rust
use pinocchio::{
    account_info::AccountInfo as AccountView,
    entrypoint::ProgramResult,
    program_error::ProgramError,
    pubkey::Pubkey as Address,
    sysvars::{clock::Clock, rent::Rent},
};
use pinocchio_system::instructions::CreateAccount;
use pinocchio_token::{
    instructions::{Transfer, MintTo, Burn},
    state::{TokenAccount, Mint},
};
```

---

## Account Access Patterns

### Field Access vs Method Calls

Pinocchio uses method calls instead of direct field access for account properties.

**Before (Anchor)**:
```rust
pub fn process(ctx: Context<MyInstruction>) -> Result<()> {
    let account = &ctx.accounts.my_account;
    
    // Direct field access
    let key = account.key;
    let owner = account.owner;
    let is_signer = account.is_signer;
    let is_writable = account.is_writable;
    let lamports = account.lamports();
    let data = account.data.borrow();
    
    Ok(())
}
```

**After (Pinocchio)**:
```rust
pub fn process(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    let account = &accounts[0];
    
    // Method calls
    let key = account.key();
    let owner = account.owner();
    let is_signer = account.is_signer();
    let is_writable = account.is_writable();
    let lamports = account.lamports();
    let data = account.data();
    
    Ok(())
}
```

### Account Validation

**Before (Anchor)**:
```rust
#[derive(Accounts)]
pub struct MyInstruction<'info> {
    #[account(mut)]
    pub global_state: Account<'info, GlobalState>,
    
    #[account(signer)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
```

**After (Pinocchio)**:
```rust
pub fn process(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    // Manual account parsing
    let [global_state_account, authority_account, system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    
    // Manual validation
    validate_writable(global_state_account)?;
    validate_signer(authority_account)?;
    validate_program(system_program, &pinocchio_system::ID)?;
    
    Ok(())
}

// Validation helpers
fn validate_signer(account: &AccountView) -> Result<(), ProgramError> {
    if !account.is_signer() {
        return Err(ProgramError::MissingRequiredSignature);
    }
    Ok(())
}

fn validate_writable(account: &AccountView) -> Result<(), ProgramError> {
    if !account.is_writable() {
        return Err(ProgramError::InvalidAccountData);
    }
    Ok(())
}

fn validate_program(
    account: &AccountView,
    expected_program_id: &Address,
) -> Result<(), ProgramError> {
    if account.key() != expected_program_id {
        return Err(ProgramError::IncorrectProgramId);
    }
    Ok(())
}
```

### PDA Validation

**Before (Anchor)**:
```rust
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalState::LEN,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,
}
```

**After (Pinocchio)**:
```rust
pub fn initialize(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    let [global_state_account, authority_account, system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    
    // Validate PDA
    let seeds = &[b"global_state"];
    let (expected_address, bump) = Address::find_program_address(seeds, program_id);
    
    if global_state_account.key() != &expected_address {
        return Err(ProgramError::InvalidSeeds);
    }
    
    // Store bump for future use
    // ...
    
    Ok(())
}
```

---

## Instruction Examples

### Example 1: Update ILI

**Before (Anchor)**:
```rust
#[program]
pub mod ars_core {
    use super::*;
    
    pub fn update_ili(ctx: Context<UpdateILI>, new_ili_value: u64) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        
        // Check circuit breaker
        if global_state.circuit_breaker_active {
            let clock = Clock::get()?;
            if clock.unix_timestamp < global_state.circuit_breaker_until {
                return Err(ErrorCode::CircuitBreakerActive.into());
            }
            global_state.circuit_breaker_active = false;
        }
        
        // Update ILI
        global_state.ili_value = new_ili_value;
        global_state.last_ili_update = Clock::get()?.unix_timestamp;
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct UpdateILI<'info> {
    #[account(mut, has_one = authority)]
    pub global_state: Account<'info, GlobalState>,
    
    pub authority: Signer<'info>,
}
```

**After (Pinocchio)**:
```rust
pub fn update_ili(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    // Parse accounts
    let [global_state_account, authority_account] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    
    // Validate accounts
    validate_signer(authority_account)?;
    validate_writable(global_state_account)?;
    
    // Parse instruction data
    if data.len() < 8 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let new_ili_value = u64::from_le_bytes(data[0..8].try_into().unwrap());
    
    // Load and validate global state
    let mut global_state_data = global_state_account.data();
    let global_state = GlobalState::from_bytes_mut(&mut global_state_data)?;
    
    // Verify authority
    if global_state.authority != *authority_account.key() {
        return Err(ProgramError::InvalidAccountData);
    }
    
    // Check circuit breaker
    if global_state.circuit_breaker_active {
        let current_time = Clock::get()?.unix_timestamp;
        if current_time < global_state.circuit_breaker_until {
            return Err(CustomError::CircuitBreakerActive.into());
        }
        global_state.circuit_breaker_active = false;
    }
    
    // Update ILI
    global_state.ili_value = new_ili_value;
    global_state.last_ili_update = Clock::get()?.unix_timestamp;
    
    Ok(())
}
```

### Example 2: Vote on Proposal

**Before (Anchor)**:
```rust
pub fn vote_on_proposal(
    ctx: Context<VoteOnProposal>,
    proposal_id: u64,
    vote_yes: bool,
) -> Result<()> {
    let proposal = &mut ctx.accounts.proposal;
    let voter_stake = &ctx.accounts.voter_stake_account;
    
    // Check voting period
    let clock = Clock::get()?;
    require!(
        clock.unix_timestamp < proposal.voting_ends_at,
        ErrorCode::VotingPeriodEnded
    );
    
    // Get stake amount
    let stake_amount = voter_stake.amount;
    
    // Apply quadratic staking
    let vote_weight = (stake_amount as f64).sqrt() as u64;
    
    // Update votes
    if vote_yes {
        proposal.yes_votes = proposal.yes_votes.checked_add(vote_weight).unwrap();
    } else {
        proposal.no_votes = proposal.no_votes.checked_add(vote_weight).unwrap();
    }
    
    Ok(())
}

#[derive(Accounts)]
pub struct VoteOnProposal<'info> {
    #[account(mut)]
    pub proposal: Account<'info, Proposal>,
    
    pub voter: Signer<'info>,
    
    pub voter_stake_account: Account<'info, TokenAccount>,
}
```

**After (Pinocchio)**:
```rust
pub fn vote_on_proposal(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    // Parse accounts
    let [proposal_account, voter_account, voter_stake_account] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    
    // Validate accounts
    validate_signer(voter_account)?;
    validate_writable(proposal_account)?;
    
    // Parse instruction data
    if data.len() < 9 {
        return Err(ProgramError::InvalidInstructionData);
    }
    let proposal_id = u64::from_le_bytes(data[0..8].try_into().unwrap());
    let vote_yes = data[8] != 0;
    
    // Load proposal
    let mut proposal_data = proposal_account.data();
    let proposal = Proposal::from_bytes_mut(&mut proposal_data)?;
    
    // Verify proposal ID
    if proposal.id != proposal_id {
        return Err(CustomError::InvalidProposal.into());
    }
    
    // Check voting period
    let current_time = Clock::get()?.unix_timestamp;
    if current_time >= proposal.voting_ends_at {
        return Err(CustomError::VotingPeriodEnded.into());
    }
    
    // Get stake amount
    let stake_data = voter_stake_account.data();
    let stake_amount = u64::from_le_bytes(stake_data[0..8].try_into().unwrap());
    
    // Apply quadratic staking
    let vote_weight = sqrt_u64(stake_amount);
    
    // Update votes
    if vote_yes {
        proposal.yes_votes = proposal.yes_votes
            .checked_add(vote_weight)
            .ok_or(ProgramError::ArithmeticOverflow)?;
    } else {
        proposal.no_votes = proposal.no_votes
            .checked_add(vote_weight)
            .ok_or(ProgramError::ArithmeticOverflow)?;
    }
    
    Ok(())
}
```

### Example 3: Initialize Vault

**Before (Anchor)**:
```rust
pub fn initialize_vault(ctx: Context<InitializeVault>) -> Result<()> {
    let vault = &mut ctx.accounts.vault;
    
    vault.authority = ctx.accounts.authority.key();
    vault.sol_amount = 0;
    vault.usdc_amount = 0;
    vault.msol_amount = 0;
    vault.jitosol_amount = 0;
    vault.vhr = 0;
    vault.last_rebalance = Clock::get()?.unix_timestamp;
    vault.rebalance_threshold = 50_000_000_000_000_000; // 5% = 0.05 * 10^18
    vault.bump = *ctx.bumps.get("vault").unwrap();
    
    Ok(())
}

#[derive(Accounts)]
pub struct InitializeVault<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + Vault::LEN,
        seeds = [b"vault"],
        bump
    )]
    pub vault: Account<'info, Vault>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
```

**After (Pinocchio)**:
```rust
pub fn initialize_vault(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    let [vault_account, authority_account, system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    
    validate_signer(authority_account)?;
    validate_program(system_program, &pinocchio_system::ID)?;
    
    // Calculate rent
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(Vault::LEN);
    
    // Derive PDA
    let seeds = &[b"vault"];
    let (pda, bump) = Address::find_program_address(seeds, program_id);
    
    if vault_account.key() != &pda {
        return Err(ProgramError::InvalidSeeds);
    }
    
    // CPI: Create account
    CreateAccount {
        from: authority_account,
        to: vault_account,
        lamports,
        space: Vault::LEN as u64,
        owner: program_id,
    }.invoke_signed(&[&[b"vault", &[bump]]])?;
    
    // Initialize vault state
    let mut vault_data = vault_account.data();
    let vault = Vault::from_bytes_mut(&mut vault_data)?;
    
    vault.authority = *authority_account.key();
    vault.sol_amount = 0;
    vault.usdc_amount = 0;
    vault.msol_amount = 0;
    vault.jitosol_amount = 0;
    vault.vhr = 0;
    vault.last_rebalance = Clock::get()?.unix_timestamp;
    vault.rebalance_threshold = 50_000_000_000_000_000; // 5%
    vault.bump = bump;
    
    Ok(())
}
```

---

## CPI Changes

### Token Transfer

**Before (Anchor)**:
```rust
use anchor_spl::token::{self, Transfer};

pub fn deposit(ctx: Context<Deposit>, amount: u64) -> Result<()> {
    // CPI to token program
    let cpi_accounts = Transfer {
        from: ctx.accounts.user_token_account.to_account_info(),
        to: ctx.accounts.vault_token_account.to_account_info(),
        authority: ctx.accounts.user_authority.to_account_info(),
    };
    
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    token::transfer(cpi_ctx, amount)?;
    
    Ok(())
}
```

**After (Pinocchio)**:
```rust
use pinocchio_token::instructions::Transfer;

pub fn deposit(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    let [
        vault_account,
        user_token_account,
        vault_token_account,
        user_authority,
        token_program,
    ] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    
    // Parse amount
    let amount = u64::from_le_bytes(data[0..8].try_into().unwrap());
    
    // Validate accounts
    validate_signer(user_authority)?;
    validate_writable(vault_token_account)?;
    validate_program(token_program, &pinocchio_token::ID)?;
    
    // CPI: Transfer tokens
    Transfer {
        from: user_token_account,
        to: vault_token_account,
        authority: user_authority,
    }.invoke()?;
    
    // Update vault state
    let mut vault_data = vault_account.data();
    let vault = Vault::from_bytes_mut(&mut vault_data)?;
    vault.usdc_amount = vault.usdc_amount
        .checked_add(amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    
    Ok(())
}
```

### Token Mint

**Before (Anchor)**:
```rust
use anchor_spl::token::{self, MintTo};

pub fn mint_icu(ctx: Context<MintICU>, amount: u64) -> Result<()> {
    let mint_state = &mut ctx.accounts.mint_state;
    
    // Check supply cap
    let new_supply = mint_state.total_supply.checked_add(amount).unwrap();
    require!(new_supply <= mint_state.supply_cap, ErrorCode::SupplyCapExceeded);
    
    // CPI to mint tokens
    let cpi_accounts = MintTo {
        mint: ctx.accounts.mint.to_account_info(),
        to: ctx.accounts.destination.to_account_info(),
        authority: ctx.accounts.mint_authority.to_account_info(),
    };
    
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    
    token::mint_to(cpi_ctx, amount)?;
    
    mint_state.total_supply = new_supply;
    
    Ok(())
}
```

**After (Pinocchio)**:
```rust
use pinocchio_token::instructions::MintTo;

pub fn mint_icu(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    let [
        mint_state_account,
        mint_account,
        destination_account,
        mint_authority,
        token_program,
    ] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    
    // Parse amount
    let amount = u64::from_le_bytes(data[0..8].try_into().unwrap());
    
    // Validate accounts
    validate_signer(mint_authority)?;
    validate_writable(mint_state_account)?;
    validate_writable(mint_account)?;
    validate_writable(destination_account)?;
    validate_program(token_program, &pinocchio_token::ID)?;
    
    // Load mint state
    let mut mint_state_data = mint_state_account.data();
    let mint_state = MintState::from_bytes_mut(&mut mint_state_data)?;
    
    // Check supply cap
    let new_supply = mint_state.total_supply
        .checked_add(amount)
        .ok_or(ProgramError::ArithmeticOverflow)?;
    
    if new_supply > mint_state.supply_cap {
        return Err(CustomError::SupplyCapExceeded.into());
    }
    
    // CPI: Mint tokens
    MintTo {
        mint: mint_account,
        to: destination_account,
        authority: mint_authority,
    }.invoke()?;
    
    // Update supply
    mint_state.total_supply = new_supply;
    
    Ok(())
}
```

### System Program Account Creation

**Before (Anchor)**:
```rust
// Handled automatically by #[account(init)] macro
#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = 8 + GlobalState::LEN,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
```

**After (Pinocchio)**:
```rust
use pinocchio_system::instructions::CreateAccount;

pub fn initialize(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    let [global_state_account, authority_account, system_program] = accounts else {
        return Err(ProgramError::NotEnoughAccountKeys);
    };
    
    validate_signer(authority_account)?;
    validate_program(system_program, &pinocchio_system::ID)?;
    
    // Calculate rent
    let rent = Rent::get()?;
    let lamports = rent.minimum_balance(GlobalState::LEN);
    
    // Derive PDA
    let seeds = &[b"global_state"];
    let (pda, bump) = Address::find_program_address(seeds, program_id);
    
    if global_state_account.key() != &pda {
        return Err(ProgramError::InvalidSeeds);
    }
    
    // CPI: Create account
    CreateAccount {
        from: authority_account,
        to: global_state_account,
        lamports,
        space: GlobalState::LEN as u64,
        owner: program_id,
    }.invoke_signed(&[&[b"global_state", &[bump]]])?;
    
    // Initialize state
    let mut state_data = global_state_account.data();
    let state = GlobalState::from_bytes_mut(&mut state_data)?;
    
    state.authority = *authority_account.key();
    state.bump = bump;
    state.ili_value = 0;
    state.icr_value = 0;
    state.circuit_breaker_active = false;
    state.proposal_count = 0;
    
    Ok(())
}
```

---

## Error Handling

### Error Definition

**Before (Anchor)**:
```rust
#[error_code]
pub enum ErrorCode {
    #[msg("Invalid authority")]
    InvalidAuthority,
    
    #[msg("Insufficient funds")]
    InsufficientFunds,
    
    #[msg("Circuit breaker is active")]
    CircuitBreakerActive,
}
```

**After (Pinocchio)**:
```rust
use pinocchio::program_error::ProgramError;

#[repr(u32)]
pub enum CustomError {
    InvalidAuthority = 6000,
    InsufficientFunds = 6001,
    CircuitBreakerActive = 6002,
}

impl From<CustomError> for ProgramError {
    fn from(e: CustomError) -> Self {
        ProgramError::Custom(e as u32)
    }
}
```

### Error Usage

**Before (Anchor)**:
```rust
if !is_valid {
    return Err(ErrorCode::InvalidAuthority.into());
}

require!(condition, ErrorCode::InsufficientFunds);
```

**After (Pinocchio)**:
```rust
if !is_valid {
    return Err(CustomError::InvalidAuthority.into());
}

if !condition {
    return Err(CustomError::InsufficientFunds.into());
}
```

---

## Common Patterns

### Pattern 1: Account Deserialization

**Before (Anchor)**:
```rust
let global_state = &ctx.accounts.global_state;
// Anchor handles deserialization automatically
```

**After (Pinocchio)**:
```rust
let global_state_data = global_state_account.data();
let global_state = GlobalState::from_bytes(&global_state_data)?;

// For mutable access:
let mut global_state_data = global_state_account.data();
let global_state = GlobalState::from_bytes_mut(&mut global_state_data)?;
```

### Pattern 2: Checked Arithmetic

**Before (Anchor)**:
```rust
let result = a.checked_add(b).unwrap();
```

**After (Pinocchio)**:
```rust
let result = a.checked_add(b)
    .ok_or(ProgramError::ArithmeticOverflow)?;
```

### Pattern 3: Sysvar Access

**Before (Anchor)**:
```rust
let clock = Clock::get()?;
let timestamp = clock.unix_timestamp;

let rent = Rent::get()?;
let min_balance = rent.minimum_balance(size);
```

**After (Pinocchio)**:
```rust
// Same pattern - no changes needed
let clock = Clock::get()?;
let timestamp = clock.unix_timestamp;

let rent = Rent::get()?;
let min_balance = rent.minimum_balance(size);
```

### Pattern 4: Entry Point

**Before (Anchor)**:
```rust
#[program]
pub mod ars_core {
    use super::*;
    
    pub fn initialize(ctx: Context<Initialize>) -> Result<()> {
        // ...
    }
}
```

**After (Pinocchio)**:
```rust
#[no_mangle]
pub unsafe extern "C" fn entrypoint(input: *mut u8) -> u64 {
    let (program_id, accounts, instruction_data) = unsafe {
        pinocchio::entrypoint::parse_input(input)
    };
    
    match process_instruction(program_id, accounts, instruction_data) {
        Ok(()) => 0,
        Err(e) => e.into(),
    }
}

fn process_instruction(
    program_id: &Address,
    accounts: &[AccountView],
    data: &[u8],
) -> Result<(), ProgramError> {
    let instruction = data.get(0).ok_or(ProgramError::InvalidInstructionData)?;
    
    match instruction {
        0 => instructions::initialize(program_id, accounts, &data[1..]),
        1 => instructions::update_ili(program_id, accounts, &data[1..]),
        // ... other instructions
        _ => Err(ProgramError::InvalidInstructionData),
    }
}
```

---

## Migration Checklist

- [ ] Update `Cargo.toml` dependencies (remove Anchor, add Pinocchio)
- [ ] Replace all `AccountInfo` with `AccountView`
- [ ] Replace all `Pubkey` with `Address`
- [ ] Convert field access to method calls (`.key`, `.owner`, etc.)
- [ ] Implement manual account validation (replace `#[derive(Accounts)]`)
- [ ] Update CPI calls to use Pinocchio instruction builders
- [ ] Convert error enums to use `ProgramError::Custom`
- [ ] Implement entry point with `process_instruction` dispatcher
- [ ] Add manual PDA validation where needed
- [ ] Update all imports to use Pinocchio crates
- [ ] Test all instructions with existing clients
- [ ] Verify error codes match Anchor implementation

---

## Additional Resources

- [Pinocchio Documentation](https://github.com/febo/pinocchio)
- [Pinocchio Examples](https://github.com/febo/pinocchio/tree/main/programs)
- [ARS Design Document](./PINOCCHIO_DEVELOPMENT.md)
- [Migration Status](./MIGRATION_STATUS.md)

---

## Support

For questions or issues during migration:
1. Check the [Migration Status](./MIGRATION_STATUS.md) document
2. Review the [Design Document](./PINOCCHIO_DEVELOPMENT.md)
3. Consult existing Pinocchio program examples in the codebase
4. Open an issue in the ARS repository

