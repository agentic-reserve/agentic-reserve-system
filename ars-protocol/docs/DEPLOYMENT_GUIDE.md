# Pinocchio Migration Deployment Guide

## Overview

This guide provides step-by-step instructions for deploying the Pinocchio-based ARS programs to Solana devnet and mainnet. It includes pre-deployment checklists, deployment procedures, verification steps, and rollback procedures.

## Table of Contents

1. [Prerequisites](#prerequisites)
2. [Pre-Deployment Checklist](#pre-deployment-checklist)
3. [Devnet Deployment](#devnet-deployment)
4. [Mainnet Deployment](#mainnet-deployment)
5. [Verification](#verification)
6. [Rollback Procedure](#rollback-procedure)
7. [Monitoring](#monitoring)
8. [Troubleshooting](#troubleshooting)

---

## Prerequisites

### Required Tools

- **Solana CLI** (v1.18.0+): [Installation Guide](https://docs.solana.com/cli/install-solana-cli-tools)
- **Rust** (1.75.0+): [Installation Guide](https://rustup.rs/)
- **Cargo** (included with Rust)
- **Git** (for version control)

### Required Files

- Deployer keypair: `~/.config/solana/id.json`
- Upgrade authority keypair: `~/.config/solana/upgrade-authority.json` (mainnet only)
- Program keypairs: `target/deploy/*-keypair.json`
- Anchor program backups: `backups/anchor-programs/*.so`

### Minimum Balances

- **Devnet**: 5 SOL (can request airdrops)
- **Mainnet**: 10 SOL (for deployment + buffer)

### System Requirements

- **OS**: Linux, macOS, or Windows (with WSL)
- **RAM**: 8 GB minimum, 16 GB recommended
- **Disk**: 10 GB free space for builds
- **Network**: Stable internet connection

---

## Pre-Deployment Checklist

### Code Quality

- [ ] All unit tests pass (`cargo test`)
- [ ] All property-based tests pass (100+ iterations)
- [ ] All integration tests pass
- [ ] Performance benchmarks meet targets (20% binary size, 15% CU reduction)
- [ ] Code review completed
- [ ] Security audit completed (if applicable)

### Documentation

- [ ] API migration guide reviewed
- [ ] Performance report reviewed
- [ ] Deployment procedures documented
- [ ] Rollback plan prepared

### Testing

- [ ] Devnet deployment successful
- [ ] Smoke tests passed on devnet
- [ ] Integration tests passed on devnet
- [ ] Monitored devnet for 24-48 hours
- [ ] No critical issues identified

### Backup

- [ ] Anchor program binaries backed up
- [ ] Program keypairs backed up
- [ ] Upgrade authority keypair secured
- [ ] Deployment history documented

### Communication

- [ ] Team notified of deployment schedule
- [ ] Users notified of upcoming changes (mainnet)
- [ ] Support team briefed on changes
- [ ] Monitoring alerts configured

---

## Devnet Deployment

### Step 1: Prepare Environment

```bash
# Navigate to project root
cd ars-protocol

# Verify Solana CLI configuration
solana config get

# Set cluster to devnet
solana config set --url https://api.devnet.solana.com

# Check balance
solana balance

# Request airdrop if needed
solana airdrop 2
```

### Step 2: Build Programs

```bash
# Build all programs
cd programs

# Build ars-core
cd ars-core
cargo build-sbf --release
cd ..

# Build ars-reserve
cd ars-reserve
cargo build-sbf --release
cd ..

# Build ars-token
cd ars-token
cargo build-sbf --release
cd ..

cd ..  # Back to root
```

### Step 3: Run Deployment Script

**Linux/macOS:**
```bash
# Make script executable
chmod +x scripts/deploy-pinocchio-devnet.sh

# Run deployment
./scripts/deploy-pinocchio-devnet.sh
```

**Windows (PowerShell):**
```powershell
# Run deployment
.\scripts\deploy-pinocchio-devnet.ps1
```

### Step 4: Verify Deployment

```bash
# Check program status
solana program show <PROGRAM_ID> --url devnet

# View program logs
solana logs <PROGRAM_ID> --url devnet

# Run smoke tests
npm run test:devnet --workspace=backend
```

### Step 5: Save Deployment Info

The deployment script automatically saves deployment information to:
```
deployment-devnet-YYYYMMDD-HHMMSS.json
```

Keep this file for reference and rollback purposes.

---

## Mainnet Deployment

### Step 1: Complete Pre-Deployment Checklist

**CRITICAL**: Ensure ALL items in the [Pre-Deployment Checklist](#pre-deployment-checklist) are completed before proceeding.

### Step 2: Prepare Mainnet Environment

```bash
# Set cluster to mainnet
solana config set --url https://api.mainnet-beta.solana.com

# Verify deployer keypair
solana-keygen pubkey ~/.config/solana/id.json

# Check balance (minimum 10 SOL recommended)
solana balance

# Create upgrade authority keypair (if not exists)
solana-keygen new --outfile ~/.config/solana/upgrade-authority.json
```

### Step 3: Backup Current Programs

```bash
# Create backup directory
mkdir -p backups/anchor-programs

# Download current program binaries (if upgrading)
solana program dump <PROGRAM_ID> backups/anchor-programs/ars_core.so
solana program dump <PROGRAM_ID> backups/anchor-programs/ars_reserve.so
solana program dump <PROGRAM_ID> backups/anchor-programs/ars_token.so

# Backup keypairs
cp target/deploy/*.json backups/anchor-programs/
```

### Step 4: Run Mainnet Deployment Script

```bash
# Make script executable
chmod +x scripts/deploy-pinocchio-mainnet.sh

# Run deployment (requires multiple confirmations)
./scripts/deploy-pinocchio-mainnet.sh
```

The script will prompt for:
1. Initial confirmation (type 'YES')
2. Pre-deployment checklist verification
3. Final confirmation (type 'DEPLOY')

### Step 5: Verify Mainnet Deployment

```bash
# Check program status
solana program show <PROGRAM_ID>

# View program logs
solana logs <PROGRAM_ID>

# Verify upgrade authority
solana program show <PROGRAM_ID> | grep "Upgrade Authority"

# Run integration tests
npm run test:mainnet --workspace=backend
```

### Step 6: Monitor Initial Performance

Monitor the programs for 24-48 hours:

```bash
# Watch logs continuously
solana logs <PROGRAM_ID> --follow

# Check transaction success rate
# (Use Solana Explorer or custom monitoring)

# Monitor compute unit consumption
# (Check transaction logs for CU usage)
```

---

## Verification

### Program Verification Checklist

- [ ] Program deployed successfully
- [ ] Program ID matches expected value
- [ ] Upgrade authority set correctly
- [ ] Program is executable
- [ ] Program logs are accessible
- [ ] Binary size matches build output
- [ ] Program version is correct

### Functional Verification

```bash
# Test each instruction
# (Use test scripts or manual transactions)

# ars-core
# - initialize
# - update_ili
# - query_ili
# - create_proposal
# - vote_on_proposal
# - execute_proposal
# - circuit_breaker

# ars-reserve
# - initialize_vault
# - deposit
# - withdraw
# - update_vhr
# - rebalance

# ars-token
# - initialize_mint
# - mint_icu
# - burn_icu
# - start_new_epoch
```

### Performance Verification

- [ ] Compute unit consumption meets targets (15% reduction)
- [ ] Binary size meets targets (20% reduction)
- [ ] Transaction success rate ≥ 99%
- [ ] No unexpected errors in logs
- [ ] Deserialization performance improved

---

## Rollback Procedure

### When to Rollback

Rollback immediately if:
- Critical bugs discovered
- Transaction success rate < 95%
- Compute unit consumption exceeds limits
- Data corruption detected
- Security vulnerability identified

### Rollback Steps

```bash
# Make rollback script executable
chmod +x scripts/rollback-pinocchio.sh

# Run rollback script
./scripts/rollback-pinocchio.sh

# Select cluster (devnet or mainnet)
# Provide rollback reason
# Confirm rollback (type 'ROLLBACK' then 'EXECUTE')
```

### Post-Rollback Actions

1. **Notify stakeholders** of the rollback
2. **Document the issue** that triggered rollback
3. **Analyze root cause** before re-attempting
4. **Update tests** to catch the issue
5. **Plan remediation** strategy
6. **Re-test thoroughly** before next attempt

---

## Monitoring

### Key Metrics to Monitor

**Program Health:**
- Transaction success rate
- Compute unit consumption per instruction
- Error rate by error type
- Program upgrade status

**Performance:**
- Average transaction time
- Deserialization time
- CPI call overhead
- Memory usage

**Business Metrics:**
- ILI update frequency
- ICR calculation accuracy
- Proposal creation rate
- Vault rebalancing frequency

### Monitoring Tools

**Solana CLI:**
```bash
# View program info
solana program show <PROGRAM_ID>

# Watch logs
solana logs <PROGRAM_ID> --follow

# Check transaction
solana confirm <SIGNATURE> -v
```

**Solana Explorer:**
- https://explorer.solana.com/ (mainnet)
- https://explorer.solana.com/?cluster=devnet (devnet)

**Custom Monitoring:**
```bash
# Backend monitoring endpoints
curl http://localhost:4000/health
curl http://localhost:4000/metrics

# WebSocket monitoring
# (Connect to ws://localhost:4000 for real-time updates)
```

### Alert Thresholds

Set up alerts for:
- Transaction success rate < 99%
- Error rate > 1%
- Compute unit usage > expected + 10%
- Program upgrade detected
- Circuit breaker activated

---

## Troubleshooting

### Common Issues

#### Issue: Insufficient Balance

**Symptoms:**
```
Error: Insufficient funds for deployment
```

**Solution:**
```bash
# Check balance
solana balance

# Request airdrop (devnet only)
solana airdrop 2

# Transfer SOL (mainnet)
solana transfer <RECIPIENT> <AMOUNT>
```

#### Issue: Program Already Deployed

**Symptoms:**
```
Error: Account already exists
```

**Solution:**
```bash
# Use program upgrade instead
solana program deploy --program-id <PROGRAM_ID> <PROGRAM_FILE>

# Or use a new program ID
solana-keygen new --outfile target/deploy/new-keypair.json
```

#### Issue: Build Failure

**Symptoms:**
```
Error: Failed to build program
```

**Solution:**
```bash
# Clean build artifacts
cargo clean

# Update Rust toolchain
rustup update

# Rebuild
cargo build-sbf --release
```

#### Issue: Verification Failure

**Symptoms:**
```
Error: Program verification failed
```

**Solution:**
```bash
# Check program exists
solana program show <PROGRAM_ID>

# Check cluster configuration
solana config get

# Verify network connectivity
ping api.devnet.solana.com
```

#### Issue: Upgrade Authority Mismatch

**Symptoms:**
```
Error: Incorrect upgrade authority
```

**Solution:**
```bash
# Check current upgrade authority
solana program show <PROGRAM_ID> | grep "Upgrade Authority"

# Set correct upgrade authority
solana program set-upgrade-authority <PROGRAM_ID> \
  --new-upgrade-authority <NEW_AUTHORITY>
```

### Getting Help

**Documentation:**
- [Pinocchio API Migration Guide](./PINOCCHIO_API_MIGRATION.md)
- [Performance Report](./PINOCCHIO_PERFORMANCE_REPORT.md)
- [Design Document](./PINOCCHIO_DEVELOPMENT.md)

**Support Channels:**
- GitHub Issues: [ARS Repository](https://github.com/your-org/ars-protocol)
- Discord: [ARS Community](https://discord.gg/ars)
- Email: support@ars-protocol.com

**Emergency Contacts:**
- On-call engineer: [Contact info]
- Security team: security@ars-protocol.com
- Solana support: https://solana.com/support

---

## Deployment Timeline

### Recommended Timeline

**Week 1: Devnet Deployment**
- Day 1: Deploy to devnet
- Day 2-3: Run smoke tests and integration tests
- Day 4-7: Monitor performance and stability

**Week 2: Mainnet Preparation**
- Day 1-2: Final code review and security audit
- Day 3-4: Prepare deployment documentation
- Day 5: Backup current programs
- Day 6-7: Final testing and validation

**Week 3: Mainnet Deployment**
- Day 1: Deploy to mainnet (low-traffic period)
- Day 2-7: Monitor closely for issues

**Week 4: Post-Deployment**
- Day 1-7: Continue monitoring
- Collect performance metrics
- Document lessons learned

---

## Security Considerations

### Upgrade Authority Management

**Best Practices:**
- Store upgrade authority keypair in cold storage
- Use hardware wallet for mainnet upgrade authority
- Implement multi-sig for upgrade authority (if possible)
- Never commit keypairs to version control
- Rotate upgrade authority periodically

### Deployment Security

- Verify program hashes before deployment
- Use secure RPC endpoints
- Monitor for unauthorized upgrades
- Implement circuit breakers for emergency stops
- Keep rollback plan ready

### Post-Deployment Security

- Monitor for unusual transaction patterns
- Set up alerts for circuit breaker activation
- Review program logs regularly
- Conduct periodic security audits
- Maintain incident response plan

---

## Appendix

### Deployment Script Options

**deploy-pinocchio-devnet.sh:**
- Automatic airdrop on low balance
- Binary size verification
- Smoke tests
- Deployment info logging

**deploy-pinocchio-mainnet.sh:**
- Multiple confirmation prompts
- Pre-deployment checklist
- Upgrade authority management
- Backup creation
- Cost estimation

**rollback-pinocchio.sh:**
- Emergency rollback to Anchor
- Reason documentation
- Verification checks
- Rollback info logging

### File Locations

```
ars-protocol/
├── scripts/
│   ├── deploy-pinocchio-devnet.sh      # Devnet deployment
│   ├── deploy-pinocchio-devnet.ps1     # Devnet (Windows)
│   ├── deploy-pinocchio-mainnet.sh     # Mainnet deployment
│   └── rollback-pinocchio.sh           # Emergency rollback
├── target/deploy/
│   ├── ars_core.so                     # Compiled programs
│   ├── ars_reserve.so
│   ├── ars_token.so
│   └── *-keypair.json                  # Program keypairs
├── backups/
│   └── anchor-programs/                # Anchor backups
└── docs/
    ├── DEPLOYMENT_GUIDE.md             # This file
    ├── PINOCCHIO_API_MIGRATION.md      # API migration guide
    └── PINOCCHIO_PERFORMANCE_REPORT.md # Performance metrics
```

---

## Conclusion

This deployment guide provides comprehensive instructions for safely deploying the Pinocchio-based ARS programs. Always follow the pre-deployment checklist, test thoroughly on devnet, and keep the rollback plan ready.

For questions or issues, refer to the troubleshooting section or contact the support team.

**Remember**: Safety first. When in doubt, don't deploy.

