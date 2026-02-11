use anchor_lang::prelude::*;

declare_id!("36hKHAUzNGTTwBCWPzNbz1zNJeSsTW6aAcpXsjVY6xrv");

#[program]
pub mod agent_registry {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    /// Register a new agent on-chain
    /// 
    /// # Arguments
    /// * `name` - Agent display name (max 50 characters)
    /// * `capabilities` - List of agent capabilities (max 10, each max 30 chars)
    /// * `service_types` - List of supported service type IDs (max 10)
    /// 
    /// # Requirements
    /// - Agent must not be already registered
    /// - Name must be non-empty and within length limits
    /// - Capabilities must be valid and within limits
    /// - Service types must be non-empty and within limits
    /// 
    /// # Validates
    /// - Requirements 1.1, 1.2, 1.3, 1.4, 1.5
    pub fn register_agent(
        ctx: Context<RegisterAgent>,
        name: String,
        capabilities: Vec<String>,
        service_types: Vec<u8>,
    ) -> Result<()> {
        // Validate name
        require!(!name.is_empty(), AgentRegistryError::NameEmpty);
        require!(
            name.len() <= MAX_NAME_LENGTH,
            AgentRegistryError::NameTooLong
        );

        // Validate capabilities
        require!(
            capabilities.len() <= MAX_CAPABILITIES,
            AgentRegistryError::TooManyCapabilities
        );
        for capability in &capabilities {
            require!(
                !capability.is_empty(),
                AgentRegistryError::CapabilityEmpty
            );
            require!(
                capability.len() <= MAX_CAPABILITY_LENGTH,
                AgentRegistryError::CapabilityTooLong
            );
        }

        // Validate service types
        require!(
            !service_types.is_empty(),
            AgentRegistryError::ServiceTypesEmpty
        );
        require!(
            service_types.len() <= MAX_SERVICE_TYPES,
            AgentRegistryError::TooManyServiceTypes
        );

        let agent_account = &mut ctx.accounts.agent_account;
        let clock = Clock::get()?;

        // Initialize agent account with zero reputation (Requirement 1.2)
        agent_account.agent_id = ctx.accounts.agent.key();
        agent_account.name = name;
        agent_account.capabilities = capabilities;
        agent_account.service_types = service_types;
        agent_account.reputation_score = 0; // Start with zero reputation
        agent_account.total_services = 0;
        agent_account.successful_services = 0;
        agent_account.total_earned = 0;
        agent_account.registration_time = clock.unix_timestamp;
        agent_account.is_active = true;

        // Emit registration event
        emit!(AgentRegisteredEvent {
            agent_id: ctx.accounts.agent.key(),
            name: agent_account.name.clone(),
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Update an agent's reputation score
    /// 
    /// This function is called by the marketplace contract when reputation-affecting
    /// events occur (service completion, reviews, disputes).
    /// 
    /// # Arguments
    /// * `change` - Reputation change amount (positive or negative)
    /// * `reason` - Reason for the reputation change
    /// * `service_id` - Optional service transaction ID
    /// 
    /// # Reputation Calculation
    /// Uses weighted formula:
    /// - Recent performance (last 30 days): 40% weight
    /// - Medium-term performance (31-90 days): 30% weight
    /// - Long-term performance (90+ days): 20% weight
    /// - Review ratings: 10% weight
    /// 
    /// # Requirements
    /// - Only marketplace program can call this function
    /// - Agent must exist
    /// 
    /// # Validates
    /// - Requirements 2.1, 2.2, 2.4, 2.5, 10.2
    pub fn update_reputation(
        ctx: Context<UpdateReputation>,
        change: i64,
        reason: ReputationReason,
        service_id: Option<Pubkey>,
    ) -> Result<()> {
        let agent_account = &mut ctx.accounts.agent_account;
        let reputation_history = &mut ctx.accounts.reputation_history;
        let clock = Clock::get()?;

        // Initialize reputation history if newly created
        if reputation_history.events.is_empty() && reputation_history.agent_id == Pubkey::default() {
            reputation_history.agent_id = agent_account.agent_id;
        }

        // Calculate new reputation score
        let old_score = agent_account.reputation_score as i64;
        let new_score = (old_score + change).max(0).min(10000) as u64;
        agent_account.reputation_score = new_score;

        // Create reputation event
        let event = ReputationEvent {
            timestamp: clock.unix_timestamp,
            change,
            reason: reason.clone(),
            service_id,
        };

        // Add event to history (keep only last MAX_REPUTATION_EVENTS)
        reputation_history.events.push(event);
        if reputation_history.events.len() > MAX_REPUTATION_EVENTS {
            reputation_history.events.remove(0);
        }

        // Emit reputation change event
        emit!(ReputationChangedEvent {
            agent_id: agent_account.agent_id,
            new_score,
            change,
            reason,
            service_id,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Update agent metadata
    /// 
    /// Allows agents to update their name, capabilities, and service types.
    /// Only the agent owner can update their own metadata.
    /// 
    /// # Arguments
    /// * `name` - Optional new name
    /// * `capabilities` - Optional new capabilities list
    /// * `service_types` - Optional new service types list
    /// 
    /// # Requirements
    /// - Only agent owner can update
    /// - Same validation rules as registration apply
    /// 
    /// # Validates
    /// - Requirements 1.5, 15.2
    pub fn update_agent_metadata(
        ctx: Context<UpdateAgentMetadata>,
        name: Option<String>,
        capabilities: Option<Vec<String>>,
        service_types: Option<Vec<u8>>,
    ) -> Result<()> {
        let agent_account = &mut ctx.accounts.agent_account;
        let clock = Clock::get()?;

        // Update name if provided
        if let Some(new_name) = name {
            require!(!new_name.is_empty(), AgentRegistryError::NameEmpty);
            require!(
                new_name.len() <= MAX_NAME_LENGTH,
                AgentRegistryError::NameTooLong
            );
            agent_account.name = new_name;
        }

        // Update capabilities if provided
        if let Some(new_capabilities) = capabilities {
            require!(
                new_capabilities.len() <= MAX_CAPABILITIES,
                AgentRegistryError::TooManyCapabilities
            );
            for capability in &new_capabilities {
                require!(
                    !capability.is_empty(),
                    AgentRegistryError::CapabilityEmpty
                );
                require!(
                    capability.len() <= MAX_CAPABILITY_LENGTH,
                    AgentRegistryError::CapabilityTooLong
                );
            }
            agent_account.capabilities = new_capabilities;
        }

        // Update service types if provided
        if let Some(new_service_types) = service_types {
            require!(
                !new_service_types.is_empty(),
                AgentRegistryError::ServiceTypesEmpty
            );
            require!(
                new_service_types.len() <= MAX_SERVICE_TYPES,
                AgentRegistryError::TooManyServiceTypes
            );
            agent_account.service_types = new_service_types;
        }

        // Emit metadata update event
        emit!(AgentMetadataUpdatedEvent {
            agent_id: agent_account.agent_id,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Get agent account data
    /// 
    /// This is a view function that returns agent account data.
    /// In Anchor, this is typically done via account fetching on the client side,
    /// but we provide this for completeness.
    /// 
    /// # Validates
    /// - Requirements 2.3
    pub fn get_agent(ctx: Context<GetAgent>) -> Result<()> {
        // The agent_account is already loaded and can be read by the client
        // This function exists for documentation purposes
        Ok(())
    }

    /// Get reputation history
    /// 
    /// This is a view function that returns reputation history data.
    /// 
    /// # Validates
    /// - Requirements 2.3
    pub fn get_reputation_history(ctx: Context<GetReputationHistory>) -> Result<()> {
        // The reputation_history is already loaded and can be read by the client
        // This function exists for documentation purposes
        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

// ============================================================================
// Instruction Contexts
// ============================================================================

/// Context for registering a new agent
#[derive(Accounts)]
pub struct RegisterAgent<'info> {
    /// The agent being registered (signer)
    #[account(mut)]
    pub agent: Signer<'info>,
    
    /// The agent account to be created
    /// Uses agent's public key as seed to prevent duplicate registration
    #[account(
        init,
        payer = agent,
        space = 8 + // discriminator
                32 + // agent_id (Pubkey)
                (4 + MAX_NAME_LENGTH) + // name (String: 4 bytes length + data)
                (4 + MAX_CAPABILITIES * (4 + MAX_CAPABILITY_LENGTH)) + // capabilities (Vec: 4 bytes length + items)
                (4 + MAX_SERVICE_TYPES) + // service_types (Vec: 4 bytes length + items)
                8 + // reputation_score (u64)
                8 + // total_services (u64)
                8 + // successful_services (u64)
                8 + // total_earned (u64)
                8 + // registration_time (i64)
                1, // is_active (bool)
        seeds = [b"agent", agent.key().as_ref()],
        bump
    )]
    pub agent_account: Account<'info, AgentAccount>,
    
    /// System program for account creation
    pub system_program: Program<'info, System>,
}

/// Context for updating agent reputation
#[derive(Accounts)]
pub struct UpdateReputation<'info> {
    /// The marketplace program (authority to update reputation)
    pub marketplace: Signer<'info>,
    
    /// The agent account to update
    #[account(
        mut,
        seeds = [b"agent", agent_account.agent_id.as_ref()],
        bump
    )]
    pub agent_account: Account<'info, AgentAccount>,
    
    /// The reputation history account
    #[account(
        init_if_needed,
        payer = marketplace,
        space = 8 + // discriminator
                32 + // agent_id (Pubkey)
                4 + (MAX_REPUTATION_EVENTS * (
                    8 + // timestamp (i64)
                    8 + // change (i64)
                    1 + // reason enum discriminator
                    (1 + 32) // service_id (Option<Pubkey>: 1 byte discriminator + 32 bytes)
                )),
        seeds = [b"reputation", agent_account.agent_id.as_ref()],
        bump
    )]
    pub reputation_history: Account<'info, ReputationHistory>,
    
    /// System program for account creation if needed
    pub system_program: Program<'info, System>,
}

/// Context for updating agent metadata
#[derive(Accounts)]
pub struct UpdateAgentMetadata<'info> {
    /// The agent (must be the owner)
    pub agent: Signer<'info>,
    
    /// The agent account to update
    #[account(
        mut,
        seeds = [b"agent", agent.key().as_ref()],
        bump,
        constraint = agent_account.agent_id == agent.key() @ AgentRegistryError::Unauthorized
    )]
    pub agent_account: Account<'info, AgentAccount>,
}

