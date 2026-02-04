# Security Fix Implementation Plan

**Project:** Internet Capital Bank (ICB)  
**Date:** February 4, 2026  
**Status:** Pre-Mainnet Security Hardening  
**Timeline:** 3-4 days (Priority 1 & 2 fixes)

---

## Overview

This document outlines the implementation plan to address all 10 security vulnerabilities identified in the security audit. Fixes are prioritized by severity and impact.

---

## PHASE 1: CRITICAL FIXES (Day 1-2) ⛔

### Fix #1: Proposal ID Collision

**File:** `programs/icb-core/src/instructions/create_proposal.rs`  
**File:** `programs/icb-core/src/state.rs`

**Changes:**

1. Add `proposal_counter` to `GlobalState`:
```rust
pub struct GlobalState {
    pub authority: Pubkey,
    pub ili_oracle: Pubkey,
    pub reserve_vault: Pubkey,
    pub icu_mint: Pubkey,
    pub epoch_duration: i64,
    pub mint_burn_cap_bps: u16,
    pub stability_fee_bps: u16,
    pub vhr_threshold: u16,
    pub circuit_breaker_active: bool,
    pub proposal_counter: u64,  // NEW: Monotonic counter
    pub bump: u8,
}
```

2. Update `create_proposal` handler:
```rust
pub fn handler(
    ctx: Context<CreateProposal>,
    policy_type: PolicyType,
    policy_params: Vec<u8>,
    duration: i64,
) -> Result<()> {
    let global_state = &mut ctx.accounts.global_state;
    let proposal = &mut ctx.accounts.proposal;
    let clock = Clock::get()?;
    
    // Use monotonic counter instead of timestamp
    let proposal_id = global_state.proposal_counter;
    global_state.proposal_counter = proposal_id
        .checked_add(1)
        .ok_or(ICBError::CounterOverflow)?;
    
    proposal.id = proposal_id;
    proposal.proposer = ctx.accounts.proposer.key();
    proposal.policy_type = policy_type;
    proposal.pol