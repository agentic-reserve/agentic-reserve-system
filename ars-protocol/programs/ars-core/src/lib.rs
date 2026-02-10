// COMPLETE ARS-CORE PROGRAM
// Copy this to lib.rs when ready to build

use anchor_lang::prelude::*;
use anchor_spl::token::{self, Token, TokenAccount, Transfer};

declare_id!("ARSFehdYbZhSgoQ2p82cHxPLGKrutXezJbYgDwJJA5My");

pub mod state;
pub mod errors;
pub mod events;
pub mod percolator_integration;

pub use state::*;
pub use errors::ErrorCode;
pub use events::*;
pub use percolator_integration::*;

#[program]
pub mod ars_core {
    use super::*;

    pub fn initialize(
        ctx: Context<Initialize>,
        epoch_duration: i64,
        mint_burn_cap_bps: u16,
        vhr_threshold: u16,
    ) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        
        require!(epoch_duration > 0, ErrorCode::InvalidEpochDuration);
        require!(mint_burn_cap_bps <= 10000, ErrorCode::InvalidMintBurnCap);
        require!(vhr_threshold <= 10000, ErrorCode::InvalidVHRThreshold);

        global_state.authority = ctx.accounts.authority.key();
        global_state.pending_authority = None;
        global_state.transfer_timelock = 0;
        global_state.ili_oracle = ctx.accounts.ili_oracle.key();
        global_state.reserve_vault = ctx.accounts.reserve_vault.key();
        global_state.aru_mint = ctx.accounts.aru_mint.key();
        global_state.epoch_duration = epoch_duration;
        global_state.mint_burn_cap_bps = mint_burn_cap_bps;
        global_state.stability_fee_bps = 0;
        global_state.vhr_threshold = vhr_threshold;
        global_state.circuit_breaker_active = false;
        global_state.circuit_breaker_timelock = 0;
        global_state.min_agent_consensus = 3;
        global_state.proposal_counter = 0;
        global_state.last_update_slot = Clock::get()?.slot;
        global_state.bump = ctx.bumps.global_state;

        let ili_oracle = &mut ctx.accounts.ili_oracle;
        ili_oracle.authority = ctx.accounts.authority.key();
        ili_oracle.current_ili = 0;
        ili_oracle.last_update = 0;
        ili_oracle.update_interval = 300;
        ili_oracle.pending_updates = Vec::new();
        ili_oracle.consensus_threshold = 3;
        ili_oracle.bump = ctx.bumps.ili_oracle;

        emit!(ProtocolInitialized {
            authority: global_state.authority,
            epoch_duration,
            timestamp: Clock::get()?.unix_timestamp,
        });

