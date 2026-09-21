# Plan2Field AI

**Field evidence → semantic activity matching → reviewer approval → persisted actuals.**

SIH26122 · Oil India Limited challenge · independent prototype. All included project schedules, reports and historical records are **SYNTHETIC DEMO DATA**, not Oil India internal records. This is not production certification or a selection guarantee.

## What is implemented

The [enterprise evidence update](docs/enterprise-evidence.md) documents six-discipline ingestion, explicit unmatched/low-confidence review, traceability, Institutional Memory, dashboard filters and the versioned P6/SAP integration export contract.

- PostgreSQL/pgvector schedule versions, protected baselines, asynchronous reports/jobs, review proposals, immutable accepted events and audit.
- Local Sentence-Transformers bi-encoder retrieval, CrossEncoder reranking and engineering identifier/operation gates. Extraction uses the visible `deterministic-v1` English vocabulary provider.
- Transactional approvals with activity/proposal version checks, stable request keys, component deduplication, weighted physical progress and explicit corrections.
- React project overview, table/Gantt, report submission, candidate review/diff, evidence replay, audit, imports and historical comparables.
- IndexedDB pending reports with user isolation, stable idempotency keys, offline shell caching and explicit sync.
- Bounded CSV/XER/XML schedule adapters, mapped CSV/XLSX reports, local Whisper audio and Tesseract PNG/JPEG OCR adapters.
- JSON/CSV **Update proposal exports**. **External scheduling system not connected**; no external success is simulated.

## Verification status

The frontend and backend compile. Progress, extraction/parser and local semantic smoke checks ran successfully. A six-report synthetic held-out evaluation ran with real models and explicitly **in-memory** retrieval. Isolated desktop/mobile browser tests use mocked API fixtures.

The configured Neon PostgreSQL database has been initialized with pgvector, protected baselines and restricted runtime roles. Live cloud schema/role and approval integration suites passed, including concurrency, corrections and rollback. Docker startup and voice/OCR remain unverified. See [implementation status](docs/implementation-status.md) for exact results and limitations.

## Cloud database development

The private root `.env` contains the owner `DATABASE_URL` and restricted `API_DATABASE_URL` / `WORKER_DATABASE_URL`. Do not overwrite it with `.env.example`. The database is initialized and the synthetic schedule/reports are seeded.

Run each service from the repository root in a separate terminal:

```powershell
.\.venv\Scripts\python.exe scripts/run_local.py api
.\.venv\Scripts\python.exe scripts/run_local.py worker
.\.venv\Scripts\python.exe scripts/run_local.py frontend
```

