# Project Structure

This document describes the complete structure of the Agent Reputation & Marketplace System.

## Directory Layout

```
marketplace/
├── programs/                           # Solana smart contracts (Anchor framework)
│   ├── agent-registry/                # Agent registration and reputation tracking
│   │   ├── src/
│   │   │   └── lib.rs                # Main program logic
│   │   ├── Cargo.toml                # Rust dependencies
│   │   └── Xargo.toml                # Cross-compilation config
│   │
│   ├── service-marketplace/          # Service listings and transactions
│   │   ├── src/
│   │   │   └── lib.rs                # Main program logic
│   │   ├── Cargo.toml                # Rust dependencies
│   │   └── Xargo.toml                # Cross-compilation config
│   │
│   └── escrow-manager/               # Payment escrow and dispute resolution
│       ├── src/
│       │   └── lib.rs                # Main program logic
│       ├── Cargo.toml                # Rust dependencies
│       └── Xargo.toml                # Cross-compilation config
│
├── gateway/                           # WebSocket server (TypeScript)
│   ├── src/
│   │   ├── index.ts                  # Server entry point
│   │   └── index.test.ts             # Property-based tests
│   ├── package.json                  # Node.js dependencies
│   ├── tsconfig.json                 # TypeScript configuration
│   ├── vitest.config.ts              # Test configuration
│   ├── .env.example                  # Environment template
│   └── .gitignore                    # Git ignore rules
│
├── tests/                             # Integration tests
│   ├── setup.ts                      # Test utilities
│   └── agent-registry.test.ts        # Example test
│
├── Anchor.toml                        # Anchor workspace config
├── Cargo.toml                         # Rust workspace config
├── package.json                       # Node.js dependencies
├── tsconfig.json                      # TypeScript config
├── rust-toolchain.toml               # Rust version pinning
├── .gitignore                         # Git ignore rules
├── README.md                          # Project overview
├── SETUP.md                           # Setup instructions
└── PROJECT_STRUCTURE.md              # This file
```

## Component Overview

### Smart Contracts (Solana/Anchor)

#### Agent Registry
- **Purpose**: On-chain agent identities and reputation tracking
- **Language**: Rust (Anchor framework)
- **Testing**: proptest for property-based testing
- **Program ID**: `AGNTreg1stryXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

#### Service Marketplace
- **Purpose**: Service listings, discovery, and transaction management
- **Language**: Rust (Anchor framework)
- **Testing**: proptest for property-based testing
- **Program ID**: `SRVCmrktXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

#### Escrow Manager
- **Purpose**: Payment escrow, deadline enforcement, and dispute resolution
- **Language**: Rust (Anchor framework)
- **Testing**: proptest for property-based testing
- **Program ID**: `ESCRWmgrXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXXX`

### Gateway Server (TypeScript)

- **Purpose**: WebSocket bridge between OpenClaw agents and blockchain
- **Language**: TypeScript (Node.js)
- **Testing**: fast-check for property-based testing, vitest for unit tests
- **Port**: 8080 (configurable)
- **Features**:
  - Real-time agent communication
  - Transaction signing and submission
  - Event notifications
  - Session management

## Configuration Files

### Anchor.toml
- Defines program IDs for localnet, devnet, and mainnet
- Configures Solana cluster and wallet
- Sets up test validator with cloned accounts
- Includes ARS protocol program IDs for integration

### Cargo.toml (Workspace)
- Defines Rust workspace with three programs
- Specifies shared dependencies (anchor-lang, anchor-spl)
- Configures proptest for property-based testing
- Sets release profile optimizations

### package.json (Root)
- Anchor workspace dependencies
- TypeScript and testing tools
- Solana web3.js and Anchor client libraries

### gateway/package.json
- WebSocket server dependencies (ws)
- Solana client libraries
- fast-check for property-based testing
- vitest for test execution

## Testing Strategy

### Property-Based Testing

The project uses property-based testing to validate correctness properties:

**Rust (proptest)**:
- Tests universal properties across random inputs
- Configured in each program's Cargo.toml
- Runs 100 iterations per property by default

**TypeScript (fast-check)**:
- Tests Gateway server properties
- Configured in gateway/package.json
- Runs 100 iterations per property by default

### Integration Testing

- Located in `tests/` directory
- Uses Anchor's testing framework
- Tests cross-program interactions
- Validates end-to-end workflows

## Dependencies

### Rust Dependencies
- `anchor-lang`: 0.30.1 - Anchor framework core
- `anchor-spl`: 0.30.1 - SPL token integration
- `solana-program`: 1.18.26 - Solana SDK
- `proptest`: 1.4 - Property-based testing

### TypeScript Dependencies
- `@coral-xyz/anchor`: ^0.30.1 - Anchor client
- `@solana/web3.js`: ^1.95.0 - Solana JavaScript API
- `ws`: ^8.18.0 - WebSocket server
- `fast-check`: ^3.22.0 - Property-based testing
- `vitest`: ^2.0.0 - Test runner

## Integration with ARS Protocol

The marketplace integrates with existing ARS protocol programs:

- **ARS_Core**: `ARSFehdYbZhSgoQ2p82cHxPLGKrutXezJbYgDwJJA5My`
- **ARS_Reserve**: `ARS7PfJZeYAhsYGvR68ccZEpoXWHLYvJ3YbKoG5GHb5o`
- **ARS_Token**: `ARSM8uCNGUDYCVJPNnoKenBNTzKbJANyJS3KpbUVEmQb`

These programs are cloned in the test validator for integration testing.

## Build Artifacts

After building, the following artifacts are generated:

```
target/
├── deploy/
│   ├── agent_registry.so          # Compiled program
│   ├── service_marketplace.so     # Compiled program
│   └── escrow_manager.so          # Compiled program
├── idl/
│   ├── agent_registry.json        # Interface definition
│   ├── service_marketplace.json   # Interface definition
│   └── escrow_manager.json        # Interface definition
└── types/                          # TypeScript type definitions
```

## Development Workflow

1. **Build**: `anchor build` - Compiles all programs
2. **Test**: `anchor test` - Runs all tests
3. **Deploy**: `anchor deploy` - Deploys to configured cluster
4. **Gateway**: `cd gateway && yarn dev` - Starts WebSocket server

## Next Steps

With the project structure in place, development can proceed with:

1. Implementing Agent Registry (Task 2)
2. Implementing Service Marketplace (Task 3)
3. Implementing Escrow Manager (Task 5)
4. Implementing Gateway server (Task 9)

Refer to `tasks.md` for the complete implementation plan.
