# Implementation Plan: Pinocchio Migration

## Overview

This plan outlines the migration of three ARS Solana programs from Anchor 0.30.1 to Pinocchio 0.10.1. The migration follows a systematic approach: setup infrastructure, migrate core types, migrate instructions program-by-program, implement security features, and validate through comprehensive testing. Each task builds incrementally to ensure continuous validation.

## Tasks

- [x] 1. Setup migration infrastructure and dependencies
  - Update Cargo.toml for all three programs to use Pinocchio dependencies (`pinocchio = "0.10.1"`, `pinocchio-system = "0.10.1"`, `pinocchio-token = "0.10.1"`)
  - Remove Anchor dependencies (`anchor-lang`, `anchor-spl`)
  - Create parallel test harness for comparing Anchor and Pinocchio implementations
  - Set up build configuration to compile both versions for comparison
  - _Requirements: 1.4, 2.4, 3.4, 6.6_

- [x] 2. Migrate core types and utilities
  - [x] 2.1 Implement account structures with zero-copy deserialization
    - Create `GlobalState` struct with `from_bytes()` and `from_bytes_mut()` methods
    - Create `Proposal` struct with zero-copy deserialization
    - Create `Vault` struct for ars-reserve
    - Add account discriminators for type safety
    - _Requirements: 2.6, 5.3_
  
  - [x] 2.2 Write property test for account structure compatibility
    - **Property 4: Account Structure Compatibility**
    - **Validates: Requirements 2.6, 8.3**
  
  - [x] 2.3 Migrate error types and codes
    - Create `CustomError` enum with all error variants (InvalidAuthority, InsufficientFunds, CircuitBreakerActive, etc.)
    - Implement `From<CustomError> for ProgramError` conversion
    - Preserve all error code numbers from Anchor implementation
    - _Requirements: 5.8, 13.4_
  
  - [x] 2.4 Write property test for error code compatibility
    - **Property 18: Error Code Compatibility**
    - **Validates: Requirements 5.8**
  
  - [x] 2.5 Migrate fixed-point math utilities
    - Implement `mul_fixed()` with 18-decimal precision
    - Implement `div_fixed()` with overflow checks
    - Implement `sqrt_u64()` for quadratic staking
    - Use checked arithmetic throughout
    - _Requirements: 10.1, 10.2, 10.5_
  
  - [x] 2.6 Write property tests for fixed-point arithmetic
    - **Property 20: Fixed-Point Multiplication Equivalence**
    - **Property 21: Fixed-Point Division Equivalence**
    - **Property 22: Overflow Detection Equivalence**
    - **Property 24: Precision Preservation**
    - **Validates: Requirements 10.1, 10.2, 10.3, 10.5**

- [x] 3. Create account validation utilities
  - [x] 3.1 Implement validation helper functions
    - Create `validate_signer()` to check `is_signer()`
    - Create `validate_writable()` to check `is_writable()`
    - Create `validate_owner()` to verify account ownership
    - Create `validate_pda()` to verify PDA seeds and bump
    - Create `validate_program()` to check program IDs
    - _Requirements: 4.5, 4.6, 11.1, 11.3_
  
  - [x] 3.2 Write property tests for account validation
    - **Property 12: Access Control Validation**
    - **Property 26: PDA Validation**
    - **Validates: Requirements 4.5, 4.6, 11.1, 11.3**

- [x] 4. Migrate ars-core program entry point and instruction dispatch
  - [x] 4.1 Implement Pinocchio entry point
    - Create `entrypoint()` function using `pinocchio::entrypoint::parse_input()`
    - Implement `process_instruction()` with instruction discriminator matching
    - Map instruction bytes to handler functions (0=initialize, 1=update_ili, etc.)
    - _Requirements: 1.5_
  
  - [x] 4.2 Implement instruction data parsing utilities
    - Create parsing helpers for instruction data deserialization
    - Add length validation before parsing
    - _Requirements: 15.3, 15.4_
  
  - [x] 4.3 Write property tests for instruction parsing
    - **Property 27: Instruction Data Length Validation**
    - **Property 28: Invalid Instruction Error Handling**
    - **Property 29: Instruction Parsing Round-Trip**
    - **Validates: Requirements 15.3, 15.4, 15.6**

- [ ] 5. Migrate ars-core initialize instruction
  - [x] 5.1 Implement initialize instruction handler
    - Parse and validate accounts (global_state, authority, system_program)
    - Derive PDA with seeds `[b"global_state"]`
    - Use `pinocchio_system::instructions::CreateAccount` for CPI
    - Initialize `GlobalState` with authority, bump, and default values
    - _Requirements: 1.5, 5.3_
  
  - [x] 5.2 Write unit tests for initialize instruction
    - Test successful initialization
    - Test with invalid authority
    - Test PDA derivation
    - _Requirements: 1.5_

