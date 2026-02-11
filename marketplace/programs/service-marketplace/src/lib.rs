use anchor_lang::prelude::*;

declare_id!("76f4XeUP316CpeyASAqpGW6dxQDWw8Uw5gzzeZEpkdsV");

#[program]
pub mod service_marketplace {
    use super::*;

    pub fn initialize(_ctx: Context<Initialize>) -> Result<()> {
        Ok(())
    }

    /// Create a new service listing
    /// 
    /// # Arguments
    /// * `service_type` - Primary service type (1-255)
    /// * `title` - Service title (max 100 characters)
    /// * `description` - Service description (max 500 characters)
    /// * `price` - Price in ARU tokens (must be > 0)
    /// * `delivery_time` - Expected delivery time in seconds (must be > 0)
    /// * `requirements` - JSON string of requirements (max 500 characters)
    /// 
    /// # Requirements
    /// - Agent must be registered in Agent Registry
    /// - Agent must meet minimum reputation requirement (if enforced)
    /// - Title, description must be non-empty and within limits
    /// - Price and delivery time must be positive
    /// - Service type must be valid
    /// - Each listing must have exactly one primary service type
    /// 
    /// # Validates
    /// - Requirements 3.1, 3.2, 3.3, 3.4, 3.5, 13.3
    pub fn create_listing(
        ctx: Context<CreateListing>,
        service_type: u8,
        title: String,
        description: String,
        price: u64,
        delivery_time: u32,
        requirements: String,
    ) -> Result<()> {
        // Validate title
        require!(!title.is_empty(), ServiceMarketplaceError::TitleEmpty);
        require!(
            title.len() <= MAX_TITLE_LENGTH,
            ServiceMarketplaceError::TitleTooLong
        );

        // Validate description
        require!(
            !description.is_empty(),
            ServiceMarketplaceError::DescriptionEmpty
        );
        require!(
            description.len() <= MAX_DESCRIPTION_LENGTH,
            ServiceMarketplaceError::DescriptionTooLong
        );

        // Validate requirements
        require!(
            requirements.len() <= MAX_REQUIREMENTS_LENGTH,
            ServiceMarketplaceError::RequirementsTooLong
        );

        // Validate service type (must be valid and exactly one primary type)
        require!(
            is_valid_service_type(service_type),
            ServiceMarketplaceError::InvalidServiceType
        );

        // Validate price
        require!(price > 0, ServiceMarketplaceError::InvalidPrice);

        // Validate delivery time
        require!(
            delivery_time > 0,
            ServiceMarketplaceError::InvalidDeliveryTime
        );

        // Validate agent is registered (agent_account must exist and be loaded)
        require!(
            ctx.accounts.agent_account.is_active,
            ServiceMarketplaceError::AgentNotRegistered
        );

        let listing = &mut ctx.accounts.listing;
        let clock = Clock::get()?;

        // Initialize listing
        listing.listing_id = listing.key();
        listing.provider_id = ctx.accounts.provider.key();
        listing.service_type = service_type;
        listing.title = title.clone();
        listing.description = description.clone();
        listing.price = price;
        listing.delivery_time = delivery_time;
        listing.requirements = requirements;
        listing.is_active = true;
        listing.created_at = clock.unix_timestamp;
        listing.updated_at = clock.unix_timestamp;
        listing.total_purchases = 0;
        listing.average_rating = 0;

        // Emit listing created event
        emit!(ListingCreatedEvent {
            listing_id: listing.key(),
            provider_id: ctx.accounts.provider.key(),
            service_type,
            title,
            price,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Update an existing service listing
    /// 
    /// # Arguments
    /// * `title` - Optional new title
    /// * `description` - Optional new description
    /// * `price` - Optional new price
    /// * `delivery_time` - Optional new delivery time
    /// 
    /// # Requirements
    /// - Only listing owner can update
    /// - Same validation rules as creation apply
    /// - Transaction history is preserved
    /// - Updated timestamp is modified
    /// 
    /// # Validates
    /// - Requirements 3.3
    pub fn update_listing(
        ctx: Context<UpdateListing>,
        title: Option<String>,
        description: Option<String>,
        price: Option<u64>,
        delivery_time: Option<u32>,
    ) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        let clock = Clock::get()?;

        // Update title if provided
        if let Some(new_title) = title {
            require!(
                !new_title.is_empty(),
                ServiceMarketplaceError::TitleEmpty
            );
            require!(
                new_title.len() <= MAX_TITLE_LENGTH,
                ServiceMarketplaceError::TitleTooLong
            );
            listing.title = new_title;
        }

        // Update description if provided
        if let Some(new_description) = description {
            require!(
                !new_description.is_empty(),
                ServiceMarketplaceError::DescriptionEmpty
            );
            require!(
                new_description.len() <= MAX_DESCRIPTION_LENGTH,
                ServiceMarketplaceError::DescriptionTooLong
            );
            listing.description = new_description;
        }

        // Update price if provided
        if let Some(new_price) = price {
            require!(new_price > 0, ServiceMarketplaceError::InvalidPrice);
            listing.price = new_price;
        }

        // Update delivery time if provided
        if let Some(new_delivery_time) = delivery_time {
            require!(
                new_delivery_time > 0,
                ServiceMarketplaceError::InvalidDeliveryTime
            );
            listing.delivery_time = new_delivery_time;
        }

        // Update timestamp (preserving created_at and total_purchases)
        listing.updated_at = clock.unix_timestamp;

        // Emit listing updated event
        emit!(ListingUpdatedEvent {
            listing_id: listing.key(),
            provider_id: listing.provider_id,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }

    /// Deactivate a service listing
    /// 
    /// # Requirements
    /// - Only listing owner can deactivate
    /// - Listing data and history are preserved
    /// - Listing is marked as inactive
    /// 
    /// # Validates
    /// - Requirements 3.4
    pub fn deactivate_listing(ctx: Context<DeactivateListing>) -> Result<()> {
        let listing = &mut ctx.accounts.listing;
        let clock = Clock::get()?;

        // Mark as inactive (preserving all data)
        listing.is_active = false;
        listing.updated_at = clock.unix_timestamp;

        // Emit listing deactivated event
        emit!(ListingDeactivatedEvent {
            listing_id: listing.key(),
            provider_id: listing.provider_id,
            timestamp: clock.unix_timestamp,
        });

        Ok(())
    }
}

#[derive(Accounts)]
pub struct Initialize {}

// ============================================================================
// Instruction Contexts
// ============================================================================

/// Context for creating a service listing
#[derive(Accounts)]
#[instruction(service_type: u8, title: String, description: String, price: u64, delivery_time: u32, requirements: String)]
pub struct CreateListing<'info> {
    /// The provider creating the listing (must be registered agent)
    #[account(mut)]
    pub provider: Signer<'info>,

    /// The agent account (must exist and be active)
    #[account(
        seeds = [b"agent", provider.key().as_ref()],
        bump,
        seeds::program = agent_registry_program.key()
    )]
    /// CHECK: This account is validated by the agent_registry program
    pub agent_account: UncheckedAccount<'info>,

    /// The listing account to be created
    #[account(
        init,
        payer = provider,
        space = 8 + // discriminator
                32 + // listing_id
                32 + // provider_id
                1 + // service_type
                (4 + MAX_TITLE_LENGTH) + // title
                (4 + MAX_DESCRIPTION_LENGTH) + // description
                8 + // price
                4 + // delivery_time
                (4 + MAX_REQUIREMENTS_LENGTH) + // requirements
                1 + // is_active
                8 + // created_at
                8 + // updated_at
                8 + // total_purchases
                2, // average_rating
        seeds = [b"listing", provider.key().as_ref(), &clock.unix_timestamp.to_le_bytes()],
        bump
    )]
    pub listing: Account<'info, ServiceListing>,

    /// Agent Registry program
    /// CHECK: This is the agent registry program ID
    pub agent_registry_program: UncheckedAccount<'info>,

    /// Clock sysvar for timestamp
    pub clock: Sysvar<'info, Clock>,

    /// System program
    pub system_program: Program<'info, System>,
}

