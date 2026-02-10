#!/bin/bash

echo "=== ARS Protocol - Build Information ==="
echo ""

DEPLOY_DIR="target/deploy"

echo "✅ Programs built successfully!"
echo ""
echo "📁 Location: $DEPLOY_DIR"
echo ""

echo "Program binaries (.so):"
ls -lh "$DEPLOY_DIR"/*.so 2>/dev/null | awk '{print "   ✓ " $9 " (" $5 ")"}' || echo "   No .so files found"
echo ""

echo "Program metadata (.json):"
ls -lh "$DEPLOY_DIR"/*.json 2>/dev/null | awk '{print "   ✓ " $9 " (" $5 ")"}' || echo "   No .json files found"
echo ""

echo "Keypairs (-keypair.json):"
if ls "$DEPLOY_DIR"/*-keypair.json 1> /dev/null 2>&1; then
    ls -lh "$DEPLOY_DIR"/*-keypair.json | awk '{print "   ✓ " $9 " (" $5 ")"}'
else
    echo "   ⚠️  No keypairs yet (will be generated during deployment)"
fi
echo ""

echo "==================================="
echo ""
echo "📋 What's Built:"
echo ""
echo "   • ars-core (9 instructions)"
echo "     - Admin transfer, Agent registration"
echo "     - Byzantine consensus, Quadratic voting"
echo "     - Circuit breaker, Slashing"
echo ""
echo "   • ars-reserve (4 instructions)"
echo "     - Multi-asset vault, VHR monitoring"
echo "     - Deposit/withdraw, Rebalancing"
echo ""
echo "   • ars-token (4 instructions)"
echo "     - Epoch-based supply control"
echo "     - Mint/burn with caps, Epoch transitions"
echo ""
echo "==================================="
echo ""
echo "🚀 Ready to Deploy!"
echo ""
echo "   1. Get devnet SOL:"
echo "      solana airdrop 2 --url devnet"
echo ""
echo "   2. Deploy programs:"
echo "      anchor deploy --provider.cluster devnet"
echo ""
echo "   3. Anchor will show your program IDs"
echo ""
echo "==================================="
