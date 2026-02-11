# Setup Guide

This guide walks through setting up the development environment for the Agent Reputation & Marketplace System.

## Prerequisites

Ensure you have the following installed:

1. **Rust** (1.75.0 or later)
   ```bash
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   ```

2. **Solana CLI** (1.18.26 or later)
   ```bash
   sh -c "$(curl -sSfL https://release.solana.com/stable/install)"
   ```

3. **Anchor CLI** (0.30.1)
   ```bash
   cargo install --git https://github.com/coral-xyz/anchor avm --locked --force
   avm install 0.30.1
   avm use 0.30.1
   ```

4. **Node.js** (18+ recommended)
   ```bash
   # Using nvm
   nvm install 18
   nvm use 18
   ```

5. **Yarn** (optional, but recommended)
   ```bash
   npm install -g yarn
   ```

## Installation

### 1. Install Rust Dependencies

From the `marketplace` directory:

```bash
cargo build
```

This will:
- Download and compile all Rust dependencies
- Build the three Solana programs (agent-registry, service-marketplace, escrow-manager)

### 2. Install Node.js Dependencies

Install Anchor workspace dependencies:

```bash
yarn install
# or
npm install
```

Install Gateway server dependencies:

```bash
cd gateway
yarn install
# or
npm install
cd ..
```

## Configuration

### 1. Solana Wallet

Ensure you have a Solana wallet configured:

```bash
# Generate a new keypair if needed
solana-keygen new

# Check your configuration
solana config get
```

### 2. Gateway Environment

Copy the example environment file:

```bash
cd gateway
cp .env.example .env
```

Edit `.env` to configure your environment (defaults work for local development).

## Verification

### 1. Build Smart Contracts

```bash
anchor build
```

Expected output: Three `.so` files in `target/deploy/`

### 2. Run Tests

Run Anchor tests:

```bash
anchor test
```

Run Gateway tests:

```bash
cd gateway
yarn test
```

### 3. Start Local Validator

In a separate terminal:

```bash
solana-test-validator
```

### 4. Deploy Programs

```bash
anchor deploy
```

### 5. Start Gateway Server

```bash
cd gateway
yarn dev
```

## Testing Frameworks

### Rust (proptest)

Property-based testing is configured in each program's `Cargo.toml`:

```toml
[dev-dependencies]
proptest = { workspace = true }
```

Example property test:

```rust
#[cfg(test)]
mod tests {
    use proptest::prelude::*;

    proptest! {
        #[test]
        fn test_property(value in 0..100u64) {
            assert!(value < 100);
        }
    }
}
```

### TypeScript (fast-check)

Property-based testing is configured in `gateway/package.json`:

```json
{
  "devDependencies": {
    "fast-check": "^3.22.0"
  }
}
```

Example property test:

```typescript
import * as fc from 'fast-check';

it('Property test example', () => {
  fc.assert(
    fc.property(fc.integer(), (n) => {
      return n + 0 === n;
    }),
    { numRuns: 100 }
  );
});
```

## Troubleshooting

### Anchor Build Fails

- Ensure Rust toolchain is 1.75.0+: `rustc --version`
- Ensure Anchor version is 0.30.1: `anchor --version`
- Clean and rebuild: `anchor clean && anchor build`

### Solana Connection Issues

- Check validator is running: `solana cluster-version`
- Verify RPC URL: `solana config get`
- Check wallet balance: `solana balance`

### Gateway Server Issues

- Verify Node.js version: `node --version` (should be 18+)
- Check dependencies: `cd gateway && yarn install`
- Verify environment: Check `.env` file exists and is configured

## Next Steps

Once setup is complete, you can begin implementing the tasks in `tasks.md`:

1. Task 2: Implement Agent Registry smart contract
2. Task 3: Implement Service Marketplace smart contract
3. Task 5: Implement Escrow Manager smart contract
4. Task 9: Implement Gateway WebSocket server

Refer to the design document (`design.md`) and requirements (`requirements.md`) for implementation details.
