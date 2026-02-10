use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
    
    #[msg("Invalid amount")]
    InvalidAmount,
    
    #[msg("Invalid VHR threshold")]
    InvalidVHR,
    
    #[msg("Invalid rebalance threshold")]
    InvalidThreshold,
    
    #[msg("Insufficient balance")]
    InsufficientBalance,
    
    #[msg("VHR would fall below minimum")]
    VHRTooLow,
    
    #[msg("Rebalance not needed")]
    RebalanceNotNeeded,
}