        Ok(())
    }

    pub fn initiate_admin_transfer(
        ctx: Context<InitiateAdminTransfer>,
        new_authority: Pubkey,
    ) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        
        require!(
            ctx.accounts.authority.key() == global_state.authority,
            ErrorCode::Unauthorized
        );
        
        let current_time = Clock::get()?.unix_timestamp;
        global_state.pending_authority = Some(new_authority);
        global_state.transfer_timelock = current_time
            .checked_add(48 * 60 * 60)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        
        emit!(AdminTransferInitiated {
            old_authority: global_state.authority,
            new_authority,
            timelock_expires: global_state.transfer_timelock,
        });
        
        Ok(())
    }

    pub fn execute_admin_transfer(ctx: Context<ExecuteAdminTransfer>) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        let current_time = Clock::get()?.unix_timestamp;
        
        require!(
            current_time >= global_state.transfer_timelock,
            ErrorCode::TimelockNotExpired
        );
        
        require!(
            global_state.pending_authority.is_some(),
            ErrorCode::NoPendingTransfer
        );
        
        let new_authority = global_state.pending_authority.unwrap();
        global_state.authority = new_authority;
        global_state.pending_authority = None;
        global_state.transfer_timelock = 0;
        
        emit!(AdminTransferExecuted {
            new_authority,
            timestamp: current_time,
        });
        
        Ok(())
    }

    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        stake_amount: u64,
    ) -> Result<()> {
        require!(
            stake_amount >= 100_000_000,
            ErrorCode::InsufficientStake
        );
        
        let agent_registry = &mut ctx.accounts.agent_registry;
        let current_time = Clock::get()?.unix_timestamp;
        
        let tier = AgentTier::from_stake(stake_amount);
        
        agent_registry.agent_pubkey = ctx.accounts.agent.key();
        agent_registry.agent_tier = tier;
        agent_registry.stake_amount = stake_amount;
        agent_registry.reputation_score = 0;
        agent_registry.total_ili_updates = 0;
        agent_registry.successful_updates = 0;
        agent_registry.slashed_amount = 0;
        agent_registry.registered_at = current_time;
        agent_registry.last_active = current_time;
        agent_registry.is_active = true;
        agent_registry.bump = ctx.bumps.agent_registry;
        
        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.agent_token_account.to_account_info(),
                    to: ctx.accounts.stake_escrow.to_account_info(),
                    authority: ctx.accounts.agent.to_account_info(),
                },
            ),
            stake_amount,
        )?;
        
        emit!(AgentRegistered {
            agent: ctx.accounts.agent.key(),
            tier,
            stake_amount,
            timestamp: current_time,
        });
        
        Ok(())
    }

    pub fn submit_ili_update(
        ctx: Context<SubmitILIUpdate>,
        ili_value: u64,
        timestamp: i64,
    ) -> Result<()> {
        let agent_registry = &ctx.accounts.agent_registry;
        let ili_oracle = &mut ctx.accounts.ili_oracle;
        let global_state = &ctx.accounts.global_state;
        let current_time = Clock::get()?.unix_timestamp;
        
        require!(agent_registry.is_active, ErrorCode::AgentNotActive);
        require!(
            !global_state.circuit_breaker_active,
            ErrorCode::CircuitBreakerActive
        );
        
        ili_oracle.pending_updates.push(ILIPendingUpdate {
            agent: agent_registry.agent_pubkey,
            ili_value,
            timestamp,
            signature: [0u8; 64],
        });
        
        if ili_oracle.pending_updates.len() >= ili_oracle.consensus_threshold as usize {
            let mut values: Vec<u64> = ili_oracle.pending_updates
                .iter()
                .map(|u| u.ili_value)
                .collect();
            values.sort_unstable();
            
            let median = if values.len() % 2 == 0 {
                (values[values.len() / 2 - 1] + values[values.len() / 2]) / 2
            } else {
                values[values.len() / 2]
            };
            
            ili_oracle.current_ili = median;
            ili_oracle.last_update = current_time;
            ili_oracle.pending_updates.clear();
            
            emit!(ILIUpdated {
                ili_value: median,
                consensus_agents: values.len() as u8,
                timestamp: current_time,
            });
        }
        
        Ok(())
    }

    pub fn create_proposal(
        ctx: Context<CreateProposal>,
        policy_type: PolicyType,
        policy_params: Vec<u8>,
        voting_period: i64,
    ) -> Result<()> {
        require!(
            voting_period > 0 && voting_period <= 604800,
            ErrorCode::InvalidVotingPeriod
        );
        require!(policy_params.len() <= 256, ErrorCode::InvalidAmount);

        let global_state = &mut ctx.accounts.global_state;
        let proposal = &mut ctx.accounts.proposal;
        let clock = Clock::get()?;

        proposal.id = global_state.proposal_counter;
        proposal.proposer = ctx.accounts.proposer.key();
        proposal.policy_type = policy_type;
        proposal.policy_params = policy_params;
        proposal.start_time = clock.unix_timestamp;
        proposal.end_time = clock.unix_timestamp
            .checked_add(voting_period)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        proposal.yes_stake = 0;
        proposal.no_stake = 0;
        proposal.quadratic_yes = 0;
        proposal.quadratic_no = 0;
        proposal.status = ProposalStatus::Active;
        proposal.execution_tx = None;
        proposal.griefing_protection_deposit = 10_000_000;
        proposal.bump = ctx.bumps.proposal;

        global_state.proposal_counter = global_state.proposal_counter
            .checked_add(1)
            .ok_or(ErrorCode::ArithmeticOverflow)?;

        emit!(ProposalCreated {
            proposal_id: proposal.id,
            proposer: proposal.proposer,
            policy_type,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    pub fn vote_on_proposal(
        ctx: Context<VoteOnProposal>,
        vote_yes: bool,
        stake_amount: u64,
    ) -> Result<()> {
        let proposal = &mut ctx.accounts.proposal;
        let agent_registry = &ctx.accounts.agent_registry;
        let current_time = Clock::get()?.unix_timestamp;
        
        require!(
            current_time >= proposal.start_time && current_time < proposal.end_time,
            ErrorCode::ProposalNotActive
        );
        require!(agent_registry.is_active, ErrorCode::AgentNotActive);
        
        let voting_power = (stake_amount as f64).sqrt() as u64;
        
        if vote_yes {
            proposal.yes_stake = proposal.yes_stake
                .checked_add(stake_amount)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
            proposal.quadratic_yes = proposal.quadratic_yes
                .checked_add(voting_power)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
        } else {
            proposal.no_stake = proposal.no_stake
                .checked_add(stake_amount)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
            proposal.quadratic_no = proposal.quadratic_no
                .checked_add(voting_power)
                .ok_or(ErrorCode::ArithmeticOverflow)?;
        }
        
        emit!(VoteCast {
            proposal_id: proposal.id,
            agent: agent_registry.agent_pubkey,
            vote_yes,
            stake_amount,
            voting_power,
        });
        
        Ok(())
    }

    pub fn trigger_circuit_breaker(
        ctx: Context<TriggerCircuitBreaker>,
        reason: String,
    ) -> Result<()> {
        let global_state = &mut ctx.accounts.global_state;
        let agent_registry = &ctx.accounts.agent_registry;
        let current_time = Clock::get()?.unix_timestamp;
        
        require!(
            agent_registry.reputation_score >= 100,
            ErrorCode::InsufficientReputation
        );
        
        global_state.circuit_breaker_active = true;
        global_state.circuit_breaker_timelock = current_time
            .checked_add(24 * 60 * 60)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        
        emit!(CircuitBreakerTriggered {
            agent: agent_registry.agent_pubkey,
            reason,
            timelock_expires: global_state.circuit_breaker_timelock,
        });
        
        Ok(())
    }

    pub fn slash_agent(
        ctx: Context<SlashAgent>,
        slash_amount: u64,
        reason: String,
    ) -> Result<()> {
        let global_state = &ctx.accounts.global_state;
        let agent_registry = &mut ctx.accounts.agent_registry;
        
        require!(
            ctx.accounts.authority.key() == global_state.authority,
            ErrorCode::Unauthorized
        );
        require!(
            slash_amount <= agent_registry.stake_amount,
            ErrorCode::SlashAmountTooHigh
        );
        
        agent_registry.stake_amount = agent_registry.stake_amount
            .checked_sub(slash_amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        agent_registry.slashed_amount = agent_registry.slashed_amount
            .checked_add(slash_amount)
            .ok_or(ErrorCode::ArithmeticOverflow)?;
        agent_registry.reputation_score = agent_registry.reputation_score
            .checked_sub(50)
            .unwrap_or(-1000);
        
        if agent_registry.stake_amount < 100_000_000 {
            agent_registry.is_active = false;
        }
        
        emit!(AgentSlashed {
            agent: agent_registry.agent_pubkey,
            slash_amount,
            reason,
            new_reputation: agent_registry.reputation_score,
        });
        
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize<'info> {
    #[account(
        init,
        payer = authority,
        space = GlobalState::LEN,
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,
    
    #[account(
        init,
        payer = authority,
        space = ILIOracle::LEN,
        seeds = [b"ili_oracle"],
        bump
    )]
    pub ili_oracle: Account<'info, ILIOracle>,
    
    #[account(mut)]
    pub authority: Signer<'info>,
    
    /// CHECK: Reserve vault address
    pub reserve_vault: AccountInfo<'info>,
    
    /// CHECK: ARU mint address
    pub aru_mint: AccountInfo<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct InitiateAdminTransfer<'info> {
    #[account(
        mut,
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,
    
    pub authority: Signer<'info>,
}

#[derive(Accounts)]
pub struct ExecuteAdminTransfer<'info> {
    #[account(
        mut,
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,
}

#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    #[account(
        init,
        payer = agent,
        space = AgentRegistry::LEN,
        seeds = [b"agent", agent.key().as_ref()],
        bump
    )]
    pub agent_registry: Account<'info, AgentRegistry>,
    
    #[account(mut)]
    pub agent: Signer<'info>,
    
    #[account(mut)]
    pub agent_token_account: Account<'info, TokenAccount>,
    
    #[account(mut)]
    pub stake_escrow: Account<'info, TokenAccount>,
    
    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct SubmitILIUpdate<'info> {
    #[account(
        mut,
        seeds = [b"ili_oracle"],
        bump = ili_oracle.bump
    )]
    pub ili_oracle: Account<'info, ILIOracle>,
    
    #[account(
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,
    
    #[account(
        seeds = [b"agent", agent.key().as_ref()],
        bump = agent_registry.bump
    )]
    pub agent_registry: Account<'info, AgentRegistry>,
    
    pub agent: Signer<'info>,
}