Open [http://localhost:8080](http://localhost:8080), using `DEMO_EMAIL` and `DEMO_PASSWORD` from `.env`. The API listens on port 3001; Vite proxies `/api`. This workspace sets `FRONTEND_PORT=8080` and `APP_ORIGIN=http://localhost:8080` because port 5173 is used by another project. The worker uses locally cached semantic models and the restricted database role.

Cloud verification commands:

```powershell
# Creates and drops only a randomly named test database on the same server.
Push-Location backend
node --env-file=../.env scripts/test-database.mjs
Pop-Location
# Checks the seeded, unapproved demo reports using real models and pgvector.
.\.venv\Scripts\python.exe scripts/cloud_verify.py
# Run after all three development services are ready; uses installed Edge.
node --env-file=.env tests/cloud-smoke.mjs
```

The seed verifier expects pristine demo actuals; run it before approving demo reports. Vector retrieval is exact cosine search for this small fixture; no approximate vector index is required or claimed.

## Architecture

```text
React / Nginx ──same-origin REST── Express / TypeScript
                                      │
                        PostgreSQL + pgvector + job leases
                                      │
                           Python local inference worker
                                      │
                         Mounted uploads and model cache
```

See [architecture](docs/architecture.md), [data dictionary](docs/data-dictionary.md), [OpenAPI](backend/openapi.yaml) and [security/limitations](docs/security-and-limitations.md).

## Windows 11 local startup

Prerequisites: Docker Desktop with its Linux container engine running, Compose v2, and enough disk/RAM for PostgreSQL, CPU Torch and local model weights. Start with approximately 8 GB available RAM and several GB of free disk as a planning allowance, **not a measured minimum**. First-run images/packages/models require public internet downloads. No paid API key is needed.

From PowerShell in this repository:

```powershell
Copy-Item .env.example .env
# Edit .env: set POSTGRES_PASSWORD, API_DB_PASSWORD, WORKER_DB_PASSWORD,
# DEMO_EMAIL and DEMO_PASSWORD. Use at least 12 characters for passwords.
.\scripts\bootstrap.ps1 -DownloadModels
```

The script starts PostgreSQL, builds images, configures runtime role passwords, explicitly downloads the pinned models, seeds the demo with real embeddings, and starts services. Docker commands could not be tested on this machine; they are not claimed as a verified clean startup.

Open **[http://localhost:8080](http://localhost:8080)**. Sign in using `DEMO_EMAIL` and `DEMO_PASSWORD` from `.env`. No credential is bundled in the frontend. Accounts are seeded only with `LOCAL_DEMO=true`. Reseeding preserves an existing account password.

Git Bash alternative:

```bash
cp .env.example .env
# Edit local credentials first.
bash scripts/bootstrap.sh --download-models
```

### Individual Docker steps

```powershell
docker compose up -d --wait db
# schema.sql and roles.sql run only on a fresh database volume.
docker compose build
docker compose run --rm bootstrap node scripts/bootstrap.mjs
docker compose run --rm -e HF_HUB_OFFLINE=0 ml_worker python scripts/download_models.py
docker compose run --rm seed python scripts/seed_data.py
docker compose up -d
docker compose logs --tail 100 backend ml_worker
```

Health: `/api/health/live` checks the API; `/api/health/ready` separately reports database, worker and semantic model availability. A 503 readiness response is expected when weights or the worker are unavailable. Whisper/OCR availability is checked when those sources are processed.

### Migration, safe reset and stop

Fresh databases apply `database/schema.sql` through the image initialization directory. `database/migrations/001_initial.sql` is identical. The initial migration is intentionally not rerunnable against an existing initialized database; later schema changes need numbered migrations.

```powershell
# Create a fresh demo schedule version; preserve all old baselines/ledger records.
docker compose run --rm seed python scripts/reset_demo.py --project-code OIL-DEMO-01
# Stop without deleting persistent data.
docker compose down
```

Do not use `down -v` for normal shutdown. The reset script only accepts the known synthetic demo project.

## Three core scenarios

1. **Clean start:** submit `Line twenty-four spool erection started on 12 September 2026 in the north area.` Review the model-ranked erection candidate and approve. Actual start should become 12 September; baseline stays 10 September; start variance is **+2 calendar days**.
2. **Ambiguity:** submit `Spool erection started in the north area on 12 September 2026.` Supply the full line identifier and select the correct candidate. Save/revalidate before approval. There is no actual update before approval.
3. **Partial:** submit `On line 24, spools S01, S02 and S03 are erected. Three out of ten are complete in total as of 15 September 2026.` Approve **3/10 = 30%**; finish remains null. Repeating the same components cannot increase quantity.

Full [four-minute demo script](docs/demo-script.md). Routing uses actual scores with provisional thresholds; a clean example may still require review. No score is represented as a calibrated probability.

## Tests and evaluation

Verified local build/unit commands (Node 24.14.0, Python 3.13.9 on this workspace):

```powershell
npm ci
npm --prefix backend ci
npm --prefix frontend ci
npm --prefix backend run build
npm --prefix frontend run build
npm --prefix backend test
npm --prefix frontend test
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install uv==0.9.5
.\.venv\Scripts\uv.exe pip install --python .venv/Scripts/python.exe -r ml_worker/requirements.in --torch-backend cpu
.\.venv\Scripts\python.exe -m pytest ml_worker/tests -m "not models" -p no:cacheprovider
```

`requirements.lock` pins the Linux/Python 3.12 container environment, including the CPU Torch index. The local Windows environment was resolved separately from `requirements.in`. It is not claimed to use the Linux lock unchanged.

Explicit local model download and real model smoke/evaluation:

```powershell
.\.venv\Scripts\python.exe ml_worker/scripts/download_models.py --semantic-only
$env:RUN_MODEL_TESTS='1'
$env:HF_HUB_OFFLINE='1'
.\.venv\Scripts\python.exe -m pytest ml_worker/tests/test_models.py -p no:cacheprovider
.\.venv\Scripts\python.exe ml_worker/scripts/evaluate_matching.py --fixture-only --output docs/local-model-evaluation.json
```

The default evaluation path uses real pgvector; `--fixture-only` is an explicit evaluation option and is never used by the application:

```powershell
docker compose run --rm ml_worker python scripts/evaluate_matching.py
docker compose run --rm -e RUN_MODEL_TESTS=1 ml_worker python -m pytest tests/test_models.py
docker compose run --rm bootstrap node scripts/test-database.mjs
```

The integration runner creates and removes only a randomly named `p2f_test_…` database. It checks grants, cross-project constraints, request-key conflicts, simultaneous approvals, stale versions, component correction, transaction rollback and HTTP authorization. It requires the initialized local cluster and runtime role passwords.

Real browser workflows require a running seeded stack, model readiness and demo credentials in the shell:

```powershell
cd frontend
npx playwright install chromium
$env:RUN_REAL_E2E='1'
$env:DEMO_PASSWORD='the password configured in .env'
npm run test:e2e
```

For isolated UI layout checks only, start `npm --prefix frontend run preview -- --port 4173`, then `node tests/ui-smoke.mjs` from the repository root. That test uses installed Edge and clearly mocked API fixtures. It is not real-stack verification.

## Formats, model mode and limitations

See [parser support](docs/parser-support.md). XER/XML require explicit measurement mapping fields and are limited dialect adapters; arbitrary vendor exports are not guaranteed. English printed diary OCR is review-only evidence; PDF, handwriting reliability and macros are not supported. No general-purpose local LLM is configured. Whisper transcription and OCR could not be exercised here because their external binaries and voice model were absent.

There is no CPM recalculation, working-day variance, duration forecasting, production-scale retrieval benchmark, calibrated model probability or live P6/MS Project connector. Aggregate progress cannot guarantee semantic deduplication; reconciliation is explicit. Synthetic history is excluded from operational comparables by default.