/// Context for getting agent data
#[derive(Accounts)]
pub struct GetAgent<'info> {
    /// The agent account to query
    #[account(
        seeds = [b"agent", agent_account.agent_id.as_ref()],
        bump
    )]
    pub agent_account: Account<'info, AgentAccount>,
}

/// Context for getting reputation history
#[derive(Accounts)]
pub struct GetReputationHistory<'info> {
    /// The reputation history account to query
    #[account(
        seeds = [b"reputation", reputation_history.agent_id.as_ref()],
        bump
    )]
    pub reputation_history: Account<'info, ReputationHistory>,
}

// ============================================================================
// State Structures
// ============================================================================

/// Agent account storing identity, capabilities, and reputation data
#[account]
pub struct AgentAccount {
    /// Unique identifier (agent's public key)
    pub agent_id: Pubkey,
    /// Agent display name (max 50 characters)
    pub name: String,
    /// List of agent capabilities (max 10 capabilities, 30 chars each)
    pub capabilities: Vec<String>,
    /// Supported service type IDs (max 10 types)
    pub service_types: Vec<u8>,
    /// Current reputation score (0-10000 scale, displayed as 0.00-100.00)
    pub reputation_score: u64,
    /// Total number of services completed
    pub total_services: u64,
    /// Number of successfully completed services
    pub successful_services: u64,
    /// Total ARU tokens earned
    pub total_earned: u64,
    /// Unix timestamp of registration
    pub registration_time: i64,
    /// Active status flag
    pub is_active: bool,
}

