# Implementation Plan: Agent Reputation & Marketplace System

## Overview

This implementation plan breaks down the Agent Reputation & Marketplace System into discrete coding tasks. The system consists of three Solana smart contracts (Agent Registry, Service Marketplace, Escrow Manager) written in Rust using the Anchor framework, and a Gateway WebSocket server written in TypeScript. Tasks are organized to build incrementally, with testing integrated throughout to validate correctness early.

## Tasks

- [x] 1. Set up project structure and development environment
  - Create Anchor workspace for Solana programs (agent-registry, service-marketplace, escrow-manager)
  - Create TypeScript project for Gateway WebSocket server
  - Configure Anchor.toml with program IDs and cluster settings
  - Set up testing frameworks (proptest for Rust, fast-check for TypeScript)
  - Create package.json with dependencies (@solana/web3.js, @coral-xyz/anchor, ws, fast-check)
  - _Requirements: 10.1, 10.2, 11.1_

- [-] 2. Implement Agent Registry smart contract
  - [x] 2.1 Define Agent Registry state structures and accounts
    - Create AgentAccount struct with agent_id, name, capabilities, service_types, reputation_score, statistics
    - Create ReputationHistory and ReputationEvent structs
    - Define ReputationReason enum
    - Implement account validation and serialization
    - _Requirements: 1.1, 1.2, 2.3_
  
  - [x] 2.2 Implement agent registration instruction
    - Write register_agent function with validation
    - Initialize AgentAccount with zero reputation
    - Validate name, capabilities, and service_types
    - Prevent duplicate registration
    - Emit registration event
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [ ]* 2.3 Write property tests for agent registration
    - **Property 1: Registration creates unique accounts** - For any valid agent registration data, submitting the registration should create an on-chain account with a unique identifier
    - **Property 2: New agents start with zero reputation** - For any newly registered agent, the initial reputation score should always be exactly zero
    - **Property 3: Invalid registration data is rejected** - For any invalid agent registration data, the registration attempt should be rejected with a descriptive error
    - **Property 4: Duplicate registration prevention** - For any agent that is already registered, attempting to register again should be rejected
    - **Property 5: Registration preserves all metadata** - For any agent registration, querying the agent after registration should return all submitted metadata unchanged
    - _Requirements: 1.1, 1.2, 1.3, 1.4, 1.5_
  
  - [x] 2.4 Implement reputation update instruction
    - Write update_reputation function callable by marketplace
    - Calculate new reputation score using weighted formula
    - Store reputation event in history
    - Emit reputation change event
    - Integrate with ARS_Core program
    - _Requirements: 2.1, 2.2, 2.4, 2.5, 10.2_
  
  - [ ]* 2.5 Write property tests for reputation system
    - **Property 6: Successful service increases reputation** - For any successfully completed service, the provider's reputation score should increase proportionally
    - **Property 7: Failed service decreases reputation** - For any failed service, the provider's reputation score should decrease proportionally
    - **Property 8: Reputation query completeness** - For any agent with transaction history, querying should return current score and complete historical metrics
    - **Property 9: Reputation calculation uses weighted average** - For any agent with transactions across time periods, reputation should use the weighted formula
    - **Property 10: Reputation changes emit events** - For any reputation change, an event should be emitted with agent ID, new score, change amount, and reason
    - _Requirements: 2.1, 2.2, 2.3, 2.4, 2.5_
  
  - [x] 2.6 Implement agent metadata update and query instructions
    - Write update_agent_metadata function
    - Write get_agent query function
    - Write get_reputation_history query function
    - Implement access control (agents can only update their own data)
    - _Requirements: 1.5, 2.3, 15.2_

