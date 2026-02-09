#!/bin/bash

# Pinocchio Migration - Emergency Rollback Script
# This script rolls back to the previous Anchor-based programs
# in case of critical issues with the Pinocchio deployment

set -e  # Exit on error

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
MAGENTA='\033[0;35m'
NC='\033[0m' # No Color

# Configuration
KEYPAIR_PATH="${HOME}/.config/solana/id.json"
UPGRADE_AUTHORITY_PATH="${HOME}/.config/solana/upgrade-authority.json"
BACKUP_DIR="./backups/anchor-programs"
TARGET_DIR="./target/deploy"

echo -e "${RED}========================================${NC}"
echo -e "${RED}  ARS EMERGENCY ROLLBACK${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo -e "${RED}⚠️  WARNING: EMERGENCY ROLLBACK ⚠️${NC}"
echo -e "${RED}This will revert to the previous Anchor programs!${NC}"
echo ""

# Prompt for cluster
echo -e "${YELLOW}Select cluster:${NC}"
echo "  1) devnet"
echo "  2) mainnet-beta"
read -p "Enter choice (1 or 2): " CLUSTER_CHOICE

case $CLUSTER_CHOICE in
    1)
        CLUSTER="devnet"
        CLUSTER_URL="https://api.devnet.solana.com"
        ;;
    2)
        CLUSTER="mainnet-beta"
        CLUSTER_URL="https://api.mainnet-beta.solana.com"
        echo ""
        echo -e "${RED}⚠️  MAINNET ROLLBACK - PRODUCTION IMPACT ⚠️${NC}"
        ;;
    *)
        echo -e "${RED}Invalid choice${NC}"
        exit 1
        ;;
esac

echo ""

# Confirmation prompt
read -p "Are you sure you want to rollback on $CLUSTER? (type 'ROLLBACK' to continue): " CONFIRM
if [ "$CONFIRM" != "ROLLBACK" ]; then
    echo -e "${YELLOW}Rollback cancelled.${NC}"
    exit 0
fi

echo ""

# Check prerequisites
echo -e "${YELLOW}Checking prerequisites...${NC}"

if ! command -v solana &> /dev/null; then
    echo -e "${RED}Error: solana CLI not found${NC}"
    exit 1
fi

if [ ! -f "$KEYPAIR_PATH" ]; then
    echo -e "${RED}Error: Deployer keypair not found${NC}"
    exit 1
fi

if [ ! -f "$UPGRADE_AUTHORITY_PATH" ]; then
    echo -e "${RED}Error: Upgrade authority keypair not found${NC}"
    echo -e "${RED}Cannot perform rollback without upgrade authority${NC}"
    exit 1
fi

if [ ! -d "$BACKUP_DIR" ]; then
    echo -e "${RED}Error: Backup directory not found at $BACKUP_DIR${NC}"
    echo -e "${RED}Cannot rollback without Anchor program backups${NC}"
    exit 1
fi

echo -e "${GREEN}✓ Prerequisites check passed${NC}"
echo ""

# Set Solana cluster
echo -e "${YELLOW}Configuring Solana CLI...${NC}"
solana config set --url "$CLUSTER_URL"
solana config set --keypair "$KEYPAIR_PATH"

# Check balance
BALANCE=$(solana balance | awk '{print $1}')
echo -e "Current balance: ${GREEN}${BALANCE} SOL${NC}"

if (( $(echo "$BALANCE < 5" | bc -l) )); then
    echo -e "${RED}Error: Insufficient balance for rollback${NC}"
    exit 1
fi

echo ""

# Verify backup files exist
echo -e "${YELLOW}Verifying backup files...${NC}"

ANCHOR_CORE="$BACKUP_DIR/ars_core.so"
ANCHOR_RESERVE="$BACKUP_DIR/ars_reserve.so"
ANCHOR_TOKEN="$BACKUP_DIR/ars_token.so"

if [ ! -f "$ANCHOR_CORE" ]; then
    echo -e "${RED}Error: ars-core backup not found${NC}"
    exit 1
