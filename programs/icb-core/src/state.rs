use anchor_lang::prelude::*;

/// Global state for the ICB protocol
#[account]
pub struct GlobalState {
    pub authority: Pubkey,
    pub ili_oracle: Pubkey,
    pub reserve_vault: Pubkey,
    pub icu_mint: Pubkey,
    pub epoch_duration: i64,        // 24 hours in seconds
    pub mint_burn_cap_bps: u16,     // 200 = 2%
    pub stability_fee_bps: u16,     // 10 = 0.1%
    pub vhr_threshold: u16,         // 15000 = 150%
    pub circuit_breaker_active: bool,
    pub proposal_counter: u64,      // FIX #1: Monotonic counter for proposal IDs
    pub circuit_breaker_requested_at: i64, // FIX #7: Timelock for circuit breaker
    pub last_update_slot: u64,      // FIX #9: Slot-based validation
    pub bump: u8,
}

impl GlobalState {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        32 + // ili_oracle
        32 + // reserve_vault
        32 + // icu_mint
        8 +  // epoch_duration
        2 +  // mint_burn_cap_bps
        2 +  // stability_fee_bps
        2 +  // vhr_threshold
        1 +  // circuit_breaker_active
        8 +  // proposal_counter (FIX #1)
        8 +  // circuit_breaker_requested_at (FIX #7)
        8 +  // last_update_slot (FIX #9)
        1;   // bump
}

/// ILI Oracle account
#[account]
pub struct ILIOracle {
    pub authority: Pubkey,
    pub current_ili: u64,           // Scaled by 1e6
    pub last_update: i64,
    pub update_interval: i64,       // 300 seconds (5 min)
    pub snapshot_count: u16,
    pub last_update_slot: u64,      // FIX #9: Slot-based validation
    pub bump: u8,
}

impl ILIOracle {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        8 +  // current_ili
        8 +  // last_update
        8 +  // update_interval
        2 +  // snapshot_count
        8 +  // last_update_slot (FIX #9)
        1;   // bump
}

/// ILI snapshot for historical data
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct ILISnapshot {
    pub timestamp: i64,
    pub ili_value: u64,
    pub avg_yield: u32,             // Basis points
    pub volatility: u32,            // Basis points
    pub tvl: u64,                   // USD scaled by 1e6
}

/// Policy proposal account
#[account]
pub struct PolicyProposal {
    pub id: u64,
    pub proposer: Pubkey,
    pub policy_type: PolicyType,
    pub policy_params: Vec<u8>,     // Serialized params
    pub start_time: i64,
    pub end_time: i64,
    pub yes_stake: u64,
    pub no_stake: u64,
    pub status: ProposalStatus,
    pub execution_tx: Option<[u8; 64]>,
    pub passed_at: i64,             // FIX #3: Track when proposal passed for execution delay
    pub bump: u8,
}

impl PolicyProposal {
    pub const MAX_PARAMS_LEN: usize = 256;
    pub const LEN: usize = 8 + // discriminator
        8 +  // id
        32 + // proposer
        1 +  // policy_type
        4 + Self::MAX_PARAMS_LEN + // policy_params (vec)
        8 +  // start_time
        8 +  // end_time
        8 +  // yes_stake
        8 +  // no_stake
        1 +  // status
        1 + 64 + // execution_tx (option + signature)
        8 +  // passed_at (FIX #3)
        1;   // bump
}

/// Policy type enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum PolicyType {
    MintICU,
    BurnICU,
    UpdateICR,
    RebalanceVault,
}

/// Proposal status enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum ProposalStatus {
    Active,
    Passed,
    Failed,
    Executed,
    Cancelled,
}

/// Vote record account
#[account]
pub struct VoteRecord {
    pub proposal: Pubkey,
    pub agent: Pubkey,              // Agent public key
    pub stake_amount: u64,
    pub prediction: bool,           // true = YES, false = NO
    pub timestamp: i64,
    pub claimed: bool,
    pub agent_signature: [u8; 64],  // Ed25519 signature
    pub bump: u8,
}

impl VoteRecord {
    pub const LEN: usize = 8 + // discriminator
        32 + // proposal
        32 + // agent
        8 +  // stake_amount
        1 +  // prediction
        8 +  // timestamp
        1 +  // claimed
        64 + // agent_signature
        1;   // bump
}

/// Agent registry account
#[account]
pub struct AgentRegistry {
    pub agent_pubkey: Pubkey,
    pub agent_type: AgentType,
    pub total_transactions: u64,
    pub total_volume: u64,
    pub reputation_score: u32,
    pub registered_at: i64,
    pub last_active: i64,
    pub bump: u8,
}

impl AgentRegistry {
    pub const LEN: usize = 8 + // discriminator
        32 + // agent_pubkey
        1 +  // agent_type
        8 +  // total_transactions
        8 +  // total_volume
        4 +  // reputation_score
        8 +  // registered_at
        8 +  // last_active
        1;   // bump
}

/// Agent type enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, PartialEq)]
pub enum AgentType {
    LendingAgent,
    YieldAgent,
    LiquidityAgent,
    PredictionAgent,
    ArbitrageAgent,
    TreasuryAgent,
}
