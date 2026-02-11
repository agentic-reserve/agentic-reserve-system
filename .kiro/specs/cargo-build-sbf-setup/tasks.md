# Implementation Plan: Cargo Build SBF Setup

## Overview

This implementation plan configures the ARS Protocol Solana programs to build using cargo-build-sbf. The approach focuses on verifying the existing configuration (which already uses Anchor 0.30.1 and should default to cargo-build-sbf), adding explicit documentation, creating build scripts for convenience, and implementing verification tests.

Since Anchor 0.30.0+ uses cargo-build-sbf by default, most of the configuration is already in place. The tasks focus on verification, documentation, and tooling to ensure the build system is robust and well-documented.

## Tasks

- [ ] 1. Verify Solana CLI and toolchain installation
  - Check that Solana CLI 1.18.26 is installed
  - Verify cargo-build-sbf is available and matches Solana version
  - Document installation instructions in README or setup guide
  - _Requirements: 1.1, 1.2, 1.3, 1.4_

- [ ] 2. Verify and document workspace configuration
  - [ ] 2.1 Verify workspace Cargo.toml dependencies
    - Confirm anchor-lang, anchor-spl, and solana-program versions
    - Verify constant_time_eq is pinned to 0.3.1
    - Confirm build profile settings (overflow-checks, lto, codegen-units)
    - _Requirements: 3.1, 3.2, 3.3, 3.5_
  
  - [ ] 2.2 Verify program Cargo.toml configurations
    - Check that all programs use workspace dependencies
    - Verify idl-build feature is included
    - Confirm crate-type and lib name settings
    - _Requirements: 3.4_
  
  - [ ] 2.3 Document Anchor.toml build configuration
    - Add comments explaining toolchain version
    - Document that Anchor 0.30+ uses cargo-build-sbf by default
    - Explain program address configuration
    - _Requirements: 2.1, 8.3_

- [ ] 3. Create build scripts
  - [ ] 3.1 Create scripts/build.sh
    - Implement dev, release, verify, and clean commands
    - Add error handling and status messages
    - Make script executable
    - _Requirements: 5.1, 5.2, 5.3, 5.4_
  
  - [ ] 3.2 Create scripts/verify-build.sh
    - Check for .so files in target/deploy/
    - Verify each file is a valid ELF shared object
    - Check file sizes are within limits
    - Output file paths and sizes
    - _Requirements: 6.1, 6.2, 6.3, 6.5_
  
  - [ ]* 3.3 Write unit tests for build scripts
    - Test each build.sh command option
    - Test verify-build.sh with valid and missing artifacts
    - Test error handling for invalid inputs
    - _Requirements: 5.1, 5.2, 5.3, 5.4_

- [ ] 4. Checkpoint - Test build process
  - Run `anchor build` and verify it succeeds
  - Run `anchor build --release` and verify optimizations
  - Run build scripts and verify they work correctly
  - Ensure all tests pass, ask the user if questions arise

- [ ] 5. Implement build verification tests
  - [ ] 5.1 Create test script for build artifact validation
    - Write script that runs anchor build
    - Verify all expected .so files are created
    - Check that files are valid ELF format
    - Verify file sizes are within Solana limits
    - _Requirements: 6.1, 6.2, 6.3_
  
  - [ ]* 5.2 Write property test for build artifact validity
    - **Property 1: Build Artifact Validity**
    - **Validates: Requirements 6.1, 6.2, 6.3**
    - Test that for any successful build, all programs produce valid artifacts
    - Run build multiple times with different configurations
    - Verify artifact validity each time
  
  - [ ]* 5.3 Write unit tests for incremental builds
    - Test that modifying one program only rebuilds that program
    - Test that clean removes all artifacts
    - Test that build after clean rebuilds everything
    - _Requirements: 7.1, 7.2_

- [ ] 6. Create documentation
  - [ ] 6.1 Document build system setup
    - Create or update BUILD.md with setup instructions
    - Document required environment variables (PATH for Solana)
    - List all required tool versions
    - Provide troubleshooting guide for common issues
    - _Requirements: 8.1, 8.4_
  
  - [ ] 6.2 Document configuration files
    - Add inline comments to Cargo.toml explaining each setting
    - Document why constant_time_eq is pinned
    - Explain build profile options (lto, overflow-checks, etc.)
    - Document Anchor.toml build-related settings
    - _Requirements: 8.2, 8.3_
  
  - [ ] 6.3 Document build commands and workflow
    - List all available build commands
    - Explain when to use dev vs release builds
    - Document build script usage
    - Explain differences between cargo-build-sbf and anchor build
    - _Requirements: 5.1, 5.2, 5.3, 5.4, 8.5_

- [ ] 7. Verify version compatibility
  - [ ] 7.1 Create version compatibility check script
    - Check Anchor CLI version matches anchor-lang version
    - Check Solana CLI version matches solana-program version
    - Check cargo-build-sbf version matches Solana CLI
    - Output compatibility matrix
    - _Requirements: 4.1, 4.2, 4.4_
  
  - [ ]* 7.2 Write tests for version checking
    - Test version check script with correct versions
    - Test error reporting with mismatched versions
    - Verify compatibility matrix is accurate
    - _Requirements: 4.3_

- [ ] 8. Final checkpoint - Complete verification
  - Run all build commands and verify they work
  - Run all verification scripts and tests
  - Review all documentation for completeness
  - Ensure all tests pass, ask the user if questions arise

## Notes

- Tasks marked with `*` are optional and can be skipped for faster MVP
- Most configuration is already correct since Anchor 0.30.1 uses cargo-build-sbf by default
- Focus is on verification, documentation, and tooling rather than configuration changes
- Build scripts provide convenient wrappers around anchor build commands
- Property tests validate that builds consistently produce correct artifacts
- Documentation ensures the build system is maintainable and understandable