/// Context for updating a service listing
#[derive(Accounts)]
pub struct UpdateListing<'info> {
    /// The provider (must be listing owner)
    pub provider: Signer<'info>,

    /// The listing to update
    #[account(
        mut,
        constraint = listing.provider_id == provider.key() @ ServiceMarketplaceError::Unauthorized
    )]
    pub listing: Account<'info, ServiceListing>,
}

/// Context for deactivating a service listing
#[derive(Accounts)]
pub struct DeactivateListing<'info> {
    /// The provider (must be listing owner)
    pub provider: Signer<'info>,

    /// The listing to deactivate
    #[account(
        mut,
        constraint = listing.provider_id == provider.key() @ ServiceMarketplaceError::Unauthorized
    )]
    pub listing: Account<'info, ServiceListing>,
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Validate if a service type is valid
fn is_valid_service_type(service_type: u8) -> bool {
    matches!(
        service_type,
        SERVICE_TYPE_YIELD_OPTIMIZATION
            | SERVICE_TYPE_RISK_ANALYSIS
            | SERVICE_TYPE_MARKET_PREDICTION
            | SERVICE_TYPE_STRATEGY_DEVELOPMENT
            | SERVICE_TYPE_DATA_ANALYSIS
            | SERVICE_TYPE_SMART_CONTRACT_AUDIT
            | SERVICE_TYPE_LIQUIDITY_PROVISION
            | SERVICE_TYPE_ARBITRAGE_DETECTION
            | SERVICE_TYPE_PORTFOLIO_MANAGEMENT
            | SERVICE_TYPE_CUSTOM
    )
}

