# Pinocchio Migration - Devnet Deployment Script (PowerShell)
# This script deploys the Pinocchio-based ARS programs to Solana devnet
# while preserving existing program IDs for backward compatibility

$ErrorActionPreference = "Stop"

# Configuration
$CLUSTER = "devnet"
$KEYPAIR_PATH = "$env:USERPROFILE\.config\solana\id.json"
$PROGRAM_DIR = ".\programs"
$TARGET_DIR = ".\target\deploy"

Write-Host "========================================" -ForegroundColor Blue
Write-Host "  ARS Pinocchio Migration - Devnet" -ForegroundColor Blue
Write-Host "========================================" -ForegroundColor Blue
Write-Host ""

# Check prerequisites
Write-Host "Checking prerequisites..." -ForegroundColor Yellow

if (-not (Get-Command solana -ErrorAction SilentlyContinue)) {
    Write-Host "Error: solana CLI not found" -ForegroundColor Red
    Write-Host "Install from: https://docs.solana.com/cli/install-solana-cli-tools"
    exit 1
}

if (-not (Get-Command cargo -ErrorAction SilentlyContinue)) {
    Write-Host "Error: cargo not found" -ForegroundColor Red
    Write-Host "Install Rust from: https://rustup.rs/"
    exit 1
}

if (-not (Test-Path $KEYPAIR_PATH)) {
    Write-Host "Error: Keypair not found at $KEYPAIR_PATH" -ForegroundColor Red
    Write-Host "Generate with: solana-keygen new"
    exit 1
}

Write-Host "✓ Prerequisites check passed" -ForegroundColor Green
Write-Host ""

# Set Solana cluster
Write-Host "Configuring Solana CLI..." -ForegroundColor Yellow
solana config set --url https://api.devnet.solana.com
solana config set --keypair $KEYPAIR_PATH

# Check balance
$BALANCE_OUTPUT = solana balance
$BALANCE = ($BALANCE_OUTPUT -split ' ')[0]
Write-Host "Current balance: $BALANCE SOL" -ForegroundColor Green

if ([double]$BALANCE -lt 5) {
    Write-Host "Warning: Low balance. Requesting airdrop..." -ForegroundColor Yellow
    try {
        solana airdrop 2
    } catch {
        Write-Host "Airdrop failed. Continue with existing balance." -ForegroundColor Yellow
    }
}

Write-Host ""

# Build programs
Write-Host "Building Pinocchio programs..." -ForegroundColor Yellow
Write-Host "This may take several minutes..." -ForegroundColor Blue

Push-Location $PROGRAM_DIR

# Build ars-core
Write-Host "Building ars-core..." -ForegroundColor Yellow
Push-Location ars-core
cargo build-sbf --release
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to build ars-core" -ForegroundColor Red
    Pop-Location
    Pop-Location
    exit 1
}
Write-Host "✓ ars-core built successfully" -ForegroundColor Green
Pop-Location

# Build ars-reserve
Write-Host "Building ars-reserve..." -ForegroundColor Yellow
Push-Location ars-reserve
cargo build-sbf --release
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to build ars-reserve" -ForegroundColor Red
    Pop-Location
    Pop-Location
    exit 1
}
Write-Host "✓ ars-reserve built successfully" -ForegroundColor Green
Pop-Location

# Build ars-token
Write-Host "Building ars-token..." -ForegroundColor Yellow
Push-Location ars-token
cargo build-sbf --release
if ($LASTEXITCODE -ne 0) {
    Write-Host "Error: Failed to build ars-token" -ForegroundColor Red
    Pop-Location
    Pop-Location
    exit 1
}
Write-Host "✓ ars-token built successfully" -ForegroundColor Green
Pop-Location

Pop-Location  # Back to root

Write-Host ""
Write-Host "All programs built successfully!" -ForegroundColor Green
Write-Host ""

# Verify binary sizes
Write-Host "Verifying binary sizes..." -ForegroundColor Yellow
$ARS_CORE_SIZE = (Get-Item "$TARGET_DIR\ars_core.so").Length
$ARS_RESERVE_SIZE = (Get-Item "$TARGET_DIR\ars_reserve.so").Length
$ARS_TOKEN_SIZE = (Get-Item "$TARGET_DIR\ars_token.so").Length

Write-Host "ars-core: $([math]::Round($ARS_CORE_SIZE / 1KB, 2)) KB" -ForegroundColor Green
Write-Host "ars-reserve: $([math]::Round($ARS_RESERVE_SIZE / 1KB, 2)) KB" -ForegroundColor Green
Write-Host "ars-token: $([math]::Round($ARS_TOKEN_SIZE / 1KB, 2)) KB" -ForegroundColor Green
Write-Host ""

# Deploy programs
Write-Host "Deploying programs to devnet..." -ForegroundColor Yellow
Write-Host ""

# Deploy ars-core
Write-Host "Deploying ars-core..." -ForegroundColor Yellow
solana program deploy `
    --program-id "$TARGET_DIR\ars_core-keypair.json" `
    "$TARGET_DIR\ars_core.so" `
    --url devnet

if ($LASTEXITCODE -eq 0) {
    $DEPLOYED_CORE_ID = solana-keygen pubkey "$TARGET_DIR\ars_core-keypair.json"
    Write-Host "✓ ars-core deployed successfully" -ForegroundColor Green
    Write-Host "Program ID: $DEPLOYED_CORE_ID" -ForegroundColor Blue
} else {
    Write-Host "Error: Failed to deploy ars-core" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Deploy ars-reserve
Write-Host "Deploying ars-reserve..." -ForegroundColor Yellow
solana program deploy `
    --program-id "$TARGET_DIR\ars_reserve-keypair.json" `
    "$TARGET_DIR\ars_reserve.so" `
    --url devnet

