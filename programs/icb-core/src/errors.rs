use anchor_lang::prelude::*;

#[error_code]
pub enum ICBError {
    #[msg("Circuit breaker is active")]
    CircuitBreakerActive,
    
    #[msg("Invalid epoch duration")]
    InvalidEpochDuration,
    
    #[msg("Invalid mint/burn cap")]
    InvalidMintBurnCap,
    
    #[msg("Invalid VHR threshold")]
    InvalidVHRThreshold,
    
    #[msg("ILI update too soon")]
    ILIUpdateTooSoon,
    
    #[msg("Invalid ILI value")]
    InvalidILIValue,
    
    #[msg("Proposal already exists")]
    ProposalAlreadyExists,
    
    #[msg("Invalid voting period")]
    InvalidVotingPeriod,
    
    #[msg("Proposal not active")]
    ProposalNotActive,
    
    #[msg("Proposal still active")]
    ProposalStillActive,
    
    #[msg("Proposal not passed")]
    ProposalNotPassed,
    
    #[msg("Already voted")]
    AlreadyVoted,
    
    #[msg("Invalid stake amount")]
    InvalidStakeAmount,
    
    #[msg("Insufficient stake")]
    InsufficientStake,
    
    #[msg("Unauthorized")]
    Unauthorized,
    
    #[msg("Invalid agent signature")]
    InvalidAgentSignature,
    
    #[msg("Arithmetic overflow")]
    ArithmeticOverflow,
    
    #[msg("Arithmetic underflow")]
    ArithmeticUnderflow,
    
    // FIX #1: Proposal counter overflow
    #[msg("Proposal counter overflow")]
    CounterOverflow,
    
    // FIX #2: Signature verification
    #[msg("Invalid signature program")]
    InvalidSignatureProgram,
    
    #[msg("Signature verification failed")]
    SignatureVerificationFailed,
    
    // FIX #3: Execution delay
    #[msg("Execution delay not met")]
    ExecutionDelayNotMet,
    
    #[msg("Proposal not ready for execution")]
    ProposalNotReadyForExecution,
    
    // FIX #6: Oracle validation
    #[msg("Invalid yield value")]
    InvalidYield,
    
    #[msg("Invalid volatility value")]
    InvalidVolatility,
    
    #[msg("Invalid TVL value")]
    InvalidTVL,
    
    // FIX #7: Circuit breaker timelock
    #[msg("Circuit breaker timelock not met")]
    CircuitBreakerTimelockNotMet,
    
    // FIX #9: Slot validation
    #[msg("Slot buffer not met")]
    SlotBufferNotMet,
    
    // FIX #10: Reserve vault validation
    #[msg("Invalid reserve vault")]
    InvalidReserveVault,
    
    #[msg("Invalid ICU mint")]
    InvalidICUMint,
}
