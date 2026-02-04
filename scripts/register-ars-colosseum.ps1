# Register Agentic Reserve System (ARS) Project on Colosseum (PowerShell)

Write-Host "=== Registering Agentic Reserve System (ARS) Project ===" -ForegroundColor Cyan
Write-Host ""

# Load environment variables
if (Test-Path .env) {
    Get-Content .env | ForEach-Object {
        if ($_ -match '^([^#][^=]+)=(.*)$') {
            [Environment]::SetEnvironmentVariable($matches[1], $matches[2])
        }
    }
}

# API Configuration
$API_BASE = if ($env:COLOSSEUM_API_BASE) { $env:COLOSSEUM_API_BASE } else { "https://api.colosseum.org/v1" }
$SKILL_URL = "https://colosseum.com/skill.md"

# Project details
$projectData = @{
    name = "Agentic Reserve System"
    teamName = "ars-team"
    agentName = "ars-agent"
    agentId = "268"
    description = "The first Agent-First DeFi Protocol on Solana - an autonomous monetary coordination layer built exclusively for AI agents. Agentic Reserve System (ARS) enables agents to execute lending, borrowing, staking, prediction markets, yield farming, and liquidity provision autonomously through 8 core integrations: Helius (infrastructure), Kamino (lending), Meteora (liquidity), MagicBlock (performance), OpenClaw (orchestration), OpenRouter (AI), x402-PayAI (payments), and Solana Policy Institute (compliance)."
    repoLink = "https://github.com/protocoldaemon-sec/agentic-reserve-system.git"
    solanaIntegration = "ARS uses Solana as its core blockchain with 3 Anchor programs (~3,200 lines of Rust): ARS Core (governance via futarchy), ARS Reserve (vault management), and ARU Token (reserve unit minting). Integrates with Kamino Finance for lending/borrowing, Meteora Protocol for liquidity provision, Jupiter for swaps, and Pyth/Switchboard for oracles. Uses Helius for 99.99% uptime RPC, Helius Sender for 95%+ transaction landing rate, and MagicBlock Ephemeral Rollups for sub-100ms high-frequency execution. All operations are agent-exclusive with Ed25519 authentication and on-chain reputation tracking."
    technicalDemoLink = "https://ars-demo.vercel.app"
    presentationLink = "https://youtube.com/watch?v=ars-demo"
    skillUrl = $SKILL_URL
    tags = @("defi", "ai", "governance", "agent-first", "autonomous")
}

Write-Host "Project Details:" -ForegroundColor Yellow
$projectData | ConvertTo-Json -Depth 10
Write-Host ""

# Check if API key is set
if (-not $env:COLOSSEUM_API_KEY) {
    Write-Host "❌ Error: COLOSSEUM_API_KEY not set in .env file" -ForegroundColor Red
    Write-Host ""
    Write-Host "Please add to .env:" -ForegroundColor Yellow
    Write-Host "COLOSSEUM_API_KEY=your-api-key-here"
    exit 1
}

$headers = @{
    "Authorization" = "Bearer $env:COLOSSEUM_API_KEY"
    "Content-Type" = "application/json"
}

# Check if project already exists
Write-Host "Checking for existing project..." -ForegroundColor Yellow
try {
    $existingProject = Invoke-RestMethod -Uri "$API_BASE/my-project" -Headers $headers -Method Get -ErrorAction SilentlyContinue
    
    if ($existingProject) {
        Write-Host "✓ Project exists. Updating..." -ForegroundColor Green
        $response = Invoke-RestMethod -Uri "$API_BASE/my-project" -Headers $headers -Method Put -Body ($projectData | ConvertTo-Json -Depth 10)
    }
} catch {
    Write-Host "✓ Creating new project..." -ForegroundColor Green
    $response = Invoke-RestMethod -Uri "$API_BASE/my-project" -Headers $headers -Method Post -Body ($projectData | ConvertTo-Json -Depth 10)
}

Write-Host ""
Write-Host "Response:" -ForegroundColor Yellow
$response | ConvertTo-Json -Depth 10
Write-Host ""

# Check if successful
if ($response.error) {
    Write-Host "❌ Registration failed. Please check the error message above." -ForegroundColor Red
    exit 1
} else {
    Write-Host "✅ Project Registered/Updated Successfully!" -ForegroundColor Green
}

Write-Host ""
Write-Host "=== Next Steps ===" -ForegroundColor Cyan
Write-Host ""
Write-Host "1. Verify project on Colosseum dashboard"
Write-Host "2. Build and test your project"
Write-Host "3. Deploy to devnet"
Write-Host "4. Create demo video and upload to YouTube"
Write-Host "5. Update demo links:"
Write-Host "   - technicalDemoLink: Live demo URL"
Write-Host "   - presentationLink: YouTube video URL"
Write-Host "6. Post progress updates on forum"
Write-Host "7. Submit when ready for judges"
Write-Host ""
Write-Host "To update demo links later:" -ForegroundColor Yellow
Write-Host "  Edit this script and run again"
Write-Host ""
Write-Host "To submit when ready:" -ForegroundColor Yellow
Write-Host "  `$headers = @{ 'Authorization' = 'Bearer `$env:COLOSSEUM_API_KEY' }"
Write-Host "  Invoke-RestMethod -Uri '$API_BASE/my-project/submit' -Headers `$headers -Method Post"
Write-Host ""

