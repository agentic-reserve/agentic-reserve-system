---
name: solana-core-concepts
version: 1.0.0
description: Solana blockchain core concepts and best practices for ARS protocol development
tags: [solana, blockchain, security, development]
---

# Solana Core Concepts for ARS Protocol

## Overview

This skill provides essential Solana blockchain concepts and best practices specifically applied to the Agentic Reserve System (ARS) protocol development.

## Core Concepts

### 1. Accounts Model

**Key Points:**
- All data on Solana is stored in accounts (key-value structure)
- Accounts have: lamports (balance), data, owner, executable flag
- Rent-exempt requirement: 2 years of storage costs upfront
- Account size calculation: discriminator (8) + data fields

**ARS Implementation:**
- `ReserveVault`: 8 + 32 + 32 + 32 + 8 + 8 + 2 + 8 + 2 + 1 + 1 = 142 bytes
- `PolicyProposal`: 8 + 8 + 32 + 1 + 260 + 8 + 8 + 8 + 8 + 1 + 65 + 8 + 1 = 416 bytes
- `VoteRecord`: 8 + 32 + 32 + 8 + 1 + 8 + 1 + 64 + 1 = 155 bytes

### 2. Program Derived Addresses (PDAs)

**Key Points:**
- Deterministic addresses derived from: Program ID + Seeds + Bump
- No private key (only program can sign)
- Used for program-owned accounts
- Always validate bump seed (use canonical bump)

**ARS Implementation:**
```rust
// Vault PDA
seeds = [b"vault"]
bump = vault.bump

// Proposal PDA
seeds = [b"proposal", &proposal_id.to_le_bytes()]
bump = proposal.bump

// Vote Record PDA
seeds = [b"vote", proposal.key().as_ref(), agent.key().as_ref()]
bump = vote_record.bump
```

**Security:**
- ✅ Always store bump in account state
- ✅ Validate PDA derivation on every use
- ✅ Use `find_program_address` for canonical bump
- ❌ Never trust client-provided PDAs without validation

### 3. Cross Program Invocation (CPI)

**Key Points:**
- One program calling another program's instruction
- Enables composability (DeFi legos)
- Use `invoke()` for regular CPI, `invoke_signed()` for PDA signers
- Always validate accounts before CPI

**ARS Implementation:**
```rust
// CPI to SPL Token (withdraw with PDA signer)
let seeds = &[VAULT_SEED, &[vault.bump]];
let signer = &[&seeds[..]];

let cpi_accounts = Transfer {
    from: vault_token_account.to_account_info(),
    to: recipient_token_account.to_account_info(),
    authority: vault.to_account_info(),
};

let cpi_ctx = CpiContext::new_with_signer(
    token_program.to_account_info(),
    cpi_accounts,
    signer
);

token::transfer(cpi_ctx, amount)?;
```

**Security Checklist:**
- ✅ Validate program ID matches expected
- ✅ Validate account ownership
- ✅ Check account is not closed (lamports > 0)
- ✅ Validate CPI results
- ✅ Use slippage protection for swaps

### 4. Transactions & Instructions

**Key Points:**
- Transaction = Signatures + Message
- Message = Header + Account Keys + Recent Blockhash + Instructions
- Max transaction size: 1232 bytes
- Blockhash expires after 150 blocks (~1 minute)
- Atomic execution (all-or-nothing)

**Account Ordering:**
1. Signer + Writable
2. Signer + Read-only
3. Not signer + Writable
4. Not signer + Read-only

**ARS Optimization:**
- Batch multiple operations in single transaction
- Use lookup tables for large transactions
- Optimize account ordering to reduce compute

### 5. Reentrancy Protection

**Problem:**
- Malicious contracts can call back during execution
- Can manipulate state before first call completes

**ARS Solution:**
```rust
// Manual lock management (due to Rust borrow checker)
pub struct ReentrancyGuard {}

impl ReentrancyGuard {
    pub fn acquire(locked: &mut bool) -> Result<Self> {
        if *locked {
            return err!(ReserveError::ReentrancyDetected);
        }
        *locked = true;
        Ok(Self {})
    }
    
    pub fn release(locked: &mut bool) {
        *locked = false;
    }
}

// Usage in instructions
let _guard = ReentrancyGuard::acquire(&mut vault.locked)?;
// ... perform operations ...
ReentrancyGuard::release(&mut vault.locked);
```

**Applied to:**
- ✅ deposit.rs
- ✅ withdraw.rs
- ✅ rebalance.rs

### 6. Slippage Protection

**Problem:**
- Price can change between transaction creation and execution
- MEV bots can front-run transactions
- Need to protect against excessive slippage

**ARS Solution:**
```rust
pub struct SlippageConfig {
    pub max_slippage_bps: u16,  // 50 = 0.5%
    pub min_output_amount: u64,
}

impl SlippageConfig {
    pub fn new(input_amount: u64, expected_rate: u64) -> Self {
        let expected_output = (input_amount as u128 * expected_rate as u128) / 1_000_000;
        let min_output = expected_output * (10000 - 50) / 10000;
        
        Self {
            max_slippage_bps: 50,
            min_output_amount: min_output as u64,
        }
    }
    
    pub fn validate_output(&self, actual_output: u64) -> Result<()> {
        require!(
            actual_output >= self.min_output_amount,
            ReserveError::SlippageExceeded
        );
        Ok(())
    }
}
```