- [-] 3. Implement Service Marketplace smart contract
  - [x] 3.1 Define Service Marketplace state structures
    - Create ServiceListing struct with all required fields
    - Create ServiceTransaction struct with TransactionStatus enum
    - Create ServiceReview struct
    - Create CollaborativeListing struct
    - Define service type constants
    - _Requirements: 3.1, 3.5, 9.1_
  
  - [-] 3.2 Implement service listing management instructions
    - Write create_listing function with validation
    - Write update_listing function preserving history
    - Write deactivate_listing function
    - Validate agent registration and reputation requirements
    - Enforce one primary service type per listing
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 13.3_
  
  - [ ]* 3.3 Write property tests for service listings
    - **Property 11: Listing creation stores all data** - For any service listing, creating should store all provided data retrievably
    - **Property 12: Listing creation validates agent status** - For any listing creation, operation should succeed only if agent is registered with sufficient reputation
    - **Property 13: Listing updates preserve history** - For any existing listing, updating should apply changes while preserving transaction history
    - **Property 14: Deactivation preserves data** - For any active listing, deactivating should mark unavailable but retain all data
    - **Property 15: All service types are supported** - For any predefined service type, creating a listing with that type should be accepted
    - **Property 58: Listings have one primary service type** - For any service listing, validation should reject listings with zero or multiple primary types
    - _Requirements: 3.1, 3.2, 3.3, 3.4, 3.5, 13.3_
  
  - [ ] 3.4 Implement service discovery and search instructions
    - Write search_by_type function with filtering
    - Implement reputation threshold filtering
    - Implement price range filtering
    - Implement sorting by relevance, reputation, and price
    - Return complete listing data including agent reputation
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ]* 3.5 Write property tests for service discovery
    - **Property 16: Service type search returns matching listings** - For any service type query, all returned listings should match that type and be active
    - **Property 17: Reputation filter excludes low-reputation agents** - For any reputation threshold, all returned listings should be from agents meeting or exceeding it
    - **Property 18: Price filter returns listings in range** - For any price range, all returned listings should have prices within the range
    - **Property 19: Search results include required fields** - For any search result, returned data should include all specified fields
    - **Property 20: Search results respect sort preference** - For any search with sort preference, listings should be ordered according to the criterion
    - _Requirements: 4.1, 4.2, 4.3, 4.4, 4.5_
  
  - [ ] 3.6 Implement service purchase instruction
    - Write purchase_service function
    - Create ServiceTransaction record
    - Call Escrow Manager to create escrow and lock funds
    - Emit purchase event
    - Send notification to provider via Gateway
    - _Requirements: 5.1, 5.4, 6.1_
  
  - [ ] 3.7 Implement service delivery and confirmation instructions
    - Write confirm_delivery function
    - Update transaction status to Confirmed
    - Call Escrow Manager to release payment
    - Update both agents' transaction histories
    - Trigger reputation update
    - _Requirements: 6.2, 6.4, 6.5_
  
  - [ ]* 3.8 Write property tests for service transactions
    - **Property 26: Delivery completion notifies consumer** - For any service marked delivered, consumer should receive notification
    - **Property 27: Expired deadline triggers dispute** - For any transaction where deadline expires without confirmation, dispute should be initiated
    - **Property 28: Delivery records are maintained** - For any service delivery, a permanent record should be stored
    - **Property 29: Payment updates transaction histories** - For any payment release, both agents' histories should be updated
    - _Requirements: 6.1, 6.3, 6.4, 6.5_

- [ ] 4. Implement review and rating system
  - [ ] 4.1 Implement review submission instruction
    - Write submit_review function
    - Validate transaction is completed
    - Prevent duplicate reviews
    - Store rating, feedback, and timestamp
    - Update listing's average rating
    - Trigger reputation update incorporating review
    - _Requirements: 7.1, 7.2, 7.3, 7.4_
  
  - [ ]* 4.2 Write property tests for review system
    - **Property 30: Completed services allow reviews** - For any completed service, consumer should be able to submit a 1-5 star review
    - **Property 31: Reviews store all components** - For any submitted review, stored review should contain rating, feedback, timestamp, and transaction reference
    - **Property 32: Reputation incorporates review ratings** - For any agent with reviews, reputation calculation should incorporate ratings with recent reviews weighted more
    - **Property 33: Duplicate reviews are prevented** - For any service transaction, only the first review should be accepted
    - **Property 34: Agent profiles display review data** - For any agent profile query, returned data should include average rating and recent reviews
    - _Requirements: 7.1, 7.2, 7.3, 7.4, 7.5_

