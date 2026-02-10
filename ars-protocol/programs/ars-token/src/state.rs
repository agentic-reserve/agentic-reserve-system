use anchor_lang::prelude::*;

#[account]
pub struct MintState {
    pub authority: Pubkey,
    pub aru_mint: Pubkey,
    pub current_epoch: u64,
    pub epoch_start: i64,
    pub epoch_duration: i64,
    pub total_supply: u64,
    pub epoch_minted: u64,
    pub epoch_burned: u64,
    pub mint_cap_per_epoch_bps: u16,
    pub burn_cap_per_epoch_bps: u16,
    pub bump: u8,
}

impl MintState {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        32 + // aru_mint
        8 + // current_epoch
        8 + // epoch_start
        8 + // epoch_duration
        8 + // total_supply
        8 + // epoch_minted
        8 + // epoch_burned
        2 + // mint_cap_per_epoch_bps
        2 + // burn_cap_per_epoch_bps
        1; // bump
}

#[account]
pub struct EpochHistory {
    pub epoch_number: u64,
    pub start_time: i64,
    pub end_time: i64,
    pub total_minted: u64,
    pub total_burned: u64,
    pub net_supply_change: i64,
    pub final_supply: u64,
}

impl EpochHistory {
    pub const LEN: usize = 8 + // discriminator
        8 + // epoch_number
        8 + // start_time
        8 + // end_time
        8 + // total_minted
        8 + // total_burned
        8 + // net_supply_change
        8; // final_supply
}
