use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("ARS7PfJZeYAhsYGvR68ccZEpoXWHLYvJ3YbKoG5GHb5o");

pub mod state;
pub mod errors;

pub use state::*;
pub use errors::ErrorCode;

#[program]
pub mod ars_reserve {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        min_vhr: u16,
        rebalance_threshold_bps: u16,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        
        require!(min_vhr >= 10000, ErrorCode::InvalidVHR);
        require!(rebalance_threshold_bps <= 10000, ErrorCode::InvalidThreshold);

        vault.authority = ctx.accounts.authority.key();
        vault.usdc_vault = ctx.accounts.usdc_vault.key();
        vault.sol_vault = ctx.accounts.sol_vault.key();
        vault.msol_vault = ctx.accounts.msol_vault.key();
        vault.jitosol_vault = ctx.accounts.jitosol_vault.key();
        vault.total_value_usd = 0;
        vault.liabilities_usd = 0;
        vault.vhr = u16::MAX;
        vault.last_rebalance = 0;
        vault.rebalance_threshold_bps = rebalance_threshold_bps;
        vault.min_vhr = min_vhr;
        vault.bump = ctx.bumps.vault;

        Ok(())
    }

    pub fn deposit(
        ctx: Context<Deposit>,
        amount: u64,
    ) -> Result<()> {
        require!(amount > 0, ErrorCode::InvalidAmount);
        
        let vault = &mut ctx.accounts.vault;
        
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.user_token_account.to_account_info(),
                    to: ctx.accounts.vault_token_account.to_account_info(),
                    authority: ctx.accounts.user.to_account_info(),
                },
            ),
            amount,
        )?;
        
        // Simplified: assume 1:1 USD for now
        let value_usd = amount;
        
        vault.total_value_usd = vault.total_value_usd
            .checked_add(value_usd)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        
        vault.vhr = calculate_vhr(vault.total_value_usd, vault.liabilities_usd)?;
        
        Ok(())
    }

    pub fn withdraw(
        ctx: Context<Withdraw>,
        amount: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        
        require!(
            amount <= ctx.accounts.vault_token_account.amount,
            ErrorCode::InsufficientBalance
        );
        
        let value_usd = amount;
        
        let new_total_value = vault.total_value_usd
            .checked_sub(value_usd)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        
        let new_vhr = calculate_vhr(new_total_value, vault.liabilities_usd)?;
        
        require!(new_vhr >= vault.min_vhr, ErrorCode::VHRTooLow);
        
        let vault_seeds = &[
            b"vault",
            vault.authority.as_ref(),
            &[vault.bump],
        ];
        let signer = &[&vault_seeds[..]];
        
        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault_token_account.to_account_info(),
                    to: ctx.accounts.user_token_account.to_account_info(),
                    authority: vault.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;
        
        vault.total_value_usd = new_total_value;
        vault.vhr = new_vhr;
        
        Ok(())
    }

    pub fn rebalance(
        ctx: Context<Rebalance>,
        _amount: u64,
    ) -> Result<()> {
        let vault = &mut ctx.accounts.vault;
        
        require!(
            vault.vhr < vault.rebalance_threshold_bps,
            ErrorCode::RebalanceNotNeeded
        );
        
        // Simplified rebalancing logic
        vault.last_rebalance = Clock::get()?.unix_timestamp;
        vault.vhr = calculate_vhr(vault.total_value_usd, vault.liabilities_usd)?;
        
        Ok(())
    }
}

fn calculate_vhr(total_value_usd: u64, liabilities_usd: u64) -> Result<u16> {
    if liabilities_usd == 0 {
        return Ok(u16::MAX);
    }
    
    let ratio = total_value_usd
        .checked_mul(10000)
        .ok_or(ErrorCode::ArithmeticOverflow)?
        .checked_div(liabilities_usd)
        .ok_or(ErrorCode::ArithmeticOverflow)?;
    
    Ok(ratio as u16)
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = ReserveVault::LEN,
        seeds = [b"vault", authority.key().as_ref()],
        bump
    )]
    pub vault: Account<'info, ReserveVault>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: USDC vault token account
    pub usdc_vault: AccountInfo<'info>,
    
    /// CHECK: SOL vault token account
    pub sol_vault: AccountInfo<'info>,
    
    /// CHECK: mSOL vault token account
    pub msol_vault: AccountInfo<'info>,
    
    /// CHECK: JitoSOL vault token account
    pub jitosol_vault: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct Deposit<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.authority.as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, ReserveVault>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Withdraw<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.authority.as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, ReserveVault>,
    
    #[account(mut)]
    pub user: Signer<'info>,
    
    #[account(mut)]
    pub user_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub vault_token_account: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct Rebalance<'info> {
    #[account(
        mut,
        seeds = [b"vault", vault.authority.as_ref()],
        bump = vault.bump
    )]
    pub vault: Account<'info, ReserveVault>,
    
    pub authority: Signer<'info>,
}
