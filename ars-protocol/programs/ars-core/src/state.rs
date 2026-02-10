use anchor_lang::prelude::*;

/// Global state for the ARS protocol with admin transfer and circuit breaker
#[account]
pub struct GlobalState {
    /// Current admin authority
    pub authority: Pubkey,
    /// Pending admin transfer (None if no transfer in progress)
    pub pending_authority: Option<Pubkey>,
    /// Timelock timestamp for admin transfer (48 hours)
    pub transfer_timelock: i64,
    /// ILI oracle account
    pub ili_oracle: Pubkey,
    /// Reserve vault account
    pub reserve_vault: Pubkey,
    /// ARU mint account
    pub aru_mint: Pubkey,
    /// Epoch duration in seconds
    pub epoch_duration: i64,
    /// Mint/burn cap in basis points
    pub mint_burn_cap_bps: u16,
    /// Stability fee in basis points
    pub stability_fee_bps: u16,
    /// VHR threshold in basis points
    pub vhr_threshold: u16,
    /// Circuit breaker active flag
    pub circuit_breaker_active: bool,
    /// Circuit breaker timelock (24 hours)
    pub circuit_breaker_timelock: i64,
    /// Minimum agent consensus (default 3)
    pub min_agent_consensus: u8,
    /// Proposal counter for unique IDs
    pub proposal_counter: u64,
    /// Last update slot
    pub last_update_slot: u64,
    /// PDA bump
    pub bump: u8,
}

impl GlobalState {
    /// Calculate space needed for GlobalState account
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        (1 + 32) + // pending_authority (Option<Pubkey>)
        8 + // transfer_timelock
        32 + // ili_oracle
        32 + // reserve_vault
        32 + // aru_mint
        8 + // epoch_duration
        2 + // mint_burn_cap_bps
        2 + // stability_fee_bps
        2 + // vhr_threshold
        1 + // circuit_breaker_active
        8 + // circuit_breaker_timelock
        1 + // min_agent_consensus
        8 + // proposal_counter
        8 + // last_update_slot
        1; // bump
}

/// Agent tier based on stake amount
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum AgentTier {
    /// 100-999 ARU staked
    Bronze,
    /// 1,000-9,999 ARU staked
    Silver,
    /// 10,000-99,999 ARU staked
    Gold,
    /// 100,000+ ARU staked
    Platinum,
}

impl AgentTier {
    /// Calculate tier from stake amount (in lamports, 6 decimals)
    pub fn from_stake(stake_amount: u64) -> Self {
        if stake_amount >= 100_000_000_000_000 {
            // 100,000 ARU
            AgentTier::Platinum
        } else if stake_amount >= 10_000_000_000_000 {
            // 10,000 ARU
            AgentTier::Gold
        } else if stake_amount >= 1_000_000_000_000 {
            // 1,000 ARU
            AgentTier::Silver
        } else {
            // 100-999 ARU
            AgentTier::Bronze
        }
    }
}

/// Agent registry with tier, stake, and reputation
#[account]
pub struct AgentRegistry {
    /// Agent's public key
    pub agent_pubkey: Pubkey,
    /// Agent tier based on stake
    pub agent_tier: AgentTier,
    /// Staked amount in lamports
    pub stake_amount: u64,
    /// Reputation score (can be negative)
    pub reputation_score: i32,
    /// Total ILI updates submitted
    pub total_ili_updates: u64,
    /// Successful ILI updates
    pub successful_updates: u64,
    /// Total amount slashed
    pub slashed_amount: u64,
    /// Registration timestamp
    pub registered_at: i64,
    /// Last activity timestamp
    pub last_active: i64,
    /// Active status flag
    pub is_active: bool,
    /// PDA bump
    pub bump: u8,
}

impl AgentRegistry {
    /// Calculate space needed for AgentRegistry account
    pub const LEN: usize = 8 + // discriminator
        32 + // agent_pubkey
        1 + // agent_tier (enum)
        8 + // stake_amount
        4 + // reputation_score
        8 + // total_ili_updates
        8 + // successful_updates
        8 + // slashed_amount
        8 + // registered_at
        8 + // last_active
        1 + // is_active
        1; // bump
}