// ============================================================================
// State Structures
// ============================================================================

/// Service listing created by providers
#[account]
pub struct ServiceListing {
    /// Unique listing identifier
    pub listing_id: Pubkey,
    /// Provider's agent ID
    pub provider_id: Pubkey,
    /// Primary service type (1-255)
    pub service_type: u8,
    /// Service title (max 100 characters)
    pub title: String,
    /// Service description (max 500 characters)
    pub description: String,
    /// Price in ARU tokens (lamports)
    pub price: u64,
    /// Expected delivery time in seconds
    pub delivery_time: u32,
    /// JSON string of requirements (max 500 characters)
    pub requirements: String,
    /// Active status flag
    pub is_active: bool,
    /// Unix timestamp of creation
    pub created_at: i64,
    /// Unix timestamp of last update
    pub updated_at: i64,
    /// Total number of purchases
    pub total_purchases: u64,
    /// Average rating (0-500, representing 0.00-5.00 stars * 100)
    pub average_rating: u16,
}

/// Service transaction record
#[account]
pub struct ServiceTransaction {
    /// Unique transaction identifier
    pub transaction_id: Pubkey,
    /// Listing identifier
    pub listing_id: Pubkey,
    /// Provider's agent ID
    pub provider_id: Pubkey,
    /// Consumer's agent ID
    pub consumer_id: Pubkey,
    /// Transaction price in ARU tokens
    pub price: u64,
    /// Current transaction status
    pub status: TransactionStatus,
    /// Unix timestamp of creation
    pub created_at: i64,
    /// Delivery deadline (unix timestamp)
    pub deadline: i64,
    /// Unix timestamp of completion (if completed)
    pub completed_at: Option<i64>,
    /// Associated escrow account
    pub escrow_account: Pubkey,
}

/// Transaction status enum
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum TransactionStatus {
    /// Transaction initiated, awaiting escrow
    Pending,
    /// Escrow created, service in progress
    InProgress,
    /// Provider marked as delivered
    Delivered,
    /// Consumer confirmed delivery
    Confirmed,
    /// Dispute raised
    Disputed,
    /// Dispute resolved
    Resolved,
    /// Transaction cancelled
    Cancelled,
}

/// Service review submitted by consumer
#[account]
pub struct ServiceReview {
    /// Unique review identifier
    pub review_id: Pubkey,
    /// Transaction identifier
    pub transaction_id: Pubkey,
    /// Consumer's agent ID
    pub consumer_id: Pubkey,
    /// Provider's agent ID
    pub provider_id: Pubkey,
    /// Rating (1-5 stars)
    pub rating: u8,
    /// Written feedback (max 500 characters)
    pub feedback: String,
    /// Unix timestamp of review creation
    pub created_at: i64,
}

/// Collaborative service listing with multiple providers
#[account]
pub struct CollaborativeListing {
    /// Unique listing identifier
    pub listing_id: Pubkey,
    /// List of participating agent IDs (max 10 participants)
    pub participants: Vec<Pubkey>,
    /// Payment shares in basis points (10000 = 100%, must sum to 10000)
    pub payment_shares: Vec<u16>,
    /// Base service listing data
    pub service_type: u8,
    pub title: String,
    pub description: String,
    pub price: u64,
    pub delivery_time: u32,
    pub requirements: String,
    pub is_active: bool,
    pub created_at: i64,
    pub updated_at: i64,
    pub total_purchases: u64,
    pub average_rating: u16,
}

// ============================================================================
// Constants - Service Types
// ============================================================================