### 7. Rate Limiting

**Problem:**
- Spam attacks can drain resources
- Need to prevent excessive operations

**ARS Solution:**
```rust
// Minimum 1 hour between rebalances
let min_rebalance_interval = 3600;
require!(
    clock.unix_timestamp >= vault.last_rebalance + min_rebalance_interval,
    ReserveError::RebalanceTooFrequent
);
```

## Security Best Practices

### Account Validation
```rust
// Validate owner
#[account(
    mut,
    constraint = vault_token_account.owner == vault.key() @ ReserveError::InvalidAccountOwner
)]
pub vault_token_account: Account<'info, TokenAccount>,

// Validate mint
#[account(
    mut,
    constraint = depositor_token_account.mint == vault_token_account.mint @ ReserveError::InvalidAmount
)]
pub depositor_token_account: Account<'info, TokenAccount>,
```

### Arithmetic Safety
```rust
// Always use checked operations
vault.total_value_usd = vault.total_value_usd
    .checked_add(amount)
    .ok_or(ReserveError::ArithmeticOverflow)?;

// Use u128 for intermediate calculations
let new_vhr = ((new_total_value as u128 * 10000) / vault.liabilities_usd as u128) as u16;
```

### PDA Validation
```rust
pub fn validate_pda(
    account: &Pubkey,
    seeds: &[&[u8]],
    bump: u8,
    program_id: &Pubkey,
) -> Result<()> {
    let (expected_pda, expected_bump) = Pubkey::find_program_address(seeds, program_id);
    
    require!(
        account == &expected_pda && bump == expected_bump,
        ReserveError::InvalidPDA
    );
    
    Ok(())
}
```

## Integration Points

### Jupiter Aggregator (Planned)
- Swap execution for vault rebalancing
- Multi-hop routing for optimal prices
- Slippage protection integration

### Pyth Oracle
- Real-time price feeds
- Account validation before reading
- Confidence interval checking

### Sipher Privacy Layer (Collaboration)
- Shielded transactions for ARU transfers
- Private governance voting
- MEV protection for vault operations
- Selective disclosure for compliance

## Performance Considerations

### Compute Units
- Reentrancy guards: +~200 CU per operation
- Account validation: +~100 CU per constraint
- Logging: +~50 CU per msg!()
- Total impact: <1% increase (acceptable)

### Transaction Size
- No significant impact
- All validations happen on-chain
- No additional accounts required

## Testing Strategy

### Unit Tests
```rust
#[cfg(test)]
mod tests {
    use super::*;
    
    #[test]
    fn test_reentrancy_guard() {
        let mut locked = false;
        let _guard = ReentrancyGuard::acquire(&mut locked);
        assert!(locked);
        
        // Should fail on double acquire
        let result = ReentrancyGuard::acquire(&mut locked);
        assert!(result.is_err());
    }
    
    #[test]
    fn test_slippage_config() {
        let config = SlippageConfig::new(1_000_000, 1_000_000);
        assert!(config.validate_output(995_000).is_ok());
        assert!(config.validate_output(994_999).is_err());
    }
}
```

### Integration Tests
- Test on devnet with real transactions
- Verify reentrancy protection with malicious contracts
- Test CPI calls with Jupiter
- Validate PDA derivations with fuzzing

## References

### Official Documentation
- [Solana Core Concepts](https://solana.com/docs/core)
- [Anchor CPI Guide](https://solana.com/docs/programs/anchor/cpi)
- [PDA Documentation](https://solana.com/docs/core/pda)
- [Transactions](https://solana.com/docs/core/transactions)

### Security Research
- [Asymmetric Research - CPI Security](https://www.asymmetric.re/blog/invocation-security-navigating-vulnerabilities-in-solana-cpis)
- [Neodyme - PDA Vulnerabilities](https://blog.neodyme.io/posts/solana_core_1/)
- [Sec3 - PDA Bump Validation](https://sec3.dev/blog/pda-bump-seeds)

### Implementation Files
- `programs/ars-reserve/src/utils/security.rs` - Security utilities
- `programs/ars-reserve/src/utils/cpi_helpers.rs` - CPI helpers
- `documentation/SOLANA_CORE_IMPROVEMENTS.md` - Detailed documentation

## Status

**Implementation**: ✅ COMPLETE
**Build Status**: ✅ SUCCESS (0 errors)
**Testing**: 🔄 IN PROGRESS
**Deployment**: ⏳ PENDING

## Next Actions

1. Run comprehensive unit tests
2. Deploy to devnet for integration testing
3. Security audit by external firm
4. Complete Jupiter integration
5. Integrate Sipher privacy layer
6. Mainnet deployment preparation
