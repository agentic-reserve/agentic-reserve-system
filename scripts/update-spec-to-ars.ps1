# Update spec files from ICB to ARS
# This script updates all references in requirements.md, design.md, and tasks.md

$files = @(
    ".kiro/specs/agentic-reserve-system/requirements.md",
    ".kiro/specs/agentic-reserve-system/design.md",
    ".kiro/specs/agentic-reserve-system/tasks.md"
)

foreach ($file in $files) {
    if (Test-Path $file) {
        Write-Host "Updating $file..."
        
        $content = Get-Content $file -Raw
        
        # Replace all ICB references
        $content = $content -replace 'Internet Central Bank \(ICB\)', 'Agentic Reserve System (ARS)'
        $content = $content -replace 'Internet Central Bank', 'Agentic Reserve System'
        $content = $content -replace '\bICB\b', 'ARS'
        
        # Replace ICU token references to ARU
        $content = $content -replace '\$ICU', '$ARU'
        $content = $content -replace '\bICU\b', 'ARU'
        
        # Replace program names
        $content = $content -replace 'icb-protocol', 'ars-protocol'
        $content = $content -replace 'icb_core', 'ars_core'
        $content = $content -replace 'icb-core', 'ars-core'
        $content = $content -replace 'icb_reserve', 'ars_reserve'
        $content = $content -replace 'icb-reserve', 'ars-reserve'
        $content = $content -replace 'icb_token', 'ars_token'
        $content = $content -replace 'icb-token', 'ars-token'
        $content = $content -replace 'ICBClient', 'ARSClient'
        $content = $content -replace 'ICBAgent', 'ARSAgent'
        $content = $content -replace '@icb/', '@ars/'
        $content = $content -replace 'agent\.icb\.', 'agent.ars.'
        
        # Replace branding
        $content = $content -replace 'ICB branding', 'ARS branding'
        $content = $content -replace 'ICB protocol', 'ARS protocol'
        $content = $content -replace 'ICB integration', 'ARS integration'
        $content = $content -replace 'ICB Agent', 'ARS Agent'
        $content = $content -replace 'ICB ecosystem', 'ARS ecosystem'
        $content = $content -replace 'ICB data', 'ARS data'
        
        # Save updated content
        Set-Content -Path $file -Value $content -NoNewline
        
        Write-Host "✓ Updated $file"
    } else {
        Write-Host "✗ File not found: $file"
    }
}

Write-Host "`nAll spec files updated from ICB to ARS!"
