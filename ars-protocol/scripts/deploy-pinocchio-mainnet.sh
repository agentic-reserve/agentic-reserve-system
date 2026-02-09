#!/bin/bash

# Pinocchio Migration - Mainnet Deployment Script
# This script deploys the Pinocchio-based ARS programs to Solana mainnet
# with upgrade authority management and safety checks

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
CLUSTER="mainnet-beta"
KEYPAIR_PATH="${HOME}/.config/solana/id.json"
UPGRADE_AUTHORITY_PATH="${HOME}/.config/solana/upgrade-authority.json"
PROGRAM_DIR="./programs"
TARGET_DIR="./target/deploy"

# Minimum balance required (in SOL)
MIN_BALANCE=10

echo -e "${MAGENTA}========================================${NC}"
echo -e "${MAGENTA}  ARS Pinocchio Migration - MAINNET${NC}"
echo -e "${MAGENTA}========================================${NC}"
echo ""
echo -e "${RED}⚠️  WARNING: MAINNET DEPLOYMENT ⚠️${NC}"
echo -e "${RED}This will deploy to production mainnet!${NC}"
echo ""

# Confirmation prompt
read -p "Are you sure you want to deploy to MAINNET? (type 'YES' to continue): " CONFIRM
if [ "$CONFIRM" != "YES" ]; then
    echo -e "${YELLOW}Deployment cancelled.${NC}"
    exit 0
fi

echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v solana &> /dev/null; then
    echo -e "${RED}Error: solana CLI not found${NC}"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo -e "${RED}Error: cargo not found${NC}"
    exit 1
fi

if [ ! -f "$KEYPAIR_PATH" ]; then
    echo -e "${RED}Error: Deployer keypair not found at $KEYPAIR_PATH${NC}"
    exit 1
fi

if [ ! -f "$UPGRADE_AUTHORITY_PATH" ]; then
    echo -e "${YELLOW}Warning: Upgrade authority keypair not found${NC}"
    echo -e "${YELLOW}Creating upgrade authority keypair...${NC}"
    solana-keygen new --outfile "$UPGRADE_AUTHORITY_PATH" --no-bip39-passphrase
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Set Solana cluster
echo -e "${YELLOW}Configuring Solana CLI for MAINNET...${NC}"
solana config set --url https://api.mainnet-beta.solana.com
solana config set --keypair "$KEYPAIR_PATH"

# Check balance
BALANCE=$(solana balance | awk '{print $1}')
echo -e "Current balance: ${GREEN}${BALANCE} SOL${NC}"

if (( $(echo "$BALANCE < $MIN_BALANCE" | bc -l) )); then
    echo -e "${RED}Error: Insufficient balance for mainnet deployment${NC}"
    echo -e "${RED}Required: ${MIN_BALANCE} SOL, Available: ${BALANCE} SOL${NC}"
    exit 1
fi

echo ""

# Verify devnet deployment
echo -e "${YELLOW}Pre-deployment checklist:${NC}"
echo ""
read -p "Have you successfully deployed and tested on devnet? (yes/no): " DEVNET_CHECK
if [ "$DEVNET_CHECK" != "yes" ]; then
    echo -e "${RED}Please deploy and test on devnet first!${NC}"
    exit 1
fi

read -p "Have all integration tests passed? (yes/no): " TESTS_CHECK
if [ "$TESTS_CHECK" != "yes" ]; then
    echo -e "${RED}Please ensure all tests pass before mainnet deployment!${NC}"
    exit 1
fi

read -p "Have you reviewed the performance benchmarks? (yes/no): " PERF_CHECK
if [ "$PERF_CHECK" != "yes" ]; then
    echo -e "${RED}Please review performance benchmarks before deployment!${NC}"
    exit 1
fi

read -p "Do you have a rollback plan ready? (yes/no): " ROLLBACK_CHECK
if [ "$ROLLBACK_CHECK" != "yes" ]; then
    echo -e "${RED}Please prepare a rollback plan before deployment!${NC}"
    exit 1
fi

echo ""
echo -e "${GREEN}✓ Pre-deployment checklist complete${NC}"
echo ""

# Build programs
echo -e "${YELLOW}Building Pinocchio programs for MAINNET...${NC}"
echo -e "${BLUE}This may take several minutes...${NC}"

cd "$PROGRAM_DIR"

# Build ars-core
echo -e "${YELLOW}Building ars-core...${NC}"
cd ars-core
cargo build-sbf --release
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to build ars-core${NC}"
    exit 1
fi
echo -e "${GREEN}✓ ars-core built successfully${NC}"
cd ..

# Build ars-reserve
echo -e "${YELLOW}Building ars-reserve...${NC}"
cd ars-reserve
cargo build-sbf --release
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to build ars-reserve${NC}"
    exit 1
