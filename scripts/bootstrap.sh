#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
if [ ! -f .env ]; then cp .env.example .env; echo 'Created .env; configure passwords before rerunning.'; exit 1; fi
docker compose up -d --wait db
docker compose build
docker compose run --rm bootstrap node scripts/bootstrap.mjs
if [ "${1:-}" = '--download-models' ]; then docker compose run --rm -e HF_HUB_OFFLINE=0 ml_worker python scripts/download_models.py; fi
docker compose run --rm seed python scripts/seed_data.py
docker compose up -d
echo 'Local application: http://localhost:8080'