- [x] 6. Migrate ars-core ILI instructions
  - [x] 6.1 Implement update_ili instruction
    - Validate accounts and authority
    - Check circuit breaker status
    - Deserialize new ILI value from instruction data
    - Update `GlobalState.ili_value` and `last_ili_update` timestamp
    - _Requirements: 1.5, 5.1_
  
  - [x] 6.2 Implement query_ili instruction
    - Validate global state account
    - Return current ILI value and timestamp
    - _Requirements: 1.5, 5.1_
  
  - [x] 6.3 Write property test for ILI calculation equivalence
    - **Property 13: ILI Calculation Equivalence**
    - **Validates: Requirements 5.1**

- [x] 7. Migrate ars-core governance instructions
  - [x] 7.1 Implement create_proposal instruction
    - Validate accounts and proposer signature
    - Parse proposal parameters (type, target_value, voting_period)
    - Create proposal account with PDA seeds `[b"proposal", proposal_id.to_le_bytes()]`
    - Initialize `Proposal` struct with parameters
    - Increment `GlobalState.proposal_count`
    - _Requirements: 1.5, 5.3_
  
  - [x] 7.2 Write property test for proposal data format
    - **Property 15: Proposal Data Format Compatibility**
    - **Validates: Requirements 5.3**
  
  - [x] 7.3 Implement vote_on_proposal instruction
    - Validate proposal account and voter signature
    - Check voting period hasn't ended
    - Get stake amount from voter_stake_account
    - Calculate vote weight using `sqrt_u64()` for quadratic staking
    - Update `Proposal.yes_votes` or `Proposal.no_votes`
    - _Requirements: 1.5, 5.4_
  
  - [x] 7.4 Write property test for quadratic staking
    - **Property 16: Quadratic Staking Calculation**
    - **Validates: Requirements 5.4**
  
  - [x] 7.5 Implement execute_proposal instruction
    - Validate proposal account and execution conditions
    - Check voting period has ended
    - Check proposal hasn't been executed
    - Verify yes_votes > no_votes
    - Apply policy changes based on proposal type
    - Mark proposal as executed
    - _Requirements: 1.5, 5.5_
  
  - [x] 7.6 Write property test for proposal execution logic
    - **Property 17: Proposal Execution Logic**
    - **Validates: Requirements 5.5**

- [x] 8. Implement circuit breaker for ars-core
  - [x] 8.1 Implement circuit_breaker instruction
    - Validate authority signature
    - Set `GlobalState.circuit_breaker_active = true`
    - Set `GlobalState.circuit_breaker_until` to current_time + 24 hours
    - _Requirements: 4.2, 4.7_
  
  - [x] 8.2 Add circuit breaker checks to all instructions
    - Create `check_circuit_breaker()` helper function
    - Call before executing state-changing operations
    - Auto-deactivate if timelock expired
    - _Requirements: 4.2, 4.7_
  
  - [x] 8.3 Write property test for circuit breaker
    - **Property 9: Circuit Breaker Activation**
    - **Validates: Requirements 4.2, 4.7**

- [x] 9. Implement reentrancy guards for ars-core
  - [x] 9.1 Add reentrancy_guard field to GlobalState
    - Add `reentrancy_guard: bool` field to struct
    - Implement `acquire_reentrancy_lock()` function
    - Implement `release_reentrancy_lock()` function
    - _Requirements: 4.3_
  
  - [x] 9.2 Add reentrancy protection to critical instructions
    - Wrap execute_proposal logic with lock acquisition/release
    - Wrap other state-changing operations
    - _Requirements: 4.3_
  
  - [x] 9.3 Write property test for reentrancy prevention
    - **Property 10: Reentrancy Prevention**
    - **Validates: Requirements 4.3**

- [x] 10. Checkpoint - Ensure ars-core tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 11. Migrate ars-reserve program entry point
  - [x] 11.1 Implement Pinocchio entry point for ars-reserve
    - Create `entrypoint()` and `process_instruction()`
    - Map instruction discriminators (0=initialize_vault, 1=deposit, 2=withdraw, 3=update_vhr, 4=rebalance)
    - _Requirements: 2.3_
  
  - [x] 11.2 Implement Vault account structure
    - Create `Vault` struct with zero-copy deserialization
    - Add fields for SOL, USDC, mSOL, JitoSOL amounts
    - Add VHR, last_rebalance, rebalance_threshold fields
    - _Requirements: 2.6_