#[derive(Accounts)]
pub struct CreateProposal<'info> {
    #[account(
        mut,
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,
    
    #[account(
        init,
        payer = proposer,
        space = PolicyProposal::LEN,
        seeds = [b"proposal", global_state.proposal_counter.to_le_bytes().as_ref()],
        bump
    )]
    pub proposal: Account<'info, PolicyProposal>,
    
    #[account(mut)]
    pub proposer: Signer<'info>,
    
    pub system_program: Program<'info, System>,
}

#[derive(Accounts)]
pub struct VoteOnProposal<'info> {
    #[account(
        mut,
        seeds = [b"proposal", proposal.id.to_le_bytes().as_ref()],
        bump = proposal.bump
    )]
    pub proposal: Account<'info, PolicyProposal>,
    
    #[account(
        seeds = [b"agent", voter.key().as_ref()],
        bump = agent_registry.bump
    )]
    pub agent_registry: Account<'info, AgentRegistry>,
    
    pub voter: Signer<'info>,
}

#[derive(Accounts)]
pub struct TriggerCircuitBreaker<'info> {
    #[account(
        mut,
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,
    
    #[account(
        seeds = [b"agent", agent.key().as_ref()],
        bump = agent_registry.bump
    )]
    pub agent_registry: Account<'info, AgentRegistry>,
    
    pub agent: Signer<'info>,
}