/// Service type: Yield optimization strategies
pub const SERVICE_TYPE_YIELD_OPTIMIZATION: u8 = 1;
/// Service type: Risk analysis and assessment
pub const SERVICE_TYPE_RISK_ANALYSIS: u8 = 2;
/// Service type: Market prediction and forecasting
pub const SERVICE_TYPE_MARKET_PREDICTION: u8 = 3;
/// Service type: Strategy development and planning
pub const SERVICE_TYPE_STRATEGY_DEVELOPMENT: u8 = 4;
/// Service type: Data analysis and insights
pub const SERVICE_TYPE_DATA_ANALYSIS: u8 = 5;
/// Service type: Smart contract auditing
pub const SERVICE_TYPE_SMART_CONTRACT_AUDIT: u8 = 6;
/// Service type: Liquidity provision services
pub const SERVICE_TYPE_LIQUIDITY_PROVISION: u8 = 7;
/// Service type: Arbitrage detection and execution
pub const SERVICE_TYPE_ARBITRAGE_DETECTION: u8 = 8;
/// Service type: Portfolio management
pub const SERVICE_TYPE_PORTFOLIO_MANAGEMENT: u8 = 9;
/// Service type: Custom services
pub const SERVICE_TYPE_CUSTOM: u8 = 255;

// ============================================================================
// Constants - Limits
// ============================================================================

/// Maximum length for service title
pub const MAX_TITLE_LENGTH: usize = 100;
/// Maximum length for service description
pub const MAX_DESCRIPTION_LENGTH: usize = 500;
/// Maximum length for requirements JSON
pub const MAX_REQUIREMENTS_LENGTH: usize = 500;
/// Maximum length for review feedback
pub const MAX_FEEDBACK_LENGTH: usize = 500;
/// Maximum number of participants in collaborative listing
pub const MAX_PARTICIPANTS: usize = 10;
/// Basis points representing 100%
pub const BASIS_POINTS_TOTAL: u16 = 10000;

// ============================================================================
// Errors
// ============================================================================

#[error_code]
pub enum ServiceMarketplaceError {
    #[msg("Service title exceeds maximum length of 100 characters")]
    TitleTooLong,
    #[msg("Service title cannot be empty")]
    TitleEmpty,
    #[msg("Service description exceeds maximum length of 500 characters")]
    DescriptionTooLong,
    #[msg("Service description cannot be empty")]
    DescriptionEmpty,
    #[msg("Requirements string exceeds maximum length of 500 characters")]
    RequirementsTooLong,
    #[msg("Invalid service type")]
    InvalidServiceType,
    #[msg("Price must be greater than zero")]
    InvalidPrice,
    #[msg("Delivery time must be greater than zero")]
    InvalidDeliveryTime,
    #[msg("Agent is not registered")]
    AgentNotRegistered,
    #[msg("Agent does not meet minimum reputation requirement")]
    InsufficientReputation,
    #[msg("Listing not found")]
    ListingNotFound,
    #[msg("Unauthorized: only listing owner can perform this action")]
    Unauthorized,
    #[msg("Listing is not active")]
    ListingNotActive,
    #[msg("Transaction not found")]
    TransactionNotFound,
    #[msg("Invalid transaction status for this operation")]
    InvalidTransactionStatus,
    #[msg("Review feedback exceeds maximum length of 500 characters")]
    FeedbackTooLong,
    #[msg("Rating must be between 1 and 5")]
    InvalidRating,
    #[msg("Review already exists for this transaction")]
    DuplicateReview,
    #[msg("Too many participants (maximum 10)")]
    TooManyParticipants,
    #[msg("Payment shares must sum to 10000 basis points (100%)")]
    InvalidPaymentShares,
    #[msg("Participants and payment shares length mismatch")]
    ParticipantSharesMismatch,
}

// ============================================================================
// Events
// ============================================================================

/// Event emitted when a new listing is created
#[event]
pub struct ListingCreatedEvent {
    pub listing_id: Pubkey,
    pub provider_id: Pubkey,
    pub service_type: u8,
    pub title: String,
    pub price: u64,
    pub timestamp: i64,
}

/// Event emitted when a listing is updated
#[event]
pub struct ListingUpdatedEvent {
    pub listing_id: Pubkey,
    pub provider_id: Pubkey,
    pub timestamp: i64,
}

/// Event emitted when a listing is deactivated
#[event]
pub struct ListingDeactivatedEvent {
    pub listing_id: Pubkey,
    pub provider_id: Pubkey,
    pub timestamp: i64,
}
