use anchor_lang::prelude::*;

#[error_code]
pub enum ErrorCode {
    #[msg("Arithmetic overflow occurred")]
    ArithmeticOverflow,
    
    #[msg("Invalid epoch duration")]
    InvalidEpochDuration,
    
    #[msg("Invalid mint cap")]
    InvalidMintCap,
    
    #[msg("Invalid burn cap")]
    InvalidBurnCap,
    
    #[msg("Mint cap exceeded for this epoch")]
    MintCapExceeded,
    
    #[msg("Burn cap exceeded for this epoch")]
    BurnCapExceeded,
    
    #[msg("Epoch duration not complete")]
    EpochNotComplete,
}