if ($LASTEXITCODE -eq 0) {
    $DEPLOYED_RESERVE_ID = solana-keygen pubkey "$TARGET_DIR\ars_reserve-keypair.json"
    Write-Host "✓ ars-reserve deployed successfully" -ForegroundColor Green
    Write-Host "Program ID: $DEPLOYED_RESERVE_ID" -ForegroundColor Blue
} else {
    Write-Host "Error: Failed to deploy ars-reserve" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Deploy ars-token
Write-Host "Deploying ars-token..." -ForegroundColor Yellow
solana program deploy `
    --program-id "$TARGET_DIR\ars_token-keypair.json" `
    "$TARGET_DIR\ars_token.so" `
    --url devnet

if ($LASTEXITCODE -eq 0) {
    $DEPLOYED_TOKEN_ID = solana-keygen pubkey "$TARGET_DIR\ars_token-keypair.json"
    Write-Host "✓ ars-token deployed successfully" -ForegroundColor Green
    Write-Host "Program ID: $DEPLOYED_TOKEN_ID" -ForegroundColor Blue
} else {
    Write-Host "Error: Failed to deploy ars-token" -ForegroundColor Red
    exit 1
}
Write-Host ""

# Verify deployments
Write-Host "Verifying deployments..." -ForegroundColor Yellow

foreach ($PROGRAM_ID in @($DEPLOYED_CORE_ID, $DEPLOYED_RESERVE_ID, $DEPLOYED_TOKEN_ID)) {
    try {
        solana program show $PROGRAM_ID --url devnet | Out-Null
        Write-Host "✓ $PROGRAM_ID verified" -ForegroundColor Green
    } catch {
        Write-Host "✗ $PROGRAM_ID verification failed" -ForegroundColor Red
    }
}

Write-Host ""

# Save deployment info
$TIMESTAMP = Get-Date -Format "yyyyMMdd-HHmmss"
$DEPLOYMENT_FILE = ".\deployment-devnet-$TIMESTAMP.json"

$DEPLOYER_PUBKEY = solana-keygen pubkey $KEYPAIR_PATH
$DEPLOYMENT_INFO = @{
    cluster = "devnet"
    timestamp = (Get-Date).ToUniversalTime().ToString("yyyy-MM-ddTHH:mm:ssZ")
    programs = @{
        "ars-core" = @{
            program_id = $DEPLOYED_CORE_ID
            binary_size = $ARS_CORE_SIZE
            path = "$TARGET_DIR\ars_core.so"
        }
        "ars-reserve" = @{
            program_id = $DEPLOYED_RESERVE_ID
            binary_size = $ARS_RESERVE_SIZE
            path = "$TARGET_DIR\ars_reserve.so"
        }
        "ars-token" = @{
            program_id = $DEPLOYED_TOKEN_ID
            binary_size = $ARS_TOKEN_SIZE
            path = "$TARGET_DIR\ars_token.so"
        }
    }
    deployer = $DEPLOYER_PUBKEY
}

$DEPLOYMENT_INFO | ConvertTo-Json -Depth 10 | Out-File -FilePath $DEPLOYMENT_FILE -Encoding UTF8

Write-Host "Deployment info saved to: $DEPLOYMENT_FILE" -ForegroundColor Green
Write-Host ""

# Run smoke tests
Write-Host "Running smoke tests..." -ForegroundColor Yellow
Write-Host "Testing program accessibility..." -ForegroundColor Blue

foreach ($PROGRAM_ID in @($DEPLOYED_CORE_ID, $DEPLOYED_RESERVE_ID, $DEPLOYED_TOKEN_ID)) {
    try {
        solana program show $PROGRAM_ID --url devnet | Out-Null
        Write-Host "✓ $PROGRAM_ID is accessible" -ForegroundColor Green
    } catch {
        Write-Host "✗ $PROGRAM_ID is not accessible" -ForegroundColor Red
    }
}

Write-Host ""

# Summary
Write-Host "========================================" -ForegroundColor Green
Write-Host "  Deployment Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Green
Write-Host ""
Write-Host "Deployed Programs:" -ForegroundColor Blue
Write-Host "  ars-core:    $DEPLOYED_CORE_ID" -ForegroundColor Green
Write-Host "  ars-reserve: $DEPLOYED_RESERVE_ID" -ForegroundColor Green
Write-Host "  ars-token:   $DEPLOYED_TOKEN_ID" -ForegroundColor Green
Write-Host ""
Write-Host "Next Steps:" -ForegroundColor Blue
Write-Host "  1. Update client configurations with new program IDs"
Write-Host "  2. Run integration tests against devnet"
Write-Host "  3. Monitor program performance and logs"
Write-Host "  4. Verify backward compatibility with existing clients"
Write-Host ""
Write-Host "Important:" -ForegroundColor Yellow
Write-Host "  - Keep the deployment info file for rollback reference"
Write-Host "  - Monitor the programs for 24-48 hours before mainnet deployment"
Write-Host "  - Ensure all tests pass before proceeding to mainnet"
Write-Host ""

exit 0