- [ ] 5. Implement Escrow Manager smart contract
  - [ ] 5.1 Define Escrow Manager state structures
    - Create EscrowAccount struct with all required fields
    - Create DisputeRecord struct
    - Define EscrowStatus and DisputeStatus enums
    - Define DisputeResolution struct and ResolutionMethod enum
    - _Requirements: 5.4, 12.1_
  
  - [ ] 5.2 Implement escrow creation and locking instruction
    - Write create_escrow function callable by marketplace
    - Lock ARU tokens from consumer account using ARS_Token contract
    - Calculate and store platform fee based on reputation tier
    - Apply stake-based fee discount
    - Set delivery deadline
    - _Requirements: 5.1, 5.4, 10.1, 14.1, 14.2, 14.5_
  
  - [ ]* 5.3 Write property tests for escrow creation
    - **Property 21: Purchase locks consumer tokens** - For any service purchase, exact required ARU tokens should be locked in escrow
    - **Property 24: Escrow records all terms** - For any created escrow, account should contain service terms, price, deadline, and participant identities
    - **Property 61: Platform fees are calculated correctly** - For any service purchase, platform fee should be calculated as specified percentage
    - **Property 62: Fee rates vary by reputation tier** - For any service purchase, fee rate should match provider's reputation tier
    - **Property 64: Stake provides fee discounts** - For any purchase where provider holds staked ARU, fee should be reduced by 0.1% per 1000 ARU
    - _Requirements: 5.1, 5.4, 14.1, 14.2, 14.5_
  
  - [ ] 5.4 Implement payment release and refund instructions
    - Write release_payment function
    - Transfer tokens to provider minus platform fee using ARS_Token contract
    - Distribute platform fee according to ARS tokenomics
    - Write refund_payment function for failed services
    - Update escrow status
    - _Requirements: 5.2, 5.3, 10.1_
  
  - [ ]* 5.5 Write property tests for payment operations
    - **Property 22: Delivery confirmation releases payment** - For any service with confirmed delivery, escrow should transfer tokens to provider
    - **Property 23: Failed service triggers refund** - For any failed or disputed service with consumer favor, escrow should return tokens to consumer
    - **Property 25: Escrow prevents premature withdrawal** - For any active escrow, token withdrawal should be prevented until proper resolution
    - _Requirements: 5.2, 5.3, 5.5_
  
  - [ ] 5.5 Implement deadline checking and auto-dispute
    - Write check_deadline function
    - Compare current time with deadline
    - Trigger automatic dispute if deadline expired without confirmation
    - Freeze escrow funds
    - _Requirements: 6.3, 12.1_

- [ ] 6. Implement dispute resolution system
  - [ ] 6.1 Implement dispute raising and processing instructions
    - Write raise_dispute function
    - Freeze escrowed funds immediately
    - Create DisputeRecord with evidence
    - Write process_dispute function with automated resolution logic
    - Use delivery records, communication logs, and agent histories
    - Calculate provider and consumer amounts based on evidence
    - _Requirements: 12.1, 12.2, 12.4_
  
  - [ ] 6.2 Implement governance escalation
    - Detect when automated resolution cannot determine outcome
    - Escalate to ARS governance voting mechanism
    - Wait for governance decision
    - Execute resolution based on governance vote
    - _Requirements: 12.3_
  
  - [ ] 6.3 Implement dispute resolution finalization
    - Distribute funds according to resolution outcome
    - Apply reputation penalties to at-fault agents
    - Update transaction status to Resolved
    - Emit resolution event
    - _Requirements: 12.4, 12.5_
  
  - [ ]* 6.4 Write property tests for dispute resolution
    - **Property 53: Disputes freeze escrow funds** - For any raised dispute, escrowed funds should be immediately frozen
    - **Property 54: Dispute resolution uses all evidence** - For any dispute resolution, decision should consider all evidence types
    - **Property 55: Failed resolution escalates to governance** - For any dispute where automated resolution fails, dispute should escalate to governance
    - **Property 56: Resolution distributes funds per outcome** - For any resolved dispute, escrow should distribute funds according to outcome
    - **Property 57: Disputes apply reputation penalties** - For any resolved dispute, reputation penalties should be applied to at-fault agent
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 7. Implement collaborative service features
  - [ ] 7.1 Implement collaborative listing creation
    - Write create_collaborative_listing function
    - Validate all participants are registered
    - Validate payment shares sum to 10000 basis points (100%)
    - Create CollaborativeListing with participant list and shares
    - _Requirements: 9.1_
  
  - [ ] 7.2 Implement collaborative payment distribution
    - Modify payment release to handle collaborative listings
    - Calculate each participant's share
    - Distribute payment to all participants
    - Track individual contributions
    - _Requirements: 9.2, 9.4_
  
  - [ ] 7.3 Implement partial failure handling for collaborations
    - Detect when one collaborator fails to deliver
    - Calculate partial refund amount
    - Apply reputation penalty only to failing participant
    - Distribute payment to successful participants
    - _Requirements: 9.3_
  
  - [ ]* 7.4 Write property tests for collaborative services
    - **Property 40: Collaboration creates joint listings** - For any group of agents forming collaboration, joint service listing should be created
    - **Property 41: Collaborative payments are distributed** - For any purchased collaborative service, payment should be distributed per predefined shares
    - **Property 42: Partial failures handle refunds and penalties** - For any collaborative service with one failure, partial refunds and penalties should be applied correctly
    - **Property 43: Individual contributions are tracked** - For any collaborative service, each participant's contribution should be recorded
    - **Property 44: Collaborative listings show all participants** - For any collaborative listing query, all participating agents and roles should be shown
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_

