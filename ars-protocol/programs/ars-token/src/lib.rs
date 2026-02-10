use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Mint, MintTo, Burn};

declare_id!("ARSM8uCNGUDYCVJPNnoKenBNTzKbJANyJS3KpbUVEmQb");

pub mod state;
pub mod errors;

pub use state::*;
pub use errors::ErrorCode;

#[program]
pub mod ars_token {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        epoch_duration: i64,
        mint_cap_per_epoch_bps: u16,
        burn_cap_per_epoch_bps: u16,
    ) -> Result<()> {
        let mint_state = &mut ctx.accounts.mint_state;
        
        require!(epoch_duration > 0, ErrorCode::InvalidEpochDuration);
        require!(mint_cap_per_epoch_bps <= 10000, ErrorCode::InvalidMintCap);
        require!(burn_cap_per_epoch_bps <= 10000, ErrorCode::InvalidBurnCap);

        mint_state.authority = ctx.accounts.authority.key();
        mint_state.aru_mint = ctx.accounts.aru_mint.key();
        mint_state.current_epoch = 0;
        mint_state.epoch_start = Clock::get()?.unix_timestamp;
        mint_state.epoch_duration = epoch_duration;
        mint_state.total_supply = 0;
        mint_state.epoch_minted = 0;
        mint_state.epoch_burned = 0;
        mint_state.mint_cap_per_epoch_bps = mint_cap_per_epoch_bps;
        mint_state.burn_cap_per_epoch_bps = burn_cap_per_epoch_bps;
        mint_state.bump = ctx.bumps.mint_state;

        Ok(())
    }

    pub fn mint_aru(
        ctx: Context<MintARU>,
        amount: u64,
    ) -> Result<()> {
        let mint_state = &mut ctx.accounts.mint_state;
        
        let mint_cap = mint_state.total_supply
            .checked_mul(mint_state.mint_cap_per_epoch_bps as u64)
            .ok_or(ErrorCode::ArithmeticOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        
        let new_epoch_minted = mint_state.epoch_minted
            .checked_add(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        
        require!(
            new_epoch_minted <= mint_cap,
            ErrorCode::MintCapExceeded
        );
        
        let mint_seeds = &[
            b"mint_state",
            mint_state.authority.as_ref(),
            &[mint_state.bump],
        ];
        let signer = &[&mint_seeds[..]];
        
        token::mint_to(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                MintTo {
                    mint: ctx.accounts.aru_mint.to_account_info(),
                    to: ctx.accounts.destination.to_account_info(),
                    authority: mint_state.to_account_info(),
                },
                signer,
            ),
            amount,
        )?;
        
        mint_state.epoch_minted = new_epoch_minted;
        mint_state.total_supply = mint_state.total_supply
            .checked_add(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        
        Ok(())
    }

    pub fn burn_aru(
        ctx: Context<BurnARU>,
        amount: u64,
    ) -> Result<()> {
        let mint_state = &mut ctx.accounts.mint_state;
        
        let burn_cap = mint_state.total_supply
            .checked_mul(mint_state.burn_cap_per_epoch_bps as u64)
            .ok_or(ErrorCode::ArithmeticOverflow)?
            .checked_div(10000)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        
        let new_epoch_burned = mint_state.epoch_burned
            .checked_add(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        
        require!(
            new_epoch_burned <= burn_cap,
            ErrorCode::BurnCapExceeded
        );
        
        token::burn(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Burn {
                    mint: ctx.accounts.aru_mint.to_account_info(),
                    from: ctx.accounts.source.to_account_info(),
                    authority: ctx.accounts.authority.to_account_info(),
                },
            ),
            amount,
        )?;
        
        mint_state.epoch_burned = new_epoch_burned;
        mint_state.total_supply = mint_state.total_supply
            .checked_sub(amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        
        Ok(())
    }

    pub fn start_new_epoch(
        ctx: Context<StartNewEpoch>,
    ) -> Result<()> {
        let mint_state = &mut ctx.accounts.mint_state;
        let current_time = Clock::get()?.unix_timestamp;
        
        let epoch_end = mint_state.epoch_start
            .checked_add(mint_state.epoch_duration)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        
        require!(
            current_time >= epoch_end,
            ErrorCode::EpochNotComplete
        );
        
        let epoch_history = &mut ctx.accounts.epoch_history;
        epoch_history.epoch_number = mint_state.current_epoch;
        epoch_history.start_time = mint_state.epoch_start;
        epoch_history.end_time = current_time;
        epoch_history.total_minted = mint_state.epoch_minted;
        epoch_history.total_burned = mint_state.epoch_burned;
        epoch_history.net_supply_change = (mint_state.epoch_minted as i64)
            .checked_sub(mint_state.epoch_burned as i64)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        epoch_history.final_supply = mint_state.total_supply;
        
        mint_state.current_epoch = mint_state.current_epoch
            .checked_add(1)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        mint_state.epoch_start = current_time;
        mint_state.epoch_minted = 0;
        mint_state.epoch_burned = 0;
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = MintState::LEN,
        seeds = [b"mint_state", authority.key().as_ref()],
        bump
    )]
    pub mint_state: Account<'info, MintState>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub aru_mint: Account<'info, Mint>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct MintARU<'info> {
    #[account(
        mut,
        seeds = [b"mint_state", mint_state.authority.as_ref()],
        bump = mint_state.bump
    )]
    pub mint_state: Account<'info, MintState>,
    
    #[account(mut)]
    pub aru_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub destination: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct BurnARU<'info> {
    #[account(
        mut,
        seeds = [b"mint_state", mint_state.authority.as_ref()],
        bump = mint_state.bump
    )]
    pub mint_state: Account<'info, MintState>,
    
    #[account(mut)]
    pub aru_mint: Account<'info, Mint>,
    
    #[account(mut)]
    pub source: Account<'info, TokenAccount>,
    
    pub authority: Signer<'info>,
    
    pub token_program: Program<'info, Token>,
}

#[derive(Accounts)]
pub struct StartNewEpoch<'info> {
    #[account(
        mut,
        seeds = [b"mint_state", mint_state.authority.as_ref()],
        bump = mint_state.bump
    )]
    pub mint_state: Account<'info, MintState>,
    
    #[account(
        init,
        payer = authority,
        space = EpochHistory::LEN,
        seeds = [b"epoch_history", mint_state.current_epoch.to_le_bytes().as_ref()],
        bump
    )]
    pub epoch_history: Account<'info, EpochHistory>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}