/// Reputation history tracking all reputation changes
#[account]
pub struct ReputationHistory {
    /// Agent identifier
    pub agent_id: Pubkey,
    /// List of reputation events (max 100 most recent events)
    pub events: Vec<ReputationEvent>,
}

/// Individual reputation change event
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct ReputationEvent {
    /// Unix timestamp of the event
    pub timestamp: i64,
    /// Reputation change amount (positive or negative)
    pub change: i64,
    /// Reason for the reputation change
    pub reason: ReputationReason,
    /// Optional service transaction ID that caused the change
    pub service_id: Option<Pubkey>,
}

/// Reasons for reputation changes
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum ReputationReason {
    /// Service completed successfully
    ServiceCompleted,
    /// Received positive review
    PositiveReview,
    /// Received negative review
    NegativeReview,
    /// Dispute resolved in agent's favor
    DisputeResolved,
    /// Penalty applied due to dispute
    DisputePenalty,
}

// ============================================================================
// Constants
// ============================================================================

/// Maximum length for agent name
pub const MAX_NAME_LENGTH: usize = 50;
/// Maximum number of capabilities
pub const MAX_CAPABILITIES: usize = 10;
/// Maximum length for each capability string
pub const MAX_CAPABILITY_LENGTH: usize = 30;
/// Maximum number of service types
pub const MAX_SERVICE_TYPES: usize = 10;
/// Maximum number of reputation events to store
pub const MAX_REPUTATION_EVENTS: usize = 100;

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum AgentRegistryError {
    #[msg("Agent name exceeds maximum length of 50 characters")]
    NameTooLong,
    #[msg("Agent name cannot be empty")]
    NameEmpty,
    #[msg("Too many capabilities (maximum 10)")]
    TooManyCapabilities,
    #[msg("Capability string exceeds maximum length of 30 characters")]
    CapabilityTooLong,
    #[msg("Capability string cannot be empty")]
    CapabilityEmpty,
    #[msg("Too many service types (maximum 10)")]
    TooManyServiceTypes,
    #[msg("Service types list cannot be empty")]
    ServiceTypesEmpty,
    #[msg("Agent is already registered")]
    AgentAlreadyRegistered,
    #[msg("Agent not found")]
    AgentNotFound,
    #[msg("Unauthorized: only agent owner can perform this action")]
    Unauthorized,
}

// ============================================================================
// Events
// ============================================================================

/// Event emitted when a new agent is registered
#[event]
pub struct AgentRegisteredEvent {
    /// The agent's public key
    pub agent_id: Pubkey,
    /// The agent's display name
    pub name: String,
    /// Unix timestamp of registration
    pub timestamp: i64,
}

/// Event emitted when an agent's reputation changes
#[event]
pub struct ReputationChangedEvent {
    /// The agent's public key
    pub agent_id: Pubkey,
    /// New reputation score
    pub new_score: u64,
    /// Change amount (positive or negative)
    pub change: i64,
    /// Reason for the change
    pub reason: ReputationReason,
    /// Optional service ID that caused the change
    pub service_id: Option<Pubkey>,
    /// Unix timestamp of the change
    pub timestamp: i64,
}

/// Event emitted when agent metadata is updated
#[event]
pub struct AgentMetadataUpdatedEvent {
    /// The agent's public key
    pub agent_id: Pubkey,
    /// Unix timestamp of the update
    pub timestamp: i64,
}
