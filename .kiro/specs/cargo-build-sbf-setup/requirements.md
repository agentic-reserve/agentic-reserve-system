# Requirements Document: Cargo Build SBF Setup

## Introduction

This specification defines the requirements for configuring the ARS Protocol Solana programs to build using cargo-build-sbf instead of the default Anchor build process. The cargo-build-sbf tool provides direct control over the BPF (Berkeley Packet Filter) compilation process, enabling better optimization and compatibility management for Solana programs.

The ARS Protocol consists of three Anchor programs (ars-core, ars-reserve, ars-token) currently using Anchor 0.30.1 and Solana 1.18.26. This feature will establish a robust build configuration that maintains version compatibility while leveraging cargo-build-sbf for program compilation.

## Glossary

- **Build_System**: The cargo-build-sbf tool and associated configuration that compiles Solana programs to BPF bytecode
- **Anchor_Workspace**: The collection of three ARS Protocol programs managed by Anchor framework
- **BPF_Toolchain**: The Solana toolchain components required for compiling programs to BPF format
- **Program_Artifact**: The compiled .so (shared object) file produced by the build process
- **Solana_CLI**: The command-line interface tools for Solana development and deployment
- **Version_Compatibility**: The requirement that Anchor, Solana SDK, and BPF toolchain versions work together correctly

## Requirements

### Requirement 1: Solana CLI Installation and Configuration

**User Story:** As a developer, I want to install and configure Solana CLI tools with the correct version, so that I have the necessary toolchain for building programs with cargo-build-sbf.

#### Acceptance Criteria

1. THE Build_System SHALL use Solana CLI version 1.18.26
2. WHEN Solana CLI is installed, THE Build_System SHALL verify the installation includes cargo-build-sbf
3. WHEN checking tool versions, THE Build_System SHALL confirm solana-cli and cargo-build-sbf versions match
4. THE Build_System SHALL configure the Solana toolchain path in the development environment

### Requirement 2: Cargo Build SBF Configuration

**User Story:** As a developer, I want to configure cargo-build-sbf as the primary build tool, so that I have direct control over the BPF compilation process.

#### Acceptance Criteria

1. THE Anchor_Workspace SHALL configure Anchor.toml to use cargo-build-sbf for program compilation
2. WHEN building programs, THE Build_System SHALL invoke cargo-build-sbf instead of anchor build
3. THE Build_System SHALL configure cargo-build-sbf to output Program_Artifacts to the correct target directory
4. WHEN cargo-build-sbf is invoked, THE Build_System SHALL pass appropriate optimization flags for release builds

### Requirement 3: Workspace Dependency Management

**User Story:** As a developer, I want properly configured workspace dependencies, so that all programs build with consistent and compatible versions.

#### Acceptance Criteria

1. THE Anchor_Workspace SHALL define anchor-lang version 0.30.1 in workspace dependencies
2. THE Anchor_Workspace SHALL define anchor-spl version 0.30.1 in workspace dependencies
3. THE Anchor_Workspace SHALL define solana-program version 1.18.26 in workspace dependencies
4. WHEN a program declares dependencies, THE Build_System SHALL resolve them from workspace definitions
5. THE Anchor_Workspace SHALL pin constant_time_eq to version 0.3.1 for BPF_Toolchain compatibility

### Requirement 4: Version Compatibility Verification

**User Story:** As a developer, I want to verify version compatibility between components, so that I can prevent build failures due to version mismatches.

#### Acceptance Criteria

1. WHEN building programs, THE Build_System SHALL verify Anchor version matches solana-program version compatibility
2. WHEN building programs, THE Build_System SHALL verify BPF_Toolchain version matches Solana CLI version
3. IF version incompatibilities are detected, THEN THE Build_System SHALL report specific version conflicts
4. THE Build_System SHALL document the tested and verified version combinations

### Requirement 5: Build Script and Command Configuration

**User Story:** As a developer, I want convenient build scripts and commands, so that I can easily build programs during development and for deployment.

#### Acceptance Criteria

1. THE Build_System SHALL provide a command to build all programs in the workspace
2. THE Build_System SHALL provide a command to build individual programs
3. THE Build_System SHALL provide a command to build programs in release mode with optimizations
4. THE Build_System SHALL provide a command to clean build artifacts
5. WHEN building in development mode, THE Build_System SHALL enable debug symbols
6. WHEN building in release mode, THE Build_System SHALL enable LTO and optimization flags

### Requirement 6: Build Artifact Verification

**User Story:** As a developer, I want to verify that builds produce correct artifacts, so that I can ensure programs are ready for deployment.

#### Acceptance Criteria

1. WHEN a build completes successfully, THE Build_System SHALL produce a .so file for each program
2. THE Build_System SHALL verify each Program_Artifact is a valid BPF shared object
3. THE Build_System SHALL verify each Program_Artifact size is within Solana program size limits
4. WHEN verifying artifacts, THE Build_System SHALL confirm the program ID in the artifact matches Anchor.toml configuration
5. THE Build_System SHALL output the file path and size of each Program_Artifact after successful builds

### Requirement 7: Development Workflow Integration

**User Story:** As a developer, I want the build system integrated into my development workflow, so that I can efficiently iterate on program development.

#### Acceptance Criteria

1. THE Build_System SHALL support incremental builds that only recompile changed programs
2. WHEN tests are run, THE Build_System SHALL automatically rebuild programs if source files changed
3. THE Build_System SHALL provide clear error messages when builds fail
4. WHEN build errors occur, THE Build_System SHALL indicate which program and source file caused the error
5. THE Build_System SHALL complete full workspace builds in under 2 minutes on standard development hardware

### Requirement 8: Build Configuration Documentation

**User Story:** As a developer, I want clear documentation of the build configuration, so that I can understand and maintain the build system.

#### Acceptance Criteria

1. THE Build_System SHALL document all required environment variables
2. THE Build_System SHALL document the purpose of each Cargo.toml configuration option
3. THE Build_System SHALL document the purpose of each Anchor.toml build-related configuration
4. THE Build_System SHALL provide troubleshooting guidance for common build issues
5. THE Build_System SHALL document the differences between cargo-build-sbf and anchor build
