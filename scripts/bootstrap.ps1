param([switch]$DownloadModels)
$ErrorActionPreference = 'Stop'
Set-Location (Split-Path $PSScriptRoot -Parent)
if (-not (Test-Path -LiteralPath '.env')) { Copy-Item -LiteralPath '.env.example' -Destination '.env'; Write-Host 'Created .env. Set your local passwords before rerunning bootstrap.'; exit 1 }
if (-not (Get-Command docker -ErrorAction SilentlyContinue)) { throw 'Docker Desktop with Compose is required. Install it and start its Linux engine, then rerun this script.' }
function Run-Docker { & docker @args; if ($LASTEXITCODE -ne 0) { throw 'Docker command failed; see output above.' } }
Run-Docker compose up -d --wait db
Run-Docker compose build
Run-Docker compose run --rm bootstrap node scripts/bootstrap.mjs
if ($DownloadModels) { Run-Docker compose run --rm -e HF_HUB_OFFLINE=0 ml_worker python scripts/download_models.py }
Run-Docker compose run --rm seed python scripts/seed_data.py
Run-Docker compose up -d
Write-Host 'Open http://localhost:8080 and use DEMO_EMAIL / DEMO_PASSWORD from .env. Model inference readiness may take time; inspect /api/health/ready.'
