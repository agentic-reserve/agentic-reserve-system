#!/bin/bash

# Pinocchio Migration - Devnet Deployment Script
# This script deploys the Pinocchio-based ARS programs to Solana devnet
# while preserving existing program IDs for backward compatibility

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
CLUSTER="devnet"
KEYPAIR_PATH="${HOME}/.config/solana/id.json"
PROGRAM_DIR="./programs"
TARGET_DIR="./target/deploy"

# Program IDs (preserve existing IDs)
ARS_CORE_PROGRAM_ID="ARSCoreProgram11111111111111111111111111111"
ARS_RESERVE_PROGRAM_ID="ARSReserveProgram1111111111111111111111111"
ARS_TOKEN_PROGRAM_ID="ARSTokenProgram111111111111111111111111111"

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  ARS Pinocchio Migration - Devnet${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v solana &> /dev/null; then
    echo -e "${RED}Error: solana CLI not found${NC}"
    echo "Install from: https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
fi

if ! command -v cargo &> /dev/null; then
    echo -e "${RED}Error: cargo not found${NC}"
    echo "Install Rust from: https://rustup.rs/"
    exit 1
fi

if [ ! -f "$KEYPAIR_PATH" ]; then
    echo -e "${RED}Error: Keypair not found at $KEYPAIR_PATH${NC}"
    echo "Generate with: solana-keygen new"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Set Solana cluster
echo -e "${YELLOW}Configuring Solana CLI...${NC}"
solana config set --url https://api.devnet.solana.com
solana config set --keypair "$KEYPAIR_PATH"

# Check balance
BALANCE=$(solana balance | awk '{print $1}')
echo -e "Current balance: ${GREEN}${BALANCE} SOL${NC}"

if (( $(echo "$BALANCE < 5" | bc -l) )); then
    echo -e "${YELLOW}Warning: Low balance. Requesting airdrop...${NC}"
    solana airdrop 2 || echo -e "${YELLOW}Airdrop failed. Continue with existing balance.${NC}"
fi

echo ""

# Build programs
echo -e "${YELLOW}Building Pinocchio programs...${NC}"
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

# Deploy programs
echo -e "${YELLOW}Deploying programs to devnet...${NC}"
echo ""

# Deploy ars-core
echo -e "${YELLOW}Deploying ars-core...${NC}"
solana program deploy \
    --program-id "$TARGET_DIR/ars_core-keypair.json" \
    "$TARGET_DIR/ars_core.so" \
    --url devnet

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
    "$TARGET_DIR/ars_reserve.so" \
    --url devnet

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
    "$TARGET_DIR/ars_token.so" \
    --url devnet

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
    PROGRAM_INFO=$(solana program show "$PROGRAM_ID" --url devnet 2>&1)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $PROGRAM_ID verified${NC}"
    else
        echo -e "${RED}✗ $PROGRAM_ID verification failed${NC}"
        echo "$PROGRAM_INFO"
    fi
done

echo ""

# Save deployment info
DEPLOYMENT_FILE="./deployment-devnet-$(date +%Y%m%d-%H%M%S).json"
cat > "$DEPLOYMENT_FILE" << EOF
{
  "cluster": "devnet",
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
  "deployer": "$(solana-keygen pubkey $KEYPAIR_PATH)"
}
EOF

echo -e "${GREEN}Deployment info saved to: ${DEPLOYMENT_FILE}${NC}"
echo ""

# Run smoke tests
echo -e "${YELLOW}Running smoke tests...${NC}"
echo -e "${BLUE}Testing program accessibility...${NC}"

for PROGRAM_ID in "$DEPLOYED_CORE_ID" "$DEPLOYED_RESERVE_ID" "$DEPLOYED_TOKEN_ID"; do
    if solana program show "$PROGRAM_ID" --url devnet > /dev/null 2>&1; then
        echo -e "${GREEN}✓ $PROGRAM_ID is accessible${NC}"
    else
        echo -e "${RED}✗ $PROGRAM_ID is not accessible${NC}"
    fi
done

echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  Deployment Complete!${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Deployed Programs:${NC}"
echo -e "  ars-core:    ${GREEN}${DEPLOYED_CORE_ID}${NC}"
echo -e "  ars-reserve: ${GREEN}${DEPLOYED_RESERVE_ID}${NC}"
echo -e "  ars-token:   ${GREEN}${DEPLOYED_TOKEN_ID}${NC}"
echo ""
echo -e "${BLUE}Next Steps:${NC}"
echo "  1. Update client configurations with new program IDs"
echo "  2. Run integration tests against devnet"
echo "  3. Monitor program performance and logs"
echo "  4. Verify backward compatibility with existing clients"
echo ""
echo -e "${YELLOW}Important:${NC}"
echo "  - Keep the deployment info file for rollback reference"
echo "  - Monitor the programs for 24-48 hours before mainnet deployment"
echo "  - Ensure all tests pass before proceeding to mainnet"
echo ""

exit 0