fi
echo -e "${GREEN}✓ ars-reserve built successfully${NC}"
cd ..

# Build ars-token
echo -e "${YELLOW}Building ars-token...${NC}"
cd ars-token
cargo build-sbf --release
if [ $? -ne 0 ]; then
    echo -e "${RED}Error: Failed to build ars-token${NC}"
    exit 1
fi
echo -e "${GREEN}✓ ars-token built successfully${NC}"
cd ..

cd ..  # Back to root

echo ""
echo -e "${GREEN}All programs built successfully!${NC}"
echo ""

# Verify binary sizes
echo -e "${YELLOW}Verifying binary sizes...${NC}"
ARS_CORE_SIZE=$(stat -f%z "$TARGET_DIR/ars_core.so" 2>/dev/null || stat -c%s "$TARGET_DIR/ars_core.so")
ARS_RESERVE_SIZE=$(stat -f%z "$TARGET_DIR/ars_reserve.so" 2>/dev/null || stat -c%s "$TARGET_DIR/ars_reserve.so")
ARS_TOKEN_SIZE=$(stat -f%z "$TARGET_DIR/ars_token.so" 2>/dev/null || stat -c%s "$TARGET_DIR/ars_token.so")

echo -e "ars-core: ${GREEN}$(($ARS_CORE_SIZE / 1024)) KB${NC}"
echo -e "ars-reserve: ${GREEN}$(($ARS_RESERVE_SIZE / 1024)) KB${NC}"
echo -e "ars-token: ${GREEN}$(($ARS_TOKEN_SIZE / 1024)) KB${NC}"
echo ""

# Calculate deployment costs
TOTAL_SIZE=$(($ARS_CORE_SIZE + $ARS_RESERVE_SIZE + $ARS_TOKEN_SIZE))
COST_LAMPORTS=$(($TOTAL_SIZE * 5000))  # ~5000 lamports per byte
COST_SOL=$(echo "scale=4; $COST_LAMPORTS / 1000000000" | bc)

echo -e "${YELLOW}Estimated deployment cost: ${COST_SOL} SOL${NC}"
echo ""

# Final confirmation
echo -e "${RED}========================================${NC}"
echo -e "${RED}  FINAL CONFIRMATION${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo -e "You are about to deploy to ${RED}MAINNET${NC}"
echo -e "Estimated cost: ${YELLOW}${COST_SOL} SOL${NC}"
echo -e "Upgrade authority: ${BLUE}$(solana-keygen pubkey $UPGRADE_AUTHORITY_PATH)${NC}"
echo ""
read -p "Type 'DEPLOY' to proceed: " FINAL_CONFIRM

if [ "$FINAL_CONFIRM" != "DEPLOY" ]; then
    echo -e "${YELLOW}Deployment cancelled.${NC}"
    exit 0
fi

echo ""

# Deploy programs with upgrade authority
echo -e "${YELLOW}Deploying programs to MAINNET...${NC}"
echo ""

# Deploy ars-core
echo -e "${YELLOW}Deploying ars-core...${NC}"
solana program deploy \
    --program-id "$TARGET_DIR/ars_core-keypair.json" \
    --upgrade-authority "$UPGRADE_AUTHORITY_PATH" \
    "$TARGET_DIR/ars_core.so" \
    --url mainnet-beta

if [ $? -eq 0 ]; then
    DEPLOYED_CORE_ID=$(solana-keygen pubkey "$TARGET_DIR/ars_core-keypair.json")
    echo -e "${GREEN}✓ ars-core deployed successfully${NC}"
    echo -e "Program ID: ${BLUE}${DEPLOYED_CORE_ID}${NC}"
else
    echo -e "${RED}Error: Failed to deploy ars-core${NC}"
    exit 1
fi
echo ""

# Deploy ars-reserve
echo -e "${YELLOW}Deploying ars-reserve...${NC}"
solana program deploy \
    --program-id "$TARGET_DIR/ars_reserve-keypair.json" \
    --upgrade-authority "$UPGRADE_AUTHORITY_PATH" \
    "$TARGET_DIR/ars_reserve.so" \
    --url mainnet-beta

if [ $? -eq 0 ]; then
    DEPLOYED_RESERVE_ID=$(solana-keygen pubkey "$TARGET_DIR/ars_reserve-keypair.json")
    echo -e "${GREEN}✓ ars-reserve deployed successfully${NC}"
    echo -e "Program ID: ${BLUE}${DEPLOYED_RESERVE_ID}${NC}"
else
    echo -e "${RED}Error: Failed to deploy ars-reserve${NC}"
    exit 1
fi
echo ""

