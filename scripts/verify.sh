#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
npm --prefix backend run build
npm --prefix backend test
npm --prefix frontend run build
npm --prefix frontend test
docker compose run --rm ml_worker python -m pytest tests -m 'not database'
docker compose run --rm -e RUN_MODEL_TESTS=1 ml_worker python -m pytest tests/test_models.py
echo 'For database integration and browser scenarios, see README test commands.'
