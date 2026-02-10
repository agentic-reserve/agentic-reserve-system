use anchor_lang::prelude::*;

#[account]
pub struct ReserveVault {
    pub authority: Pubkey,
    pub usdc_vault: Pubkey,
    pub sol_vault: Pubkey,
    pub msol_vault: Pubkey,
    pub jitosol_vault: Pubkey,
    pub total_value_usd: u64,
    pub liabilities_usd: u64,
    pub vhr: u16,
    pub last_rebalance: i64,
    pub rebalance_threshold_bps: u16,
    pub min_vhr: u16,
    pub bump: u8,
}

impl ReserveVault {
    pub const LEN: usize = 8 + // discriminator
        32 + // authority
        32 + // usdc_vault
        32 + // sol_vault
        32 + // msol_vault
        32 + // jitosol_vault
        8 + // total_value_usd
        8 + // liabilities_usd
        2 + // vhr
        8 + // last_rebalance
        2 + // rebalance_threshold_bps
        2 + // min_vhr
        1; // bump
}

#[account]
pub struct AssetConfig {
    pub mint: Pubkey,
    pub vault: Pubkey,
    pub target_weight_bps: u16,
    pub min_weight_bps: u16,
    pub max_weight_bps: u16,
    pub volatility_threshold_bps: u16,
    pub current_weight_bps: u16,
    pub oracle_source: Pubkey,
    pub bump: u8,
}

impl AssetConfig {
    pub const LEN: usize = 8 + // discriminator
        32 + // mint
        32 + // vault
        2 + // target_weight_bps
        2 + // min_weight_bps
        2 + // max_weight_bps
        2 + // volatility_threshold_bps
        2 + // current_weight_bps
        32 + // oracle_source
        1; // bump
}
