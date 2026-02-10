use anchor_lang::prelude::*;
use crate::state::{AgentTier, PolicyType};

#[event]
pub struct ProtocolInitialized {
    pub authority: Pubkey,
    pub epoch_duration: i64,
    pub timestamp: i64,
}

#[event]
pub struct AdminTransferInitiated {
    pub old_authority: Pubkey,
    pub new_authority: Pubkey,
    pub timelock_expires: i64,
}

#[event]
pub struct AdminTransferExecuted {
    pub new_authority: Pubkey,
    pub timestamp: i64,
}

#[event]
pub struct AgentRegistered {
    pub agent: Pubkey,
    pub tier: AgentTier,
    pub stake_amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct ILIUpdated {
    pub ili_value: u64,
    pub consensus_agents: u8,
    pub timestamp: i64,
}

#[event]
pub struct ProposalCreated {
    pub proposal_id: u64,
    pub proposer: Pubkey,
    pub policy_type: PolicyType,
    pub timestamp: i64,
}

#[event]
pub struct VoteCast {
    pub proposal_id: u64,
    pub agent: Pubkey,
    pub vote_yes: bool,
    pub stake_amount: u64,
    pub voting_power: u64,
}

#[event]
pub struct CircuitBreakerTriggered {
    pub agent: Pubkey,
    pub reason: String,
    pub timelock_expires: i64,
}

#[event]
pub struct AgentSlashed {
    pub agent: Pubkey,
    pub slash_amount: u64,
    pub reason: String,
    pub new_reputation: i32,
}

// Percolator Integration Events

#[event]
pub struct PercolatorAllocation {
    pub user_idx: u16,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct PercolatorWithdrawal {
    pub user_idx: u16,
    pub amount: u64,
    pub timestamp: i64,
}

#[event]
pub struct PercolatorOracleUpdate {
    pub ili_value: u64,
    pub price_e6: u64,
    pub timestamp: i64,
}

#[event]
pub struct PercolatorTradeEvent {
    pub agent: Pubkey,
    pub user_idx: u16,
    pub lp_idx: u16,
    pub size: i128,
    pub timestamp: i64,
}