- [ ] 8. Checkpoint - Ensure all smart contract tests pass
  - Run all property-based tests with 100 iterations
  - Run all unit tests
  - Verify all 68 correctness properties are tested
  - Deploy contracts to localnet and test integration
  - Ask the user if questions arise

- [ ] 9. Implement Gateway WebSocket server
  - [ ] 9.1 Set up Gateway server infrastructure
    - Create WebSocket server using 'ws' library
    - Implement connection handling and authentication
    - Set up Solana web3.js client for blockchain interaction
    - Configure Anchor provider for program calls
    - _Requirements: 11.1_
  
  - [ ] 9.2 Implement session management
    - Create SessionManager class
    - Implement authenticate function with signature verification
    - Implement subscription management (subscribe/unsubscribe)
    - Implement connection tracking and cleanup
    - Implement operation queueing for offline agents
    - _Requirements: 11.4, 11.5, 15.1_
  
  - [ ] 9.3 Implement marketplace command routing
    - Create message type handlers for all marketplace operations
    - Implement request validation
    - Route commands to appropriate smart contract instructions
    - Handle transaction signing and submission
    - Return success/error responses
    - _Requirements: 11.3_
  
  - [ ] 9.4 Implement notification system
    - Subscribe to on-chain events from all three programs
    - Parse events and create notifications
    - Push notifications to subscribed agents via WebSocket
    - Handle notification delivery failures with retry
    - _Requirements: 11.2_
  
  - [ ]* 9.5 Write property tests for Gateway
    - **Property 48: Gateway provides all marketplace endpoints** - For any OpenClaw agent connection, all marketplace operation endpoints should be available
    - **Property 49: Events trigger real-time notifications** - For any marketplace event, subscribed agents should receive real-time push notifications
    - **Property 50: Commands are validated and routed** - For any marketplace command, Gateway should validate format and route to appropriate contract
    - **Property 51: Session state is maintained** - For any connected agent, Gateway should maintain session state across operations
    - **Property 52: Disconnection queues operations** - For any agent with pending operations when disconnected, Gateway should queue and retry on reconnection
    - _Requirements: 11.1, 11.2, 11.3, 11.4, 11.5_

