use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};
use solana_program::{pubkey, pubkey::Pubkey as SolanaPubkey, instruction::{AccountMeta, Instruction}, program::invoke};

/// Percolator program ID (devnet)
pub const PERCOLATOR_PROGRAM_ID: SolanaPubkey = pubkey!("46iB4ET4WpqfTXAqGSmyBczLBgVhd1sHre93KtU3sTg9");

/// Percolator integration module for ARS
/// 
/// This module provides CPI interfaces to interact with Percolator perpetual futures markets.
/// ARS can use Percolator for:
/// - Oracle price feeds (ILI-derived prices)
/// - Collateral allocation from reserve vault
/// - Agent-operated liquidity provision
/// - Governance-controlled risk parameters

#[derive(Accounts)]
pub struct PercolatorDeposit<'info> {
    /// Percolator slab account (market state)
    /// CHECK: Validated by Percolator program
    #[account(mut)]
    pub slab: AccountInfo<'info>,
    
    /// Percolator vault token account
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    
    /// ARS authority (signer)
    pub authority: Signer<'info>,
    
    /// ARS token account (source)
    #[account(mut)]
    pub ars_token_account: Account<'info, TokenAccount>,
    
    /// Token program
    pub token_program: Program<'info, Token>,
    
    /// Percolator program
    /// CHECK: Validated against PERCOLATOR_PROGRAM_ID
    pub percolator_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct PercolatorWithdraw<'info> {
    /// Percolator slab account (market state)
    /// CHECK: Validated by Percolator program
    #[account(mut)]
    pub slab: AccountInfo<'info>,
    
    /// Percolator vault token account
    #[account(mut)]
    pub vault: Account<'info, TokenAccount>,
    
    /// Vault authority PDA
    /// CHECK: Derived by Percolator program
    pub vault_authority: AccountInfo<'info>,
    
    /// ARS authority (signer)
    pub authority: Signer<'info>,
    
    /// ARS token account (destination)
    #[account(mut)]
    pub ars_token_account: Account<'info, TokenAccount>,
    
    /// Oracle account
    /// CHECK: Validated by Percolator program
    pub oracle: AccountInfo<'info>,
    
    /// Token program
    pub token_program: Program<'info, Token>,
    
    /// Percolator program
    /// CHECK: Validated against PERCOLATOR_PROGRAM_ID
    pub percolator_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct PercolatorTrade<'info> {
    /// Percolator slab account (market state)
    /// CHECK: Validated by Percolator program
    #[account(mut)]
    pub slab: AccountInfo<'info>,
    
    /// Oracle account
    /// CHECK: Validated by Percolator program
    pub oracle: AccountInfo<'info>,
    
    /// ARS authority (signer)
    pub authority: Signer<'info>,
    
    /// Percolator program
    /// CHECK: Validated against PERCOLATOR_PROGRAM_ID
    pub percolator_program: AccountInfo<'info>,
}

#[derive(Accounts)]
pub struct PercolatorPushPrice<'info> {
    /// Percolator slab account (market state)
    /// CHECK: Validated by Percolator program
    #[account(mut)]
    pub slab: AccountInfo<'info>,
    
    /// Oracle authority (must match slab's oracle_authority)
    pub authority: Signer<'info>,
    
    /// Percolator program
    /// CHECK: Validated against PERCOLATOR_PROGRAM_ID
    pub percolator_program: AccountInfo<'info>,
}

/// CPI helper functions for Percolator integration

/// Deposit collateral to Percolator vault
pub fn percolator_deposit_collateral(
    ctx: Context<PercolatorDeposit>,
    user_idx: u16,
    amount: u64,
) -> Result<()> {
    let perc_id: Pubkey = PERCOLATOR_PROGRAM_ID.into();
    require!(
        ctx.accounts.percolator_program.key() == perc_id,
        crate::errors::ErrorCode::InvalidPercolatorProgram
    );
    
    // Transfer tokens from ARS to Percolator vault
    let cpi_accounts = Transfer {
        from: ctx.accounts.ars_token_account.to_account_info(),
        to: ctx.accounts.vault.to_account_info(),
        authority: ctx.accounts.authority.to_account_info(),
    };
    let cpi_program = ctx.accounts.token_program.to_account_info();
    let cpi_ctx = CpiContext::new(cpi_program, cpi_accounts);
    token::transfer(cpi_ctx, amount)?;
    
    // Build Percolator deposit instruction data
    // Instruction format: [tag: u8, user_idx: u16, amount: u64]
    let mut data = Vec::with_capacity(11);
    data.push(3); // DepositCollateral instruction tag
    data.extend_from_slice(&user_idx.to_le_bytes());
    data.extend_from_slice(&amount.to_le_bytes());
    
    // CPI to Percolator
    let accounts = vec![
        ctx.accounts.slab.to_account_info(),
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.ars_token_account.to_account_info(),
        ctx.accounts.authority.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
    ];
    
    invoke(
        &Instruction {
            program_id: *ctx.accounts.percolator_program.key,
            accounts: accounts.iter().map(|a| AccountMeta {
                pubkey: *a.key,
                is_signer: a.is_signer,
                is_writable: a.is_writable,
            }).collect(),
            data,
        },
        &accounts,
    )?;
    
    Ok(())
}

