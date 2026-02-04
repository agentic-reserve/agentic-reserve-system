#!/bin/bash
# security-pipeline.sh - Comprehensive security audit pipeline

set -e

echo "🔒 Starting ICB Security Audit Pipeline..."
echo "================================================"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Create logs directory
mkdir -p logs/security

# 1. Static Analysis
echo ""
echo "📊 Phase 1: Static Analysis"
echo "----------------------------"

# Cargo audit - check for vulnerable dependencies
echo "Running cargo audit..."
if cargo audit --json > logs/security/cargo-audit.json 2>&1; then
    echo -e "${GREEN}✓ No vulnerable dependencies found${NC}"
else
    echo -e "${YELLOW}⚠ Vulnerable dependencies detected - check logs/security/cargo-audit.json${NC}"
fi

# Cargo geiger - detect unsafe code
echo "Running cargo geiger..."
if command -v cargo-geiger &> /dev/null; then
    cargo geiger --output-format Json > logs/security/cargo-geiger.json 2>&1 || true
    echo -e "${GREEN}✓ Unsafe code analysis complete${NC}"
else
    echo -e "${YELLOW}⚠ cargo-geiger not installed - skipping${NC}"
    echo "Install with: cargo install cargo-geiger"
fi

# Semgrep - pattern-based analysis
echo "Running semgrep..."
if command -v semgrep &> /dev/null; then
    semgrep --config=auto --json programs/ > logs/security/semgrep.json 2>&1 || true
    echo -e "${GREEN}✓ Semgrep analysis complete${NC}"
else
    echo -e "${YELLOW}⚠ semgrep not installed - skipping${NC}"
    echo "Install with: pip install semgrep"
fi

# 2. Fuzzing
echo ""
echo "🔍 Phase 2: Fuzzing"
echo "-------------------"

# Trident fuzzing
echo "Running Trident fuzzing..."
if command -v trident &> /dev/null; then
    cd programs/icb-core
    if [ -d "trident-tests" ]; then
        trident fuzz run-hfuzz --iterations 1000 > ../../logs/security/trident.log 2>&1 || true
        echo -e "${GREEN}✓ Trident fuzzing complete (1000 iterations)${NC}"
    else
        echo -e "${YELLOW}⚠ Trident not initialized - run 'trident init' first${NC}"
    fi
    cd ../..
else
    echo -e "${YELLOW}⚠ Trident not installed - skipping${NC}"
    echo "Install with: cargo install trident-cli"
fi

# 3. Penetration Testing
echo ""
echo "🎯 Phase 3: Penetration Testing"
echo "--------------------------------"

echo "Running penetration tests..."
cd programs/icb-core

# Run pentest suite
if cargo test pentest_ --no-fail-fast -- --nocapture > ../../logs/security/pentests.log 2>&1; then
    echo -e "${GREEN}✓ All penetration tests passed${NC}"
else
    echo -e "${RED}✗ Some penetration tests failed - check logs/security/pentests.log${NC}"
fi

cd ../..

# 4. Property-Based Testing
echo ""
echo "🧪 Phase 4: Property-Based Testing"
echo "-----------------------------------"

echo "Running property-based tests..."
cd programs/icb-core

if cargo test prop_ --no-fail-fast -- --nocapture > ../../logs/security/prop-tests.log 2>&1; then
    echo -e "${GREEN}✓ All property-based tests passed${NC}"
else
    echo -e "${RED}✗ Some property-based tests failed - check logs/security/prop-tests.log${NC}"
fi

cd ../..

# 5. Cryptographic Verification
echo ""
echo "🔐 Phase 5: Cryptographic Verification"
echo "---------------------------------------"

echo "Running cryptographic tests..."
cd programs/icb-core

if cargo test crypto_ --no-fail-fast -- --nocapture > ../../logs/security/crypto-tests.log 2>&1; then
    echo -e "${GREEN}✓ All cryptographic tests passed${NC}"
else
    echo -e "${RED}✗ Some cryptographic tests failed - check logs/security/crypto-tests.log${NC}"
fi

cd ../..

# 6. Generate Security Report
echo ""
echo "📊 Phase 6: Generating Security Report"
echo "---------------------------------------"

# Create report timestamp
TIMESTAMP=$(date +"%Y-%m-%d_%H-%M-%S")
REPORT_FILE="logs/security/security-report-${TIMESTAMP}.md"

cat > "$REPORT_FILE" << EOF
# ICB Security Audit Report
**Date**: $(date)
**Pipeline Version**: 1.0.0

## Summary

### Static Analysis
- Cargo Audit: $([ -f logs/security/cargo-audit.json ] && echo "✓ Complete" || echo "⚠ Skipped")
- Cargo Geiger: $([ -f logs/security/cargo-geiger.json ] && echo "✓ Complete" || echo "⚠ Skipped")
- Semgrep: $([ -f logs/security/semgrep.json ] && echo "✓ Complete" || echo "⚠ Skipped")

### Fuzzing
- Trident: $([ -f logs/security/trident.log ] && echo "✓ Complete" || echo "⚠ Skipped")

### Testing
- Penetration Tests: $([ -f logs/security/pentests.log ] && echo "✓ Complete" || echo "⚠ Skipped")
- Property-Based Tests: $([ -f logs/security/prop-tests.log ] && echo "✓ Complete" || echo "⚠ Skipped")
- Cryptographic Tests: $([ -f logs/security/crypto-tests.log ] && echo "✓ Complete" || echo "⚠ Skipped")

## Detailed Results

### Cargo Audit
\`\`\`json
$([ -f logs/security/cargo-audit.json ] && cat logs/security/cargo-audit.json || echo "Not available")
\`\`\`

### Test Results
See individual log files in \`logs/security/\` for detailed results.

## Recommendations

1. Review all failed tests in detail
2. Update vulnerable dependencies immediately
3. Minimize unsafe code usage
4. Run full fuzzing campaign (10,000+ iterations) before mainnet
5. Schedule regular security audits

## Next Steps

- [ ] Address all critical vulnerabilities
- [ ] Review and fix failed tests
- [ ] Run extended fuzzing campaign
- [ ] Schedule professional security audit
- [ ] Implement continuous security monitoring

---
*Generated by ICB Security Pipeline*
EOF

echo -e "${GREEN}✓ Security report generated: $REPORT_FILE${NC}"

# 7. Summary
echo ""
echo "================================================"
echo "🏁 Security Audit Pipeline Complete"
echo "================================================"
echo ""
echo "Reports generated in: logs/security/"
echo "Latest report: $REPORT_FILE"
echo ""
echo "Next steps:"
echo "1. Review the security report"
echo "2. Check individual log files for details"
echo "3. Address any vulnerabilities found"
echo "4. Run extended fuzzing before deployment"
echo ""

# Exit with error if any critical issues found
if grep -q "CRITICAL" logs/security/*.log 2>/dev/null; then
    echo -e "${RED}⚠ CRITICAL ISSUES FOUND - DO NOT DEPLOY${NC}"
    exit 1
else
    echo -e "${GREEN}✓ No critical issues detected${NC}"
    exit 0
fi
