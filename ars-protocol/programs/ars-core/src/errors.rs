use anchor_lang::prelude::*;

/// Error codes for the ARS Core program
#[error_code]
pub enum ErrorCode {
    // Arithmetic errors
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,

    // Authorization errors
    #[msg("Unauthorized access")]
    Unauthorized,

    // Admin transfer errors
    #[msg("Timelock has not expired")]
    TimelockNotExpired,
    #[msg("No pending admin transfer")]
    NoPendingTransfer,

    // Agent registration errors
    #[msg("Insufficient stake amount (minimum 100 ARU)")]
    InsufficientStake,
    #[msg("Agent is not active")]
    AgentNotActive,

    // ILI update errors
    #[msg("ILI update too frequent (5 minute minimum)")]
    UpdateTooFrequent,
    #[msg("Invalid Ed25519 signature")]
    InvalidSignature,
    #[msg("Insufficient agents for consensus (minimum 3 required)")]
    InsufficientConsensus,

    // Proposal errors
    #[msg("Proposal is not active")]
    ProposalNotActive,
    #[msg("Invalid voting period")]
    InvalidVotingPeriod,
    #[msg("Invalid stake amount")]
    InvalidStakeAmount,

    // Circuit breaker errors
    #[msg("Circuit breaker is active")]
    CircuitBreakerActive,
    #[msg("Insufficient reputation score")]
    InsufficientReputation,
    #[msg("Insufficient deposit for griefing protection (minimum 10 ARU)")]
    InsufficientDeposit,

    // Slashing errors
    #[msg("Slash amount exceeds agent stake")]
    SlashAmountTooHigh,

    // General validation errors
    #[msg("Invalid epoch duration")]
    InvalidEpochDuration,
    #[msg("Invalid mint/burn cap")]
    InvalidMintBurnCap,
    #[msg("Invalid VHR threshold")]
    InvalidVHRThreshold,
    #[msg("Invalid ILI value")]
    InvalidILIValue,
    #[msg("Invalid yield rate")]
    InvalidYield,
    #[msg("Invalid volatility")]
    InvalidVolatility,
    #[msg("Invalid TVL")]
    InvalidTVL,
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

    // Percolator integration errors
    #[msg("Invalid Percolator program ID")]
    InvalidPercolatorProgram,
    #[msg("Percolator CPI failed")]
    PercolatorCPIFailed,
    #[msg("Invalid Percolator slab account")]
    InvalidPercolatorSlab,
    #[msg("Overflow in calculation")]
    Overflow,
}
