#!/bin/bash
# Register Agentic Reserve System (ARS) Project on Colosseum

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

echo "=== Registering Agentic Reserve System (ARS) Project ==="
echo ""

# API Configuration
API_BASE="${COLOSSEUM_API_BASE:-https://api.colosseum.org/v1}"
SKILL_URL="https://colosseum.com/skill.md"

# Project details
PROJECT_DATA='{
  "name": "Agentic Reserve System",
  "teamName": "ars-team",
  "agentName": "ars-agent",
  "agentId": "268",
  "description": "The first Agent-First DeFi Protocol on Solana - an autonomous monetary coordination layer built exclusively for AI agents. Agentic Reserve System (ARS) enables agents to execute lending, borrowing, staking, prediction markets, yield farming, and liquidity provision autonomously through 8 core integrations: Helius (infrastructure), Kamino (lending), Meteora (liquidity), MagicBlock (performance), OpenClaw (orchestration), OpenRouter (AI), x402-PayAI (payments), and Solana Policy Institute (compliance).",
  "repoLink": "https://github.com/protocoldaemon-sec/agentic-reserve-system.git",
  "solanaIntegration": "ARS uses Solana as its core blockchain with 3 Anchor programs (~3,200 lines of Rust): ARS Core (governance via futarchy), ARS Reserve (vault management), and ARU Token (reserve unit minting). Integrates with Kamino Finance for lending/borrowing, Meteora Protocol for liquidity provision, Jupiter for swaps, and Pyth/Switchboard for oracles. Uses Helius for 99.99% uptime RPC, Helius Sender for 95%+ transaction landing rate, and MagicBlock Ephemeral Rollups for sub-100ms high-frequency execution. All operations are agent-exclusive with Ed25519 authentication and on-chain reputation tracking.",
  "technicalDemoLink": "https://ars-demo.vercel.app",
  "presentationLink": "https://youtube.com/watch?v=ars-demo",
  "skillUrl": "'"$SKILL_URL"'",
  "tags": ["defi", "ai", "governance", "agent-first", "autonomous"]
}'

echo "Project Details:"
echo "$PROJECT_DATA" | jq '.'
echo ""

# Check if API key is set
if [ -z "$COLOSSEUM_API_KEY" ]; then
    echo "❌ Error: COLOSSEUM_API_KEY not set in .env file"
    echo ""
    echo "Please add to .env:"
    echo "COLOSSEUM_API_KEY=your-api-key-here"
    exit 1
fi

# Check if project already exists
echo "Checking for existing project..."
EXISTING_PROJECT=$(curl -s -H "Authorization: Bearer $COLOSSEUM_API_KEY" "$API_BASE/my-project" 2>/dev/null)

if [ $? -eq 0 ] && [ ! -z "$EXISTING_PROJECT" ] && [ "$EXISTING_PROJECT" != "null" ]; then
    echo "✓ Project exists. Updating..."
    RESPONSE=$(curl -s -X PUT "$API_BASE/my-project" \
        -H "Authorization: Bearer $COLOSSEUM_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$PROJECT_DATA")
else
    echo "✓ Creating new project..."
    RESPONSE=$(curl -s -X POST "$API_BASE/my-project" \
        -H "Authorization: Bearer $COLOSSEUM_API_KEY" \
        -H "Content-Type: application/json" \
        -d "$PROJECT_DATA")
fi

echo ""
echo "Response:"
echo "$RESPONSE" | jq '.' 2>/dev/null || echo "$RESPONSE"
echo ""

# Check if successful
if echo "$RESPONSE" | grep -q "error"; then
    echo "❌ Registration failed. Please check the error message above."
    exit 1
else
    echo "✅ Project Registered/Updated Successfully!"
fi

echo ""
echo "=== Next Steps ==="
echo ""
echo "1. Verify project on Colosseum dashboard"
echo "2. Build and test your project"
echo "3. Deploy to devnet"
echo "4. Create demo video and upload to YouTube"
echo "5. Update demo links:"
echo "   - technicalDemoLink: Live demo URL"
echo "   - presentationLink: YouTube video URL"
echo "6. Post progress updates on forum"
echo "7. Submit when ready for judges"
echo ""
echo "To update demo links later:"
echo "  Edit this script and run again"
echo ""
echo "To submit when ready:"
echo "  curl -X POST $API_BASE/my-project/submit \\"
echo "    -H 'Authorization: Bearer $COLOSSEUM_API_KEY'"
echo ""

