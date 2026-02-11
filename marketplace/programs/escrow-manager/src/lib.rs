use anchor_lang::prelude::*;

declare_id!("7NczKPkt6hRjKX1R9GYVNUS3XVQiyvfHQcACbJV4FEfN");

#[program]
pub mod escrow_manager {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}
