# Task 2.1 Implementation: GlobalState and AgentRegistry Account Structures

## Overview
This task implements the core account structures for the ARS protocol with security revisions including admin transfer, circuit breaker, agent registration, and Byzantine fault-tolerant consensus.

## Files Created/Modified

### 1. `src/state.rs` (NEW)
Contains all account structures and enums for the ARS Core program:

#### GlobalState
- **Purpose**: Main protocol state with admin transfer and circuit breaker mechanisms
- **New Fields Added**:
  - `pending_authority: Option<Pubkey>` - Pending admin transfer
  - `transfer_timelock: i64` - 48-hour timelock for admin transfers
  - `circuit_breaker_timelock: i64` - 24-hour timelock for circuit breaker
  - `min_agent_consensus: u8` - Minimum agents required for consensus (default: 3)
- **Space**: 179 bytes (calculated in `GlobalState::LEN`)

#### AgentRegistry
- **Purpose**: Track registered agents with tier, stake, and reputation
- **Fields**:
  - `agent_pubkey: Pubkey` - Agent's public key
  - `agent_tier: AgentTier` - Tier based on stake (Bronze/Silver/Gold/Platinum)
  - `stake_amount: u64` - Staked amount in lamports
  - `reputation_score: i32` - Can be negative (capped at -1000)
  - `total_ili_updates: u64` - Total ILI updates submitted
  - `successful_updates: u64` - Successful ILI updates
  - `slashed_amount: u64` - Total amount slashed
  - `registered_at: i64` - Registration timestamp
  - `last_active: i64` - Last activity timestamp
  - `is_active: bool` - Active status flag
  - `bump: u8` - PDA bump
- **Space**: 95 bytes (calculated in `AgentRegistry::LEN`)

#### AgentTier Enum
- **Purpose**: Categorize agents based on stake amount
- **Tiers**:
  - `Bronze`: 100-999 ARU staked
  - `Silver`: 1,000-9,999 ARU staked
  - `Gold`: 10,000-99,999 ARU staked
  - `Platinum`: 100,000+ ARU staked
- **Helper**: `from_stake(stake_amount: u64)` - Calculate tier from stake

#### ILIOracle
- **Purpose**: Byzantine fault-tolerant ILI updates with consensus
- **New Fields**:
  - `pending_updates: Vec<ILIPendingUpdate>` - Pending updates awaiting consensus
  - `consensus_threshold: u8` - Minimum agents required (default: 3)
  - `update_interval: i64` - Update interval in seconds (default: 300 = 5 minutes)
- **Space**: 1190 bytes (allows up to 10 pending updates)

#### ILIPendingUpdate Struct
- **Purpose**: Store pending ILI updates for Byzantine consensus
- **Fields**:
  - `agent: Pubkey` - Agent submitting the update
  - `ili_value: u64` - ILI value submitted
  - `timestamp: i64` - Submission timestamp
  - `signature: [u8; 64]` - Ed25519 signature
- **Space**: 112 bytes per update

#### PolicyProposal
- **Purpose**: Futarchy governance with quadratic voting
- **New Fields**:
  - `policy_type: PolicyType` - Type of policy (enum)
  - `quadratic_yes: u64` - Quadratic voting power for yes (sqrt of yes_stake)
  - `quadratic_no: u64` - Quadratic voting power for no (sqrt of no_stake)
  - `status: ProposalStatus` - Proposal status (enum)
  - `execution_tx: Option<[u8; 64]>` - Execution transaction signature
  - `griefing_protection_deposit: u64` - Minimum 10 ARU deposit
- **Space**: 421 bytes (allows up to 256 bytes for policy_params)

#### PolicyType Enum
- `MintARU` - Mint ARU tokens
- `BurnARU` - Burn ARU tokens
- `UpdateParameters` - Update protocol parameters
- `RebalanceVault` - Rebalance reserve vault

#### ProposalStatus Enum
- `Active` - Proposal is active and accepting votes
- `Passed` - Proposal passed and awaiting execution
- `Rejected` - Proposal was rejected
- `Executed` - Proposal was executed

### 2. `src/errors.rs` (NEW)
Contains all error codes for the ARS Core program:

#### Error Categories
1. **Arithmetic Errors**: `ArithmeticOverflow`
2. **Authorization Errors**: `Unauthorized`
3. **Admin Transfer Errors**: `TimelockNotExpired`, `NoPendingTransfer`
4. **Agent Registration Errors**: `InsufficientStake`, `AgentNotActive`
5. **ILI Update Errors**: `UpdateTooFrequent`, `InvalidSignature`, `InsufficientConsensus`
6. **Proposal Errors**: `ProposalNotActive`, `InvalidVotingPeriod`, `InvalidStakeAmount`
7. **Circuit Breaker Errors**: `CircuitBreakerActive`, `InsufficientReputation`, `InsufficientDeposit`
8. **Slashing Errors**: `SlashAmountTooHigh`
9. **General Validation Errors**: Various validation errors for parameters

### 3. `src/lib.rs` (MODIFIED)
Updated to use the new modular structure:

#### Changes
1. Added module declarations: `pub mod state;` and `pub mod errors;`
2. Added re-exports: `pub use state::*;` and `pub use errors::*;`
3. Updated `Initialize` context to use `GlobalState::LEN` and `ILIOracle::LEN`
4. Updated `initialize` function to initialize new fields:
   - `pending_authority = None`
   - `transfer_timelock = 0`
   - `circuit_breaker_timelock = 0`
   - `min_agent_consensus = 3`
   - ILI Oracle initialization with new fields
5. Updated `CreateProposal` context to use `PolicyProposal::LEN`
6. Updated `create_proposal` function to use new `PolicyType` enum and initialize quadratic voting fields
7. Added backward compatibility note for `update_ili` function

## Requirements Validated

### Requirement 1.1
✅ GlobalState account created with admin authority and initial parameters

### Requirement 1.4
✅ AgentRegistry account structure defined with:
- Tier system (Bronze/Silver/Gold/Platinum)
- Stake amount tracking
- Reputation score (can be negative)
- Activity tracking

## Design Compliance

All account structures follow the design document specifications:
- Proper discriminators (handled by Anchor's `#[account]` macro)
- PDA bumps included in all account structures
- Space calculations use const functions for clarity
- All fields documented with inline comments
- Enums use `AnchorSerialize` and `AnchorDeserialize` traits

## Security Features

1. **Checked Arithmetic**: All arithmetic operations in functions use `checked_add`, `checked_sub`, etc.
2. **Space Calculations**: Explicit space calculations prevent account size issues
3. **Type Safety**: Strong typing with enums for tiers, policy types, and statuses
4. **Documentation**: All structures and fields are well-documented

## Next Steps

The following tasks will build upon these account structures:
- **Task 2.2**: Implement admin transfer mechanism with 48h timelock
- **Task 2.4**: Implement agent registration with stake-based tiers
- **Task 2.6**: Implement Byzantine fault-tolerant ILI updates
- **Task 2.8**: Implement futarchy governance with quadratic voting
- **Task 2.10**: Implement circuit breaker with griefing protection
- **Task 2.12**: Implement reputation and slashing system

## Testing Notes

To test these structures:
1. Build the program: `anchor build --program-name ars-core`
2. Run tests: `anchor test --skip-deploy`
3. Verify account sizes match expected values
4. Test initialization with various parameters
5. Verify PDA derivations work correctly

## Backward Compatibility

The implementation maintains backward compatibility with existing functions:
- `initialize` function signature unchanged
- `update_ili` function still works (will be enhanced in task 2.6)
- `create_proposal` function enhanced with new fields but maintains core functionality