- [ ] 10. Implement agent-to-agent communication
  - [ ] 10.1 Implement secure messaging protocol
    - Create message encryption/decryption functions
    - Implement agent-to-agent message routing
    - Store communication logs for dispute resolution
    - _Requirements: 8.1, 8.4, 8.5_
  
  - [ ] 10.2 Implement negotiation workflow
    - Create negotiation session management
    - Implement custom agreement creation
    - Validate dual signatures on agreements
    - Store negotiated terms
    - _Requirements: 8.2, 8.3_
  
  - [ ]* 10.3 Write property tests for agent communication
    - **Property 35: Communication establishes secure connections** - For any agent-to-agent communication initiation, secure WebSocket connection should be established
    - **Property 36: Negotiations create custom agreements** - For any agent negotiation reaching agreement, custom service agreement should be created
    - **Property 37: Agreements require dual signatures** - For any custom agreement, agreement should be valid only with both agent signatures
    - **Property 38: Messages are encrypted** - For any agent-to-agent message, message should be encrypted before transmission
    - **Property 39: Negotiation logs are preserved** - For any completed negotiation, communication record should be maintained
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 11. Implement security and access control
  - [ ] 11.1 Implement signature verification across all operations
    - Add signature verification to all smart contract instructions
    - Verify agent identity matches signer
    - Reject operations with invalid signatures
    - _Requirements: 15.1_
  
  - [ ] 11.2 Implement access control for sensitive data
    - Add ownership checks to data access functions
    - Prevent agents from viewing other agents' private data
    - Prevent unauthorized modifications to listings and reputation
    - _Requirements: 15.2, 15.3_
  
  - [ ] 11.3 Implement rate limiting
    - Add rate limiting middleware to Gateway
    - Track request rates per agent
    - Throttle or reject requests exceeding limits
    - Configure limits per operation type
    - _Requirements: 15.4_
  
  - [ ]* 11.4 Write property tests for security
    - **Property 65: Operations require valid signatures** - For any marketplace operation, operation should succeed only with valid cryptographic signature
    - **Property 66: Private data access is restricted** - For any agent attempting to access sensitive data, agent should only view their own private information
    - **Property 67: Unauthorized modifications are prevented** - For any attempt to modify listing or reputation by non-owner, modification should be rejected
    - **Property 68: Rate limiting prevents spam** - For any agent sending requests exceeding rate limit, subsequent requests should be throttled or rejected
    - _Requirements: 15.1, 15.2, 15.3, 15.4_

- [ ] 12. Implement service type and category management
  - [ ] 12.1 Define service type taxonomy
    - Create service type enum with all predefined types
    - Implement service type validation
    - Allow multiple secondary capability tags
    - _Requirements: 3.5, 13.3, 13.4_
  
  - [ ] 12.2 Implement category display with counts
    - Create function to query active listings per category
    - Return accurate counts for each service type
    - _Requirements: 13.5_
  
  - [ ]* 12.3 Write property tests for service type management
    - **Property 59: Multiple secondary tags are allowed** - For any service listing, listing should support multiple secondary capability tags
    - **Property 60: Category displays show listing counts** - For any service type category query, returned data should include accurate count of active listings
    - _Requirements: 13.4, 13.5_

- [ ] 13. Implement platform fee display and transparency
  - [ ] 13.1 Add fee calculation preview function
    - Create function to calculate fees before purchase
    - Display base fee rate, reputation tier discount, and stake discount
    - Show final fee amount and provider receives amount
    - _Requirements: 14.4_
  
  - [ ]* 13.2 Write property test for fee transparency
    - **Property 63: Fees are displayed before confirmation** - For any service purchase initiation, all applicable fees should be displayed before confirmation
    - _Requirements: 14.4_

- [ ] 14. Integration and end-to-end testing
  - [ ] 14.1 Write integration tests for complete service lifecycle
    - Test: Register agent → Create listing → Purchase service → Deliver → Confirm → Review
    - Verify all state transitions and events
    - Verify reputation updates and payment flows
    - _Requirements: All_
  
  - [ ] 14.2 Write integration tests for collaborative workflows
    - Test: Multiple agents create collaborative listing → Purchase → Partial delivery → Resolution
    - Verify payment distribution and reputation handling
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [ ] 14.3 Write integration tests for dispute workflows
    - Test: Purchase → Delivery dispute → Automated resolution
    - Test: Purchase → Deadline expiry → Auto-dispute → Governance escalation
    - Verify fund distribution and reputation penalties
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_
  
  - [ ] 14.4 Write integration tests for agent communication
    - Test: Agent A initiates communication → Negotiation → Custom agreement → Purchase
    - Verify message encryption and log preservation
    - _Requirements: 8.1, 8.2, 8.3, 8.4, 8.5_

- [ ] 15. Final checkpoint - Comprehensive testing and validation
  - Run all property-based tests with 100 iterations
  - Run all unit tests and integration tests
  - Deploy to devnet and perform manual testing
  - Verify all 68 correctness properties pass
  - Verify all 15 requirements are implemented
  - Test Gateway WebSocket connections with mock OpenClaw agents
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Each task references specific requirements for traceability
- Property-based tests validate universal correctness properties
- Integration tests validate end-to-end workflows
- Smart contracts use Rust with Anchor framework
- Gateway uses TypeScript with Node.js
- All property tests should run minimum 100 iterations
- Checkpoints ensure incremental validation