- [x] 12. Migrate ars-reserve vault instructions
  - [x] 12.1 Implement initialize_vault instruction
    - Validate accounts and authority
    - Create vault PDA with seeds `[b"vault"]`
    - Initialize Vault struct with zero balances
    - Set default rebalance_threshold (e.g., 5% = 0.05 * 10^18)
    - _Requirements: 2.3_
  
  - [x] 12.2 Implement deposit instruction
    - Validate accounts (vault, user_token_account, vault_token_account, authority, token_program)
    - Parse deposit amount from instruction data
    - Use `pinocchio_token::instructions::Transfer` for CPI
    - Update corresponding vault amount field (usdc_amount, sol_amount, etc.)
    - _Requirements: 2.3_
  
  - [x] 12.3 Implement withdraw instruction
    - Validate accounts and authority
    - Parse withdraw amount
    - Check sufficient vault balance
    - Use `pinocchio_token::instructions::Transfer` for CPI (vault to user)
    - Update vault amount field
    - _Requirements: 2.3_
  
  - [x] 12.4 Implement update_vhr instruction
    - Validate accounts and authority
    - Calculate total vault value in USD terms
    - Calculate total ARU supply
    - Compute VHR = (vault_value / aru_supply) with fixed-point math
    - Update `Vault.vhr` field
    - _Requirements: 2.3_

- [x] 13. Implement vault rebalancing logic
  - [x] 13.1 Implement rebalance instruction
    - Validate accounts and authority
    - Check if rebalancing is needed (VHR deviation > threshold)
    - Calculate target allocations for each asset
    - Execute token swaps via Jupiter CPI (if needed)
    - Update vault amounts
    - Update `Vault.last_rebalance` timestamp
    - _Requirements: 2.7, 5.6_
  
  - [x] 13.2 Write property test for rebalancing logic
    - **Property 5: Rebalancing Logic Preservation**
    - **Validates: Requirements 2.7, 5.6**

- [x] 14. Checkpoint - Ensure ars-reserve tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 15. Migrate ars-token program entry point
  - [x] 15.1 Implement Pinocchio entry point for ars-token
    - Create `entrypoint()` and `process_instruction()`
    - Map instruction discriminators (0=initialize_mint, 1=mint_icu, 2=burn_icu, 3=start_new_epoch)
    - _Requirements: 3.3_
  
  - [x] 15.2 Implement MintState account structure
    - Create `MintState` struct with zero-copy deserialization
    - Add fields for current_epoch, total_supply, supply_cap, last_epoch_start
    - _Requirements: 3.6_