fi

if [ ! -f "$ANCHOR_RESERVE" ]; then
    echo -e "${RED}Error: ars-reserve backup not found${NC}"
    exit 1
fi

if [ ! -f "$ANCHOR_TOKEN" ]; then
    echo -e "${RED}Error: ars-token backup not found${NC}"
    exit 1
fi

echo -e "${GREEN}✓ All backup files found${NC}"
echo ""

# Get program IDs
echo -e "${YELLOW}Reading program IDs...${NC}"

CORE_KEYPAIR="$TARGET_DIR/ars_core-keypair.json"
RESERVE_KEYPAIR="$TARGET_DIR/ars_reserve-keypair.json"
TOKEN_KEYPAIR="$TARGET_DIR/ars_token-keypair.json"

if [ ! -f "$CORE_KEYPAIR" ]; then
    echo -e "${RED}Error: ars-core keypair not found${NC}"
    exit 1
fi

CORE_PROGRAM_ID=$(solana-keygen pubkey "$CORE_KEYPAIR")
RESERVE_PROGRAM_ID=$(solana-keygen pubkey "$RESERVE_KEYPAIR")
TOKEN_PROGRAM_ID=$(solana-keygen pubkey "$TOKEN_KEYPAIR")

echo -e "ars-core:    ${BLUE}${CORE_PROGRAM_ID}${NC}"
echo -e "ars-reserve: ${BLUE}${RESERVE_PROGRAM_ID}${NC}"
echo -e "ars-token:   ${BLUE}${TOKEN_PROGRAM_ID}${NC}"
echo ""

# Document rollback reason
echo -e "${YELLOW}Please document the reason for rollback:${NC}"
read -p "Reason: " ROLLBACK_REASON

if [ -z "$ROLLBACK_REASON" ]; then
    ROLLBACK_REASON="Emergency rollback - no reason provided"
fi

echo ""

# Final confirmation
echo -e "${RED}========================================${NC}"
echo -e "${RED}  FINAL CONFIRMATION${NC}"
echo -e "${RED}========================================${NC}"
echo ""
echo -e "Cluster: ${RED}${CLUSTER}${NC}"
echo -e "Action: ${RED}Rollback to Anchor programs${NC}"
echo -e "Reason: ${YELLOW}${ROLLBACK_REASON}${NC}"
echo ""
read -p "Type 'EXECUTE' to proceed: " FINAL_CONFIRM

if [ "$FINAL_CONFIRM" != "EXECUTE" ]; then
    echo -e "${YELLOW}Rollback cancelled.${NC}"
    exit 0
fi

echo ""

# Perform rollback
echo -e "${YELLOW}Rolling back programs...${NC}"
echo ""

# Rollback ars-core
echo -e "${YELLOW}Rolling back ars-core...${NC}"
solana program deploy \
    --program-id "$CORE_PROGRAM_ID" \
    --upgrade-authority "$UPGRADE_AUTHORITY_PATH" \
    "$ANCHOR_CORE" \
    --url "$CLUSTER_URL"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ars-core rolled back successfully${NC}"
else
    echo -e "${RED}Error: Failed to rollback ars-core${NC}"
    echo -e "${RED}CRITICAL: Program may be in inconsistent state${NC}"
    exit 1
fi
echo ""

# Rollback ars-reserve
echo -e "${YELLOW}Rolling back ars-reserve...${NC}"
solana program deploy \
    --program-id "$RESERVE_PROGRAM_ID" \
    --upgrade-authority "$UPGRADE_AUTHORITY_PATH" \
    "$ANCHOR_RESERVE" \
    --url "$CLUSTER_URL"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ars-reserve rolled back successfully${NC}"
else
    echo -e "${RED}Error: Failed to rollback ars-reserve${NC}"
    echo -e "${RED}CRITICAL: Program may be in inconsistent state${NC}"
    exit 1
fi
echo ""