/// Withdraw collateral from Percolator vault
pub fn percolator_withdraw_collateral(
    ctx: Context<PercolatorWithdraw>,
    user_idx: u16,
    amount: u64,
) -> Result<()> {
    let perc_id: Pubkey = PERCOLATOR_PROGRAM_ID.into();
    require!(
        ctx.accounts.percolator_program.key() == perc_id,
        crate::errors::ErrorCode::InvalidPercolatorProgram
    );
    
    // Build Percolator withdraw instruction data
    // Instruction format: [tag: u8, user_idx: u16, amount: u64]
    let mut data = Vec::with_capacity(11);
    data.push(4); // WithdrawCollateral instruction tag
    data.extend_from_slice(&user_idx.to_le_bytes());
    data.extend_from_slice(&amount.to_le_bytes());
    
    // CPI to Percolator
    let accounts = vec![
        ctx.accounts.slab.to_account_info(),
        ctx.accounts.vault.to_account_info(),
        ctx.accounts.vault_authority.to_account_info(),
        ctx.accounts.ars_token_account.to_account_info(),
        ctx.accounts.oracle.to_account_info(),
        ctx.accounts.authority.to_account_info(),
        ctx.accounts.token_program.to_account_info(),
    ];
    
    invoke(
        &Instruction {
            program_id: *ctx.accounts.percolator_program.key,
            accounts: accounts.iter().map(|a| AccountMeta {
                pubkey: *a.key,
                is_signer: a.is_signer,
                is_writable: a.is_writable,
            }).collect(),
            data,
        },
        &accounts,
    )?;
    
    Ok(())
}

/// Execute trade on Percolator (no CPI to matcher)
pub fn percolator_trade_nocpi(
    ctx: Context<PercolatorTrade>,
    user_idx: u16,
    lp_idx: u16,
    size: i128,
) -> Result<()> {
    let perc_id: Pubkey = PERCOLATOR_PROGRAM_ID.into();
    require!(
        ctx.accounts.percolator_program.key() == perc_id,
        crate::errors::ErrorCode::InvalidPercolatorProgram
    );
    
    // Build Percolator trade instruction data
    // Instruction format: [tag: u8, user_idx: u16, lp_idx: u16, size: i128]
    let mut data = Vec::with_capacity(21);
    data.push(5); // TradeNoCpi instruction tag
    data.extend_from_slice(&user_idx.to_le_bytes());
    data.extend_from_slice(&lp_idx.to_le_bytes());
    data.extend_from_slice(&size.to_le_bytes());
    
    // CPI to Percolator
    let accounts = vec![
        ctx.accounts.slab.to_account_info(),
        ctx.accounts.oracle.to_account_info(),
        ctx.accounts.authority.to_account_info(),
    ];
    
    invoke(
        &Instruction {
            program_id: *ctx.accounts.percolator_program.key,
            accounts: accounts.iter().map(|a| AccountMeta {
                pubkey: *a.key,
                is_signer: a.is_signer,
                is_writable: a.is_writable,
            }).collect(),
            data,
        },
        &accounts,
    )?;
    
    Ok(())
}

/// Push oracle price to Percolator (oracle authority only)
pub fn percolator_push_oracle_price(
    ctx: Context<PercolatorPushPrice>,
    price_usd: u64,
) -> Result<()> {
    let perc_id: Pubkey = PERCOLATOR_PROGRAM_ID.into();
    require!(
        ctx.accounts.percolator_program.key() == perc_id,
        crate::errors::ErrorCode::InvalidPercolatorProgram
    );
    
    // Build Percolator push price instruction data
    // Instruction format: [tag: u8, price_e6: u64]
    let mut data = Vec::with_capacity(9);
    data.push(14); // PushOraclePrice instruction tag
    
    // Convert USD price to e6 format (price * 1_000_000)
    let price_e6 = price_usd.checked_mul(1_000_000)
        .ok_or(crate::errors::ErrorCode::Overflow)?;
    data.extend_from_slice(&price_e6.to_le_bytes());
    
    // CPI to Percolator
    let accounts = vec![
        ctx.accounts.slab.to_account_info(),
        ctx.accounts.authority.to_account_info(),
    ];
    
    invoke(
        &Instruction {
            program_id: *ctx.accounts.percolator_program.key,
            accounts: accounts.iter().map(|a| AccountMeta {
                pubkey: *a.key,
                is_signer: a.is_signer,
                is_writable: a.is_writable,
            }).collect(),
            data,
        },
        &accounts,
    )?;
    
    Ok(())
}

/// Helper: Convert ILI value to Percolator price format (e6)
pub fn ili_to_price_e6(ili_value: u64) -> u64 {
    // ILI is typically in basis points (10000 = 100%)
    // Convert to price per unit (e.g., if ILI = 10500, price = 1.05)
    // Then scale to e6 format
    ili_value.saturating_mul(100) // 10500 * 100 = 1_050_000 (1.05 in e6)
}

/// Helper: Derive Percolator vault authority PDA
pub fn derive_vault_authority_pda(slab: &Pubkey) -> (Pubkey, u8) {
    let perc_id: Pubkey = PERCOLATOR_PROGRAM_ID.into();
    Pubkey::find_program_address(
        &[b"vault", slab.as_ref()],
        &perc_id,
    )
}

/// Helper: Derive Percolator LP PDA
pub fn derive_lp_pda(slab: &Pubkey, lp_idx: u16) -> (Pubkey, u8) {
    let perc_id: Pubkey = PERCOLATOR_PROGRAM_ID.into();
    Pubkey::find_program_address(
        &[b"lp", slab.as_ref(), &lp_idx.to_le_bytes()],
        &perc_id,
    )
}