- [x] 16. Migrate ars-token lifecycle instructions
  - [x] 16.1 Implement initialize_mint instruction
    - Validate accounts and authority
    - Create mint PDA with seeds `[C:\Users\raden\Documents\Hackathon\agentic-reserve-system\target\deploy\ars_mint.json]
    - Initialize SPL token mint using `pinocchio_token`
    - Initialize MintState with epoch 0 and supply cap
    - _Requirements: 3.3_
  
  - [x] 16.2 Implement mint_icu instruction
    - Validate accounts and authority
    - Parse mint amount from instruction data
    - Check supply cap not exceeded
    - Use `pinocchio_token::instructions::MintTo` for CPI
    - Update `MintState.total_supply`
    - _Requirements: 3.3, 4.4, 5.7_
  
  - [x] 16.3 Write property test for supply cap enforcement
    - **Property 11: Supply Cap Enforcement**
    - **Validates: Requirements 4.4**
  
  - [x] 16.4 Implement burn_icu instruction
    - Validate accounts and authority
    - Parse burn amount
    - Use `pinocchio_token::instructions::Burn` for CPI
    - Update `MintState.total_supply`
    - _Requirements: 3.3_
  
  - [x] 16.5 Implement start_new_epoch instruction
    - Validate accounts and authority
    - Check sufficient time has passed since last epoch
    - Increment `MintState.current_epoch`
    - Update `MintState.last_epoch_start` timestamp
    - Apply epoch-based supply adjustments if configured
    - _Requirements: 3.5_
  
  - [x] 16.6 Write property tests for epoch supply control
    - **Property 6: Epoch Supply Control Preservation**
    - **Property 7: Mint State Tracking Preservation**
    - **Validates: Requirements 3.5, 3.6**

- [x] 17. Checkpoint - Ensure ars-token tests pass
  - Ensure all tests pass, ask the user if questions arise.

- [x] 18. Implement Ed25519 signature verification
  - [x] 18.1 Create Ed25519 verification utility
    - Implement `verify_agent_signature()` function
    - Load Ed25519 instruction from instructions sysvar using `load_instruction_at()`
    - Verify instruction program_id is `pinocchio::ED25519_PROGRAM_ID`
    - Parse and validate signature, public key, and message from instruction data
    - _Requirements: 4.1_
  
  - [x] 18.2 Add agent signature verification to relevant instructions
    - Add verification to create_proposal (verify proposer is authorized agent)
    - Add verification to execute_proposal (verify executor is authorized agent)
    - _Requirements: 4.1_
  
  - [x] 18.3 Write property test for Ed25519 verification
    - **Property 8: Ed25519 Signature Verification**
    - **Validates: Requirements 4.1**

- [x] 19. Implement comprehensive property-based test suite
  - [x] 19.1 Write property tests for instruction interface compatibility
    - **Property 3: Instruction Interface Compatibility**
    - Test that Pinocchio accepts same instruction data as Anchor
    - **Validates: Requirements 1.3, 2.3, 3.3**
  
  - [x] 19.2 Write property test for ICR calculation equivalence
    - **Property 14: ICR Calculation Equivalence**
    - **Validates: Requirements 5.2**
  
  - [x] 19.3 Write property test for rounding behavior
    - **Property 23: Rounding Behavior Equivalence**
    - **Validates: Requirements 10.4**
  
  - [x] 19.4 Write property test for account data length validation
    - **Property 25: Account Data Length Validation**
    - **Validates: Requirements 11.2**

- [x] 20. Implement performance benchmarking suite
  - [x] 20.1 Create compute unit measurement tests
    - Measure compute units for each instruction in all three programs
    - Compare with Anchor baseline measurements
    - Verify 15% reduction target achieved
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [x] 20.2 Write property test for compute unit reduction
    - **Property 2: Compute Unit Reduction**
    - **Validates: Requirements 1.2, 2.2, 3.2, 6.1, 6.2, 6.3**
  
  - [x] 20.3 Create binary size measurement tests
    - Measure compiled binary sizes for all three programs
    - Compare with Anchor baseline sizes
    - Verify 20% reduction target achieved
    - _Requirements: 6.4_
  
  - [x] 20.4 Write property test for binary size reduction
    - **Property 1: Binary Size Reduction**
    - **Validates: Requirements 1.1, 2.1, 3.1, 6.4**
  
  - [x] 20.5 Create deserialization performance benchmarks
    - Benchmark account deserialization for all account types
    - Compare with Anchor deserialization performance
    - _Requirements: 6.5_
  
  - [x] 20.6 Write property test for deserialization performance
    - **Property 19: Deserialization Performance**
    - **Validates: Requirements 6.5**

- [x] 21. Implement integration test suite
  - [x] 21.1 Write cross-program integration tests
    - Test ars-core → ars-reserve interactions
    - Test ars-core → ars-token interactions
    - Test complete workflows (create proposal → vote → execute → mint tokens)
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 5.5_
  
  - [x] 21.2 Write compatibility tests with Anchor-created accounts
    - Deploy Anchor version to test validator
    - Create accounts with Anchor
    - Read and modify accounts with Pinocchio version
    - Verify data compatibility
    - _Requirements: 8.3_

- [x] 22. Create deployment and migration documentation
  - [x] 22.1 Document API migration guide
    - List all type changes (AccountInfo → AccountView, Pubkey → Address)
    - Provide before/after code examples for each instruction
    - Document CPI changes
    - _Requirements: 9.1, 9.2, 9.3, 9.4, 9.5_
  
  - [x] 22.2 Document performance improvements
    - Document measured binary size reductions
    - Document measured compute unit reductions
    - Document deserialization performance improvements
    - _Requirements: 6.1, 6.2, 6.3, 6.4, 6.5_
  
  - [x] 22.3 Create deployment scripts
    - Create devnet deployment script with program ID preservation
    - Create mainnet deployment script with upgrade authority
    - Create rollback script for emergency reversion
    - _Requirements: 8.1, 8.2, 8.5_

- [ ] 23. Final validation and deployment preparation
  - [ ] 23.1 Run complete test suite
    - Execute all unit tests
    - Execute all property-based tests (100+ iterations each)
    - Execute all integration tests
    - Execute all performance benchmarks
    - Verify all tests pass
    - _Requirements: 1.1, 1.2, 1.3, 2.1, 2.2, 2.3, 3.1, 3.2, 3.3_
  
  - [ ] 23.2 Deploy to devnet and validate
    - Deploy all three programs to devnet
    - Run smoke tests with real transactions
    - Monitor compute unit consumption
    - Monitor transaction success rates
    - Verify compatibility with existing clients
    - _Requirements: 8.1, 8.3_
  
  - [ ] 23.3 Prepare mainnet deployment
    - Review all code changes
    - Verify upgrade authority configuration
    - Prepare rollback plan
    - Document monitoring strategy
    - _Requirements: 8.2, 8.5_

## Notes

- All tasks including property-based tests are required for comprehensive validation
- Each task references specific requirements for traceability
- Checkpoints ensure incremental validation after each program migration
- Property tests validate universal correctness properties with 100+ iterations
- Unit tests validate specific examples and edge cases
- Integration tests validate cross-program interactions
- Performance benchmarks validate compute unit and binary size targets
- The migration preserves all functionality while achieving measurable performance improvements
