#!/bin/bash
# Update spec files from ICB to ARS

files=(
    ".kiro/specs/agentic-reserve-system/requirements.md"
    ".kiro/specs/agentic-reserve-system/design.md"
    ".kiro/specs/agentic-reserve-system/tasks.md"
)

for file in "${files[@]}"; do
    if [ -f "$file" ]; then
        echo "Updating $file..."
        
        # Create backup
        cp "$file" "$file.bak"
        
        # Replace all ICB references
        sed -i 's/Internet Central Bank (ICB)/Agentic Reserve System (ARS)/g' "$file"
        sed -i 's/Internet Central Bank/Agentic Reserve System/g' "$file"
        sed -i 's/\bICB\b/ARS/g' "$file"
        
        # Replace ICU token references to ARU
        sed -i 's/\$ICU/$ARU/g' "$file"
        sed -i 's/\bICU\b/ARU/g' "$file"
        
        # Replace program names
        sed -i 's/icb-protocol/ars-protocol/g' "$file"
        sed -i 's/icb_core/ars_core/g' "$file"
        sed -i 's/icb-core/ars-core/g' "$file"
        sed -i 's/icb_reserve/ars_reserve/g' "$file"
        sed -i 's/icb-reserve/ars-reserve/g' "$file"
        sed -i 's/icb_token/ars_token/g' "$file"
        sed -i 's/icb-token/ars-token/g' "$file"
        sed -i 's/ICBClient/ARSClient/g' "$file"
        sed -i 's/ICBAgent/ARSAgent/g' "$file"
        sed -i 's/@icb\//@ars\//g' "$file"
        sed -i 's/agent\.icb\./agent.ars./g' "$file"
        
        # Replace branding
        sed -i 's/ICB branding/ARS branding/g' "$file"
        sed -i 's/ICB protocol/ARS protocol/g' "$file"
        sed -i 's/ICB integration/ARS integration/g' "$file"
        sed -i 's/ICB Agent/ARS Agent/g' "$file"
        sed -i 's/ICB ecosystem/ARS ecosystem/g' "$file"
        sed -i 's/ICB data/ARS data/g' "$file"
        
        # Remove backup
        rm "$file.bak"
        
        echo "✓ Updated $file"
    else
        echo "✗ File not found: $file"
    fi
done

echo ""
echo "All spec files updated from ICB to ARS!"