/// Pending ILI update for Byzantine consensus
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug)]
pub struct ILIPendingUpdate {
    /// Agent submitting the update
    pub agent: Pubkey,
    /// ILI value submitted
    pub ili_value: u64,
    /// Timestamp of submission
    pub timestamp: i64,
    /// Ed25519 signature (64 bytes)
    pub signature: [u8; 64],
}

impl ILIPendingUpdate {
    pub const LEN: usize = 32 + // agent
        8 + // ili_value
        8 + // timestamp
        64; // signature
}

/// ILI Oracle with Byzantine fault-tolerant consensus
#[account]
pub struct ILIOracle {
    /// Authority (global state)
    pub authority: Pubkey,
    /// Current ILI value
    pub current_ili: u64,
    /// Last update timestamp
    pub last_update: i64,
    /// Update interval in seconds (default 300 = 5 minutes)
    pub update_interval: i64,
    /// Pending updates awaiting consensus
    pub pending_updates: Vec<ILIPendingUpdate>,
    /// Consensus threshold (minimum agents required)
    pub consensus_threshold: u8,
    /// PDA bump
    pub bump: u8,
}

impl ILIOracle {
    /// Calculate space needed for ILIOracle account
    /// Allows up to 10 pending updates
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        8 + // current_ili
        8 + // last_update
        8 + // update_interval
        4 + (10 * ILIPendingUpdate::LEN) + // pending_updates (Vec with max 10)
        1 + // consensus_threshold
        1; // bump
}

/// Policy type for proposals
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum PolicyType {
    /// Mint ARU tokens
    MintARU,
    /// Burn ARU tokens
    BurnARU,
    /// Update protocol parameters
    UpdateParameters,
    /// Rebalance reserve vault
    RebalanceVault,
}

/// Proposal status
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq, Debug)]
pub enum ProposalStatus {
    /// Proposal is active and accepting votes
    Active,
    /// Proposal passed and awaiting execution
    Passed,
    /// Proposal was rejected
    Rejected,
    /// Proposal was executed
    Executed,
}

/// Policy proposal with futarchy governance and quadratic voting
#[account]
pub struct PolicyProposal {
    /// Unique proposal ID
    pub id: u64,
    /// Proposer's public key
    pub proposer: Pubkey,
    /// Type of policy
    pub policy_type: PolicyType,
    /// Policy parameters (serialized)
    pub policy_params: Vec<u8>,
    /// Proposal start time
    pub start_time: i64,
    /// Proposal end time
    pub end_time: i64,
    /// Total stake voting yes
    pub yes_stake: u64,
    /// Total stake voting no
    pub no_stake: u64,
    /// Quadratic voting power for yes (sqrt of yes_stake)
    pub quadratic_yes: u64,
    /// Quadratic voting power for no (sqrt of no_stake)
    pub quadratic_no: u64,
    /// Proposal status
    pub status: ProposalStatus,
    /// Execution transaction signature (if executed)
    pub execution_tx: Option<[u8; 64]>,
    /// Griefing protection deposit (minimum 10 ARU)
    pub griefing_protection_deposit: u64,
    /// PDA bump
    pub bump: u8,
}

impl PolicyProposal {
    /// Calculate space needed for PolicyProposal account
    /// Allows up to 256 bytes for policy_params
    pub const LEN: usize = 8 + // discriminator
        8 + // id
        32 + // proposer
        1 + // policy_type (enum)
        4 + 256 + // policy_params (Vec with max 256 bytes)
        8 + // start_time
        8 + // end_time
        8 + // yes_stake
        8 + // no_stake
        8 + // quadratic_yes
        8 + // quadratic_no
        1 + // status (enum)
        (1 + 64) + // execution_tx (Option<[u8; 64]>)
        8 + // griefing_protection_deposit
        1; // bump
}