# Rollback ars-token
echo -e "${YELLOW}Rolling back ars-token...${NC}"
solana program deploy \
    --program-id "$TOKEN_PROGRAM_ID" \
    --upgrade-authority "$UPGRADE_AUTHORITY_PATH" \
    "$ANCHOR_TOKEN" \
    --url "$CLUSTER_URL"

if [ $? -eq 0 ]; then
    echo -e "${GREEN}✓ ars-token rolled back successfully${NC}"
else
    echo -e "${RED}Error: Failed to rollback ars-token${NC}"
    echo -e "${RED}CRITICAL: Program may be in inconsistent state${NC}"
    exit 1
fi
echo ""

# Verify rollback
echo -e "${YELLOW}Verifying rollback...${NC}"

for PROGRAM_ID in "$CORE_PROGRAM_ID" "$RESERVE_PROGRAM_ID" "$TOKEN_PROGRAM_ID"; do
    PROGRAM_INFO=$(solana program show "$PROGRAM_ID" --url "$CLUSTER_URL" 2>&1)
    if [ $? -eq 0 ]; then
        echo -e "${GREEN}✓ $PROGRAM_ID verified${NC}"
    else
        echo -e "${RED}✗ $PROGRAM_ID verification failed${NC}"
        echo "$PROGRAM_INFO"
    fi
done

echo ""

# Save rollback info
ROLLBACK_FILE="./rollback-${CLUSTER}-$(date +%Y%m%d-%H%M%S).json"
UPGRADE_AUTHORITY=$(solana-keygen pubkey "$UPGRADE_AUTHORITY_PATH")
DEPLOYER=$(solana-keygen pubkey "$KEYPAIR_PATH")

cat > "$ROLLBACK_FILE" << EOF
{
  "cluster": "$CLUSTER",
  "timestamp": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "action": "rollback",
  "reason": "$ROLLBACK_REASON",
  "programs": {
    "ars-core": {
      "program_id": "$CORE_PROGRAM_ID",
      "rolled_back_to": "anchor",
      "backup_path": "$ANCHOR_CORE"
    },
    "ars-reserve": {
      "program_id": "$RESERVE_PROGRAM_ID",
      "rolled_back_to": "anchor",
      "backup_path": "$ANCHOR_RESERVE"
    },
    "ars-token": {
      "program_id": "$TOKEN_PROGRAM_ID",
      "rolled_back_to": "anchor",
      "backup_path": "$ANCHOR_TOKEN"
    }
  },
  "executor": "$DEPLOYER",
  "upgrade_authority": "$UPGRADE_AUTHORITY"
}
EOF

echo -e "${GREEN}Rollback info saved to: ${ROLLBACK_FILE}${NC}"
echo ""

# Summary
echo -e "${GREEN}========================================${NC}"
echo -e "${GREEN}  ROLLBACK COMPLETE${NC}"
echo -e "${GREEN}========================================${NC}"
echo ""
echo -e "${BLUE}Rolled Back Programs:${NC}"
echo -e "  ars-core:    ${GREEN}${CORE_PROGRAM_ID}${NC}"
echo -e "  ars-reserve: ${GREEN}${RESERVE_PROGRAM_ID}${NC}"
echo -e "  ars-token:   ${GREEN}${TOKEN_PROGRAM_ID}${NC}"
echo ""
echo -e "${BLUE}Status:${NC} ${GREEN}All programs reverted to Anchor${NC}"
echo ""
echo -e "${YELLOW}Critical Post-Rollback Actions:${NC}"
echo "  1. Notify all users of the rollback"
echo "  2. Update client configurations if needed"
echo "  3. Monitor program behavior"
echo "  4. Investigate root cause: $ROLLBACK_REASON"
echo "  5. Document lessons learned"
echo "  6. Plan remediation before re-attempting migration"
echo ""
echo -e "${BLUE}Monitoring Commands:${NC}"
echo "  solana program show $CORE_PROGRAM_ID"
echo "  solana logs $CORE_PROGRAM_ID"
echo ""
echo -e "${RED}Remember:${NC} Analyze the issue before attempting migration again"
echo ""

exit 0