# Deploy ars-token
echo -e "${YELLOW}Deploying ars-token...${NC}"
solana program deploy \
    --program-id "$TARGET_DIR/ars_token-keypair.json" \
    --upgrade-authority "$UPGRADE_AUTHORITY_PATH" \
    "$TARGET_DIR/ars_token.so" \
    --url mainnet-beta

if [ $? -eq 0 ]; then
    DEPLOYED_TOKEN_ID=$(solana-keygen pubkey "$TARGET_DIR/ars_token-keypair.json")
    echo -e "${GREEN}✓ ars-token deployed successfully${NC}"
    echo -e "Program ID: ${BLUE}${DEPLOYED_TOKEN_ID}${NC}"
else
    echo -e "${RED}Error: Failed to deploy ars-token${NC}"
    exit 1
fi
echo ""

# Verify deployments
echo -e "${YELLOW}Verifying deployments...${NC}"

for PROGRAM_ID in "$DEPLOYED_CORE_ID" "$DEPLOYED_RESERVE_ID" "$DEPLOYED_TOKEN_ID"; do
    PROGRAM_INFO=$(solana program show "$PROGRAM_ID" --url mainnet-beta 2>&1)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $PROGRAM_ID verified${NC}"
    else
        echo -e "${RED}✗ $PROGRAM_ID verification failed${NC}"
        echo "$PROGRAM_INFO"
    fi
done

echo ""

# Save deployment info
DEPLOYMENT_FILE="./deployment-mainnet-$(date +%Y%m%d-%H%M%S).json"
UPGRADE_AUTHORITY=$(solana-keygen pubkey "$UPGRADE_AUTHORITY_PATH")
DEPLOYER=$(solana-keygen pubkey "$KEYPAIR_PATH")

cat > "$DEPLOYMENT_FILE" << EOF
{
  "cluster": "mainnet-beta",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "programs": {
    "ars-core": {
      "program_id": "$DEPLOYED_CORE_ID",
      "binary_size": $ARS_CORE_SIZE,
      "path": "$TARGET_DIR/ars_core.so"
    },
    "ars-reserve": {
      "program_id": "$DEPLOYED_RESERVE_ID",
      "binary_size": $ARS_RESERVE_SIZE,
      "path": "$TARGET_DIR/ars_reserve.so"
    },
    "ars-token": {
      "program_id": "$DEPLOYED_TOKEN_ID",
      "binary_size": $ARS_TOKEN_SIZE,
      "path": "$TARGET_DIR/ars_token.so"
    }
  },
  "deployer": "$DEPLOYER",
  "upgrade_authority": "$UPGRADE_AUTHORITY",
  "deployment_cost_sol": "$COST_SOL"
}
EOF

echo -e "${GREEN}Deployment info saved to: ${DEPLOYMENT_FILE}${NC}"
echo ""

# Create backup of program keypairs
BACKUP_DIR="./backups/mainnet-$(date +%Y%m%d-%H%M%S)"
mkdir -p "$BACKUP_DIR"
cp "$TARGET_DIR"/*.json "$BACKUP_DIR/"
cp "$UPGRADE_AUTHORITY_PATH" "$BACKUP_DIR/upgrade-authority.json"

echo -e "${GREEN}Program keypairs backed up to: ${BACKUP_DIR}${NC}"
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  MAINNET DEPLOYMENT COMPLETE!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Deployed Programs:${NC}"
echo -e "  ars-core:    ${GREEN}${DEPLOYED_CORE_ID}${NC}"
echo -e "  ars-reserve: ${GREEN}${DEPLOYED_RESERVE_ID}${NC}"
echo -e "  ars-token:   ${GREEN}${DEPLOYED_TOKEN_ID}${NC}"
echo ""
echo -e "${BLUE}Upgrade Authority:${NC} ${MAGENTA}${UPGRADE_AUTHORITY}${NC}"
echo ""
echo -e "${BLUE}Critical Next Steps:${NC}"
echo "  1. ${RED}SECURE THE UPGRADE AUTHORITY KEYPAIR${NC}"
echo "  2. Monitor program performance for 24-48 hours"
echo "  3. Update all client configurations"
echo "  4. Notify users of the upgrade"
echo "  5. Monitor transaction success rates"
echo "  6. Keep rollback plan ready"
echo ""
echo -e "${YELLOW}Important Security Notes:${NC}"
echo "  - Upgrade authority keypair is at: $UPGRADE_AUTHORITY_PATH"
echo "  - Backup is at: $BACKUP_DIR"
echo "  - Store these securely (hardware wallet, cold storage)"
echo "  - Never share or commit these files"
echo ""
echo -e "${BLUE}Monitoring Commands:${NC}"
echo "  solana program show $DEPLOYED_CORE_ID"
echo "  solana logs $DEPLOYED_CORE_ID"
echo ""

exit 0