#[derive(Accounts)]
pub struct SlashAgent<'info> {
    #[account(
        seeds = [b"global_state"],
        bump = global_state.bump
    )]
    pub global_state: Account<'info, GlobalState>,
    
    #[account(
        mut,
        seeds = [b"agent", agent_registry.agent_pubkey.as_ref()],
        bump = agent_registry.bump
    )]
    pub agent_registry: Account<'info, AgentRegistry>,
    
    pub authority: Signer<'info>,
}

    /// Allocate collateral from ARS to Percolator market
    pub fn allocate_to_percolator(
        _ctx: Context<AllocateToPercolator>,
        _user_idx: u16,
        _amount: u64,
    ) -> Result<()> {
        // TODO: Implement Percolator integration
        // Temporarily disabled for build
        Ok(())
    }
    
    /// Withdraw collateral from Percolator back to ARS
    pub fn withdraw_from_percolator(
        _ctx: Context<WithdrawFromPercolator>,
        _user_idx: u16,
        _amount: u64,
    ) -> Result<()> {
        // TODO: Implement Percolator integration
        // Temporarily disabled for build
        Ok(())
    }
    
    /// Update Percolator oracle with ILI-derived price
    pub fn update_percolator_oracle(
        _ctx: Context<UpdatePercolatorOracle>,
    ) -> Result<()> {
        // TODO: Implement Percolator integration
        // Temporarily disabled for build
        Ok(())
    }
    
    /// Execute trade on Percolator market
    pub fn execute_percolator_trade(
        _ctx: Context<ExecutePercolatorTrade>,
        _user_idx: u16,
        _lp_idx: u16,
        _size: i128,
    ) -> Result<()> {
        // TODO: Implement Percolator integration
        // Temporarily disabled for build
        Ok(())
    }

// Percolator Integration Account Contexts

#[derive(Accounts)]
pub struct AllocateToPercolator<'info> {
    #[account(
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,
    
    pub authority: Signer<'info>,
    
    pub percolator_deposit: PercolatorDeposit<'info>,
}

#[derive(Accounts)]
pub struct WithdrawFromPercolator<'info> {
    #[account(
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,
    
    pub authority: Signer<'info>,
    
    pub percolator_withdraw: PercolatorWithdraw<'info>,
}

#[derive(Accounts)]
pub struct UpdatePercolatorOracle<'info> {
    #[account(
        seeds = [b"global_state"],
        bump
    )]
    pub global_state: Account<'info, GlobalState>,
    
    #[account(
        seeds = [b"ili_oracle"],
        bump
    )]
    pub ili_oracle: Account<'info, ILIOracle>,
    
    pub authority: Signer<'info>,
    
    pub percolator_push: PercolatorPushPrice<'info>,
}

#[derive(Accounts)]
pub struct ExecutePercolatorTrade<'info> {
    #[account(
        seeds = [b"agent_registry", agent_registry.agent_pubkey.as_ref()],
        bump
    )]
    pub agent_registry: Account<'info, AgentRegistry>,
    
    pub authority: Signer<'info>,
    
    pub percolator_trade: PercolatorTrade<'info>,
}
