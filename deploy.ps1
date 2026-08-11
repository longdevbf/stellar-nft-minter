# Test -> build -> deploy -> doi RPC ingest -> doc lai state de xac nhan.
#
# RPC testnet cong cong dung sau load balancer gom nhieu node ingest lech nhau
# (do duoc toi 9 ledger, ~45s). Hau qua la ba loi transient khac nhau, cung mot
# goc re, deu tu het sau vai lan thu:
#   - "Contract not found"      : node chua thay contract vua deploy
#   - "Storage, MissingValue"   : thay contract nhung chua thay instance entry
#   - "TxBadSeq"                : doc phai sequence cu cua tai khoan
# Script nay thu lai dung ba loai do va bao ngay voi bat ky loi nao khac.

param(
    [string]$Identity   = "quang",
    [string]$Network    = "testnet",
    [string]$Alias      = "nft_minter",
    [string]$BaseUri    = "https://gateway.pinata.cloud/ipfs/",
    [string]$Name       = "Stellar Mints",
    [string]$Symbol     = "SMINT",
    [int]$MaxSupply     = 100,
    [int]$MaxAttempts   = 20
)

# Phai la Continue, KHONG duoc la Stop: PowerShell 5.1 boc stderr cua native exe
# thanh ErrorRecord (NativeCommandError), voi Stop se throw ca khi exit code 0.
# Ta kiem tra $LASTEXITCODE thu cong o tung buoc.
$ErrorActionPreference = "Continue"
$env:Path += ";C:\Program Files (x86)\Stellar CLI"
Set-Location $PSScriptRoot

$TRANSIENT = "Contract not found|MissingValue|TxBadSeq"
$errFile = Join-Path $env:TEMP "stellar-deploy-err.txt"

function Invoke-WithRetry {
    param([scriptblock]$Action, [string]$Label)

    for ($i = 1; $i -le $MaxAttempts; $i++) {
        $out = & $Action 2>$errFile
        if ($LASTEXITCODE -eq 0) {
            if ($i -gt 1) { Write-Host "    ($Label thanh cong o lan $i)" -ForegroundColor DarkGray }
            return $out
        }
        $err = if (Test-Path $errFile) { Get-Content $errFile -Raw } else { "" }
        if ($err -notmatch $TRANSIENT) {
            Write-Host $err -ForegroundColor Red
            throw "$Label that bai vi loi khong phai transient - dung retry."
        }
        Write-Host "    Lan ${i}: node con tut lai, thu lai sau 5s..." -ForegroundColor Yellow
        Start-Sleep -Seconds 5
    }
    throw "$Label van that bai sau $MaxAttempts lan thu."
}

Write-Host "[1/5] Test..." -ForegroundColor Cyan
cargo test --quiet
if ($LASTEXITCODE -ne 0) { throw "cargo test that bai" }

Write-Host "[2/5] Build Wasm..." -ForegroundColor Cyan
stellar contract build
if ($LASTEXITCODE -ne 0) { throw "stellar contract build that bai" }

Write-Host "[3/5] Deploy..." -ForegroundColor Cyan
$contractId = Invoke-WithRetry -Label "deploy" -Action {
    stellar contract deploy `
        --wasm "target\wasm32v1-none\release\nft_minter.wasm" `
        --source $Identity --network $Network --no-cache `
        -- --base_uri $BaseUri --name $Name --symbol $Symbol --max_supply $MaxSupply |
        Select-Object -Last 1
}
$contractId = ($contractId | Select-Object -Last 1).ToString().Trim()
Write-Host "    Contract ID: $contractId" -ForegroundColor Green

Write-Host "[4/5] Gan alias '$Alias'..." -ForegroundColor Cyan
stellar contract alias add $Alias --id $contractId --network $Network --overwrite
if ($LASTEXITCODE -ne 0) { throw "gan alias that bai" }

Write-Host "[5/5] Doc lai state de xac nhan contract song..." -ForegroundColor Cyan
$readName = Invoke-WithRetry -Label "doc name" -Action {
    stellar contract invoke --id $contractId --source $Identity `
        --network $Network --no-cache -- name
}
Write-Host "    name = $readName" -ForegroundColor Green

Write-Host ""
Write-Host "Xong." -ForegroundColor Green
Write-Host "  Contract : $contractId"
Write-Host "  Explorer : https://stellar.expert/explorer/$Network/contract/$contractId"
Write-Host ""
Write-Host "  Nho cap nhat NEXT_PUBLIC_CONTRACT_ID trong web\.env.local" -ForegroundColor Yellow
