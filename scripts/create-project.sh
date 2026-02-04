#!/bin/bash
# Create/Update Agentic Reserve System Project on Colosseum

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "=== Creating/Updating Agentic Reserve System Project ==="
echo ""

# Project details
PROJECT_DATA='{
  "name": "Agentic Reserve System",
  "description": "The first Agent-First DeFi Protocol on Solana - an autonomous monetary coordination layer built exclusively for AI agents. Enables agents to execute lending, borrowing, staking, prediction markets, yield farming, and liquidity provision autonomously through 8 core integrations: Helius (infrastructure), Kamino (lending), Meteora (liquidity), MagicBlock (performance), OpenClaw (orchestration), OpenRouter (AI), x402-PayAI (payments), and Solana Policy Institute (compliance).",
  "repoLink": "https://github.com/protocoldaemon-sec/agentic-reserve-system.git",
  "solanaIntegration": "ARS uses Solana as its core blockchain with 3 Anchor programs (~3,200 lines of Rust): ARS Core (governance via futarchy), ARS Reserve (vault management), and ARU Token (reserve unit minting). Integrates with Kamino Finance for lending/borrowing, Meteora Protocol for liquidity provision, Jupiter for swaps, and Pyth/Switchboard for oracles. Uses Helius for 99.99% uptime RPC, Helius Sender for 95%+ transaction landing rate, and MagicBlock Ephemeral Rollups for sub-100ms high-frequency execution. All operations are agent-exclusive with Ed25519 authentication and on-chain reputation tracking.",
  "technicalDemoLink": "https://ars-demo.vercel.app",
  "presentationLink": "https://youtube.com/watch?v=ars-demo",
  "tags": ["defi", "ai", "governance"]
}'

# Check if project already exists
echo "Checking for existing project..."
EXISTING_PROJECT=$(curl -s -H "Authorization: Bearer $API_KEY" "$API_BASE/my-project" 2>/dev/null)

if [ $? -eq 0 ] && [ ! -z "$EXISTING_PROJECT" ]; then
    echo "Project exists. Updating..."
    RESPONSE=$(curl -s -X PUT "$API_BASE/my-project" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d "$PROJECT_DATA")
else
    echo "Creating new project..."
    RESPONSE=$(curl -s -X POST "$API_BASE/my-project" \
        -H "Authorization: Bearer $API_KEY" \
        -H "Content-Type: application/json" \
        -d "$PROJECT_DATA")
fi

echo ""
echo "Response:"
echo $RESPONSE | jq '.'
echo ""

echo "=== Project Created/Updated ==="
echo ""
echo "⚠️  IMPORTANT: Do NOT submit yet!"
echo "   - Build and test your project first"
echo "   - Add demo and presentation links"
echo "   - Post progress updates on the forum"
echo "   - Only submit when ready for judges"
echo ""
echo "To submit when ready:"
echo "   curl -X POST $API_BASE/my-project/submit -H 'Authorization: Bearer $API_KEY'"
echo ""
